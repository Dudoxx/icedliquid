/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   The voice-agent session: microphone → VAD + browser ASR → tool-calling brain → streamed browser speech, half-duplex with tap-to-interrupt.
 * @status    active
 */
import { asr_live, voice_agent, webgpu } from '@/config';
import { createLiveAsrSession, type LiveAsrSession } from '@/lib/asr-live/engine';
import {
  defaultLiveAsrOptions,
  type LiveAsrConfig,
  type LiveAsrEvent,
  type LiveAsrResults,
} from '@/lib/asr-live/events';
import { micSource, type LiveAsrSource } from '@/lib/asr-live/sources';
import type { SpeechPlayer } from '@/lib/omni/speech-player';
import type { WebgpuChatMessage } from '@/lib/webgpu/protocol';
import { webgpuEngine } from '@/lib/webgpu/use-webgpu-engine';

import { speak, speechText, think, webgpuTranscriber, type RunSlot, type RunUsage } from './brain';
import { createBargeIn } from './barge-in';
import { gatedSource } from './gated-source';
import { resolveVoiceLocale, type VoiceAgentLocale } from './locale';
import { isGoodbye, localeIntent, rejectReason, themeIntent } from './turn-filter';
import { callVoiceAgentTool, CLIENT_TOOLS, type VoiceAgentToolAnswer } from './tools';
import type { VoiceAgentConfig, VoiceAgentHandlers, VoiceAgentToolEvent, VoiceTurnMetrics } from './types';

export interface VoiceAgentSession {
  /** Stop speaking / thinking now and listen again (barge-in by tap). */
  interrupt(): void;
  /** A typed message: runs the same turn as a spoken one; false while the agent is busy. */
  ask(text: string): boolean;
  close(): Promise<void>;
}

type ConfigGraph = keyof typeof webgpu.graphs;

/** The webgpu side graphs each needed modality runs on (the decoder alone serves text_out). */
const NEEDED: Readonly<Record<'audio_in' | 'text_out' | 'speech_out', readonly ConfigGraph[]>> = {
  audio_in: ['audio_encoder'],
  text_out: [],
  speech_out: ['depth_decoder', 'codec_decoder'],
};

/** `voice_agent.asr_lane` names ears this app does not ship; only the in-browser lane runs. */
export class VoiceAgentAsrLaneError extends Error {
  readonly lane: string;

  constructor(lane: string) {
    super(`voice_agent.asr_lane "${lane}" is not supported: only "browser" ears run in this app`);
    this.name = 'VoiceAgentAsrLaneError';
    this.lane = lane;
  }
}

interface LoadedConfig {
  asr: LiveAsrConfig;
  agent: VoiceAgentConfig;
}

async function loadConfig(): Promise<LoadedConfig> {
  const agent: VoiceAgentConfig = voice_agent;
  if (agent.asr_lane !== 'browser') throw new VoiceAgentAsrLaneError(agent.asr_lane);
  const missing = (Object.keys(NEEDED) as (keyof typeof NEEDED)[]).find((m) =>
    NEEDED[m].some((graph) => !webgpu.graphs[graph]),
  );
  if (missing) throw new Error(`WebGPU ${missing} is not available: config webgpu.graphs lacks its graph`);
  webgpuEngine.load(webgpu);
  await webgpuEngine.whenReady();
  return { asr: asr_live, agent };
}

/** Wraps the output-level callback to report the ms from `started` to the first audible chunk once. */
function firstAudioTap(
  onLevel: (level: number) => void,
  onFirstAudio: ((ms: number) => void) | undefined,
): (level: number) => void {
  const started = performance.now();
  let first = true;
  return (level) => {
    if (first && level > 0) {
      first = false;
      onFirstAudio?.(performance.now() - started);
    }
    onLevel(level);
  };
}

/** Optional timing hooks of one spoken answer. */
interface SayHooks {
  onFirstAudio?: (ms: number) => void;
  onUsage?: (u: RunUsage) => void;
}

/** Voice timings of one turn: first audio + reply wait, then speech tokens and their rate. */
function voiceHooks(handlers: VoiceAgentHandlers, turnId: string, heardAt: number): SayHooks {
  return {
    onFirstAudio: (ms) => handlers.onMetrics?.(turnId, { voice_first_audio_ms: ms, reply_ms: performance.now() - heardAt }),
    onUsage: (u) => handlers.onMetrics?.(turnId, { voice_tokens: u.completion_tokens, voice_tok_s: rate(u.completion_tokens, u.wall_ms) }),
  };
}

/** Tool events → state (tool while it runs, thinking once it answered) + the UI line. */
function toolRelay(handlers: VoiceAgentHandlers): (event: VoiceAgentToolEvent) => void {
  return (event) => {
    handlers.onState(event.result ? 'thinking' : 'tool');
    handlers.onTool(event);
  };
}

/**
 * Run a page tool the user asked for in plain words (goodbye, theme) and show it as a tool call,
 * even when the small model answers in words without calling the tool.
 */
function clientAction(handlers: VoiceAgentHandlers, name: string, args: Record<string, unknown>): void {
  const event: VoiceAgentToolEvent = { id: crypto.randomUUID(), name, args };
  const result = handlers.onClientTool?.(name, args) ?? { ok: false, error: `${name} is not available here` };
  handlers.onTool({ ...event, result, ms: 0 });
}

/** Append one exchange and keep the last `turns` exchanges. */
function remember(history: WebgpuChatMessage[], user: string, answer: string, turns: number): void {
  history.push({ role: 'user', content: user }, { role: 'assistant', content: answer });
  history.splice(0, Math.max(0, history.length - turns * 2));
}

/** Tokens per second of `tokens` over `ms` (0 when nothing ran). */
const rate = (tokens: number, ms: number): number => (ms > 0 ? (tokens * 1000) / ms : 0);

/** think() with its tool time and token usage split out: brain_ms = thinking time without tools. */
async function timedThink(
  run: (onTool: (event: VoiceAgentToolEvent) => void, onUsage: (u: RunUsage) => void) => Promise<string>,
  onTool: (event: VoiceAgentToolEvent) => void,
): Promise<{ answer: string; metrics: Partial<VoiceTurnMetrics> }> {
  const started = performance.now();
  let toolMs = 0;
  const use = { context: 0, tokens: 0, ms: 0, rounds: 0 };
  const answer = await run(
    (event) => {
      toolMs += event.ms ?? 0;
      onTool(event);
    },
    (u) => {
      use.context = u.prompt_tokens;
      use.tokens += u.completion_tokens;
      use.ms += u.wall_ms;
      use.rounds += 1;
    },
  );
  return {
    answer,
    metrics: {
      brain_ms: performance.now() - started - toolMs,
      tool_ms: toolMs,
      context_tokens: use.context,
      brain_tokens: use.tokens,
      brain_tok_s: rate(use.tokens, use.ms),
      rounds: use.rounds,
    },
  };
}

/** Page tools go to the UI handler, every other tool to the server route (in the session locale). */
function toolRunner(
  handlers: VoiceAgentHandlers,
  locale: string,
): (name: string, args: Record<string, unknown>) => Promise<VoiceAgentToolAnswer> {
  return async (name, args) => {
    if (!CLIENT_TOOLS.has(name)) return callVoiceAgentTool(name, args, locale);
    const started = performance.now();
    const result = handlers.onClientTool?.(name, args) ?? { ok: false, error: `${name} is not available here` };
    return { result, ms: performance.now() - started };
  };
}

/** Ears timings of a final ASR result. */
function earsMetrics(event: LiveAsrResults): Partial<VoiceTurnMetrics> {
  return {
    ears_ms: event.metrics.request_ms,
    ears_engine: event.metrics.engine,
    first_interim_ms: event.utterance_metrics?.first_interim_ms ?? null,
  };
}

/**
 * The ears: live ASR over the gated mic with the browser transcriber (one WebGPU `audio_to_text`
 * pass). The mic gate is closed while the brain and voice run, so interim passes never compete
 * with them for the one WebGPU worker (measured 2026-10-30: first interim 0.7-1.0 s).
 */
function earsSession(
  asr: LiveAsrConfig,
  agent: VoiceAgentConfig,
  locale: VoiceAgentLocale,
  source: LiveAsrSource,
  slot: RunSlot,
  onEvent: (event: LiveAsrEvent) => void,
): LiveAsrSession {
  if (agent.asr_lane !== 'browser') throw new VoiceAgentAsrLaneError(agent.asr_lane);
  return createLiveAsrSession({
    // The agent's own VAD keys (louder, longer speech) over the shared live-ASR VAD.
    cfg: { ...asr, vad: { ...asr.vad, ...agent.vad } },
    source,
    onEvent,
    options: { ...defaultLiveAsrOptions(asr), language: locale.code, interim: true },
    transcribe: webgpuTranscriber(agent.asr_max_tokens, slot, { system: locale.asr_system }),
  });
}

/**
 * ASR events → agent: live words while the user speaks (replaced by the final of the same
 * utterance), then every accepted non-empty final goes to `onFinal`. Ignored while the agent is busy.
 */
function earsHandler(
  handlers: VoiceAgentHandlers,
  isBusy: () => boolean,
  fail: (error: unknown) => void,
  onFinal: (event: LiveAsrResults, text: string) => void,
  accept: (event: LiveAsrResults, text: string) => boolean,
): (event: LiveAsrEvent) => void {
  return (event) => {
    if (event.type === 'Error') return fail(new Error(`${event.code}: ${event.message}`));
    if (isBusy()) return;
    if (event.type === 'SpeechStarted') return handlers.onState('hearing');
    if (event.type !== 'Results') return;
    const text = event.channel.alternatives[0].transcript.trim();
    if (!event.is_final) return text === '' ? undefined : handlers.onUser(event.utterance_id, text, false);
    if (text === '') return handlers.onState('listening');
    if (!accept(event, text)) {
      handlers.onDiscard?.(event.utterance_id);
      return handlers.onState('listening');
    }
    onFinal(event, text);
  };
}

/**
 * Each accepted final is shown at once with its final text, carries its ears timings and runs as
 * one turn under its utterance id. After close the words are shown as the user's line and no brain
 * runs.
 */
function finalRelay(
  handlers: VoiceAgentHandlers,
  isClosed: () => boolean,
  runTurn: (id: string, text: string) => void,
): (event: LiveAsrResults, text: string) => void {
  return (event, text) => {
    handlers.onUser(event.utterance_id, text, false);
    handlers.onMetrics?.(event.utterance_id, earsMetrics(event));
    if (isClosed()) return handlers.onUser(event.utterance_id, text, true);
    runTurn(event.utterance_id, text);
  };
}

interface SessionControl {
  isBusy: () => boolean;
  isClosed: () => boolean;
  markClosed: () => void;
  halt: () => void;
  resume: () => void;
  runTurn: (id: string, text: string) => void;
  stopAll: () => Promise<void>;
  onIdle: () => void;
}

/** The public session: typed turns, tap interrupt, close. */
function sessionApi(c: SessionControl): VoiceAgentSession {
  return {
    ask(text) {
      const clean = text.trim();
      if (c.isBusy() || c.isClosed() || clean === '') return false;
      c.runTurn(`typed-${crypto.randomUUID()}`, clean);
      return true;
    },
    interrupt() {
      if (!c.isBusy()) return;
      c.halt();
      c.resume();
    },
    async close() {
      c.markClosed();
      c.halt();
      await c.stopAll();
      c.onIdle();
    },
  };
}

/**
 * One voice session in `localeCode` (the page locale): ears, brain, tool results and voice all use
 * that language's instructions from `voice_agent.locales`.
 */
export async function createVoiceAgent(
  microphone: MediaStream,
  handlers: VoiceAgentHandlers,
  localeCode: string,
): Promise<VoiceAgentSession> {
  handlers.onState('loading');
  const { asr, agent } = await loadConfig();
  const locale = resolveVoiceLocale(agent, localeCode);
  const slot: RunSlot = { current: null, aborted: false };
  const gate = gatedSource(micSource(microphone, asr));
  const history: WebgpuChatMessage[] = [];
  let player: SpeechPlayer | null = null;
  let busy = false;
  let closed = false;
  let spokeEnd = Number.NEGATIVE_INFINITY;
  const runTool = toolRunner(handlers, locale.code);
  /** Cut the run in flight and the playback (interrupt, barge-in, close). */
  const halt = (): void => {
    slot.aborted = true;
    if (slot.current) webgpuEngine.abort(slot.current);
    player?.stop();
    player = null;
  };
  // Speaking over the answer cuts it (voice_agent.barge_in); armed only while the agent talks.
  const barge = createBargeIn(microphone, agent.barge_in, () => {
    if (!busy) return;
    halt();
    resume();
  }, () => player?.level() ?? 0);
  /** Listen again after echo_tail_ms: the last syllables still ring in the room and the speakers. */
  const resume = (): void => {
    busy = false;
    barge.setArmed(false);
    spokeEnd = performance.now();
    setTimeout(() => (busy || closed ? undefined : gate.setOpen(true)), agent.echo_tail_ms);
    if (!closed) handlers.onState('listening');
  };
  const fail = (error: unknown): void => {
    handlers.onError('AGENT_FAILED', error instanceof Error ? error.message : String(error));
  };
  /** Speak with the mic gate closed; listening resumes when playback ends (or on interrupt). */
  const say = async (text: string, hooks: SayHooks = {}): Promise<void> => {
    busy = true;
    gate.setOpen(false);
    handlers.onState('speaking');
    barge.setArmed(true);
    await speak(text, agent, locale, slot, firstAudioTap(handlers.onLevel, hooks.onFirstAudio), (p) => {
      player = p;
      handlers.onSpeechPlayer?.(p);
    }, hooks.onUsage);
  };
  const turn = async (turnId: string, userText: string, heardAt: number): Promise<void> => {
    busy = true;
    slot.aborted = false;
    gate.setOpen(false);
    // Confirmation: the request is shown as taken at once, before the model starts.
    handlers.onUser(turnId, userText, true);
    handlers.onState('thinking');
    const mode = themeIntent(userText, agent.theme_phrases);
    if (mode) clientAction(handlers, 'set_theme', { mode });
    const target = localeIntent(userText, agent.locale_switch);
    if (target && target !== locale.code) clientAction(handlers, 'set_locale', { locale: target });
    const { answer, metrics } = await timedThink(
      (onTool, onUsage) => think(history, userText, agent, locale, slot, onTool, runTool, onUsage),
      toolRelay(handlers),
    );
    handlers.onMetrics?.(turnId, metrics);
    if (slot.aborted || closed || answer === '') return resume();
    handlers.onAssistant(turnId, answer, true);
    remember(history, userText, answer, agent.history_turns);
    await say(speechText(answer), voiceHooks(handlers, turnId, heardAt));
    if (isGoodbye(userText, agent.goodbye_phrases)) clientAction(handlers, 'end_session', {});
    resume();
  };
  const runTurn = (id: string, text: string): void => {
    turn(id, text, performance.now()).catch((error: unknown) => {
      if (slot.aborted || closed) return resume();
      fail(error);
    });
  };
  const accept = (event: LiveAsrResults, text: string): boolean =>
    rejectReason(text, event.duration * 1000, performance.now() - spokeEnd, agent) === null;
  const onFinal = finalRelay(handlers, () => closed, runTurn);
  const onEvent = earsHandler(handlers, () => busy, fail, onFinal, accept);
  const asrSession = earsSession(asr, agent, locale, gate, slot, onEvent);
  await asrSession.start();
  // Welcome: spoken once, mic closed meanwhile; then listen.
  handlers.onAssistant('greeting', locale.greeting, true);
  say(locale.greeting)
    .then(resume)
    .catch((error: unknown) => (closed ? undefined : fail(error)));
  return sessionApi({
    isBusy: () => busy,
    isClosed: () => closed,
    markClosed: () => (closed = true),
    halt,
    resume,
    runTurn,
    stopAll: async () => (await barge.close(), await asrSession.stop()),
    onIdle: () => handlers.onState('idle'),
  });
}
