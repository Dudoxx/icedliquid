/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   One speech frame (12 codebook codes) from the backbone hidden state: MaskGIT passes over the depth_decoder graph with per-codebook repetition penalty, a port of mlx_vlm lfm3_audio depth.py.
 * @status    feature-local
 */
import type { InferenceSession, Tensor } from 'onnxruntime-web/webgpu';

import type { TensorCtor } from './decoder-step';
import { WebgpuEngineError } from './protocol';
import { sample, type Rng } from './sampling';

/** Depth/MaskGIT facts (config.json) + speech sampling (generation_config.json). */
export interface DepthConfig {
  numCodebooks: number;
  /** LM-side codebook size, EOS code included (2017). */
  codebookSize: number;
  eosCode: number;
  /** Codebooks revealed per pass (config.json maskgit_schedule). */
  maskgitSchedule: number[];
  hiddenSize: number;
  temperature: number | null;
  topK: number | null;
  repetitionPenalty: number | null;
  repetitionWindow: number;
}

function record(json: string, file: string): Record<string, unknown> {
  const root: unknown = JSON.parse(json);
  if (typeof root !== 'object' || root === null) throw new WebgpuEngineError('LOAD_FAILED', `${file} is not an object`);
  return root as Record<string, unknown>;
}

function num(rec: Record<string, unknown>, key: string, file: string): number {
  const value = rec[key];
  if (typeof value !== 'number') throw new WebgpuEngineError('LOAD_FAILED', `${file} lacks ${key}`);
  return value;
}

function optionalNum(rec: Record<string, unknown>, key: string): number | null {
  const value = rec[key];
  return typeof value === 'number' ? value : null;
}

/** Read maskgit_schedule, codebook facts and audio sampling; nothing here is a code constant. */
export function readDepthConfig(configJson: string, generationConfigJson: string): DepthConfig {
  const cfg = record(configJson, 'config.json');
  const gen = record(generationConfigJson, 'generation_config.json');
  const schedule = cfg['maskgit_schedule'];
  if (!Array.isArray(schedule) || !schedule.every((v): v is number => typeof v === 'number' && v > 0)) {
    throw new WebgpuEngineError('LOAD_FAILED', 'config.json lacks maskgit_schedule');
  }
  const numCodebooks = num(cfg, 'num_codebooks', 'config.json');
  if (schedule.reduce((a, b) => a + b, 0) !== numCodebooks) {
    throw new WebgpuEngineError('LOAD_FAILED', `maskgit_schedule ${schedule.join(',')} does not cover ${numCodebooks} codebooks`);
  }
  const text = (cfg['text_config'] ?? {}) as Record<string, unknown>;
  return {
    numCodebooks,
    codebookSize: num(cfg, 'codebook_size', 'config.json'),
    eosCode: num(cfg, 'audio_eos_code', 'config.json'),
    maskgitSchedule: schedule,
    hiddenSize: optionalNum(text, 'hidden_size') ?? num(cfg, 'hidden_size', 'config.json'),
    temperature: optionalNum(gen, 'audio_temperature'),
    topK: optionalNum(gen, 'audio_top_k'),
    repetitionPenalty: optionalNum(gen, 'audio_repetition_penalty'),
    repetitionWindow: optionalNum(gen, 'audio_repetition_window') ?? 64,
  };
}

/** The last `window` non-EOS frames (stream_slots audio_history deque). */
export class AudioHistory {
  private readonly frames: Int32Array[] = [];

  constructor(private readonly window: number) {}

  push(codes: Int32Array): void {
    this.frames.push(codes);
    if (this.frames.length > this.window) this.frames.shift();
  }

  get size(): number {
    return this.frames.length;
  }

  /** Codes of codebook `i` over the kept frames; undefined when empty (no penalty). */
  column(i: number): number[] | undefined {
    if (this.frames.length === 0) return undefined;
    return this.frames.map((f) => f[i] ?? 0);
  }
}

/** Fisher-Yates permutation of 0..k-1 (depth.py mx.random.permutation). */
export function randomOrder(k: number, rng: Rng): number[] {
  const order = Array.from({ length: k }, (_, i) => i);
  for (let i = k - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i] ?? i;
    order[i] = order[j] ?? j;
    order[j] = tmp;
  }
  return order;
}

/** A frame with any EOS code becomes all EOS (depth.py normalize_eos). */
export function normalizeEos(codes: Int32Array, eosCode: number): Int32Array {
  return codes.includes(eosCode) ? new Int32Array(codes.length).fill(eosCode) : codes;
}

export interface SampleFrameOptions {
  rng?: Rng | undefined;
  /** Fixed reveal order (stream_slots frame_order); random per frame otherwise. */
  order?: readonly number[] | undefined;
}

/** One depth_decoder pass: logits [K, V] as float32 rows. */
async function depthPass(
  session: InferenceSession,
  Ctor: TensorCtor,
  hidden: Float32Array,
  codes: Int32Array,
  revealed: Uint8Array,
  cfg: DepthConfig,
): Promise<Float32Array> {
  const k = cfg.numCodebooks;
  const masked = new Uint8Array(k);
  for (let i = 0; i < k; i++) masked[i] = revealed[i] ? 0 : 1;
  const feeds: Record<string, Tensor> = {
    hidden_states: new Ctor('float32', hidden, [1, hidden.length]),
    codes: new Ctor('int64', BigInt64Array.from(codes, (c) => BigInt(c)), [1, k]),
    masked: new Ctor('bool', masked, [1, k]),
  };
  let outputs: InferenceSession.OnnxValueMapType;
  try {
    outputs = await session.run(feeds);
  } catch (error) {
    throw depthRunError(error);
  }
  const logits = outputs['logits'];
  try {
    if (!logits) throw new WebgpuEngineError('LOAD_FAILED', 'depth_decoder returned no logits');
    const data = await logits.getData();
    if (data.length !== k * cfg.codebookSize) {
      throw new WebgpuEngineError('LOAD_FAILED', `depth_decoder logits hold ${data.length} values, expected ${k}×${cfg.codebookSize}`);
    }
    return data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>, Number);
  } finally {
    for (const value of Object.values(outputs)) value.dispose();
  }
}

function depthRunError(error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|OOM|allocation failed/i.test(message)) return new WebgpuEngineError('OOM', message);
  if (/device.{0,20}lost|lost.{0,20}device/i.test(message)) return new WebgpuEngineError('DEVICE_LOST', message);
  return new WebgpuEngineError('LOAD_FAILED', `depth_decoder: ${message}`);
}

/**
 * MaskGIT one frame: hidden [hiddenSize] → raw codes [K] (before EOS handling; the caller runs
 * normalizeEos). Pass p reveals order[s, s + schedule[p]).
 */
export async function sampleFrame(
  session: InferenceSession,
  Ctor: TensorCtor,
  hidden: Float32Array,
  history: AudioHistory,
  cfg: DepthConfig,
  opts: SampleFrameOptions = {},
): Promise<Int32Array> {
  const k = cfg.numCodebooks;
  if (hidden.length !== cfg.hiddenSize) {
    throw new WebgpuEngineError('LOAD_FAILED', `depth input hidden has ${hidden.length} values, expected ${cfg.hiddenSize}`);
  }
  const rng = opts.rng ?? Math.random;
  const order = opts.order ?? randomOrder(k, rng);
  const codes = new Int32Array(k);
  const revealed = new Uint8Array(k);
  const columns = Array.from({ length: k }, (_, i) => history.column(i));
  let start = 0;
  for (const size of cfg.maskgitSchedule) {
    const pick = order.slice(start, start + size);
    const logits = await depthPass(session, Ctor, hidden, codes, revealed, cfg);
    for (const i of pick) {
      const row = logits.subarray(i * cfg.codebookSize, (i + 1) * cfg.codebookSize);
      codes[i] = sample(row, {
        temperature: cfg.temperature,
        topK: cfg.topK,
        repetitionPenalty: cfg.repetitionPenalty,
        history: columns[i],
        rng,
      });
    }
    for (const i of pick) revealed[i] = 1;
    start += size;
  }
  return codes;
}
