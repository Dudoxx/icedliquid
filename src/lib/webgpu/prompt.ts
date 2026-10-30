/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Builds the decoder prompt ids for every request mode: system turn, media placeholder spans expanded to encoder rows, tools and the speech generation marker.
 * @status    feature-local
 */
import { GEN_MODE, OMNI_MODES, type OmniModeId } from '@/lib/omni/modes';

import { WebgpuEngineError, type WebgpuChatMessage, type WebgpuToolSpec } from './protocol';
import type { ChatTemplateMessage, ChatTemplatePart, ChatTokenizer, SpecialTokenIds } from './tokenizer';

/** The default instructions of the public mlx-vlm LFM3-Omni engine, copied once; the parity spec checks them. */
export const ASR_SYSTEM = 'Perform ASR in English.';
export const TTS_SYSTEM = 'Perform TTS in American English using a female voice.';
export const INTERLEAVED_SYSTEM = 'Respond with interleaved text and audio.';

export type PromptGenerationMode = 'text' | 'audio' | 'interleaved';

/**
 * System turn per mode: audio_to_text = `transcribe` (ASR system, the media is the whole request),
 * text_to_speech = `speak` (TTS system), interleaved = `_generate` inserts INTERLEAVED_SYSTEM when
 * the turns carry no system. Every other mode (audio_to_speech and audio_question included) has none.
 */
const SYSTEM_BY_MODE: Readonly<Partial<Record<OmniModeId, string>>> = {
  audio_to_text: ASR_SYSTEM,
  text_to_speech: TTS_SYSTEM,
  interleaved: INTERLEAVED_SYSTEM,
};

/** `transcribe` sends the clip with an empty text turn; a typed prompt is not part of ASR. */
const MEDIA_ONLY_MODES: ReadonlySet<OmniModeId> = new Set<OmniModeId>(['audio_to_text']);

/** One video: placeholder rows per frame group (h·w/merge²) and each group's mid time in seconds. */
export interface PromptVideo {
  tokensPerGroup: number;
  groupSeconds: readonly number[];
}

/** Encoder row counts per media item, in the order the encoders emit them. */
export interface PromptMedia {
  /** One count per image: t·h·w / merge² of its grid. */
  images?: readonly number[];
  video?: PromptVideo;
  /** One count per clip (encoder rows); for video_audio_to_text the soundtrack clip. */
  audios?: readonly number[];
}

export interface BuildPromptInput {
  mode: OmniModeId;
  prompt: string;
  media?: PromptMedia;
  tools?: readonly WebgpuToolSpec[];
  /** Defaults to the gateway generation_mode of the mode's output kind. */
  generationMode?: PromptGenerationMode;
  /** Earlier text turns, before the current user turn. */
  history?: readonly WebgpuChatMessage[];
  /** Replaces the mode's reference system turn (a session language for ASR / TTS). */
  system?: string;
}

export interface PlaceholderIndex {
  image: number[];
  video: number[];
  audio: number[];
}

export interface BuiltPrompt {
  /** Prompt ids, equal to the reference processor's input_ids. */
  ids: number[];
  /** `ids` plus the generation marker when the mode speaks; the decoder prefill input. */
  generationIds: number[];
  marker: number | null;
  generationMode: PromptGenerationMode;
  /** Positions of each placeholder kind in `ids`, ascending (feature rows scatter in this order). */
  placeholderIndex: PlaceholderIndex;
}

interface MediaTokens {
  image: string;
  video: string;
  audio: string;
  start: string;
  end: string;
}

function fail(message: string): never {
  throw new WebgpuEngineError('PREPROCESS_FAILED', message);
}

/** Python `f"{x:.1f}"`: an exact binary tie (x·4 odd) rounds half to even; toFixed rounds it up. */
export function formatSeconds(x: number): string {
  const quarters = x * 4;
  if (Number.isInteger(quarters) && Math.abs(quarters) % 2 === 1) {
    const low = Math.floor(x * 10);
    return ((low % 2 === 0 ? low : low + 1) / 10).toFixed(1);
  }
  return x.toFixed(1);
}

/**
 * Lfm3OmniProcessor.group_seconds: frame indices padded with the last one to a multiple of the
 * temporal patch, then (first + last) / (2·fps) per group; fps rounded to 6 places first.
 */
export function videoGroupSeconds(frameIndices: readonly number[], fps: number, temporalPatchSize: number): number[] {
  const rate = Number(fps.toFixed(6));
  const last = frameIndices.at(-1);
  if (last === undefined || !(rate > 0) || temporalPatchSize < 1) {
    fail('video metadata requires frame indices and a positive fps');
  }
  const padded = [...frameIndices];
  while (padded.length % temporalPatchSize !== 0) padded.push(last);
  const seconds: number[] = [];
  for (let i = 0; i < padded.length; i += temporalPatchSize) {
    seconds.push(((padded[i] ?? last) + (padded[i + temporalPatchSize - 1] ?? last)) / (2 * rate));
  }
  return seconds;
}

/** Placeholder rows of one image grid [t, h, w] after the merge (t·h·w / merge²). */
export function gridTokens(grid: readonly [number, number, number], mergeSize: number): number {
  return (grid[0] * grid[1] * grid[2]) / (mergeSize * mergeSize);
}

function mediaTokens(tokenizer: ChatTokenizer, ids: SpecialTokenIds): MediaTokens {
  const text = (id: number): string => tokenizer.decode([id]);
  return {
    image: text(ids.image),
    video: text(ids.video),
    audio: text(ids.audio),
    start: tokenizer.visionSpan.start,
    end: tokenizer.visionSpan.end,
  };
}

/** processing_lfm3_omni.py wrap_media: every placeholder inside exactly one span pair. */
function wrapMedia(text: string, t: MediaTokens): string {
  let out = text;
  for (const token of [t.image, t.video, t.audio]) {
    out = out.replaceAll(t.start + token + t.end, token).replaceAll(token, t.start + token + t.end);
  }
  return out;
}

/** Replace the n-th `token` with `replacements[n]`; the counts must match exactly (reference _expand). */
function expand(text: string, token: string, replacements: readonly string[]): string {
  const parts = text.split(token);
  if (parts.length - 1 !== replacements.length) {
    fail(`expected ${replacements.length} ${token} placeholders, got ${parts.length - 1}`);
  }
  return parts.reduce((acc, part, i) => (i === 0 ? part : acc + (replacements[i - 1] ?? '') + part), '');
}

function videoReplacement(video: PromptVideo, t: MediaTokens): string {
  if (video.groupSeconds.length === 0) fail('video has no frame groups');
  return video.groupSeconds
    .map((s) => `<${formatSeconds(s)} seconds>${t.start}${t.video.repeat(video.tokensPerGroup)}${t.end}`)
    .join('');
}

function expandMedia(text: string, media: PromptMedia, t: MediaTokens): string {
  let out = expand(text, t.audio, (media.audios ?? []).map((n) => t.audio.repeat(n)));
  out = expand(out, t.image, (media.images ?? []).map((n) => t.image.repeat(n)));
  return expand(out, t.video, media.video ? [videoReplacement(media.video, t)] : []);
}

/** The media a mode consumes must be exactly the media supplied (never answer without it). */
function checkMedia(mode: OmniModeId, media: PromptMedia): void {
  const input = OMNI_MODES.find((m) => m.id === mode)?.input ?? 'text';
  const has = {
    image: (media.images?.length ?? 0) > 0,
    video: media.video !== undefined,
    audio: (media.audios?.length ?? 0) > 0,
  };
  const want = {
    image: input === 'image',
    video: input === 'video' || input === 'video_audio',
    audio: input === 'audio' || input === 'video_audio',
  };
  for (const kind of ['image', 'video', 'audio'] as const) {
    if (has[kind] !== want[kind]) fail(`mode ${mode} ${want[kind] ? 'needs' : 'does not take'} ${kind} input`);
  }
}

/** The current user turn: a plain string without media (text lane shape), else media parts then text. */
function userTurn(mode: OmniModeId, prompt: string, media: PromptMedia): ChatTemplateMessage {
  const text = MEDIA_ONLY_MODES.has(mode) ? '' : prompt;
  const parts: ChatTemplatePart[] = [
    ...(media.images ?? []).map((): ChatTemplatePart => ({ type: 'image' })),
    ...(media.video ? [{ type: 'video' } as const] : []),
    ...(media.audios ?? []).map((): ChatTemplatePart => ({ type: 'audio' })),
  ];
  if (parts.length === 0) return { role: 'user', content: text };
  return { role: 'user', content: text ? [...parts, { type: 'text', text }] : parts };
}

function placeholderIndex(ids: readonly number[], special: SpecialTokenIds): PlaceholderIndex {
  const index: PlaceholderIndex = { image: [], video: [], audio: [] };
  ids.forEach((id, i) => {
    if (id === special.image) index.image.push(i);
    else if (id === special.video) index.video.push(i);
    else if (id === special.audio) index.audio.push(i);
  });
  return index;
}

/** stream_slots: speech modes append their start marker unless the prompt already ends on one. */
function markerOf(mode: PromptGenerationMode, ids: readonly number[], special: SpecialTokenIds): number | null {
  const last = ids.at(-1);
  if (mode === 'audio') return last === special.audioStart || last === special.audioOut ? null : special.audioStart;
  if (mode === 'interleaved') return last === special.mixedStart ? null : special.mixedStart;
  return null;
}

/** Prompt ids for one playground turn, as the MLX reference processor builds them. */
export function buildPrompt(tokenizer: ChatTokenizer, input: BuildPromptInput): BuiltPrompt {
  const special = tokenizer.specialIds;
  if (!special) throw new WebgpuEngineError('LOAD_FAILED', 'the tokenizer was built without config.json');
  const media = input.media ?? {};
  checkMedia(input.mode, media);
  const omniMode = OMNI_MODES.find((m) => m.id === input.mode);
  const generationMode = input.generationMode ?? (omniMode ? GEN_MODE[omniMode.output] : 'text');

  const messages: ChatTemplateMessage[] = [...(input.history ?? []), userTurn(input.mode, input.prompt, media)];
  const system = input.system ?? SYSTEM_BY_MODE[input.mode];
  const rendered = tokenizer.renderChat(messages, {
    ...(system !== undefined ? { system } : {}),
    ...(input.tools && input.tools.length > 0 ? { tools: input.tools } : {}),
  });
  const tokens = mediaTokens(tokenizer, special);
  const ids = tokenizer.encodeText(expandMedia(wrapMedia(rendered, tokens), media, tokens));
  const marker = markerOf(generationMode, ids, special);
  return {
    ids,
    generationIds: marker === null ? ids : [...ids, marker],
    marker,
    generationMode,
    placeholderIndex: placeholderIndex(ids, special),
  };
}
