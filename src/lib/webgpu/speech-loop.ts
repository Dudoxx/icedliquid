/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   The text / audio / interleaved slot loop of LFM3-Omni speech output in the worker: decoder hidden → MaskGIT frame → codec + iSTFT chunks, a port of mlx_vlm lfm3_audio stream_slots.
 * @status    feature-local
 */
import type { InferenceSession } from 'onnxruntime-web/webgpu';

import type { CodecConfig } from './codec';
import { SpeechCodec } from './codec';
import { DecoderStep, MediaFeeds, disposeOutput, prefill, type MediaTokenIds, type StepOutput, type TensorCtor, type TextModelConfig } from './decoder-step';
import { AudioHistory, normalizeEos, sampleFrame, type DepthConfig } from './depth-maskgit';
import { hasRealText, type GenerateResult } from './generate';
import { WebgpuEngineError, type WebgpuConfig } from './protocol';
import { lastRowScores, sample, type Rng } from './sampling';
import type { GraphRegistry } from './sessions';
import type { ChatTokenizer } from './tokenizer';

export type SpeechGenerationMode = 'text' | 'audio' | 'interleaved';

/** mlx-vlm stream_frame_batch default; the runner passes a configured value when it has one. */
export const DEFAULT_FRAME_BATCH = 6;
/** stream_slots text_repetition_window default. */
const TEXT_REPETITION_WINDOW = 32;

/** Slot-machine facts (config.json) + text sampling (generation_config.json). */
export interface SpeechTokenConfig {
  audioOutTokenId: number;
  audioStartTokenId: number;
  mixedStartTokenId: number;
  textEndTokenId: number;
  audioTokenId: number;
  interleavedNText: number;
  interleavedNAudio: number;
  textTemperature: number | null;
  textTopK: number | null;
  textRepetitionPenalty: number | null;
}

function jsonRecord(json: string, file: string): Record<string, unknown> {
  const root: unknown = JSON.parse(json);
  if (typeof root !== 'object' || root === null) throw new WebgpuEngineError('LOAD_FAILED', `${file} is not an object`);
  return root as Record<string, unknown>;
}

function need(rec: Record<string, unknown>, key: string): number {
  const value = rec[key];
  if (typeof value !== 'number') throw new WebgpuEngineError('LOAD_FAILED', `config.json lacks ${key}`);
  return value;
}

function maybe(rec: Record<string, unknown>, key: string): number | null {
  const value = rec[key];
  return typeof value === 'number' ? value : null;
}

export function readSpeechConfig(configJson: string, generationConfigJson: string): SpeechTokenConfig {
  const cfg = jsonRecord(configJson, 'config.json');
  const gen = jsonRecord(generationConfigJson, 'generation_config.json');
  return {
    audioOutTokenId: need(cfg, 'audio_out_token_id'),
    audioStartTokenId: need(cfg, 'audio_start_token_id'),
    mixedStartTokenId: need(cfg, 'mixed_start_token_id'),
    textEndTokenId: need(cfg, 'text_end_token_id'),
    audioTokenId: need(cfg, 'audio_token_id'),
    interleavedNText: need(cfg, 'interleaved_n_text'),
    interleavedNAudio: need(cfg, 'interleaved_n_audio'),
    textTemperature: maybe(gen, 'temperature'),
    textTopK: maybe(gen, 'top_k'),
    textRepetitionPenalty: maybe(gen, 'repetition_penalty'),
  };
}

export interface SpeechGraphs {
  decoder: InferenceSession;
  depth: InferenceSession;
  codec: InferenceSession;
}

/** Decoder + depth_decoder + codec_decoder through the registry (serial, deduplicated loads). */
export async function ensureSpeechGraphs(registry: GraphRegistry, config: WebgpuConfig, requestId?: string): Promise<SpeechGraphs> {
  const opts = requestId ? { requestId } : {};
  const [decoder, depth, codec] = await Promise.all([
    registry.ensure(config, 'decoder', opts),
    registry.ensure(config, 'depth_decoder', opts),
    registry.ensure(config, 'codec_decoder', opts),
  ]);
  return { decoder: decoder.session, depth: depth.session, codec: codec.session };
}

export interface SpeechModels {
  graphs: SpeechGraphs;
  Ctor: TensorCtor;
  textConfig: TextModelConfig;
  tokenizer: ChatTokenizer;
  mediaTokenIds: MediaTokenIds;
  speech: SpeechTokenConfig;
  depth: DepthConfig;
  codec: CodecConfig;
}

export interface SpeechLoopOptions {
  /** Prompt ids (prompt.ts generationIds); the mode marker is appended when missing. */
  promptIds: readonly number[];
  generationMode: SpeechGenerationMode;
  maxTokens: number;
  prefillChunkTokens: number;
  /** performance.now() when the worker received the request. */
  t0: number;
  isAborted: () => boolean;
  onToken: (text: string, tMs: number) => void;
  /** One decoded chunk: mono float32 PCM at codec.sampleRate (the caller transfers it). */
  onAudio: (pcm: Float32Array, frames: number, tMs: number) => void;
  /** Prompt media rows (audio_to_speech: audio_features). */
  media?: MediaFeeds | undefined;
  frameBatch?: number | undefined;
  rng?: Rng | undefined;
}

export interface SpeechLoopResult extends GenerateResult {
  ttfa_ms: number | null;
  audio_frames: number;
}

interface SlotResult {
  finished: boolean;
  next: number[];
  media?: MediaFeeds | undefined;
}

/** One request's slot state machine (stream_slots locals). */
class SpeechLoop {
  private mode: SpeechGenerationMode;
  private speaking = false;
  private textDone = false;
  private slotsLeft: number;
  private readonly textHistory: number[] = [];
  private readonly audioHistory: AudioHistory;
  private readonly codec: SpeechCodec;
  private readonly suppress: number[];
  private readonly controlIds: Set<number>;
  private readonly frameBatch: number;
  private batch: Int32Array[] = [];
  private readonly textIds: number[] = [];
  private text = '';
  private slots = 0;
  private audioFrames = 0;
  private ttfc: number | null = null;
  private ttft: number | null = null;
  private ttfa: number | null = null;
  private last: number | null = null;
  readonly promptIds: number[];

  constructor(
    private readonly m: SpeechModels,
    private readonly opts: SpeechLoopOptions,
  ) {
    const s = m.speech;
    this.mode = opts.generationMode;
    this.slotsLeft = s.interleavedNText;
    this.audioHistory = new AudioHistory(m.depth.repetitionWindow);
    this.codec = new SpeechCodec(m.graphs.codec, m.Ctor, m.codec);
    this.frameBatch = Math.max(1, opts.frameBatch ?? DEFAULT_FRAME_BATCH);
    this.promptIds = withMarker(opts.promptIds, opts.generationMode, s);
    // Placeholder ids never come from the text head; an explicit text mode keeps the reply in text.
    this.suppress = [s.audioTokenId, s.audioOutTokenId];
    if (opts.generationMode === 'text') this.suppress.push(s.mixedStartTokenId, s.audioStartTokenId);
    this.controlIds = new Set([s.audioOutTokenId, s.audioStartTokenId, s.mixedStartTokenId, s.textEndTokenId, ...m.tokenizer.eosIds]);
  }

  private checkAbort = (): void => {
    if (this.opts.isAborted()) throw new WebgpuEngineError('ABORTED', 'generation aborted');
  };

  private speechSlotNext(): boolean {
    return this.mode === 'audio' || (this.mode === 'interleaved' && this.speaking);
  }

  async run(): Promise<SpeechLoopResult> {
    const step = new DecoderStep(this.m.graphs.decoder, this.m.Ctor, this.m.textConfig);
    let out: StepOutput | null = null;
    try {
      out = await prefill(step, this.promptIds, this.opts.prefillChunkTokens, {
        media: this.opts.media,
        hidden: this.speechSlotNext() ? 'float32' : 'none',
        checkAbort: this.checkAbort,
      });
      for (let i = 0; i < this.opts.maxTokens; i++) {
        this.checkAbort();
        if (!out) throw new WebgpuEngineError('PREPROCESS_FAILED', 'empty prompt');
        const interleaving = this.mode === 'interleaved';
        const current: StepOutput = out;
        out = null;
        const slot = this.speechSlotNext() ? await this.speechSlot(current) : await this.textSlot(current, interleaving);
        if (interleaving && !this.textDone) this.advanceInterleave();
        if (slot.finished || i === this.opts.maxTokens - 1) break;
        out = await step.run(slot.next, { media: slot.media, hidden: this.speechSlotNext() ? 'float32' : 'none' });
      }
      await this.flush();
    } finally {
      disposeOutput(out);
      step.dispose();
    }
    return this.result();
  }

  private result(): SpeechLoopResult {
    if (this.opts.generationMode !== 'text' && this.audioFrames === 0) {
      // Never an empty success (invariant 2): the speech mode produced no audio.
      throw new WebgpuEngineError('LOAD_FAILED', `${this.opts.generationMode} mode ended with 0 audio frames after ${this.slots} slots`);
    }
    return {
      text: this.text,
      prompt_tokens: this.promptIds.length,
      completion_tokens: this.slots,
      ttfc_ms: this.ttfc,
      ttft_ms: this.ttft,
      last_chunk_ms: this.last,
      ttfa_ms: this.ttfa,
      audio_frames: this.audioFrames,
    };
  }

  /** stream_slots slot counter: after n text slots speak for n audio frames, and back. */
  private advanceInterleave(): void {
    this.slotsLeft -= 1;
    if (this.slotsLeft === 0) {
      this.speaking = !this.speaking;
      this.slotsLeft = this.speaking ? this.m.speech.interleavedNAudio : this.m.speech.interleavedNText;
    }
  }

  private async speechSlot(out: StepOutput): Promise<SlotResult> {
    const hidden = out.hidden;
    disposeOutput(out);
    if (!(hidden instanceof Float32Array)) throw new WebgpuEngineError('LOAD_FAILED', 'decoder hidden_states row missing for a speech slot');
    const { depth } = this.m;
    const raw = await sampleFrame(this.m.graphs.depth, this.m.Ctor, hidden, this.audioHistory, depth, { rng: this.opts.rng });
    const codes = normalizeEos(raw, depth.eosCode);
    this.slots += 1;
    if (codes[0] === depth.eosCode) {
      this.mode = 'text';
      await this.flush();
    } else {
      this.audioHistory.push(codes);
      this.batch.push(codes);
      if (this.batch.length >= this.frameBatch) await this.flush();
    }
    const media = new MediaFeeds(this.m.mediaTokenIds, {
      audio_out_codes: { data: BigInt64Array.from(codes, (c) => BigInt(c)), width: depth.numCodebooks },
    });
    return { finished: false, next: [this.m.speech.audioOutTokenId], media };
  }

  private async textSlot(out: StepOutput, interleaving: boolean): Promise<SlotResult> {
    let scores: Float32Array;
    try {
      scores = await lastRowScores(out.logits);
    } finally {
      disposeOutput(out);
    }
    const s = this.m.speech;
    const token = sample(scores, {
      temperature: s.textTemperature,
      topK: s.textTopK,
      repetitionPenalty: s.textRepetitionPenalty,
      history: this.textHistory.length ? this.textHistory : undefined,
      suppress: this.suppress,
      rng: this.opts.rng,
    });
    this.textHistory.push(token);
    if (this.textHistory.length > TEXT_REPETITION_WINDOW) this.textHistory.shift();
    let finished = false;
    if (token === s.textEndTokenId) {
      // text_end closes the text of an interleaved block, else the turn.
      if (interleaving) this.textDone = this.speaking = true;
      else finished = true;
    } else if (this.m.tokenizer.eosIds.has(token)) {
      finished = true;
    } else if (!interleaving && token === s.audioStartTokenId) {
      this.mode = 'audio';
    } else if (!interleaving && token === s.mixedStartTokenId) {
      this.mode = 'interleaved';
      this.slotsLeft = s.interleavedNText;
      this.speaking = this.textDone = false;
    }
    if (!finished) {
      this.slots += 1;
      if (!this.controlIds.has(token)) this.emitText(token);
    }
    return { finished, next: [token] };
  }

  private emitText(token: number): void {
    this.textIds.push(token);
    const full = this.m.tokenizer.decode(this.textIds);
    const delta = full.startsWith(this.text) ? full.slice(this.text.length) : full;
    this.text = full;
    const tMs = performance.now() - this.opts.t0;
    this.ttfc ??= tMs;
    if (this.ttft === null && hasRealText(this.text)) this.ttft = tMs;
    this.last = tMs;
    this.opts.onToken(delta, tMs);
  }

  /** Pending frames → codec_decoder → iSTFT → one `audio` chunk; ttfa = the first one. */
  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;
    const frames = this.batch;
    this.batch = [];
    const pcm = await this.codec.toPcm(frames);
    const tMs = performance.now() - this.opts.t0;
    this.ttfa ??= tMs;
    this.last = tMs;
    this.audioFrames += frames.length;
    this.opts.onAudio(pcm, frames.length, tMs);
  }
}

/** stream_slots: an explicit audio / interleaved mode appends its marker unless the prompt ends on it. */
function withMarker(ids: readonly number[], mode: SpeechGenerationMode, s: SpeechTokenConfig): number[] {
  const out = [...ids];
  const lastId = out[out.length - 1];
  if (mode === 'audio' && lastId !== s.audioStartTokenId && lastId !== s.audioOutTokenId) out.push(s.audioStartTokenId);
  if (mode === 'interleaved' && lastId !== s.mixedStartTokenId) out.push(s.mixedStartTokenId);
  return out;
}

/** Run one speech / interleaved (or explicit text) request; throws on zero frames in a speech mode. */
export async function runSpeechLoop(models: SpeechModels, opts: SpeechLoopOptions): Promise<SpeechLoopResult> {
  return new SpeechLoop(models, opts).run();
}
