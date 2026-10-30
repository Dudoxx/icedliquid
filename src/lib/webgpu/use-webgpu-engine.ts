'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       hook
 * @domain    integration
 * @topic     webgpu
 * @purpose   Client hook over the one WebGPU ONNX worker per tab: load status, download and per-graph progress, adapter info, generate() as an async token/audio/tool-call stream, abort().
 * @status    feature-local
 */
import { useCallback, useSyncExternalStore } from 'react';

import type {
  WebgpuAdapterInfo,
  WebgpuAudioMessage,
  WebgpuChatMessage,
  WebgpuConfig,
  WebgpuDoneMessage,
  WebgpuErrorCode,
  WebgpuGenerateRequest,
  WebgpuGraphProgressMessage,
  WebgpuMediaPayload,
  WebgpuRegistryKey,
  WebgpuTokenMessage,
  WebgpuToolCallsMessage,
  WebgpuWorkerMessage,
  WebgpuWorkerRequest,
} from './protocol';

export type WebgpuEngineStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface WebgpuFileProgress {
  loaded: number;
  total: number;
}

/** Last graph_progress of one graph: fetch (bytes downloaded), create (session build), ready. */
export interface WebgpuGraphProgress {
  phase: WebgpuGraphProgressMessage['phase'];
  loaded: number;
  total: number;
}

export interface WebgpuEngineState {
  status: WebgpuEngineStatus;
  progress: Readonly<Record<string, WebgpuFileProgress>>;
  graphs: Readonly<Partial<Record<WebgpuRegistryKey, WebgpuGraphProgress>>>;
  /** Bytes of every resident graph (sum of ready graphs; the worker's `done` value wins). */
  residentBytes: number;
  adapter: WebgpuAdapterInfo | null;
  modelLoadMs: number | null;
  cacheHit: boolean | null;
  error: { code: WebgpuErrorCode; message: string } | null;
}

export class WebgpuGenerateError extends Error {
  readonly code: WebgpuErrorCode;

  constructor(code: WebgpuErrorCode, message: string) {
    super(message);
    this.name = 'WebgpuGenerateError';
    this.code = code;
  }
}

/** One mode request as the UI builds it; `id` defaults to a fresh UUID. */
export type WebgpuRunRequest = Omit<WebgpuGenerateRequest, 'type' | 'id'> & {
  id?: string | undefined;
};

/** Events of a mode request: text deltas, 24 kHz PCM chunks, parsed tool calls. */
export type WebgpuRunEvent = WebgpuTokenMessage | WebgpuAudioMessage | WebgpuToolCallsMessage;

/** Both call shapes return the final `done` stats and throw WebgpuGenerateError. */
export interface WebgpuGenerateFn {
  /** Text lane (text_to_text): yields token events only. */
  (
    messages: WebgpuChatMessage[],
    maxTokens: number,
    id?: string,
  ): AsyncGenerator<WebgpuTokenMessage, WebgpuDoneMessage>;
  /** Any mode: yields token, audio and tool_calls events. */
  (request: WebgpuRunRequest): AsyncGenerator<WebgpuRunEvent, WebgpuDoneMessage>;
}

export interface WebgpuEngine extends WebgpuEngineState {
  load: (config: WebgpuConfig) => void;
  generate: WebgpuGenerateFn;
  abort: (id: string) => void;
}

type RequestListener = (message: WebgpuWorkerMessage) => void;

const INITIAL: WebgpuEngineState = {
  status: 'idle',
  progress: {},
  graphs: {},
  residentBytes: 0,
  adapter: null,
  modelLoadMs: null,
  cacheHit: null,
  error: null,
};

// One worker per tab, shared by every component that uses the hook.
let worker: Worker | null = null;
let state: WebgpuEngineState = INITIAL;
const subscribers = new Set<() => void>();
const requestListeners = new Map<string, RequestListener>();

function setState(patch: Partial<WebgpuEngineState>): void {
  state = { ...state, ...patch };
  for (const notify of subscribers) notify();
}

function readyBytes(graphs: WebgpuEngineState['graphs']): number {
  let sum = 0;
  for (const graph of Object.values(graphs)) if (graph?.phase === 'ready') sum += graph.loaded;
  return sum;
}

function onGraphProgress(message: WebgpuGraphProgressMessage): void {
  const graphs = {
    ...state.graphs,
    [message.graph]: { phase: message.phase, loaded: message.loaded, total: message.total },
  };
  setState({ graphs, residentBytes: readyBytes(graphs) });
}

function onWorkerMessage(event: MessageEvent<WebgpuWorkerMessage>): void {
  const message = event.data;
  if (message.type === 'graph_progress') {
    onGraphProgress(message);
    return;
  }
  if (message.type === 'progress') {
    setState({
      progress: {
        ...state.progress,
        [message.file]: { loaded: message.loaded, total: message.total },
      },
    });
    return;
  }
  if (message.type === 'ready') {
    setState({
      status: 'ready',
      adapter: message.adapter,
      modelLoadMs: message.model_load_ms,
      cacheHit: message.cache_hit,
      error: null,
    });
    return;
  }
  if (message.type === 'error' && !message.id) {
    // A lost device released every graph session in the worker.
    const cleared = message.code === 'DEVICE_LOST' ? { graphs: {}, residentBytes: 0 } : {};
    setState({
      status: 'error',
      error: { code: message.code, message: message.message },
      ...cleared,
    });
    for (const listener of requestListeners.values()) listener(message);
    return;
  }
  const listener = requestListeners.get(message.id ?? '');
  if (listener) listener(message);
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./ort-worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', onWorkerMessage);
    worker.addEventListener('error', (event) => {
      setState({
        status: 'error',
        error: { code: 'LOAD_FAILED', message: event.message || 'worker failed to start' },
      });
    });
  }
  return worker;
}

function send(request: WebgpuWorkerRequest, transfer: Transferable[] = []): void {
  ensureWorker().postMessage(request, transfer);
}

/** PCM buffers of a payload, each once (a duplicate makes postMessage throw). */
function transferList(media: WebgpuMediaPayload | undefined): Transferable[] {
  if (!media) return [];
  const out = new Set<Transferable>();
  for (const pcm of [media.audio])
    if (pcm && pcm.buffer instanceof ArrayBuffer) out.add(pcm.buffer);
  return [...out];
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

function snapshot(): WebgpuEngineState {
  return state;
}

function serverSnapshot(): WebgpuEngineState {
  return INITIAL;
}

function loadModel(config: WebgpuConfig): void {
  if (state.status === 'loading' || state.status === 'ready' || state.status === 'generating')
    return;
  setState({ status: 'loading', progress: {}, graphs: {}, residentBytes: 0, error: null });
  send({ type: 'load', config });
}

async function* runStream(
  run: WebgpuRunRequest,
): AsyncGenerator<WebgpuRunEvent, WebgpuDoneMessage> {
  if (state.status !== 'ready') {
    throw new WebgpuGenerateError(
      state.error?.code ?? 'LOAD_FAILED',
      state.error?.message ?? 'the WebGPU model is not loaded',
    );
  }
  const { id: requestId, ...body } = run;
  const id = requestId ?? crypto.randomUUID();
  const queue: WebgpuWorkerMessage[] = [];
  let wake: (() => void) | null = null;
  requestListeners.set(id, (message) => {
    queue.push(message);
    wake?.();
  });
  setState({ status: 'generating' });
  try {
    send({ type: 'generate', id, ...body }, transferList(body.media));
    for (;;) {
      const message = queue.shift();
      if (!message) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = null;
        continue;
      }
      if (message.type === 'token' || message.type === 'audio' || message.type === 'tool_calls')
        yield message;
      else if (message.type === 'done') {
        setState({ residentBytes: message.graphs_resident_bytes });
        return message;
      } else if (message.type === 'error')
        throw new WebgpuGenerateError(message.code, message.message);
    }
  } finally {
    requestListeners.delete(id);
    // `state` changed while awaiting worker messages; widen the narrowed literal before comparing.
    if ((state.status as WebgpuEngineStatus) === 'generating') setState({ status: 'ready' });
  }
}

/** Text-lane shape: the same stream with token events only (text_to_text emits nothing else). */
async function* tokenStream(
  run: WebgpuRunRequest,
): AsyncGenerator<WebgpuTokenMessage, WebgpuDoneMessage> {
  const stream = runStream(run);
  for (;;) {
    const next = await stream.next();
    if (next.done) return next.value;
    if (next.value.type === 'token') yield next.value;
  }
}

function generateRequest(
  messages: WebgpuChatMessage[],
  maxTokens: number,
  id?: string,
): AsyncGenerator<WebgpuTokenMessage, WebgpuDoneMessage>;
function generateRequest(
  request: WebgpuRunRequest,
): AsyncGenerator<WebgpuRunEvent, WebgpuDoneMessage>;
function generateRequest(
  first: WebgpuChatMessage[] | WebgpuRunRequest,
  maxTokens?: number,
  id?: string,
): AsyncGenerator<WebgpuRunEvent, WebgpuDoneMessage> {
  if (Array.isArray(first)) return tokenStream({ messages: first, max_tokens: maxTokens ?? 1, id });
  return runStream(first);
}

function abortRequest(id: string): void {
  if (worker) send({ type: 'abort', id });
}

export function useWebgpuEngine(): WebgpuEngine {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const load = useCallback((config: WebgpuConfig) => loadModel(config), []);
  const abort = useCallback((id: string) => abortRequest(id), []);
  // generateRequest is module scope, so its identity is already stable across renders.
  return { ...current, load, generate: generateRequest, abort };
}

/** Resolve once the model is resident (`ready`/`generating`); reject on a load error. */
function whenReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (): boolean => {
      if (state.status === 'ready' || state.status === 'generating') {
        resolve();
        return true;
      }
      if (state.status === 'error') {
        reject(
          new WebgpuGenerateError(
            state.error?.code ?? 'LOAD_FAILED',
            state.error?.message ?? 'the WebGPU model failed to load',
          ),
        );
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsubscribe = subscribe(() => {
      if (check()) unsubscribe();
    });
  });
}

/**
 * Non-React access to the one tab worker, for runtimes outside a component (the voice agent).
 * The same functions the hook returns; one worker per tab either way.
 */
export const webgpuEngine = {
  load: loadModel,
  generate: generateRequest,
  abort: abortRequest,
  state: snapshot,
  whenReady,
} as const;
