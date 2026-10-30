/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     webgpu
 * @purpose   Worker-side speech encoder run: 16 kHz PCM to log-mel input_features, the audio_encoder graph from the GraphRegistry, and the backbone audio_features rows that fill the audio placeholders.
 * @status    feature-local
 */
import * as ort from 'onnxruntime-web/webgpu';

import { logMel, readFeatureConfig, type AudioFeatureConfig } from './audio-features';
import { fetchModelText, preprocessFileUrls, type ProgressSink } from './model-cache';
import { WebgpuEngineError, type WebgpuConfig, type WebgpuMelDiagnostics } from './protocol';
import type { GraphRegistry } from './sessions';

/** The preprocessing file that carries `feature_extractor` (one of config/icedliquid.json webgpu.preprocess_files). */
const PROCESSOR_CONFIG = 'processor_config.json';
const INPUT_NAME = 'input_features';
const OUTPUT_NAME = 'audio_features';

export interface EncodeAudioOptions {
  /** The generate request that needs the encoder (echoed on graph_progress). */
  requestId?: string;
  /** Per-file progress of the processor_config.json fetch. */
  onProgress?: ProgressSink;
  /** Opt-in: also return stats of the log-mel input. */
  diagnostics?: boolean;
}

/** Encoder output: `placeholders` rows of `width` floats, row-major. */
export interface EncodedAudio {
  features: Float32Array;
  /** Rows = audio placeholder tokens in the prompt = ceil(numFrames / encoder_stride). */
  placeholders: number;
  /** Backbone hidden width of each row (2048 for LFM3-Omni). */
  width: number;
  /** Log-mel frames fed to the encoder. */
  numFrames: number;
  /** Only when `diagnostics` was set. */
  mel?: WebgpuMelDiagnostics;
}

/**
 * Mean, std and floor share of the normalised log-mel features. The floor value is the one
 * logMel writes for a band with no energy: (log_floor + offset) / divisor, cast to float32.
 */
export function melStats(data: Float32Array, bins: number, frames: number, cfg: AudioFeatureConfig): WebgpuMelDiagnostics {
  const floor = Math.fround((cfg.log_floor + cfg.normalization_offset) / cfg.normalization_divisor);
  let sum = 0;
  let sumSq = 0;
  let atFloor = 0;
  for (const v of data) {
    sum += v;
    sumSq += v * v;
    if (v === floor) atFloor++;
  }
  const n = Math.max(1, data.length);
  const mean = sum / n;
  return {
    frames,
    bins,
    mean,
    std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    floor_share: atFloor / n,
  };
}

let featureConfig: { url: string; promise: Promise<AudioFeatureConfig> } | null = null;

/** processor_config.json `feature_extractor`, fetched once per files_base (a failed fetch is retried next call). */
export function loadFeatureConfig(config: WebgpuConfig, onProgress: ProgressSink = () => undefined): Promise<AudioFeatureConfig> {
  const url = preprocessFileUrls(config)[PROCESSOR_CONFIG];
  if (!url) {
    return Promise.reject(
      new WebgpuEngineError('LOAD_FAILED', `${PROCESSOR_CONFIG} is not in config webgpu.preprocess_files`),
    );
  }
  if (featureConfig?.url === url) return featureConfig.promise;
  const promise = fetchModelText(url, onProgress).then(({ text }) => readFeatureConfig(text));
  featureConfig = { url, promise };
  promise.catch(() => {
    if (featureConfig?.promise === promise) featureConfig = null;
  });
  return promise;
}

function mapRunError(error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|OOM|allocation failed/i.test(message)) return new WebgpuEngineError('OOM', `audio_encoder: ${message}`);
  if (/device.{0,20}lost|lost.{0,20}device/i.test(message)) {
    return new WebgpuEngineError('DEVICE_LOST', `audio_encoder: ${message}`);
  }
  return new WebgpuEngineError('LOAD_FAILED', `audio_encoder session.run: ${message}`);
}

/** Check the output tensor against the placeholder count and copy its rows out of ORT. */
async function readFeatures(output: ort.Tensor | undefined, expectedRows: number): Promise<{ features: Float32Array; width: number }> {
  if (!output) throw new WebgpuEngineError('LOAD_FAILED', `audio_encoder returned no ${OUTPUT_NAME}`);
  if (output.type !== 'float32' || output.dims.length !== 2) {
    throw new WebgpuEngineError(
      'LOAD_FAILED',
      `audio_encoder ${OUTPUT_NAME} is ${output.type} [${output.dims.join(', ')}]; expected float32 [rows, width]`,
    );
  }
  const [rows, width] = output.dims;
  if (rows !== expectedRows) {
    throw new WebgpuEngineError(
      'PREPROCESS_FAILED',
      `audio_encoder produced ${rows} rows for ${expectedRows} audio placeholders (ceil(frames / encoder_stride))`,
    );
  }
  const data = (await output.getData()) as Float32Array;
  // Own copy: the tensor's buffer is released with it.
  // dims.length === 2 was checked above, so width is defined.
  return { features: new Float32Array(data), width: width ?? 0 };
}

/**
 * Encode one mono clip. `sampleRate` is the clip's real rate; anything other than the feature
 * extractor's sampling_rate (16 kHz) is PREPROCESS_FAILED (the main thread resamples, task 012).
 */
export async function encodeAudio(
  registry: GraphRegistry,
  config: WebgpuConfig,
  pcm: Float32Array,
  sampleRate: number,
  options: EncodeAudioOptions = {},
): Promise<EncodedAudio> {
  const cfg = await loadFeatureConfig(config, options.onProgress);
  // Features first: a wrong rate or an empty clip fails before the encoder graph is fetched.
  const mel = logMel(pcm, sampleRate, cfg);
  // exactOptionalPropertyTypes: omit requestId rather than pass undefined.
  const ensureOptions = options.requestId === undefined ? {} : { requestId: options.requestId };
  const entry = await registry.ensure(config, 'audio_encoder', ensureOptions);
  const input = new ort.Tensor('float32', mel.data, [1, mel.numMelBins, mel.numFrames]);
  let outputs: ort.InferenceSession.OnnxValueMapType | null = null;
  try {
    outputs = await entry.session.run({ [INPUT_NAME]: input });
    const { features, width } = await readFeatures(outputs[OUTPUT_NAME], mel.encoderTokens);
    const encoded: EncodedAudio = { features, placeholders: mel.encoderTokens, width, numFrames: mel.numFrames };
    if (options.diagnostics) encoded.mel = melStats(mel.data, mel.numMelBins, mel.numFrames, cfg);
    return encoded;
  } catch (error) {
    throw mapRunError(error);
  } finally {
    input.dispose();
    for (const value of Object.values(outputs ?? {})) value.dispose();
  }
}
