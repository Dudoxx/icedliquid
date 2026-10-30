/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Greedy text generation over the LFM3 ONNX decoder step: chunked prefill, one-token decode, honest timings.
 * @status    feature-local
 */
import type { InferenceSession } from 'onnxruntime-web/webgpu';

import { DecoderStep, disposeOutput, prefill, type MediaFeeds, type StepOutput, type TensorCtor, type TextModelConfig } from './decoder-step';
import { WebgpuEngineError, type WebgpuFirstTokenDiagnostics } from './protocol';
import { greedy, lastRowScores } from './sampling';
import type { ChatTokenizer } from './tokenizer';

// The worker imports these from here (ort-worker.ts); they now live with the step.
export { cacheInputNames, readTextModelConfig, type TextModelConfig } from './decoder-step';

export interface GenerateOptions {
  promptIds: readonly number[];
  maxTokens: number;
  prefillChunkTokens: number;
  /** performance.now() when the worker received the request. */
  t0: number;
  isAborted: () => boolean;
  onToken: (text: string, tMs: number) => void;
  /** Media rows at their placeholders (image/audio/video to text); text_to_text passes none. */
  media?: MediaFeeds | undefined;
  /**
   * Opt-in diagnostics: softmax stats of the FIRST step only (the token right after prefill).
   * Absent = no softmax, no extra read of the logits.
   */
  onFirstStep?: ((stats: WebgpuFirstTokenDiagnostics) => void) | undefined;
}

export interface GenerateResult {
  text: string;
  prompt_tokens: number;
  completion_tokens: number;
  ttfc_ms: number | null;
  ttft_ms: number | null;
  last_chunk_ms: number | null;
}

const THINK_PREFIX = /^\s*<think>\s*<\/think>\s*/;
const THINK_MARKER = '<think></think>';

/** Port of the mlx-vlm strip_think step: drop the leading empty think block. */
export function stripThink(text: string): string {
  return text.replace(THINK_PREFIX, '');
}

/** Port of bench/timing.py has_real_text: more than a (possibly partial) empty think marker. */
export function hasRealText(raw: string): boolean {
  const rest = stripThink(raw).replace(/\s/g, '');
  return rest.length > 0 && !THINK_MARKER.startsWith(rest);
}

const OOM_RE = /out of memory|OOM|allocation failed/i;
const DEVICE_LOST_RE = /device.{0,20}lost|lost.{0,20}device/i;
/** ORT node-placement text (same lines sessions.ts watches during create). */
const CPU_FALLBACK_RE =
  /not assigned to the preferred execution providers|fallback to CPU EP has been explicitly disabled|assigned to the default CPU EP/i;
/** A model or preprocessing file the route answered 404 for. */
const MISSING_FILE_RE = /\b404\b/;

/**
 * Any failure of a generate request → the engine code the UI shows (invariant 2, never a silent
 * fallback): engine errors pass through; OOM, DEVICE_LOST, CPU_FALLBACK and MISSING_GRAPH are read
 * from the runtime text; anything else is LOAD_FAILED with the original message.
 */
export function mapRunError(error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (OOM_RE.test(message)) return new WebgpuEngineError('OOM', message);
  if (DEVICE_LOST_RE.test(message)) return new WebgpuEngineError('DEVICE_LOST', message);
  if (CPU_FALLBACK_RE.test(message)) return new WebgpuEngineError('CPU_FALLBACK', message);
  if (MISSING_FILE_RE.test(message)) return new WebgpuEngineError('MISSING_GRAPH', message);
  return new WebgpuEngineError('LOAD_FAILED', message);
}

/** Greedy id from a step output (or -1 when there was none); the output is always disposed. */
async function greedyOf(out: StepOutput | null): Promise<number> {
  if (!out) return -1;
  try {
    return await greedy(out.logits);
  } finally {
    disposeOutput(out);
  }
}

const TOP_K_DIAGNOSTICS = 5;

/** Softmax of one logits row: summed EOS probability and the top-5 ids with their text. */
export function firstTokenStats(
  scores: Float32Array,
  eosIds: ReadonlySet<number>,
  decode: (ids: number[]) => string,
): WebgpuFirstTokenDiagnostics {
  let max = Number.NEGATIVE_INFINITY;
  for (const v of scores) if (v > max) max = v;
  let total = 0;
  for (const v of scores) total += Math.exp(v - max);
  const prob = (id: number): number => (total > 0 ? Math.exp((scores[id] ?? Number.NEGATIVE_INFINITY) - max) / total : 0);
  let eosProb = 0;
  for (const id of eosIds) if (id >= 0 && id < scores.length) eosProb += prob(id);
  // Partial selection: keep the 5 best ids without sorting the whole vocabulary.
  const top: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    const v = scores[i] ?? Number.NEGATIVE_INFINITY;
    if (top.length === TOP_K_DIAGNOSTICS && v <= (scores[top[TOP_K_DIAGNOSTICS - 1] ?? 0] ?? 0)) continue;
    let at = top.length;
    while (at > 0 && v > (scores[top[at - 1] ?? 0] ?? 0)) at--;
    top.splice(at, 0, i);
    if (top.length > TOP_K_DIAGNOSTICS) top.pop();
  }
  return {
    eos_prob: eosProb,
    top5: top.map((id) => ({ id, token: decode([id]), p: prob(id) })),
  };
}

/** Greedy id of the prefill output, reporting first-step stats first when a hook is set. */
async function firstIdOf(out: StepOutput | null, tokenizer: ChatTokenizer, onFirstStep: GenerateOptions['onFirstStep']): Promise<number> {
  if (out && onFirstStep) {
    const scores = await lastRowScores(out.logits);
    onFirstStep(firstTokenStats(scores, tokenizer.eosIds, (ids) => tokenizer.decode(ids)));
  }
  return greedyOf(out);
}

export async function generate(
  session: InferenceSession,
  Ctor: TensorCtor,
  cfg: TextModelConfig,
  tokenizer: ChatTokenizer,
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const step = new DecoderStep(session, Ctor, cfg);
  const generated: number[] = [];
  let text = '';
  let ttfc: number | null = null;
  let ttft: number | null = null;
  let last: number | null = null;
  const checkAbort = (): void => {
    if (opts.isAborted()) throw new WebgpuEngineError('ABORTED', 'generation aborted');
  };
  try {
    let nextId = await firstIdOf(
      await prefill(step, opts.promptIds, opts.prefillChunkTokens, { media: opts.media, checkAbort }),
      tokenizer,
      opts.onFirstStep,
    );
    while (nextId >= 0 && !tokenizer.eosIds.has(nextId) && generated.length < opts.maxTokens) {
      generated.push(nextId);
      const full = tokenizer.decode(generated);
      const delta = full.startsWith(text) ? full.slice(text.length) : full;
      text = full;
      const tMs = performance.now() - opts.t0;
      ttfc ??= tMs;
      if (ttft === null && hasRealText(text)) ttft = tMs;
      last = tMs;
      opts.onToken(delta, tMs);
      if (generated.length >= opts.maxTokens) break;
      checkAbort();
      nextId = await greedyOf(await step.run([nextId]));
    }
  } finally {
    step.dispose();
  }
  return {
    text,
    prompt_tokens: opts.promptIds.length,
    completion_tokens: generated.length,
    ttfc_ms: ttfc,
    ttft_ms: ttft,
    last_chunk_ms: last,
  };
}
