/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Token selection over decoder and depth logits: the greedy argmax of the text lane and a port of the mlx_vlm lfm3_audio sampler with a seedable RNG.
 * @status    feature-local
 */
import type { Tensor } from 'onnxruntime-web/webgpu';

/** IEEE 754 half → float, for argmax over fp16 logits. */
export function halfToFloat(h: number): number {
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  const sign = h & 0x8000 ? -1 : 1;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 0x1f) return frac ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

/** Greedy pick over the last position of the logits tensor (the text lane's decoding). */
export async function greedy(logits: Tensor): Promise<number> {
  const vocab = logits.dims[logits.dims.length - 1] ?? 0;
  const data = await logits.getData();
  const offset = data.length - vocab;
  let best = 0;
  let bestValue = Number.NEGATIVE_INFINITY;
  const half = logits.type === 'float16' && data instanceof Uint16Array;
  for (let i = 0; i < vocab; i++) {
    const raw = data[offset + i];
    const value = half ? halfToFloat(Number(raw)) : Number(raw);
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

/** Last position of a logits tensor as float32 scores (fp16 decoded). */
export async function lastRowScores(logits: Tensor): Promise<Float32Array> {
  const vocab = logits.dims[logits.dims.length - 1] ?? 0;
  const data = await logits.getData();
  const offset = data.length - vocab;
  const out = new Float32Array(vocab);
  const half = logits.type === 'float16' && data instanceof Uint16Array;
  for (let i = 0; i < vocab; i++) {
    const raw = data[offset + i];
    out[i] = half ? halfToFloat(Number(raw)) : Number(raw);
  }
  return out;
}

/** Uniform [0, 1) source; `seededRng` gives a reproducible one. */
export type Rng = () => number;

/** mulberry32: small, fast, seedable PRNG for parity runs. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleOptions {
  temperature?: number | null;
  topK?: number | null;
  repetitionPenalty?: number | null;
  /** Ids to penalize (the caller passes the window, e.g. the last 64 codes). */
  history?: readonly number[] | undefined;
  suppress?: readonly number[] | undefined;
  rng?: Rng | undefined;
}

function argmax(scores: Float32Array): number {
  let best = 0;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < scores.length; i++) {
    const value = scores[i] ?? Number.NEGATIVE_INFINITY;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

/** depth.py: picked < 0 → picked * penalty, else picked / penalty; each id once (take/put along axis). */
function applyRepetitionPenalty(scores: Float32Array, history: readonly number[], penalty: number): void {
  const original = new Map<number, number>();
  for (const id of history) {
    if (id < 0 || id >= scores.length || original.has(id)) continue;
    original.set(id, scores[id] ?? 0);
  }
  for (const [id, picked] of original) scores[id] = picked < 0 ? picked * penalty : picked / penalty;
}

/** Keep the topK highest scores; the rest become -Infinity (mlx apply_top_k). */
function applyTopK(scores: Float32Array, topK: number): void {
  const order = Array.from(scores.keys()).sort((x, y) => (scores[y] ?? 0) - (scores[x] ?? 0));
  for (let r = topK; r < order.length; r++) scores[order[r] ?? 0] = Number.NEGATIVE_INFINITY;
}

/** Categorical draw from unnormalised log-probabilities. */
function categorical(logProbs: Float32Array, rng: Rng): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const v of logProbs) if (v > max) max = v;
  const weights = new Float64Array(logProbs.length);
  let total = 0;
  for (let i = 0; i < logProbs.length; i++) {
    const w = Math.exp((logProbs[i] ?? Number.NEGATIVE_INFINITY) - max);
    weights[i] = w;
    total += w;
  }
  let target = rng() * total;
  let last = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    last = i;
    target -= w;
    if (target < 0) return i;
  }
  return last;
}

/** Port of depth.py `sample` for one row of scores; `scores` is not modified. */
export function sample(scores: Float32Array, opts: SampleOptions = {}): number {
  const work = Float32Array.from(scores);
  const { temperature, topK, repetitionPenalty, history, suppress } = opts;
  if (repetitionPenalty != null && repetitionPenalty !== 1 && history) {
    applyRepetitionPenalty(work, history, repetitionPenalty);
  }
  for (const id of suppress ?? []) if (id >= 0 && id < work.length) work[id] = Number.NEGATIVE_INFINITY;
  if (temperature === 0 || (temperature == null && !topK)) return argmax(work);
  if (temperature) for (let i = 0; i < work.length; i++) work[i] = (work[i] ?? 0) / temperature;
  // log-softmax is a constant shift: it changes neither the top-k set nor the categorical draw.
  if (topK && topK < work.length) applyTopK(work, Math.floor(topK));
  return categorical(work, opts.rng ?? Math.random);
}
