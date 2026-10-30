/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     asr-live
 * @purpose   Deepgram-like event contract of the live (pseudo-streaming) ASR session engine.
 * @status    active
 */

/**
 * The `asr_live` block of the app config (`@/config`). Every knob the engine uses comes from
 * here — no literal number lives in this module.
 */
export interface LiveAsrConfig {
  /** Default language code; the voice session overrides it with its locale. */
  language: string;
  sample_rate: number;
  frame_ms: number;
  interim_interval_ms: number;
  min_first_audio_ms: number;
  min_new_audio_ms: number;
  agreement: number;
  endpoint_silence_ms: number;
  max_utterance_ms: number;
  cut_search_ms: number;
  vad: {
    calibration_ms: number;
    start_threshold_db: number;
    stop_threshold_db: number;
    noise_margin_db: number;
    noise_alpha: number;
    speech_start_ms: number;
    pre_roll_ms: number;
  };
}

/** Per-session choices the user makes before Start (sent with every request of the session). */
export interface LiveAsrOptions {
  /** Language code (the session locale). */
  language: string;
  /** Expected terms (names, product words, a taxonomy), comma-separated; '' = none. Sent as `prompt`. */
  hints: string;
  /** true = capitalise sentence starts + one end mark; false = the model text as returned. */
  format: boolean;
  /** false = no interim re-transcription, one final per utterance (slow transcribers, the voice agent). */
  interim: boolean;
}

/** Options from the config defaults: default language, no hints, formatted finals. */
export function defaultLiveAsrOptions(cfg: LiveAsrConfig): LiveAsrOptions {
  return { language: cfg.language, hints: '', format: true, interim: true };
}

/** One block of mono PCM at `asr_live.sample_rate`. */
export interface LiveAsrFrame {
  pcm: Float32Array;
  /** Audio clock: ms of audio before this frame since the source opened. */
  t0_ms: number;
  /** Wall clock (`performance.now()`) when the frame was produced. */
  wall_ms: number;
}

/** Timing of the one gateway request behind a Results event. */
export interface LiveAsrRequestMetrics {
  /** Wall ms from POST to parsed answer. */
  request_ms: number;
  /** Utterance audio ms sent in this request. */
  audio_ms: number;
  /** Engine that answered (`X-Engine` response header). */
  engine: string;
  /** Wall clock (`performance.now()`) at emit. */
  wall_ms: number;
}

/** Per-utterance numbers, built by metrics.ts from event timestamps. */
export interface LiveAsrUtteranceMetrics {
  /** First interim wall − speech_start wall; null when no interim came before the final. */
  first_interim_ms: number | null;
  /** Final wall − endpoint wall (VAD speech_end or forced cut). */
  final_after_endpoint_ms: number;
  /** final_after_endpoint_ms + endpoint_silence_ms, from measured walls (not assumed). */
  final_after_speech_end_ms: number;
  /** Final request ms / utterance audio ms. */
  rtf_final: number;
  interim_count: number;
  /** Interim ticks skipped because a request was in flight. */
  skipped_ticks: number;
  /** Hypotheses that disagreed inside the committed prefix (never retracted). */
  revisions: number;
  audio_ms: number;
}

/** Whole-session numbers. */
export interface LiveAsrSessionMetrics {
  /** Σ request ms / session wall ms (share of time with a request in flight). */
  gpu_duty: number;
  requests: number;
  request_ms_total: number;
  wall_ms: number;
}

export interface LiveAsrAlternative {
  /** Display text: interim = stable words + tentative tail; final = formatted sentences joined. */
  transcript: string;
  /** The gateway answer as returned (final: before formatting). */
  raw_transcript: string;
  /** Count of leading words of `transcript` that will not change in this utterance. */
  stable_words: number;
  /** Never filled (invariant 2: no synthesised word timestamps). */
  words?: never[];
}

export interface LiveAsrResults {
  type: 'Results';
  utterance_id: string;
  /** Audio-clock seconds of the utterance start (first speech frame minus pre-roll). */
  start: number;
  /** Audio seconds covered by this result. */
  duration: number;
  is_final: boolean;
  speech_final: boolean;
  channel: { alternatives: [LiveAsrAlternative] };
  /** Final only: the sentences of the formatted transcript. */
  sentences?: string[];
  metrics: LiveAsrRequestMetrics;
  /** Final only: the utterance metrics. */
  utterance_metrics?: LiveAsrUtteranceMetrics;
  /** Wall clock at emit (same as metrics.wall_ms; every event carries it). */
  wall_ms: number;
}

export interface LiveAsrSpeechStarted {
  type: 'SpeechStarted';
  utterance_id: string;
  /** Audio-clock seconds of the first speech frame. */
  timestamp: number;
  wall_ms: number;
}

export interface LiveAsrUtteranceEnd {
  type: 'UtteranceEnd';
  utterance_id: string;
  /** Audio-clock seconds where the last speech frame ended. */
  last_speech_end: number;
  wall_ms: number;
}

export const LIVE_ASR_ERROR_CODES = [
  'MIC_DENIED',
  'MIC_MISSING',
  'GATEWAY_UNREACHABLE',
  'ENGINE_REFUSED',
  'LANGUAGE_REFUSED',
  'BUSY',
  'HTTP_ERROR',
  'CONFIG_INVALID',
] as const;

export type LiveAsrErrorCode = (typeof LIVE_ASR_ERROR_CODES)[number];

export interface LiveAsrError {
  type: 'Error';
  code: LiveAsrErrorCode;
  status?: number;
  message: string;
  wall_ms: number;
}

export interface LiveAsrMetadata {
  type: 'Metadata';
  session_id: string;
  config: LiveAsrConfig;
  options: LiveAsrOptions;
  wall_ms: number;
}

export type LiveAsrEvent =
  | LiveAsrResults
  | LiveAsrSpeechStarted
  | LiveAsrUtteranceEnd
  | LiveAsrError
  | LiveAsrMetadata;
