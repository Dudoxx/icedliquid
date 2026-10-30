/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   One LFM3 ONNX decoder session with its fp16 cache state: per-chunk media feature rows at their placeholders, logits and the final-norm hidden state out.
 * @status    feature-local
 */
import type { InferenceSession, Tensor } from 'onnxruntime-web/webgpu';

import { WebgpuEngineError } from './protocol';

export type TensorCtor = new (type: Tensor.Type, data: Tensor.DataType, dims: readonly number[]) => Tensor;

/** Text-model fields of config.json (`text_config` on LFM3-Omni). */
export interface TextModelConfig {
  layer_types: string[];
  num_key_value_heads: number;
  head_dim: number;
  hidden_size: number;
  conv_L_cache: number;
}

export function readTextModelConfig(configJson: string): TextModelConfig {
  const root: unknown = JSON.parse(configJson);
  const record = (typeof root === 'object' && root !== null ? root : {}) as Record<string, unknown>;
  const text = (record['text_config'] ?? record) as Partial<TextModelConfig>;
  const { layer_types, num_key_value_heads, head_dim, hidden_size, conv_L_cache } = text;
  if (
    !Array.isArray(layer_types) ||
    typeof num_key_value_heads !== 'number' ||
    typeof head_dim !== 'number' ||
    typeof hidden_size !== 'number' ||
    typeof conv_L_cache !== 'number'
  ) {
    throw new WebgpuEngineError('LOAD_FAILED', 'config.json lacks layer_types / cache dimensions');
  }
  return { layer_types, num_key_value_heads, head_dim, hidden_size, conv_L_cache };
}

/** Decoder media inputs, in graph order. */
export const MEDIA_INPUTS = ['image_features', 'video_features', 'audio_features', 'audio_out_codes'] as const;
export type MediaInput = (typeof MEDIA_INPUTS)[number];

/** Placeholder token id per media input (config.json image/video/audio/audio_out _token_id). */
export type MediaTokenIds = Record<MediaInput, number>;

const TOKEN_ID_KEYS: Record<MediaInput, string> = {
  image_features: 'image_token_id',
  video_features: 'video_token_id',
  audio_features: 'audio_token_id',
  audio_out_codes: 'audio_out_token_id',
};

export function readMediaTokenIds(configJson: string): MediaTokenIds {
  const root: unknown = JSON.parse(configJson);
  const record = (typeof root === 'object' && root !== null ? root : {}) as Record<string, unknown>;
  const ids = {} as MediaTokenIds;
  for (const input of MEDIA_INPUTS) {
    const value = record[TOKEN_ID_KEYS[input]];
    if (typeof value !== 'number') throw new WebgpuEngineError('LOAD_FAILED', `config.json lacks ${TOKEN_ID_KEYS[input]}`);
    ids[input] = value;
  }
  return ids;
}

/** Full rows of one media input, row-major; `width` = values per row (2048 features, 12 codes). */
export interface MediaRows {
  data: Float32Array | BigInt64Array | Int32Array;
  width: number;
}

function isKv(name: string): boolean {
  return name.startsWith('past_key_values.');
}

/** Fill a symbolic dimension of a past.* input; batch is 1, past length starts at 0. */
function resolveDim(name: string, axis: number, cfg: TextModelConfig): number {
  if (axis === 0) return 1;
  if (isKv(name)) {
    if (axis === 1) return cfg.num_key_value_heads;
    if (axis === 2) return 0;
    if (axis === 3) return cfg.head_dim;
  } else {
    if (axis === 1) return cfg.hidden_size;
    if (axis === 2) return cfg.conv_L_cache;
  }
  throw new WebgpuEngineError('LOAD_FAILED', `cannot resolve dim ${axis} of ${name}`);
}

function zeros(type: Tensor.Type, size: number): Tensor.DataType {
  if (type === 'float16') return new Uint16Array(size);
  if (type === 'float32') return new Float32Array(size);
  throw new WebgpuEngineError('LOAD_FAILED', `unsupported cache type ${type}`);
}

/** Validate the cache inputs once per session; returns their names. */
export function cacheInputNames(session: InferenceSession, cfg: TextModelConfig): string[] {
  const names = session.inputNames.filter((n) => n.startsWith('past_'));
  const conv = names.filter((n) => n.startsWith('past_conv.')).length;
  const kv = names.filter(isKv).length;
  const convLayers = cfg.layer_types.filter((t) => t === 'conv').length;
  const attnLayers = cfg.layer_types.length - convLayers;
  if (conv !== convLayers || kv !== attnLayers * 2) {
    throw new WebgpuEngineError(
      'LOAD_FAILED',
      `graph caches (conv ${conv}, kv ${kv}) do not match config layer_types (conv ${convLayers}, attention ${attnLayers})`,
    );
  }
  for (const required of ['input_ids', 'attention_mask']) {
    if (!session.inputNames.includes(required)) throw new WebgpuEngineError('LOAD_FAILED', `graph has no ${required} input`);
  }
  return names;
}

function emptyCaches(session: InferenceSession, cfg: TextModelConfig, Ctor: TensorCtor): Record<string, Tensor> {
  const caches: Record<string, Tensor> = {};
  for (const meta of session.inputMetadata) {
    if (!meta.name.startsWith('past_')) continue;
    if (!meta.isTensor) throw new WebgpuEngineError('LOAD_FAILED', `${meta.name} is not a tensor input`);
    const dims = meta.shape.map((d, axis) => (typeof d === 'number' && d >= 0 ? d : resolveDim(meta.name, axis, cfg)));
    const size = dims.reduce((a, b) => a * b, 1);
    caches[meta.name] = new Ctor(meta.type, zeros(meta.type, size), dims);
  }
  return caches;
}

const TEXT_INPUTS = new Set(['input_ids', 'attention_mask', 'position_ids', 'logits_to_keep']);

function emptyOf(type: Tensor.Type): Tensor.DataType {
  if (type === 'float16') return new Uint16Array(0);
  if (type === 'float32') return new Float32Array(0);
  if (type === 'int64') return new BigInt64Array(0);
  if (type === 'int32') return new Int32Array(0);
  throw new WebgpuEngineError('LOAD_FAILED', `unsupported media input type ${type}`);
}

/** Zero rows for every non-text, non-cache input: dynamic dims become 0, static dims keep the graph value. */
function emptyMediaInputs(session: InferenceSession, Ctor: TensorCtor): Record<string, Tensor> {
  const feeds: Record<string, Tensor> = {};
  for (const meta of session.inputMetadata) {
    if (meta.name.startsWith('past_') || TEXT_INPUTS.has(meta.name)) continue;
    if (!meta.isTensor) throw new WebgpuEngineError('LOAD_FAILED', `${meta.name} is not a tensor input`);
    const dims = meta.shape.map((d) => (typeof d === 'number' && d >= 0 ? d : 0));
    feeds[meta.name] = new Ctor(meta.type, emptyOf(meta.type), dims);
  }
  return feeds;
}

function intTensor(session: InferenceSession, name: string, values: readonly number[], dims: readonly number[], Ctor: TensorCtor): Tensor {
  const meta = session.inputMetadata.find((m) => m.name === name);
  const type = meta?.isTensor ? meta.type : 'int64';
  if (type === 'int32') return new Ctor('int32', Int32Array.from(values), dims);
  return new Ctor('int64', BigInt64Array.from(values, (v) => BigInt(v)), dims);
}

function pastNameFor(presentName: string): string | null {
  if (presentName.startsWith('present_conv.')) return `past_conv.${presentName.slice('present_conv.'.length)}`;
  if (presentName.startsWith('present.')) return `past_key_values.${presentName.slice('present.'.length)}`;
  return null;
}

function mapRunError(error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|OOM|allocation failed/i.test(message)) return new WebgpuEngineError('OOM', message);
  if (/device.{0,20}lost|lost.{0,20}device/i.test(message)) return new WebgpuEngineError('DEVICE_LOST', message);
  // Any other session.run failure (bad feed, shape mismatch) is a model/graph problem, not a lost GPU.
  return new WebgpuEngineError('LOAD_FAILED', `session.run: ${message}`);
}

/** float → IEEE 754 half bits (round to nearest), only for a graph that declares fp16 features. */
function floatToHalf(value: number): number {
  const f32 = new Float32Array([value]);
  const bits = new Uint32Array(f32.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  const exp = ((bits >>> 23) & 0xff) - 127 + 15;
  const mant = bits & 0x7fffff;
  if (exp >= 0x1f) return sign | 0x7c00 | (((bits >>> 23) & 0xff) === 0xff && mant ? 0x200 : 0);
  if (exp <= 0) return exp < -10 ? sign : sign | ((mant | 0x800000) >> (14 - exp));
  // `+`, not `|`: a rounding carry out of the mantissa must bump the exponent.
  return sign | ((exp << 10) + ((mant + 0x1000) >> 13));
}

/** Rows [from, from+n) of `src` in the dtype the graph declares for `input`. */
function rowsTensor(session: InferenceSession, input: MediaInput, src: MediaRows, from: number, n: number, Ctor: TensorCtor): Tensor {
  const meta = session.inputMetadata.find((m) => m.name === input);
  if (!meta?.isTensor) throw new WebgpuEngineError('PREPROCESS_FAILED', `decoder has no ${input} input`);
  const declared = meta.shape[1];
  if (typeof declared === 'number' && declared >= 0 && declared !== src.width) {
    throw new WebgpuEngineError('PREPROCESS_FAILED', `${input} rows are ${src.width} wide, decoder expects ${declared}`);
  }
  const slice = src.data.subarray(from * src.width, (from + n) * src.width);
  const dims = [n, src.width];
  const numbers = (): number[] => Array.from(slice as ArrayLike<number | bigint>, (v) => Number(v));
  switch (meta.type) {
    case 'float32':
      return new Ctor('float32', slice instanceof Float32Array ? slice : Float32Array.from(numbers()), dims);
    case 'float16':
      return new Ctor('float16', Uint16Array.from(numbers(), floatToHalf), dims);
    case 'int64':
      return new Ctor('int64', slice instanceof BigInt64Array ? slice : BigInt64Array.from(numbers(), (v) => BigInt(Math.trunc(v))), dims);
    case 'int32':
      return new Ctor('int32', Int32Array.from(numbers()), dims);
    default:
      throw new WebgpuEngineError('PREPROCESS_FAILED', `unsupported ${input} type ${meta.type}`);
  }
}

/**
 * Full media rows of one request plus a cursor per kind. `take(ids)` counts the placeholders of
 * each kind inside `ids` and hands out exactly that many next rows; `assertConsumed()` refuses a
 * prefill that left rows unfed (PREPROCESS_FAILED).
 */
export class MediaFeeds {
  private readonly cursor: Record<MediaInput, number> = { image_features: 0, video_features: 0, audio_features: 0, audio_out_codes: 0 };

  constructor(
    private readonly tokenIds: MediaTokenIds,
    private readonly rows: Partial<Record<MediaInput, MediaRows>>,
  ) {
    for (const input of MEDIA_INPUTS) {
      const src = rows[input];
      if (src && (src.width <= 0 || src.data.length % src.width !== 0)) {
        throw new WebgpuEngineError('PREPROCESS_FAILED', `${input} has ${src.data.length} values, not a multiple of ${src.width}`);
      }
    }
  }

  private available(input: MediaInput): number {
    const src = this.rows[input];
    return src ? src.data.length / src.width : 0;
  }

  /** Feeds for the placeholders inside `ids`; kinds with no placeholder are omitted (zero-row rule). */
  take(session: InferenceSession, ids: readonly number[], Ctor: TensorCtor): Record<string, Tensor> {
    const feeds: Record<string, Tensor> = {};
    for (const input of MEDIA_INPUTS) {
      const token = this.tokenIds[input];
      let n = 0;
      for (const id of ids) if (id === token) n++;
      if (n === 0) continue;
      const from = this.cursor[input];
      const src = this.rows[input];
      if (!src || from + n > this.available(input)) {
        throw new WebgpuEngineError('PREPROCESS_FAILED', `${input}: prompt has more placeholders than the ${this.available(input)} rows given`);
      }
      feeds[input] = rowsTensor(session, input, src, from, n, Ctor);
      this.cursor[input] = from + n;
    }
    return feeds;
  }

  assertConsumed(): void {
    for (const input of MEDIA_INPUTS) {
      const left = this.available(input) - this.cursor[input];
      if (left !== 0) throw new WebgpuEngineError('PREPROCESS_FAILED', `${input}: ${left} rows left after prefill (placeholder count mismatch)`);
    }
  }
}

/** How the step returns the last hidden_states row: dropped, kept on the GPU, or read back. */
export type HiddenMode = 'none' | 'tensor' | 'float32';

export interface StepOptions {
  media?: MediaFeeds | undefined;
  hidden?: HiddenMode | undefined;
}

export interface StepOutput {
  /** Last-position logits; the caller disposes it. */
  logits: Tensor;
  /** hidden: 'tensor' → [1, 1, 2048] GPU tensor the caller disposes; 'float32' → the last row; else null. */
  hidden: Tensor | Float32Array | null;
}

/** Last hidden_states row; the tensor itself is kept only when it already is that one row. */
async function takeHidden(value: Tensor, mode: HiddenMode): Promise<Tensor | Float32Array | null> {
  if (mode === 'none') {
    value.dispose();
    return null;
  }
  const width = value.dims[value.dims.length - 1] ?? 0;
  const rows = value.dims.slice(0, -1).reduce((a, b) => a * b, 1);
  if (mode === 'tensor' && rows === 1) return value;
  try {
    const data = await value.getData();
    const offset = data.length - width;
    const row = new Float32Array(width);
    for (let i = 0; i < width; i++) row[i] = Number(data[offset + i]);
    return row;
  } finally {
    value.dispose();
  }
}

/** One decoder session wrapped with its cache state; dispose() frees every GPU tensor. */
export class DecoderStep {
  private caches: Record<string, Tensor>;
  private pastLength = 0;

  constructor(
    private readonly session: InferenceSession,
    private readonly Ctor: TensorCtor,
    cfg: TextModelConfig,
  ) {
    this.caches = emptyCaches(session, cfg, Ctor);
  }

  private feedsFor(ids: readonly number[], media: MediaFeeds | undefined): Record<string, Tensor> {
    const n = ids.length;
    const total = this.pastLength + n;
    const feeds: Record<string, Tensor> = {
      ...emptyMediaInputs(this.session, this.Ctor),
      ...(media ? media.take(this.session, ids, this.Ctor) : {}),
      ...this.caches,
      input_ids: intTensor(this.session, 'input_ids', ids, [1, n], this.Ctor),
      attention_mask: intTensor(this.session, 'attention_mask', Array.from({ length: total }, () => 1), [1, total], this.Ctor),
    };
    if (this.session.inputNames.includes('position_ids')) {
      // 1-D positions (rope_type default): they continue across chunks.
      const positions = Array.from({ length: n }, (_, i) => this.pastLength + i);
      feeds['position_ids'] = intTensor(this.session, 'position_ids', positions, [1, n], this.Ctor);
    }
    if (this.session.inputNames.includes('logits_to_keep')) {
      // Rank 1 ([1]), not a scalar: the q4f16 graph rejects rank 0 ("Invalid rank ... Expected: 1").
      feeds['logits_to_keep'] = intTensor(this.session, 'logits_to_keep', [1], [1], this.Ctor);
    }
    return feeds;
  }

  /** Feed `ids` after the current cache; returns the last-position logits (and hidden row on request). */
  async run(ids: readonly number[], opts: StepOptions = {}): Promise<StepOutput> {
    const feeds = this.feedsFor(ids, opts.media);
    let outputs: InferenceSession.OnnxValueMapType;
    try {
      outputs = await this.session.run(feeds);
    } catch (error) {
      throw mapRunError(error);
    }
    // The old caches are consumed: free them before keeping the new ones.
    for (const tensor of Object.values(this.caches)) tensor.dispose();
    const next: Record<string, Tensor> = {};
    let logits: Tensor | null = null;
    let hiddenOut: Tensor | null = null;
    for (const [name, value] of Object.entries(outputs)) {
      const past = pastNameFor(name);
      if (past) next[past] = value;
      else if (name === 'logits') logits = value;
      else if (name === 'hidden_states') hiddenOut = value;
      else value.dispose();
    }
    this.caches = next;
    this.pastLength += ids.length;
    const mode = opts.hidden ?? 'none';
    if (!logits) {
      hiddenOut?.dispose();
      throw new WebgpuEngineError('LOAD_FAILED', 'graph returned no logits');
    }
    if (!hiddenOut) {
      if (mode !== 'none') {
        logits.dispose();
        throw new WebgpuEngineError('LOAD_FAILED', 'graph returned no hidden_states');
      }
      return { logits, hidden: null };
    }
    return { logits, hidden: await takeHidden(hiddenOut, mode) };
  }

  dispose(): void {
    for (const tensor of Object.values(this.caches)) tensor.dispose();
    this.caches = {};
  }
}

/**
 * Chunked prefill (chunks of `chunkTokens`, the WebGPU limit) with media rows sliced per chunk;
 * returns the output of the last chunk. All media rows must be consumed (PREPROCESS_FAILED).
 */
export async function prefill(
  step: DecoderStep,
  promptIds: readonly number[],
  chunkTokens: number,
  opts: StepOptions & { checkAbort: () => void },
): Promise<StepOutput | null> {
  const chunk = Math.max(1, chunkTokens);
  let out: StepOutput | null = null;
  for (let start = 0; start < promptIds.length; start += chunk) {
    opts.checkAbort();
    disposeOutput(out);
    const last = start + chunk >= promptIds.length;
    out = await step.run(promptIds.slice(start, start + chunk), { media: opts.media, hidden: last ? opts.hidden : 'none' });
  }
  try {
    opts.media?.assertConsumed();
  } catch (error) {
    disposeOutput(out);
    throw error;
  }
  return out;
}

export function disposeOutput(out: StepOutput | null): void {
  if (!out) return;
  out.logits.dispose();
  if (out.hidden && !(out.hidden instanceof Float32Array)) out.hidden.dispose();
}
