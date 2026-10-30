/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     webgpu
 * @purpose   Lazy registry of the ONNX graph sessions (decoder plus side graphs): loads one graph at a time on the WebGPU EP, posts graph_progress, keeps a byte ledger and refuses graphs that need CPU nodes.
 * @status    feature-local
 */
import * as ort from 'onnxruntime-web/webgpu';

import { fetchModelFile, graphFileUrls, type FetchedFile } from './model-cache';
import {
  WebgpuEngineError,
  type WebgpuConfig,
  type WebgpuErrorCode,
  type WebgpuGraphProgressMessage,
  type WebgpuProgressMessage,
  type WebgpuRegistryKey,
} from './protocol';

/** Per-graph session options. */
export interface GraphSpec {
  /** Where outputs stay; the decoder keeps `gpu-buffer` (KV caches never leave the GPU). */
  preferredOutputLocation?: ort.InferenceSession.SessionOptions['preferredOutputLocation'];
  /** Create with disable_cpu_ep_fallback and refuse a graph that ORT places partly on CPU. */
  strict: boolean;
}

/**
 * Decoder options are exactly the text lane's (proven 2026-10-29). Side graphs use the same
 * placement: a live run (2026-10-29) showed `disable_cpu_ep_fallback` refuses
 * audio_encoder and depth_decoder because ORT puts its small shape/index ops on CPU by design.
 * Decision: that ORT shape placement is allowed (logged as a warning); model math stays on
 * WebGPU, and a missing WebGPU is still a hard NO_WEBGPU error, never a CPU run.
 */
export const DECODER_SPEC: GraphSpec = { preferredOutputLocation: 'gpu-buffer', strict: false };
export const SIDE_GRAPH_SPEC: GraphSpec = { strict: false };

/** Tensor names each graph must expose (dumped from the ONNX files). */
const GRAPH_IO: Readonly<Record<WebgpuRegistryKey, { inputs: readonly string[]; outputs: readonly string[] }>> = {
  decoder: { inputs: ['input_ids', 'attention_mask', 'position_ids'], outputs: ['logits', 'hidden_states'] },
  audio_encoder: { inputs: ['input_features'], outputs: ['audio_features'] },
  codec_decoder: { inputs: ['audio_codes'], outputs: ['stft_features'] },
  depth_decoder: { inputs: ['hidden_states', 'codes', 'masked'], outputs: ['logits'] },
};

export interface GraphEntry {
  key: WebgpuRegistryKey;
  session: ort.InferenceSession;
  /** Graph + external-data bytes handed to ORT (the ledger value). */
  bytes: number;
  /** Both files came from the OPFS copy (no download). */
  cacheHit: boolean;
}

/** The graph file, its external data (absent for a single-file graph) and the stem for messages. */
interface GraphFiles {
  graph: FetchedFile;
  data: { file: FetchedFile; name: string } | null;
  stem: string;
}

export type GraphPost = (message: WebgpuGraphProgressMessage | WebgpuProgressMessage) => void;

export interface EnsureOptions {
  /** The generate request that needs the graph (echoed on graph_progress). */
  requestId?: string;
  spec?: GraphSpec;
}

const OOM_RE = /out of memory|OOM/i;
const CPU_FALLBACK_RE =
  /not assigned to the preferred execution providers|fallback to CPU EP has been explicitly disabled|assigned to the default CPU EP/i;

// ORT's own warnings carry the node-placement line; 'warning' is the level that prints it.
ort.env.logLevel = 'warning';

/** Lines printed by console during the active create; null when no create is running. */
let captured: string[] | null = null;

function installConsoleCapture(): void {
  const methods = ['log', 'info', 'warn', 'error'] as const;
  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]): void => {
      if (captured) captured.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
      original(...args);
    };
  }
}

// Before the first InferenceSession.create, which is when the wasm runtime binds console.
installConsoleCapture();

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** ORT create error → engine error code: OOM, CPU_FALLBACK, else LOAD_FAILED naming the graph. */
export function mapCreateError(stem: string, error: unknown): WebgpuEngineError {
  if (error instanceof WebgpuEngineError) return error;
  const message = messageOf(error);
  let code: WebgpuErrorCode = 'LOAD_FAILED';
  if (OOM_RE.test(message)) code = 'OOM';
  else if (CPU_FALLBACK_RE.test(message)) code = 'CPU_FALLBACK';
  return new WebgpuEngineError(code, `${stem}: ${message}`);
}

function checkGraphIo(key: WebgpuRegistryKey, stem: string, session: ort.InferenceSession): void {
  const expected = GRAPH_IO[key];
  const missing = [
    ...expected.inputs.filter((name) => !session.inputNames.includes(name)),
    ...expected.outputs.filter((name) => !session.outputNames.includes(name)),
  ];
  if (missing.length > 0) {
    throw new WebgpuEngineError('LOAD_FAILED', `${stem}: graph lacks tensors ${missing.join(', ')}`);
  }
}

function stemOf(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1).replace(/\.onnx$/, '');
}

export class GraphRegistry {
  private readonly entries = new Map<WebgpuRegistryKey, GraphEntry>();
  private readonly pending = new Map<WebgpuRegistryKey, Promise<GraphEntry>>();
  private chain: Promise<unknown> = Promise.resolve();
  /** Bumped by clear(); a load that finishes under an older epoch is released, not kept. */
  private epoch = 0;
  private readonly post: GraphPost;

  constructor(post: GraphPost) {
    this.post = post;
  }

  get(key: WebgpuRegistryKey): GraphEntry | undefined {
    return this.entries.get(key);
  }

  /** Bytes per resident graph. */
  ledger(): Partial<Record<WebgpuRegistryKey, number>> {
    const out: Partial<Record<WebgpuRegistryKey, number>> = {};
    for (const [key, entry] of this.entries) out[key] = entry.bytes;
    return out;
  }

  residentBytes(): number {
    let sum = 0;
    for (const entry of this.entries.values()) sum += entry.bytes;
    return sum;
  }

  /** The resident session for `key`, else a load queued behind every earlier one. */
  ensure(config: WebgpuConfig, key: WebgpuRegistryKey, options: EnsureOptions = {}): Promise<GraphEntry> {
    const resident = this.entries.get(key);
    if (resident) return Promise.resolve(resident);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const spec = options.spec ?? (key === 'decoder' ? DECODER_SPEC : SIDE_GRAPH_SPEC);
    const run = this.chain.then(() => this.load(config, key, spec, options.requestId));
    // The chain survives a failed load; the caller still sees the rejection.
    this.chain = run.catch(() => undefined);
    const tracked = run.finally(() => this.pending.delete(key));
    this.pending.set(key, tracked);
    return tracked;
  }

  /** Release every session (device lost); in-flight loads are released when they finish. */
  clear(): void {
    this.epoch += 1;
    for (const entry of this.entries.values()) void entry.session.release().catch(() => undefined);
    this.entries.clear();
  }

  private progress(
    key: WebgpuRegistryKey,
    phase: WebgpuGraphProgressMessage['phase'],
    loaded: number,
    total: number,
    id?: string,
  ): void {
    this.post({ type: 'graph_progress', ...(id ? { id } : {}), graph: key, phase, loaded, total });
  }

  private fileSink(key: WebgpuRegistryKey, id?: string): (file: string, loaded: number, total: number) => void {
    const perFile = new Map<string, { loaded: number; total: number }>();
    const onFile = (file: string, loaded: number, total: number): void => {
      this.post({ type: 'progress', file, loaded, total });
      perFile.set(file, { loaded, total });
      let sumLoaded = 0;
      let sumTotal = 0;
      for (const f of perFile.values()) {
        sumLoaded += f.loaded;
        sumTotal += f.total;
      }
      this.progress(key, 'fetch', sumLoaded, sumTotal, id);
    };
    return onFile;
  }

  private async fetchFiles(config: WebgpuConfig, key: WebgpuRegistryKey, id?: string): Promise<GraphFiles> {
    const onFile = this.fileSink(key, id);
    const urls = graphFileUrls(config, key);
    const [graph, data] = await Promise.all([
      fetchModelFile(urls.graph, onFile, 'MISSING_GRAPH'),
      fetchModelFile(urls.data, onFile, 'MISSING_GRAPH'),
    ]);
    return { graph, data: { file: data, name: urls.dataName }, stem: stemOf(urls.graph) };
  }

  private async create(
    stem: string,
    graph: Uint8Array,
    options: ort.InferenceSession.SessionOptions,
  ): Promise<{ session: ort.InferenceSession; log: string[] }> {
    const log: string[] = [];
    captured = log;
    try {
      return { session: await ort.InferenceSession.create(graph, options), log };
    } catch (error) {
      throw mapCreateError(stem, error);
    } finally {
      captured = null;
    }
  }

  private sessionOptions(spec: GraphSpec, data: GraphFiles['data']): ort.InferenceSession.SessionOptions {
    return {
      executionProviders: ['webgpu'],
      ...(data ? { externalData: [{ path: data.name, data: new Uint8Array(data.file.bytes) }] } : {}),
      ...(spec.preferredOutputLocation ? { preferredOutputLocation: spec.preferredOutputLocation } : {}),
      ...(spec.strict ? { extra: { session: { disable_cpu_ep_fallback: '1' } } } : {}),
    };
  }

  private async load(config: WebgpuConfig, key: WebgpuRegistryKey, spec: GraphSpec, id?: string): Promise<GraphEntry> {
    const epoch = this.epoch;
    const files = await this.fetchFiles(config, key, id);
    const { stem } = files;
    const bytes = files.graph.bytes.byteLength + (files.data?.file.bytes.byteLength ?? 0);
    const cacheHit = files.graph.cacheHit && (files.data?.file.cacheHit ?? true);
    this.progress(key, 'create', bytes, bytes, id);
    // The ArrayBuffers are referenced only by these views; they drop when create returns.
    const graph = new Uint8Array(files.graph.bytes);
    const options = this.sessionOptions(spec, files.data);
    const { session, log } = await this.create(stem, graph, options);
    try {
      const placement = log.find((line) => CPU_FALLBACK_RE.test(line));
      if (placement && spec.strict) {
        throw new WebgpuEngineError('CPU_FALLBACK', `${stem}: ORT placed nodes off WebGPU — ${placement}`);
      }
      if (placement) console.warn(`[webgpu] ${stem}: ${placement}`);
      checkGraphIo(key, stem, session);
      if (epoch !== this.epoch) throw new WebgpuEngineError('DEVICE_LOST', `${stem}: the GPU device was lost during load`);
    } catch (error) {
      await session.release().catch(() => undefined);
      throw error;
    }
    console.info(`[webgpu] ${stem} ready`, { inputs: session.inputNames, outputs: session.outputNames, bytes });
    const entry: GraphEntry = { key, session, bytes, cacheHit };
    this.entries.set(key, entry);
    this.progress(key, 'ready', bytes, bytes, id);
    return entry;
  }
}
