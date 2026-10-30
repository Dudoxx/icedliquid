/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     webgpu
 * @purpose   Worker-side runner for the voice-path modes: lazy graph loads per mode, audio encoding, prompt assembly, then the text, tool-call or speech loop.
 * @status    feature-local
 */
import type { InferenceSession } from 'onnxruntime-web/webgpu';

import { findMode, GEN_MODE, type OmniMode, type OmniModality } from '@/lib/omni/modes';
import type { OmniTool } from '@/lib/omni/request';

import { encodeAudio } from './audio-encoder';
import { readCodecConfig } from './codec';
import { MediaFeeds, readMediaTokenIds, type MediaInput, type MediaRows, type MediaTokenIds, type TensorCtor, type TextModelConfig } from './decoder-step';
import { readDepthConfig } from './depth-maskgit';
import { generate, type GenerateResult } from './generate';
import { fetchModelText, preprocessFileUrls, type ProgressSink } from './model-cache';
import { buildPrompt, type PromptMedia } from './prompt';
import {
  WebgpuEngineError,
  type WebgpuAudioDiagnostics,
  type WebgpuConfig,
  type WebgpuDiagnostics,
  type WebgpuGenerateRequest,
  type WebgpuGraphKey,
  type WebgpuToolSpec,
  type WebgpuWorkerMessage,
} from './protocol';
import type { GraphRegistry } from './sessions';
import { ensureSpeechGraphs, readSpeechConfig, runSpeechLoop, type SpeechModels } from './speech-loop';
import { createChatTokenizer, type ChatTokenizer, type ChatTokenizerSources } from './tokenizer';
import { ToolCallStream } from './tool-calls';

/** Codec geometry file (`webgpu.preprocess_files`); an HF file name, not a graph. */
const CODEC_CONFIG_FILE = 'audio_tokenizer/config.json';
/** Mic / OfflineAudioContext rate of every PCM payload (the capture side resamples to it). */
const PAYLOAD_SAMPLE_RATE = 16000;

/** What the worker loaded once (load()): the decoder session, the text tokenizer and the raw files. */
export interface RunnerModel {
  session: InferenceSession;
  tokenizer: ChatTokenizer;
  modelConfig: TextModelConfig;
  config: WebgpuConfig;
  /** The text files of load(), kept to build the multimodal tokenizer and the speech configs. */
  sources: ChatTokenizerSources & { modelConfigJson: string };
}

export type RunnerPost = (message: WebgpuWorkerMessage, transfer?: Transferable[]) => void;

export interface RunnerContext {
  model: RunnerModel;
  registry: GraphRegistry;
  Ctor: TensorCtor;
  post: RunnerPost;
  /** performance.now() when the worker received the request. */
  t0: number;
  isAborted: () => boolean;
}

/** Per loaded model: the config.json-aware tokenizer and the speech configs, built on first need. */
interface MultimodalAssets {
  tokenizer: ChatTokenizer;
  mediaTokenIds: MediaTokenIds;
}
const assetCache = new WeakMap<RunnerModel, MultimodalAssets>();
const codecCache = new WeakMap<RunnerModel, Promise<string>>();

const GRAPHS_BY_NEED: Readonly<Record<OmniModality, readonly WebgpuGraphKey[]>> = {
  text_in: ['decoder'],
  text_out: ['decoder'],
  audio_in: ['audio_encoder'],
  speech_out: ['depth_decoder', 'codec_decoder'],
};

/** Graph keys of one mode, decoder first, in load order, deduplicated. */
export function graphsFor(mode: OmniMode): WebgpuGraphKey[] {
  const keys: WebgpuGraphKey[] = ['decoder'];
  for (const need of mode.needs) for (const key of GRAPHS_BY_NEED[need]) if (!keys.includes(key)) keys.push(key);
  return keys;
}

function fail(step: string, message: string): WebgpuEngineError {
  return new WebgpuEngineError('PREPROCESS_FAILED', `${step}: ${message}`);
}

function multimodalAssets(model: RunnerModel): MultimodalAssets {
  let assets = assetCache.get(model);
  if (!assets) {
    assets = {
      tokenizer: createChatTokenizer(model.sources),
      mediaTokenIds: readMediaTokenIds(model.sources.modelConfigJson),
    };
    assetCache.set(model, assets);
  }
  return assets;
}

function progressSink(post: RunnerPost): ProgressSink {
  return (file, loaded, total) => post({ type: 'progress', file, loaded, total });
}

function codecConfigText(ctx: RunnerContext): Promise<string> {
  let pending = codecCache.get(ctx.model);
  if (!pending) {
    const url = preprocessFileUrls(ctx.model.config)[CODEC_CONFIG_FILE];
    pending = url
      ? fetchModelText(url, progressSink(ctx.post)).then((file) => file.text)
      : Promise.reject(new WebgpuEngineError('MISSING_GRAPH', `${CODEC_CONFIG_FILE}: not in config webgpu.preprocess_files`));
    // A failed fetch is retried on the next request, never cached.
    void pending.catch(() => codecCache.delete(ctx.model));
    codecCache.set(ctx.model, pending);
  }
  return pending;
}

/** OpenAI function tools of the request (ToolCallStream needs name + parameters). */
function toolPool(specs: readonly WebgpuToolSpec[] | undefined): OmniTool[] {
  const out: OmniTool[] = [];
  for (const spec of specs ?? []) {
    const fn = spec['function'];
    if (spec['type'] !== 'function' || typeof fn !== 'object' || fn === null) continue;
    const name = (fn as Record<string, unknown>)['name'];
    if (typeof name === 'string' && name) out.push(spec as unknown as OmniTool);
  }
  return out;
}

/** Last user turn = the prompt text; earlier turns = template history. */
function splitTurns(request: WebgpuGenerateRequest): { prompt: string; history: WebgpuGenerateRequest['messages'] } {
  const last = request.messages.at(-1);
  if (last?.role !== 'user') return { prompt: '', history: request.messages };
  return { prompt: last.content, history: request.messages.slice(0, -1) };
}

interface EncodedMedia {
  prompt: PromptMedia;
  rows: Partial<Record<MediaInput, MediaRows>>;
  /** Filled only when the request set `diagnostics: true`. */
  diagnostics?: WebgpuDiagnostics;
}

/**
 * Level of the PCM as the worker received it (after the main thread resampled to 16 kHz).
 * Measured here, in the worker: the tab's copy was transferred and is detached.
 */
export function audioStats(pcm: Float32Array, sampleRate: number): WebgpuAudioDiagnostics {
  let sumSq = 0;
  let peak = 0;
  let clipped = 0;
  for (const s of pcm) {
    const a = Math.abs(s);
    sumSq += s * s;
    if (a > peak) peak = a;
    // Full scale: a float sample at or beyond ±1 was clipped by capture or resampling.
    if (a >= 1) clipped++;
  }
  const n = pcm.length;
  const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;
  return {
    samples: n,
    sample_rate: sampleRate,
    duration_ms: (n / sampleRate) * 1000,
    rms_dbfs: rms > 0 ? 20 * Math.log10(rms) : null,
    peak,
    clipped_share: n > 0 ? clipped / n : 0,
  };
}

/** Encoder of the mode's input kind (audio is the only media input). */
async function encodeMedia(ctx: RunnerContext, mode: OmniMode, request: WebgpuGenerateRequest): Promise<EncodedMedia> {
  const out: EncodedMedia = { prompt: {}, rows: {} };
  if (mode.input === 'text') return out;
  const media = request.media ?? {};
  if (mode.input === 'audio') {
    const pcm = media.audio;
    if (!pcm || pcm.length === 0) throw fail('audio', `mode ${mode.id} needs 16 kHz mono PCM`);
    const diagnostics = request.diagnostics === true;
    const audioLevel = diagnostics ? audioStats(pcm, PAYLOAD_SAMPLE_RATE) : null;
    const audio = await encodeAudio(ctx.registry, ctx.model.config, pcm, PAYLOAD_SAMPLE_RATE, {
      requestId: request.id,
      onProgress: progressSink(ctx.post),
      diagnostics,
    });
    out.prompt.audios = [audio.placeholders];
    out.rows.audio_features = { data: audio.features, width: audio.width };
    if (audioLevel) out.diagnostics = { ...out.diagnostics, audio: audioLevel, ...(audio.mel ? { mel: audio.mel } : {}) };
  }
  return out;
}

function maxTokensOf(ctx: RunnerContext, request: WebgpuGenerateRequest): number {
  return Math.max(1, Math.min(request.max_tokens, ctx.model.config.max_tokens));
}

function postDone(
  ctx: RunnerContext,
  id: string,
  result: GenerateResult,
  audio: { ttfa_ms: number | null; audio_frames: number },
  diagnostics?: WebgpuDiagnostics,
): void {
  ctx.post({
    type: 'done',
    id,
    ...result,
    ...audio,
    graphs_resident_bytes: ctx.registry.residentBytes(),
    ...(diagnostics ? { diagnostics } : {}),
  });
}

/** text_to_text: the proven text lane, unchanged (load-time tokenizer, encodeChat, greedy). */
async function runTextLane(ctx: RunnerContext, request: WebgpuGenerateRequest): Promise<void> {
  const { model } = ctx;
  const result = await generate(model.session, ctx.Ctor, model.modelConfig, model.tokenizer, {
    promptIds: model.tokenizer.encodeChat(request.messages),
    maxTokens: maxTokensOf(ctx, request),
    prefillChunkTokens: model.config.prefill_chunk_tokens,
    t0: ctx.t0,
    isAborted: ctx.isAborted,
    onToken: (text, tMs) => ctx.post({ type: 'token', id: request.id, text, t_ms: tMs }),
  });
  postDone(ctx, request.id, result, { ttfa_ms: null, audio_frames: 0 });
}

/** Text answers over media prompts, and the tools mode (tokens held through ToolCallStream). */
async function runTextOut(ctx: RunnerContext, mode: OmniMode, request: WebgpuGenerateRequest, encoded: EncodedMedia): Promise<void> {
  const { model } = ctx;
  const assets = multimodalAssets(model);
  const tools = mode.tools ? toolPool(request.tools) : [];
  const { prompt, history } = splitTurns(request);
  const built = buildPrompt(assets.tokenizer, {
    mode: mode.id,
    prompt,
    media: encoded.prompt,
    history,
    generationMode: 'text',
    ...(request.system ? { system: request.system } : {}),
    ...(mode.tools && request.tools ? { tools: request.tools } : {}),
  });
  const stream = mode.tools ? new ToolCallStream(tools) : null;
  const emit = (text: string, tMs: number): void => ctx.post({ type: 'token', id: request.id, text, t_ms: tMs });
  const diagnostics: WebgpuDiagnostics | undefined = request.diagnostics === true ? { ...encoded.diagnostics } : undefined;
  const result = await generate(model.session, ctx.Ctor, model.modelConfig, assets.tokenizer, {
    promptIds: built.ids,
    maxTokens: maxTokensOf(ctx, request),
    prefillChunkTokens: model.config.prefill_chunk_tokens,
    t0: ctx.t0,
    isAborted: ctx.isAborted,
    onToken: (text, tMs) => emit(stream ? stream.feed(text) : text, tMs),
    media: new MediaFeeds(assets.mediaTokenIds, encoded.rows),
    onFirstStep: diagnostics
      ? (stats) => {
          diagnostics.first_token = stats;
        }
      : undefined,
  });
  if (stream) {
    const parsed = stream.finish();
    const tMs = performance.now() - ctx.t0;
    if (parsed.calls.length > 0) ctx.post({ type: 'tool_calls', id: request.id, calls: parsed.calls });
    // Held text that was not a call (or text around the calls) is shown once at the end.
    if (parsed.content) emit(parsed.content, tMs);
  }
  postDone(ctx, request.id, result, { ttfa_ms: null, audio_frames: 0 }, diagnostics);
}

/** `stream_frame_batch` when the config carries it; else the speech-loop default. */
function frameBatchOf(config: WebgpuConfig): number | undefined {
  const value = (config as WebgpuConfig & { stream_frame_batch?: unknown }).stream_frame_batch;
  return typeof value === 'number' && value > 0 ? value : undefined;
}

async function speechModels(ctx: RunnerContext, requestId: string): Promise<SpeechModels> {
  const { model } = ctx;
  const assets = multimodalAssets(model);
  const [graphs, codecJson] = await Promise.all([ensureSpeechGraphs(ctx.registry, model.config, requestId), codecConfigText(ctx)]);
  const { modelConfigJson, generationConfigJson } = model.sources;
  return {
    graphs,
    Ctor: ctx.Ctor,
    textConfig: model.modelConfig,
    tokenizer: assets.tokenizer,
    mediaTokenIds: assets.mediaTokenIds,
    speech: readSpeechConfig(modelConfigJson, generationConfigJson),
    depth: readDepthConfig(modelConfigJson, generationConfigJson),
    codec: readCodecConfig(codecJson),
  };
}

/** Speech and interleaved output: stream_slots loop, PCM chunks transferred to the UI. */
async function runSpeechOut(ctx: RunnerContext, mode: OmniMode, request: WebgpuGenerateRequest, encoded: EncodedMedia): Promise<void> {
  const models = await speechModels(ctx, request.id);
  const { prompt, history } = splitTurns(request);
  const generationMode = request.generation_mode ?? GEN_MODE[mode.output];
  const built = buildPrompt(models.tokenizer, { mode: mode.id, prompt, media: encoded.prompt, history, generationMode, ...(request.system ? { system: request.system } : {}) });
  const sampleRate = models.codec.sampleRate;
  const result = await runSpeechLoop(models, {
    promptIds: built.generationIds,
    generationMode: built.generationMode,
    maxTokens: maxTokensOf(ctx, request),
    prefillChunkTokens: ctx.model.config.prefill_chunk_tokens,
    t0: ctx.t0,
    isAborted: ctx.isAborted,
    onToken: (text, tMs) => ctx.post({ type: 'token', id: request.id, text, t_ms: tMs }),
    onAudio: (pcm, frames, tMs) =>
      ctx.post({ type: 'audio', id: request.id, pcm, sample_rate: sampleRate, frames, t_ms: tMs }, [pcm.buffer as ArrayBuffer]),
    media: new MediaFeeds(models.mediaTokenIds, encoded.rows),
    frameBatch: frameBatchOf(ctx.model.config),
  });
  const { ttfa_ms, audio_frames, ...textResult } = result;
  postDone(ctx, request.id, textResult, { ttfa_ms, audio_frames });
}

/** Load exactly the mode's graphs, serially, before any encoder or loop touches them. */
async function ensureGraphs(ctx: RunnerContext, mode: OmniMode, requestId: string): Promise<void> {
  for (const key of graphsFor(mode)) await ctx.registry.ensure(ctx.model.config, key, { requestId });
}

/** Run one generate request in the worker; posts token/audio/tool_calls then done, or throws. */
export async function runMode(request: WebgpuGenerateRequest, ctx: RunnerContext): Promise<void> {
  const mode = findMode(request.mode ?? 'text_to_text');
  if (request.mode && mode.id !== request.mode) throw new WebgpuEngineError('LOAD_FAILED', `unknown mode ${request.mode}`);
  if (mode.id === 'text_to_text') {
    await runTextLane(ctx, request);
    return;
  }
  await ensureGraphs(ctx, mode, request.id);
  const encoded = await encodeMedia(ctx, mode, request);
  if (mode.output === 'text') await runTextOut(ctx, mode, request, encoded);
  else await runSpeechOut(ctx, mode, request, encoded);
}
