/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Types of the in-browser voice agent: the voice_agent config mirror, agent states and the handler callbacks the UI provides.
 * @status    active
 */
import type { SpeechPlayer } from '@/lib/omni/speech-player';

/** The `voice_agent` block of the app config (`@/config`). */
export interface VoiceAgentConfig {
  name: string;
  /** Ears lane; only `browser` (WebGPU audio_to_text) runs, any other value fails the session. */
  asr_lane: string;
  /** Templates filled per session locale (`locale.ts`): {language}, {voice}, {results}. */
  system_prompt: string;
  tool_followup: string;
  asr_system: string;
  tts_system: string;
  /** Per-locale language name, TTS voice and the greeting spoken once at start. */
  locales: Record<string, { language: string; tts_voice: string; greeting: string; ungrounded_answer: string }>;
  /** Voice-agent-only VAD (louder, longer speech than the shared asr_live.vad), merged over it. */
  vad: { start_threshold_db: number; noise_margin_db: number; speech_start_ms: number };
  /** ASR phantom lines on noise (subtitle credits); a final containing one is dropped. */
  phantom_phrases: string[];
  /** Grounding guard: data-number markers and the retry instruction ({language}). */
  grounding_markers: string[];
  grounding_nudge: string;
  /** One switch verb + exactly one language name (any language) switches the conversation language at once. */
  locale_switch: { verbs: string[]; names: Record<string, string[]> };
  max_tool_rounds: number;
  answer_max_tokens: number;
  speech_max_tokens: number;
  history_turns: number;
  asr_max_tokens: number;
  /** Speaking over the assistant cuts its answer (mic level gate while it talks). */
  barge_in: { enabled: boolean; min_dbfs: number; hold_ms: number; echo_margin_db: number };
  /** Mic stays closed this long after playback ends (speaker latency + room echo). */
  echo_tail_ms: number;
  /** Shorter utterances are noise, not a request. */
  min_utterance_ms: number;
  /** A lone filler heard this soon after the assistant stopped is echo or noise. */
  filler_window_ms: number;
  fillers: string[];
  /** Phrases that end the session after the spoken answer (any language). */
  goodbye_phrases: string[];
  /** Phrases that switch the screen theme at once (any language). */
  theme_phrases: { dark: string[]; light: string[] };
}

/** loading = model download/warm-up; tool = a tool call is running. */
export type VoiceAgentState =
  | 'loading'
  | 'listening'
  | 'hearing'
  | 'thinking'
  | 'tool'
  | 'speaking'
  | 'idle';

/**
 * Measured timings of one turn, sent in parts as each stage ends (all wall ms, `performance.now()`).
 * ears = the final ASR pass; brain = thinking time without tool calls; voice_first_audio = speak
 * start → first audio chunk; reply = user's final words → first audio (what the user waits).
 */
export interface VoiceTurnMetrics {
  ears_ms: number;
  ears_engine: string;
  first_interim_ms: number | null;
  brain_ms: number;
  tool_ms: number;
  voice_first_audio_ms: number;
  reply_ms: number;
  /** Prompt tokens of the last brain round = context the model read (system + history + tools). */
  context_tokens: number;
  /** Tokens the brain generated over all rounds, and their rate over the rounds' wall time. */
  brain_tokens: number;
  brain_tok_s: number;
  /** Generate rounds (tool calls add one each). */
  rounds: number;
  /** Speech codec tokens of the spoken answer and their rate. */
  voice_tokens: number;
  voice_tok_s: number;
}

export interface VoiceAgentToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Present once the tool answered. */
  result?: { ok: boolean; [key: string]: unknown };
  ms?: number;
}

export interface VoiceAgentHandlers {
  onState: (state: VoiceAgentState) => void;
  /** The user's words: `final` false while still speaking (interim), true once the turn is taken. */
  onUser: (id: string, text: string, final: boolean) => void;
  /** The assistant's answer text; `final` once the text is complete. */
  onAssistant: (id: string, text: string, final: boolean) => void;
  onTool: (event: VoiceAgentToolEvent) => void;
  /** The player of the answer being spoken (null when it ends): read `level()` per frame for visuals. */
  onSpeechPlayer?: (player: SpeechPlayer | null) => void;
  /** Output level 0..1 while speaking (orb). */
  onLevel: (level: number) => void;
  /** Runs a page tool (set_theme, end_session); absent = those tools answer ok:false. */
  onClientTool?: (name: string, args: Record<string, unknown>) => { ok: boolean; [key: string]: unknown };
  /** A heard utterance was dropped as noise or echo: remove its live (interim) line. */
  onDiscard?: (utteranceId: string) => void;
  /** Optional: timings of a turn, merged by turn id as each stage ends. */
  onMetrics?: (turnId: string, metrics: Partial<VoiceTurnMetrics>) => void;
  /** Fatal for the session: the agent stops and releases the microphone. */
  onError: (code: string, message: string) => void;
}
