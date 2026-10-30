/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Speech frames to 24 kHz PCM in the worker: the codec_decoder graph (codes → STFT features) followed by the local inverse STFT.
 * @status    feature-local
 */
import type { InferenceSession, Tensor } from 'onnxruntime-web/webgpu';

import type { TensorCtor } from './decoder-step';
import { Istft } from './istft';
import { WebgpuEngineError } from './protocol';

/** audio_tokenizer/config.json facts the decode path needs. */
export interface CodecConfig {
  numCodebooks: number;
  /** prod(fsq_levels): valid codes are [0, codebookSize). */
  codebookSize: number;
  sampleRate: number;
  nFft: number;
  hop: number;
  frameStack: number;
  /** Samples per codec frame (stft_frame_stack · hop). */
  frameSamples: number;
}

function num(rec: Record<string, unknown>, key: string): number {
  const value = rec[key];
  if (typeof value !== 'number') throw new WebgpuEngineError('LOAD_FAILED', `audio_tokenizer/config.json lacks ${key}`);
  return value;
}

export function readCodecConfig(codecConfigJson: string): CodecConfig {
  const root: unknown = JSON.parse(codecConfigJson);
  if (typeof root !== 'object' || root === null) throw new WebgpuEngineError('LOAD_FAILED', 'audio_tokenizer/config.json is not an object');
  const rec = root as Record<string, unknown>;
  const levels = rec['fsq_levels'];
  if (!Array.isArray(levels) || !levels.every((v): v is number => typeof v === 'number' && v > 0)) {
    throw new WebgpuEngineError('LOAD_FAILED', 'audio_tokenizer/config.json lacks fsq_levels');
  }
  const nFft = num(rec, 'stft_n_fft');
  const hop = num(rec, 'stft_hop_length');
  if (num(rec, 'stft_win_length') !== nFft || nFft % hop !== 0) {
    throw new WebgpuEngineError('LOAD_FAILED', 'Liquid codec needs stft_win_length == stft_n_fft and n_fft % hop == 0');
  }
  const frameStack = num(rec, 'stft_frame_stack');
  const frameSamples = frameStack * hop;
  const declared = rec['frame_samples'];
  if (typeof declared === 'number' && declared !== frameSamples) {
    throw new WebgpuEngineError('LOAD_FAILED', `frame_samples ${declared} != stft_frame_stack·hop ${frameSamples}`);
  }
  return {
    numCodebooks: num(rec, 'n_q'),
    codebookSize: levels.reduce((a, b) => a * b, 1),
    sampleRate: num(rec, 'sampling_rate'),
    nFft,
    hop,
    frameStack,
    frameSamples,
  };
}

/** audio_codes [1, n_q, T] (codebook-major) from T frames of n_q codes; range-checked. */
function codesTensor(frames: readonly Int32Array[], cfg: CodecConfig, Ctor: TensorCtor): Tensor {
  const t = frames.length;
  const k = cfg.numCodebooks;
  const data = new BigInt64Array(k * t);
  for (let f = 0; f < t; f++) {
    const frame = frames[f];
    if (!frame || frame.length !== k) {
      throw new WebgpuEngineError('PREPROCESS_FAILED', `codec frame ${f} has ${frame?.length ?? 0} codes, expected ${k}`);
    }
    for (let q = 0; q < k; q++) {
      const code = frame[q] ?? -1;
      if (code < 0 || code >= cfg.codebookSize) {
        throw new WebgpuEngineError(
          'PREPROCESS_FAILED',
          `codec code ${code} (frame ${f}, codebook ${q}) is outside [0, ${cfg.codebookSize}); EOS frames never reach the codec`,
        );
      }
      data[q * t + f] = BigInt(code);
    }
  }
  return new Ctor('int64', data, [1, k, t]);
}

function codecRunError(error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|OOM|allocation failed/i.test(message)) return new WebgpuEngineError('OOM', message);
  if (/device.{0,20}lost|lost.{0,20}device/i.test(message)) return new WebgpuEngineError('DEVICE_LOST', message);
  return new WebgpuEngineError('LOAD_FAILED', `codec_decoder: ${message}`);
}

/** STFT features of T frames: [steps, width] row-major, steps = T · frameStack. */
export interface StftFeatures {
  data: Float32Array;
  steps: number;
  width: number;
}

/** codec_decoder on T frames → STFT features (log_mag | angle per row). */
export async function decodeFrames(
  session: InferenceSession,
  Ctor: TensorCtor,
  frames: readonly Int32Array[],
  cfg: CodecConfig,
): Promise<StftFeatures> {
  const width = cfg.nFft + 2;
  if (frames.length === 0) return { data: new Float32Array(0), steps: 0, width };
  const feeds = { audio_codes: codesTensor(frames, cfg, Ctor) };
  let outputs: InferenceSession.OnnxValueMapType;
  try {
    outputs = await session.run(feeds);
  } catch (error) {
    throw codecRunError(error);
  }
  try {
    const out = outputs['stft_features'];
    if (!out) throw new WebgpuEngineError('LOAD_FAILED', 'codec_decoder returned no stft_features');
    const steps = frames.length * cfg.frameStack;
    const [batch, seq, w] = out.dims;
    if (batch !== 1 || seq !== steps || w !== width) {
      throw new WebgpuEngineError('LOAD_FAILED', `stft_features dims [${out.dims.join(', ')}], expected [1, ${steps}, ${width}]`);
    }
    const raw = await out.getData();
    const data = raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>, Number);
    return { data, steps, width };
  } finally {
    for (const value of Object.values(outputs)) value.dispose();
  }
}

/** Codec session + iSTFT, both in the worker: frames → mono float32 PCM at cfg.sampleRate. */
export class SpeechCodec {
  private readonly istft: Istft;

  constructor(
    private readonly session: InferenceSession,
    private readonly Ctor: TensorCtor,
    readonly config: CodecConfig,
  ) {
    this.istft = new Istft({ nFft: config.nFft, hop: config.hop });
  }

  /** T frames → T · frameSamples samples (no peak normalisation). */
  async toPcm(frames: readonly Int32Array[]): Promise<Float32Array> {
    const features = await decodeFrames(this.session, this.Ctor, frames, this.config);
    const pcm = this.istft.fromFeatures(features.data, features.steps);
    if (pcm.length !== frames.length * this.config.frameSamples) {
      throw new WebgpuEngineError('LOAD_FAILED', `iSTFT gave ${pcm.length} samples for ${frames.length} frames`);
    }
    return pcm;
  }
}
