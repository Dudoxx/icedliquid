/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   The codec's inverse STFT in the worker: log-magnitude | angle STFT features to 24 kHz PCM, a port of mlx_vlm lfm3_audio codec.ISTFT.
 * @status    feature-local
 */
import { WebgpuEngineError } from './protocol';

/** STFT geometry of the codec (audio_tokenizer/config.json stft_*). */
export interface IstftGeometry {
  nFft: number;
  hop: number;
}

/** Periodic Hann window 0.5 − 0.5·cos(2πn/N), stored as float32 like the codec buffer. */
export function periodicHann(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return out;
}

/** Prime factors of n, smallest first (1,280 → 2·2·2·2·2·2·2·2·5). */
function factorize(n: number): number[] {
  const factors: number[] = [];
  let rest = n;
  for (let p = 2; p * p <= rest; p++) {
    while (rest % p === 0) {
      factors.push(p);
      rest /= p;
    }
  }
  if (rest > 1) factors.push(rest);
  return factors;
}

/**
 * Mixed-radix complex FFT of a fixed size (recursive decimation in time, twiddles tabulated once).
 * Forward sign: X[k] = Σ x[t]·e^(−2πikt/N). Radix-p butterflies are plain p-point DFTs.
 */
class MixedRadixFft {
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly factors: number[];
  private readonly tmpRe: Float64Array;
  private readonly tmpIm: Float64Array;

  constructor(readonly size: number) {
    this.cos = new Float64Array(size);
    this.sin = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
    this.factors = factorize(size);
    const maxRadix = Math.max(1, ...this.factors);
    this.tmpRe = new Float64Array(maxRadix);
    this.tmpIm = new Float64Array(maxRadix);
  }

  /** out = FFT(in); `in` and `out` are distinct arrays of length `size`. */
  forward(inRe: Float64Array, inIm: Float64Array, outRe: Float64Array, outIm: Float64Array): void {
    this.recurse(inRe, inIm, 0, 1, this.size, outRe, outIm, 0, 0);
  }

  private recurse(
    inRe: Float64Array,
    inIm: Float64Array,
    inOff: number,
    stride: number,
    n: number,
    outRe: Float64Array,
    outIm: Float64Array,
    outOff: number,
    level: number,
  ): void {
    if (n === 1) {
      outRe[outOff] = inRe[inOff] ?? 0;
      outIm[outOff] = inIm[inOff] ?? 0;
      return;
    }
    const p = this.factors[level] ?? n;
    const m = n / p;
    // Sub-DFT q (inputs q, q+p, q+2p, …) lands contiguously at outOff + q·m.
    for (let q = 0; q < p; q++) {
      this.recurse(inRe, inIm, inOff + q * stride, stride * p, m, outRe, outIm, outOff + q * m, level + 1);
    }
    this.butterflies(outRe, outIm, outOff, n, p, m);
  }

  /** X[k + r·m] = Σ_q W_n^(q·(k + r·m)) · Y_q[k], in place (positions {k + q·m} are reused). */
  private butterflies(re: Float64Array, im: Float64Array, off: number, n: number, p: number, m: number): void {
    const step = this.size / n;
    const { tmpRe, tmpIm } = this;
    for (let k = 0; k < m; k++) {
      for (let q = 0; q < p; q++) {
        tmpRe[q] = re[off + q * m + k] ?? 0;
        tmpIm[q] = im[off + q * m + k] ?? 0;
      }
      for (let r = 0; r < p; r++) {
        const index = k + r * m;
        let sumRe = 0;
        let sumIm = 0;
        for (let q = 0; q < p; q++) {
          const e = ((q * index) % n) * step;
          const wr = this.cos[e] ?? 1;
          const wi = this.sin[e] ?? 0;
          const xr = tmpRe[q] ?? 0;
          const xi = tmpIm[q] ?? 0;
          sumRe += xr * wr - xi * wi;
          sumIm += xr * wi + xi * wr;
        }
        re[off + index] = sumRe;
        im[off + index] = sumIm;
      }
    }
  }
}

/**
 * Inverse STFT of the codec (port of codec.ISTFT). One instance per geometry; `fromFeatures`
 * takes the codec's raw `stft_features` rows and returns steps·hop samples.
 */
export class Istft {
  readonly window: Float32Array;
  private readonly fft: MixedRadixFft;
  private readonly bins: number;
  private readonly specRe: Float64Array;
  private readonly specIm: Float64Array;
  private readonly timeRe: Float64Array;
  private readonly timeIm: Float64Array;

  constructor(readonly geometry: IstftGeometry) {
    const { nFft, hop } = geometry;
    if (nFft <= 0 || hop <= 0 || nFft % hop !== 0 || nFft % 2 !== 0) {
      throw new WebgpuEngineError('LOAD_FAILED', `iSTFT needs an even n_fft divisible by hop (n_fft ${nFft}, hop ${hop})`);
    }
    this.window = periodicHann(nFft);
    this.fft = new MixedRadixFft(nFft);
    this.bins = nFft / 2 + 1;
    this.specRe = new Float64Array(nFft);
    this.specIm = new Float64Array(nFft);
    this.timeRe = new Float64Array(nFft);
    this.timeIm = new Float64Array(nFft);
  }

  /** Values per feature row: log_mag[bins] | angle[bins] (1,282 for n_fft 1,280). */
  get featureWidth(): number {
    return 2 * this.bins;
  }

  /**
   * irfft(n = n_fft) of one row (log_mag | angle at `rowOff`) into `frame` (float64, length n_fft).
   * irfft(X)[t] = Re(Σ_k X̃_k e^(+2πikt/N)) / N with the Hermitian extension X̃; computed as
   * Re(FFT(conj X̃))[t] / N.
   */
  private inverseRow(features: Float32Array, rowOff: number, frame: Float64Array): void {
    const n = this.geometry.nFft;
    const { bins, specRe, specIm, timeRe, timeIm } = this;
    for (let k = 0; k < bins; k++) {
      const mag = Math.exp(features[rowOff + k] ?? 0);
      const angle = features[rowOff + bins + k] ?? 0;
      const re = mag * Math.cos(angle);
      // conj(X): negate the imaginary part; DC and Nyquist keep only their real part.
      const im = k === 0 || k === bins - 1 ? 0 : -mag * Math.sin(angle);
      specRe[k] = re;
      specIm[k] = im;
      if (k > 0 && k < bins - 1) {
        // Hermitian mirror of conj(X): conj(conj(X_k)) = X_k at N − k.
        specRe[n - k] = re;
        specIm[n - k] = -im;
      }
    }
    this.fft.forward(specRe, specIm, timeRe, timeIm);
    for (let t = 0; t < n; t++) frame[t] = (timeRe[t] ?? 0) / n;
  }

  /**
   * `features` = [steps, featureWidth] row-major (log_mag | angle per row) → float32 PCM of
   * steps·hop samples ("same" trim, divided by the window envelope, no peak normalisation).
   */
  fromFeatures(features: Float32Array, steps: number): Float32Array {
    const { nFft, hop } = this.geometry;
    const width = this.featureWidth;
    if (steps <= 0) return new Float32Array(0);
    if (features.length !== steps * width) {
      throw new WebgpuEngineError('LOAD_FAILED', `stft_features has ${features.length} values, expected ${steps}×${width}`);
    }
    const total = (steps - 1) * hop + nFft;
    const audio = new Float64Array(total);
    const envelope = new Float64Array(total);
    const frame = new Float64Array(nFft);
    for (let f = 0; f < steps; f++) {
      this.inverseRow(features, f * width, frame);
      const base = f * hop;
      for (let t = 0; t < nFft; t++) {
        const w = this.window[t] ?? 0;
        audio[base + t] = (audio[base + t] ?? 0) + (frame[t] ?? 0) * w;
        envelope[base + t] = (envelope[base + t] ?? 0) + w * w;
      }
    }
    const trim = (nFft - hop) / 2;
    const length = total - 2 * trim;
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) out[i] = (audio[trim + i] ?? 0) / (envelope[trim + i] ?? 1);
    return out;
  }
}
