/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    config
 * @purpose   Zod schema of config/icedliquid.json: every model and voice knob, all keys required.
 * @status    foundation
 *
 * Strict objects: a missing key and an unknown key both fail the parse; no field has a default.
 * The file holds no secret, so client code may import it.
 */
import { z } from 'zod';

const text = z.string().min(1);
const number = z.number();
const textList = z.array(text);

/** Model files: the browser loads `<files_base>/<file>` same-origin; `hf_revision` pins the commit. */
export const webgpuSchema = z.strictObject({
  files_base: text,
  hf_base_url: z.url(),
  hf_repo: text,
  hf_revision: z.string().regex(/^[0-9a-f]{40}$/, 'must be a 40-hex commit sha'),
  onnx_dir: text,
  decoder: text,
  prefill_chunk_tokens: z.int().positive(),
  max_tokens: z.int().positive(),
  /** Side-graph stems under onnx_dir: the audio-in and speech-out graphs. */
  graphs: z.strictObject({
    audio_encoder: text,
    codec_decoder: text,
    depth_decoder: text,
  }),
  /** Preprocessing files, paths relative to files_base. */
  preprocess_files: textList.min(1),
});

/** Model-contract sampling values. */
export const samplingSchema = z.strictObject({
  text_temperature: number,
  audio_temperature: number,
  audio_repetition_penalty: number,
});

/** Live ASR segmentation knobs the browser lane reads (energy VAD, interims, endpoint). */
export const asrLiveSchema = z.strictObject({
  /** Default language code; the voice session overrides it with its locale. */
  language: text,
  sample_rate: z.int().positive(),
  frame_ms: z.int().positive(),
  interim_interval_ms: number,
  min_first_audio_ms: number,
  min_new_audio_ms: number,
  agreement: z.int().positive(),
  endpoint_silence_ms: number,
  max_utterance_ms: number,
  cut_search_ms: number,
  vad: z.strictObject({
    calibration_ms: number,
    start_threshold_db: number,
    stop_threshold_db: number,
    noise_margin_db: number,
    noise_alpha: number,
    speech_start_ms: number,
    pre_roll_ms: number,
  }),
});

/** Server-side tool knobs (weather, time, web search, image generation). */
export const voiceAgentToolsSchema = z.strictObject({
  image_model: text,
  image_aspect_ratios: textList.min(1),
  image_timeout_ms: number,
  weather_days: z.int().positive(),
  search_results: z.int().positive(),
  summary_max_chars: z.int().positive(),
  timeout_ms: number,
  default_time_zone: text,
});

const localeSchema = z.strictObject({
  language: text,
  tts_voice: text,
  greeting: text,
  ungrounded_answer: text,
});

/** Voice agent persona, prompts, phrase lists, budgets and barge-in; `tools` feeds the tool route. */
export const voiceAgentSchema = z.strictObject({
  name: text,
  /** Ears run on the in-browser model only. */
  asr_lane: z.literal('browser'),
  system_prompt: text,
  tool_followup: text,
  asr_system: text,
  tts_system: text,
  locales: z.record(text, localeSchema),
  locale_switch: z.strictObject({
    verbs: textList.min(1),
    names: z.record(text, textList.min(1)),
  }),
  max_tool_rounds: z.int().nonnegative(),
  answer_max_tokens: z.int().positive(),
  speech_max_tokens: z.int().positive(),
  history_turns: z.int().nonnegative(),
  asr_max_tokens: z.int().positive(),
  barge_in: z.strictObject({
    enabled: z.boolean(),
    min_dbfs: number,
    hold_ms: number,
    echo_margin_db: number,
  }),
  echo_tail_ms: number,
  min_utterance_ms: number,
  vad: z.strictObject({
    start_threshold_db: number,
    noise_margin_db: number,
    speech_start_ms: number,
  }),
  phantom_phrases: textList,
  grounding_markers: textList,
  grounding_nudge: text,
  filler_window_ms: number,
  fillers: textList,
  theme_phrases: z.strictObject({ dark: textList.min(1), light: textList.min(1) }),
  goodbye_phrases: textList.min(1),
  tools: voiceAgentToolsSchema,
});

export const appConfigSchema = z.strictObject({
  webgpu: webgpuSchema,
  sampling: samplingSchema,
  asr_live: asrLiveSchema,
  voice_agent: voiceAgentSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type AppWebgpuConfig = z.infer<typeof webgpuSchema>;
export type AppSamplingConfig = z.infer<typeof samplingSchema>;
export type AppAsrLiveConfig = z.infer<typeof asrLiveSchema>;
export type AppVoiceAgentToolsConfig = z.infer<typeof voiceAgentToolsSchema>;
/** The voice_agent block as the browser reads it (the tool knobs stay with the tool route). */
export type AppVoiceAgentConfig = Omit<z.infer<typeof voiceAgentSchema>, 'tools'>;
