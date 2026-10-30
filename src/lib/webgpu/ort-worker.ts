/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     webgpu
 * @purpose   Web Worker that loads the LFM3 ONNX q4f16 decoder on the WebGPU execution provider and runs every request mode through the mode runner, streaming text, audio and tool calls to the UI.
 * @status    feature-local
 */
import * as ort from 'onnxruntime-web/webgpu';

import { cacheInputNames, mapRunError, readTextModelConfig } from './generate';
import { fetchModelText, modelFileUrls } from './model-cache';
import {
  WebgpuEngineError,
  type WebgpuAdapterInfo,
  type WebgpuConfig,
  type WebgpuGenerateRequest,
  type WebgpuWorkerMessage,
  type WebgpuWorkerRequest,
} from './protocol';
import { runMode, type RunnerModel } from './mode-runner';
import { GraphRegistry } from './sessions';
import { createChatTokenizer } from './tokenizer';

// Minimal WebGPU shapes: the project ships no @webgpu/types.
interface GpuAdapterInfoLike {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}
interface GpuAdapterLike {
  info?: GpuAdapterInfoLike;
  limits: object;
}
interface GpuLike {
  requestAdapter(options?: { powerPreference?: 'high-performance' | 'low-power' }): Promise<GpuAdapterLike | null>;
}
interface GpuDeviceLike {
  lost: Promise<{ reason: string; message: string }>;
}

const LIMIT_KEYS = [
  'maxBufferSize',
  'maxStorageBufferBindingSize',
  'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup',
  'maxStorageBuffersPerShaderStage',
] as const;

ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1;

const registry = new GraphRegistry((message) => post(message));
let loaded: RunnerModel | null = null;
let loading: Promise<void> | null = null;
let busy = false;
let deviceLost = false;
let deviceWatched = false;
const aborted = new Set<string>();
/** Device run queue: one session.run sequence at a time. */
let deviceQueue: Promise<unknown> = Promise.resolve();

function onDevice<T>(task: () => Promise<T>): Promise<T> {
  const run = deviceQueue.then(task);
  deviceQueue = run.catch(() => undefined);
  return run;
}

function post(message: WebgpuWorkerMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

/** The GPU is gone: drop the model and every graph session (decoder and side graphs). */
function markDeviceLost(): void {
  deviceLost = true;
  loaded = null;
  registry.clear();
}

function postError(error: unknown, id?: string): void {
  const engineError = mapRunError(error);
  // A run that died on a lost device clears the registry like the device.lost watcher does.
  if (engineError.code === 'DEVICE_LOST' && !deviceLost) markDeviceLost();
  post({ type: 'error', ...(id ? { id } : {}), code: engineError.code, message: engineError.message });
}

function adapterInfo(adapter: GpuAdapterLike): WebgpuAdapterInfo {
  const limits: Record<string, number> = {};
  const source = adapter.limits as Record<string, unknown>;
  for (const key of LIMIT_KEYS) {
    const value = source[key];
    if (typeof value === 'number') limits[key] = value;
  }
  const info = adapter.info ?? {};
  return {
    vendor: info.vendor ?? '',
    architecture: info.architecture ?? '',
    device: info.device ?? '',
    description: info.description ?? '',
    limits,
  };
}

async function requireAdapter(): Promise<GpuAdapterLike> {
  const gpu = (self.navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) throw new WebgpuEngineError('NO_WEBGPU', 'navigator.gpu is not available in this browser');
  let adapter: GpuAdapterLike | null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (error) {
    throw new WebgpuEngineError('ADAPTER_FAILED', error instanceof Error ? error.message : String(error));
  }
  if (!adapter) throw new WebgpuEngineError('ADAPTER_FAILED', 'navigator.gpu.requestAdapter() returned null');
  return adapter;
}

function watchDevice(): void {
  const device = ort.env.webgpu.device as unknown as GpuDeviceLike | undefined;
  if (!device?.lost || deviceWatched) return;
  deviceWatched = true;
  void device.lost.then((info) => {
    deviceWatched = false;
    markDeviceLost();
    post({ type: 'error', code: 'DEVICE_LOST', message: `${info.reason}: ${info.message}` });
  });
}

async function load(config: WebgpuConfig): Promise<void> {
  const started = performance.now();
  const adapter = await requireAdapter();
  const urls = modelFileUrls(config);
  const progress = (file: string, done: number, total: number): void => post({ type: 'progress', file, loaded: done, total });

  // Text files and the decoder fetch in parallel as before; the registry creates the decoder
  // session with the text lane's options (webgpu EP, external data, gpu-buffer outputs).
  const [tokenizerJson, tokenizerConfig, chatTemplate, modelConfigJson, generationConfig, decoder] =
    await Promise.all([
      fetchModelText(urls.tokenizer, progress),
      fetchModelText(urls.tokenizerConfig, progress),
      fetchModelText(urls.chatTemplate, progress),
      fetchModelText(urls.modelConfig, progress),
      fetchModelText(urls.generationConfig, progress),
      registry.ensure(config, 'decoder'),
    ]);

  const modelConfig = readTextModelConfig(modelConfigJson.text);
  const tokenizer = createChatTokenizer({
    tokenizerJson: tokenizerJson.text,
    tokenizerConfigJson: tokenizerConfig.text,
    chatTemplate: chatTemplate.text,
    generationConfigJson: generationConfig.text,
  });

  const session = decoder.session;
  cacheInputNames(session, modelConfig);
  watchDevice();
  deviceLost = false;
  // The raw files stay with the model: the mode runner builds the config.json-aware tokenizer
  // and the speech configs from them on first multimodal use (text_to_text never does).
  const sources = {
    tokenizerJson: tokenizerJson.text,
    tokenizerConfigJson: tokenizerConfig.text,
    chatTemplate: chatTemplate.text,
    generationConfigJson: generationConfig.text,
    modelConfigJson: modelConfigJson.text,
  };
  loaded = { session, tokenizer, modelConfig, config, sources };

  const cacheHit =
    decoder.cacheHit &&
    [tokenizerJson, tokenizerConfig, chatTemplate, modelConfigJson, generationConfig].every((f) => f.cacheHit);
  post({ type: 'ready', model_load_ms: performance.now() - started, cache_hit: cacheHit, adapter: adapterInfo(adapter) });
}

async function runGenerate(request: WebgpuGenerateRequest, t0: number): Promise<void> {
  if (deviceLost) throw new WebgpuEngineError('DEVICE_LOST', 'the GPU device was lost; reload the model');
  if (!loaded) throw new WebgpuEngineError('LOAD_FAILED', 'the model is not loaded');
  if (busy) throw new WebgpuEngineError('LOAD_FAILED', 'another generation is still running');
  busy = true;
  const model = loaded;
  try {
    // Every mode (text_to_text included) runs through the one mode runner (mode-runner.ts),
    // queued on the device.
    await onDevice(() =>
      runMode(request, {
        model,
        registry,
        Ctor: ort.Tensor,
        post,
        t0,
        isAborted: () => aborted.has(request.id),
      }),
    );
  } finally {
    busy = false;
    aborted.delete(request.id);
  }
}

self.onmessage = (event: MessageEvent<WebgpuWorkerRequest>): void => {
  const request = event.data;
  if (request.type === 'load') {
    if (loaded) return;
    loading ??= load(request.config)
      .catch((error: unknown) => postError(error))
      .finally(() => {
        loading = null;
      });
    return;
  }
  if (request.type === 'abort') {
    aborted.add(request.id);
    return;
  }
  const t0 = performance.now();
  void runGenerate(request, t0).catch((error: unknown) => postError(error, request.id));
};
