'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       hook
 * @domain    ui
 * @topic     voice
 * @purpose   Session state of the icedLiquid showcase stage: opens the microphone, runs createVoiceAgent and keeps the agent state, the chat lines (user interim/final, tool calls, answers), per-turn timings and the output level.
 * @status    feature-local
 *
 * Every line and number comes from the agent: nothing is synthesised here. The
 * shared VoiceAssistantPanel keeps the generic provider path; this hook talks to the agent
 * directly so the stage can show the full state set (hearing, tool) and VoiceTurnMetrics.
 * Page tools: set_theme switches next-themes; end_session stops the session once the spoken
 * goodbye has finished (the agent is back to listening); set_locale waits for the same moment,
 * then moves the page to /<locale>/voice-agent and resumes the session there in that language
 * (same document: the loaded WebGPU model and the mic permission stay).
 * The session language is the page locale.
 * Start intent: a Start press is remembered in sessionStorage until the session
 * first listens or fails; when the stage mounts again with the intent still open (the first press
 * on a cold page can remount it while the model loads), the session starts once by itself, so one
 * press is enough. Same mechanism as the set_locale resume.
 * Run guard: every start() is one numbered run; stop() and unmount end it. A run that
 * resolves after it ended (the stage unmounted or Stop was pressed while the model loaded) closes
 * its agent and mic at once, and its callbacks are ignored — otherwise a second, orphan agent kept
 * its mic and ears on the one WebGPU worker and aborted the live session's generation.
 * Typed turns are sent only while the engine is `ready` (a typed turn started while
 * the ears' ASR run generated was refused by the worker and ended the session).
 * A cut run is not a failure: barge-in and Interrupt abort the run in flight and the agent has
 * already resumed listening, but a cut greeting still reports `generation aborted` through
 * onError (agent.ts greeting catch). That one outcome — the abort text while the agent already
 * listens again — keeps the session open; every other error ends it and shows the fault.
 * exportRun downloads the session's own turns — metrics, input kind, tool calls — and the WebGPU
 * load facts as a JSON file in the browser (no server write); nothing is re-computed for it.
 */
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { voice_agent, webgpu } from '@/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { isValidLocale, type Locale } from '@/i18n/types';
import { openMicStream } from '@/lib/asr-live/sources';
import type { SpeechPlayer } from '@/lib/omni/speech-player';
import { createVoiceAgent, type VoiceAgentSession } from '@/lib/voice-agent/agent';
import type { VoiceAgentConfig, VoiceAgentState, VoiceAgentToolEvent, VoiceTurnMetrics } from '@/lib/voice-agent/types';
import { webgpuEngine } from '@/lib/webgpu/use-webgpu-engine';

import { useTheme } from './ThemeMode';

export type IcedLiquidLine =
  | { kind: 'user'; id: string; text: string; final: boolean }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'tool'; id: string; event: VoiceAgentToolEvent };

/** One tool call of a turn as the agent reported it (ms and ok once it answered). */
export interface IcedLiquidTurnTool {
  id: string;
  name: string;
  ms: number | null;
  ok: boolean | null;
}

export interface IcedLiquidTurn {
  id: string;
  metrics: Partial<VoiceTurnMetrics>;
  /** Tool calls the agent ran in this turn, in call order. */
  tools?: readonly IcedLiquidTurnTool[];
}

/** Typed turns get a `typed-` id from the agent (agent.ts ask); every other turn was spoken. */
function inputKind(turnId: string): 'speech' | 'typed' {
  return turnId.startsWith('typed-') ? 'typed' : 'speech';
}

/** Scalar knobs of the voice_agent block (prompts, phrase lists and per-locale texts left out). */
function configSubset(agent: VoiceAgentConfig): Record<string, unknown> {
  const { name, asr_lane, vad, barge_in, echo_tail_ms, min_utterance_ms, filler_window_ms } = agent;
  const { max_tool_rounds, answer_max_tokens, speech_max_tokens, history_turns, asr_max_tokens } = agent;
  return {
    name, asr_lane, vad, barge_in, echo_tail_ms, min_utterance_ms, filler_window_ms,
    max_tool_rounds, answer_max_tokens, speech_max_tokens, history_turns, asr_max_tokens,
  };
}

/** Hand a Blob to the browser as a named download; the object URL is released afterwards. */
function triggerDownload(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Save the session as a browser download `icedliquid-session-<UTC>.json` (Blob + object URL): the
 * file lands in the user's downloads folder and nothing is written on the server. Returns the file
 * name or an error line.
 */
export function exportRun(
  turns: readonly IcedLiquidTurn[],
  locale: string,
): Promise<{ path: string } | { error: string }> {
  const gpu = webgpuEngine.state();
  const runUtc = new Date().toISOString();
  const payload = {
    run_utc: runUtc,
    page: window.location.pathname,
    locale,
    config: { ...configSubset(voice_agent), webgpu_repo: webgpu.hf_repo, webgpu_decoder: webgpu.decoder },
    model: { model_load_ms: gpu.modelLoadMs, cache_hit: gpu.cacheHit, resident_bytes: gpu.residentBytes },
    turns: turns.map((t) => ({
      turn_id: t.id,
      input: inputKind(t.id),
      metrics: t.metrics,
      tools: (t.tools ?? []).map(({ name, ms, ok }) => ({ name, ms, ok })),
    })),
  };
  const name = `icedliquid-session-${runUtc.replace(/[:.]/g, '-')}.json`;
  try {
    triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), name);
  } catch (error) {
    return Promise.resolve({ error: error instanceof Error ? error.message : String(error) });
  }
  return Promise.resolve({ path: name });
}

/** Add or update one tool call on turn `turnId` (the turn is created when the call comes first). */
function withTool(list: readonly IcedLiquidTurn[], turnId: string, event: VoiceAgentToolEvent): readonly IcedLiquidTurn[] {
  const tool: IcedLiquidTurnTool = {
    id: event.id,
    name: event.name,
    ms: event.ms ?? null,
    ok: event.result ? event.result.ok : null,
  };
  const put = (tools: readonly IcedLiquidTurnTool[] = []): readonly IcedLiquidTurnTool[] =>
    tools.some((x) => x.id === tool.id) ? tools.map((x) => (x.id === tool.id ? tool : x)) : [...tools, tool];
  return list.some((t) => t.id === turnId)
    ? list.map((t) => (t.id === turnId ? { ...t, tools: put(t.tools) } : t))
    : [...list, { id: turnId, metrics: {}, tools: put() }];
}

export interface IcedLiquidSession {
  state: VoiceAgentState;
  lines: readonly IcedLiquidLine[];
  /** Turns with timings, newest last. */
  turns: readonly IcedLiquidTurn[];
  level: number;
  /** Loudness being HEARD now (playback analyser), 0..1; read per animation frame, no re-render. */
  sampleLevel: () => number;
  /** Id of the assistant line being spoken, or null. */
  speakingId: string | null;
  fault: string | null;
  running: boolean;
  start: () => void;
  stop: () => void;
  interrupt: () => void;
  /** Send a typed message (same turn as speech); false when no session or the agent is busy. */
  ask: (text: string) => boolean;
}

/** sessionStorage flag: a set_locale switch is in flight, start the session again after the move. */
const RESUME_KEY = 'icedliquid:resume-after-locale';
/** sessionStorage: Start was pressed and the session has not listened yet (epoch ms of the press). */
const START_INTENT_KEY = 'icedliquid:start-intent';
/** An intent older than this is stale (a tab left mid-load) and does not start a session. */
const START_INTENT_MAX_MS = 5 * 60 * 1000;
/** WebgpuEngineError ABORTED text (lib/webgpu generate.ts / speech-loop.ts): a run cut on purpose. */
const CUT_RUN = /\bgeneration aborted\b/i;

function upsert(lines: readonly IcedLiquidLine[], next: IcedLiquidLine): readonly IcedLiquidLine[] {
  const i = lines.findIndex((l) => l.kind === next.kind && l.id === next.id);
  return i === -1 ? [...lines, next] : lines.map((l, j) => (j === i ? next : l));
}

export function useIcedLiquidSession(): IcedLiquidSession {
  const agentRef = useRef<VoiceAgentSession | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<VoiceAgentState>('idle');
  const [lines, setLines] = useState<readonly IcedLiquidLine[]>([]);
  const [turns, setTurns] = useState<readonly IcedLiquidTurn[]>([]);
  const [level, setLevel] = useState(0);
  const [fault, setFault] = useState<string | null>(null);
  const endAfterReply = useRef(false);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const lastAssistant = useRef<string | null>(null);
  /** Turn the agent is answering now (set by the final user line); tool calls belong to it. */
  const currentTurn = useRef<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const sampleLevel = useCallback((): number => playerRef.current?.level() ?? 0, []);
  const { setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const switchTo = useRef<Locale | null>(null);
  /** Number of the current run; start() takes the next one, stop() ends it (see header). */
  const runRef = useRef(0);
  /** Last state the agent reported (read by onError, no re-render). */
  const agentState = useRef<VoiceAgentState>('idle');

  const release = useCallback((): void => {
    for (const track of micRef.current?.getTracks() ?? []) track.stop();
    micRef.current = null;
  }, []);

  const stop = useCallback((): void => {
    runRef.current += 1;
    const agent = agentRef.current;
    agentRef.current = null;
    void agent?.close();
    release();
    setLevel(0);
    setState('idle');
  }, [release]);

  const start = useCallback((): void => {
    // A run still loading is ended (closed when it resolves), so only one agent ever lives.
    runRef.current += 1;
    const run = runRef.current;
    const live = (): boolean => runRef.current === run;
    void agentRef.current?.close().catch(() => undefined);
    agentRef.current = null;
    release();
    setFault(null);
    endAfterReply.current = false;
    switchTo.current = null;
    currentTurn.current = null;
    setLines([]);
    setTurns([]);
    setState('loading');
    void (async () => {
      try {
        const mic = await openMicStream();
        if (!live()) {
          for (const track of mic.getTracks()) track.stop();
          return;
        }
        micRef.current = mic;
        const agent = await createVoiceAgent(mic, {
          onState: (next) => {
            if (!live()) return;
            agentState.current = next;
            setState(next);
            if (next !== 'listening') return;
            sessionStorage.removeItem(START_INTENT_KEY);
            if (endAfterReply.current) return queueMicrotask(stop);
            const target = switchTo.current;
            if (target === null) return;
            switchTo.current = null;
            queueMicrotask(() => {
              stop();
              sessionStorage.setItem(RESUME_KEY, target);
              router.replace(pathname, { locale: target });
            });
          },
          onClientTool: (name, args) => {
            if (!live()) return { ok: false, error: 'session ended' };
            if (name === 'end_session') {
              endAfterReply.current = true;
              return { ok: true, note: 'the session ends after your goodbye' };
            }
            const code = args['locale'];
            if (name === 'set_locale' && typeof code === 'string' && isValidLocale(code)) {
              if (code === locale) return { ok: true, locale: code, note: 'already speaking this language' };
              switchTo.current = code;
              return { ok: true, locale: code, note: 'the screen and the voice switch after this answer' };
            }
            const mode = args['mode'];
            if (name === 'set_theme' && (mode === 'dark' || mode === 'light')) {
              setTheme(mode);
              return { ok: true, mode };
            }
            return { ok: false, error: `${name}: unsupported arguments` };
          },
          onUser: (id, text, final) => {
            if (!live()) return;
            if (final) currentTurn.current = id;
            setLines((l) => upsert(l, { kind: 'user', id, text, final }));
          },
          onAssistant: (id, text) => {
            if (!live()) return;
            lastAssistant.current = id;
            setLines((l) => upsert(l, { kind: 'assistant', id, text }));
          },
          onSpeechPlayer: (p) => {
            if (!live()) return;
            playerRef.current = p;
            setSpeakingId(p ? lastAssistant.current : null);
          },
          onTool: (event) => {
            if (!live()) return;
            setLines((l) => upsert(l, { kind: 'tool', id: event.id, event }));
            const turnId = currentTurn.current;
            if (turnId !== null) setTurns((list) => withTool(list, turnId, event));
          },
          onDiscard: (id) => {
            if (live()) setLines((l) => l.filter((x) => !(x.kind === 'user' && x.id === id)));
          },
          onLevel: (value) => {
            if (live()) setLevel(value);
          },
          onMetrics: (id, m) => {
            if (!live()) return;
            setTurns((list) =>
              list.some((t) => t.id === id)
                ? list.map((t) => (t.id === id ? { ...t, metrics: { ...t.metrics, ...m } } : t))
                : [...list, { id, metrics: m }],
            );
          },
          onError: (code, message) => {
            if (!live() || (agentState.current === 'listening' && CUT_RUN.test(message))) return;
            sessionStorage.removeItem(START_INTENT_KEY);
            setFault(`${code}: ${message}`);
            stop();
          },
        }, locale);
        if (!live()) {
          // Ended while loading (unmount, Stop, a newer start): this agent never becomes the session.
          void agent.close().catch(() => undefined);
          for (const track of mic.getTracks()) track.stop();
          return;
        }
        agentRef.current = agent;
      } catch (error) {
        if (!live()) return;
        sessionStorage.removeItem(START_INTENT_KEY);
        setFault(error instanceof Error ? error.message : String(error));
        release();
        setState('idle');
      }
    })();
  }, [release, stop, setTheme, locale, router, pathname]);

  /** The Start button: remember the press until the session listens (see header), then start. */
  const press = useCallback((): void => {
    sessionStorage.setItem(START_INTENT_KEY, String(Date.now()));
    start();
  }, [start]);

  /** The Stop button: an explicit stop closes any open start intent. */
  const halt = useCallback((): void => {
    sessionStorage.removeItem(START_INTENT_KEY);
    stop();
  }, [stop]);

  const interrupt = useCallback((): void => agentRef.current?.interrupt(), []);
  // The worker takes one run at a time and a second run is refused while one generates (the
  // refusal reads "the WebGPU model is not loaded"); the ears' ASR pass can still be in flight
  // while the agent listens, so a typed turn waits until the engine is free (text stays in the box).
  const ask = useCallback((text: string): boolean => {
    if (webgpuEngine.state().status !== 'ready') return false;
    return agentRef.current?.ask(text) ?? false;
  }, []);

  useEffect(() => () => stop(), [stop]);

  // Auto-starts run one tick after mount and the cleanup cancels them: the dev StrictMode effect
  // replay (and its unmount stop(), which ends the run) then leaves exactly one start.
  const pressRef = useRef(press);
  const startRef = useRef(start);
  useEffect(() => {
    pressRef.current = press;
    startRef.current = start;
  }, [press, start]);

  // Arrived here through set_locale: start again, now in this page's language.
  useEffect(() => {
    if (sessionStorage.getItem(RESUME_KEY) !== locale) return;
    const timer = setTimeout(() => {
      sessionStorage.removeItem(RESUME_KEY);
      startRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [locale]);

  // Mounted again while a Start press was still loading: finish that press once.
  useEffect(() => {
    const at = Number(sessionStorage.getItem(START_INTENT_KEY) ?? Number.NaN);
    if (!Number.isFinite(at) || Date.now() - at >= START_INTENT_MAX_MS) {
      sessionStorage.removeItem(START_INTENT_KEY);
      return;
    }
    const timer = setTimeout(() => pressRef.current(), 0);
    return () => clearTimeout(timer);
  }, []);

  return { state, lines, turns, level, sampleLevel, speakingId, fault, running: state !== 'idle', start: press, stop: halt, interrupt, ask };
}
