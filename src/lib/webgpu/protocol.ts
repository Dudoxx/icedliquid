/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     webgpu
 * @purpose   Typed messages between the UI and the WebGPU ONNX worker: load, generate, abort in; progress, graph_progress, ready, token, audio, tool_calls, done, error out.
 * @status    feature-local
 */
import type { OmniModeId } from '@/lib/omni/modes';
import type { OmniToolCall } from '@/lib/omni/types';

/** Key of one ONNX graph: `decoder` maps to `config.decoder`, the rest to `config.graphs[key]`. */
export type WebgpuGraphKey = 'decoder' | 'audio_encoder' | 'codec_decoder' | 'depth_decoder';

/** Side-graph stems per key, from the `webgpu.graphs` config block. */
export type WebgpuGraphStems = Partial<Record<Exclude<WebgpuGraphKey, 'decoder'>, string>>;

/** Every session the GraphRegistry owns. Kept apart from WebgpuGraphKey so keyed mode labels stay exhaustive. */
export type WebgpuRegistryKey = WebgpuGraphKey;

/** The `webgpu` block of the app config (`@/config`). */
export interface WebgpuConfig {
  /** Same-origin prefix of the downloaded model files (/api/models). */
  files_base: string;
  hf_base_url: string;
  hf_repo: string;
  onnx_dir: string;
  decoder: string;
  prefill_chunk_tokens: number;
  max_tokens: number;
  /**
   * Side graphs (stems under onnx_dir). Optional so the text lane keeps loading with the
   * decoder-only block; a mode that needs an absent key fails with MISSING_GRAPH.
   */
  graphs?: WebgpuGraphStems;
  /** Preprocessing files, paths relative to files_base. */
  preprocess_files?: string[];
}

export interface WebgpuChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface WebgpuAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  limits: Record<string, number>;
}

export type WebgpuErrorCode =
  | 'NO_WEBGPU'
  | 'ADAPTER_FAILED'
  | 'LOAD_FAILED'
  | 'DEVICE_LOST'
  | 'OOM'
  | 'ABORTED'
  /** A graph or preprocessing file answered 404 (message names the file + download hint). */
  | 'MISSING_GRAPH'
  /** The graph needs nodes the WebGPU EP cannot run; it is not run on CPU (invariant 2). */
  | 'CPU_FALLBACK'
  /** Audio preprocessing failed before the encoder ran. */
  | 'PREPROCESS_FAILED';

// UI → worker
export interface WebgpuLoadRequest {
  type: 'load';
  config: WebgpuConfig;
}

/** Media payloads; every buffer and bitmap travels as a transferable (postMessage transfer list). */
export interface WebgpuMediaPayload {
  /** Mono PCM at 16 kHz. */
  audio?: Float32Array;
}

/** OpenAI-style function tool, passed through to the chat template unchanged. */
export type WebgpuToolSpec = Record<string, unknown>;

export interface WebgpuGenerateRequest {
  type: 'generate';
  id: string;
  /** Absent means `text_to_text` (the text lane request shape stays valid). */
  mode?: OmniModeId;
  /** Gateway generation_mode per output kind; absent means `text`. */
  generation_mode?: 'text' | 'audio' | 'interleaved';
  messages: WebgpuChatMessage[];
  max_tokens: number;
  tools?: WebgpuToolSpec[];
  media?: WebgpuMediaPayload;
  /**
   * System turn of audio_to_text / text_to_speech in place of the reference English one
   * (`Perform ASR in German.`, `Perform TTS in French using a female voice.`); absent = reference.
   */
  system?: string;
  /**
   * Opt-in ASR diagnostics: audio level, mel floor share and the
   * first step's EOS probability travel on `done.diagnostics`. Absent = no extra work, no field.
   */
  diagnostics?: boolean;
}

export interface WebgpuAbortRequest {
  type: 'abort';
  id: string;
}

export type WebgpuWorkerRequest =
  | WebgpuLoadRequest
  | WebgpuGenerateRequest
  | WebgpuAbortRequest;

// worker → UI
export interface WebgpuProgressMessage {
  type: 'progress';
  file: string;
  loaded: number;
  /** Bytes expected; 0 when the server sent no content-length. */
  total: number;
}

/** Lazy load of one graph: fetch (bytes of graph + data), create (session build), ready (resident). */
export interface WebgpuGraphProgressMessage {
  type: 'graph_progress';
  /** The generate request that needed the graph; absent during the model load. */
  id?: string;
  graph: WebgpuRegistryKey;
  phase: 'fetch' | 'create' | 'ready';
  loaded: number;
  /** Bytes expected; 0 when the route sent no content-length. */
  total: number;
}

export interface WebgpuReadyMessage {
  type: 'ready';
  model_load_ms: number;
  cache_hit: boolean;
  adapter: WebgpuAdapterInfo;
}

export interface WebgpuTokenMessage {
  type: 'token';
  id: string;
  /** Decoded text added by this token (may be empty for a partial UTF-8 sequence). */
  text: string;
  t_ms: number;
}

export interface WebgpuAudioMessage {
  type: 'audio';
  id: string;
  /** Mono PCM at 24 kHz (transferred). */
  pcm: Float32Array;
  sample_rate: number;
  /** Codec frames decoded into this chunk. */
  frames: number;
  t_ms: number;
}

export interface WebgpuToolCallsMessage {
  type: 'tool_calls';
  id: string;
  calls: OmniToolCall[];
}

/** Level of the PCM the worker received (16 kHz mono), measured before the encoder. */
export interface WebgpuAudioDiagnostics {
  samples: number;
  sample_rate: number;
  duration_ms: number;
  /** 20·log10(rms); null for an all-zero clip. */
  rms_dbfs: number | null;
  /** Largest |sample|. */
  peak: number;
  /** Share of samples at full scale (|s| >= 1). */
  clipped_share: number;
}

/** Stats of the normalised log-mel input_features fed to the audio encoder. */
export interface WebgpuMelDiagnostics {
  frames: number;
  bins: number;
  mean: number;
  std: number;
  /** Share of mel values sitting exactly on the normalised log_floor (silence / no energy). */
  floor_share: number;
}

/** Softmax of the first decode step (the token chosen right after prefill). */
export interface WebgpuFirstTokenDiagnostics {
  /** Summed probability of every end-of-sequence id. */
  eos_prob: number;
  top5: Array<{ id: number; token: string; p: number }>;
}

/** Present on `done` only when the request set `diagnostics: true`. */
export interface WebgpuDiagnostics {
  audio?: WebgpuAudioDiagnostics;
  mel?: WebgpuMelDiagnostics;
  first_token?: WebgpuFirstTokenDiagnostics;
}

export interface WebgpuDoneMessage {
  type: 'done';
  id: string;
  text: string;
  prompt_tokens: number;
  /** Generated ids, think markers included, end-of-sequence excluded. */
  completion_tokens: number;
  /** First decoded token (any content, think marker included). */
  ttfc_ms: number | null;
  /** First token after which the text minus the empty think block holds real text. */
  ttft_ms: number | null;
  last_chunk_ms: number | null;
  /** First audio chunk; null for text-only output. */
  ttfa_ms: number | null;
  /** Codec frames emitted; 0 for text-only output. */
  audio_frames: number;
  /** Bytes of every graph (graph + external data) resident when the request finished. */
  graphs_resident_bytes: number;
  /** Only when the request set `diagnostics: true`. */
  diagnostics?: WebgpuDiagnostics;
}

export interface WebgpuErrorMessage {
  type: 'error';
  /** Set when the error belongs to one generate request; absent for load/device errors. */
  id?: string;
  code: WebgpuErrorCode;
  message: string;
}

export type WebgpuWorkerMessage =
  | WebgpuProgressMessage
  | WebgpuGraphProgressMessage
  | WebgpuReadyMessage
  | WebgpuTokenMessage
  | WebgpuAudioMessage
  | WebgpuToolCallsMessage
  | WebgpuDoneMessage
  | WebgpuErrorMessage;

/** Thrown inside the worker; `code` travels to the UI unchanged. */
export class WebgpuEngineError extends Error {
  readonly code: WebgpuErrorCode;

  constructor(code: WebgpuErrorCode, message: string) {
    super(message);
    this.name = 'WebgpuEngineError';
    this.code = code;
  }
}
