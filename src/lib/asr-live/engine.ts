/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     asr-live
 * @purpose   Live ASR session engine: VAD-segmented utterances, single-flight interim re-transcription, one final per utterance, Deepgram-like events.
 * @status    active
 */
import { concatPcm } from '@/lib/audio/pcm';

import {
  defaultLiveAsrOptions,
  type LiveAsrConfig,
  type LiveAsrErrorCode,
  type LiveAsrEvent,
  type LiveAsrOptions,
  type LiveAsrRequestMetrics,
  type LiveAsrSessionMetrics,
} from './events';
import { sessionMetrics, utteranceMetrics } from './metrics';
import { formatFinal, rawFinal } from './sentences';
import { LiveAsrSourceError, type LiveAsrSource } from './sources';
import { createStabilizer, isHintEcho, type Stabilizer } from './stabilizer';
import { isAbort, LiveAsrRequestError, type TranscribeFn, type TranscribeResult } from './types';
import { createVad, frameSplitter, type Vad, type VadEvent } from './vad';

export interface LiveAsrSessionOptions {
  cfg: LiveAsrConfig;
  source: LiveAsrSource;
  onEvent: (event: LiveAsrEvent) => void;
  /** Language, hints and formatting of this session; default = `defaultLiveAsrOptions(cfg)`. */
  options?: LiveAsrOptions;
  /** The window transcriber (the voice agent passes `webgpuTranscriber`); there is no default. */
  transcribe: TranscribeFn;
}

export interface LiveAsrSession {
  start(): Promise<void>;
  /** Stops the source; a live utterance is finalised as on endpoint. Resolves when drained. */
  stop(): Promise<void>;
  metrics(): LiveAsrSessionMetrics;
  /** Resolves when the session has stopped (stop(), source end or error) and every request drained. */
  readonly done: Promise<void>;
}

interface Utterance {
  id: string;
  parts: Float32Array[];
  samples: number;
  audio_start_ms: number;
  speech_start_wall_ms: number;
  requested_samples: number;
  first_interim_wall_ms: number | null;
  interim_count: number;
  skipped_ticks: number;
  revisions: number;
  endpointed: boolean;
  stab: Stabilizer;
}

interface Endpoint {
  speech_final: boolean;
  endpoint_wall_ms: number;
  last_speech_wall_ms: number;
  last_speech_end_ms: number;
}

/** Live sessions on this page (single-flight across sessions, invariant 4). */
let activeSessions = 0;

function errorCode(error: unknown): LiveAsrErrorCode {
  if (error instanceof LiveAsrRequestError || error instanceof LiveAsrSourceError)
    return error.code;
  return 'HTTP_ERROR';
}

class Session implements LiveAsrSession {
  readonly done: Promise<void>;
  private resolveDone: () => void = () => undefined;
  private readonly cfg: LiveAsrConfig;
  private readonly options: LiveAsrOptions;
  private readonly source: LiveAsrSource;
  private readonly emit: (event: LiveAsrEvent) => void;
  private readonly transcribe: TranscribeFn;
  private readonly splitter: ReturnType<typeof frameSplitter>;
  private readonly vad: Vad;
  private utt: Utterance | null = null;
  private counter = 0;
  private lock: Promise<void> = Promise.resolve();
  private busy = false;
  private running = false;
  private faulted = false;
  private owns = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly requestMs: number[] = [];
  private startWall = 0;
  private endWall: number | null = null;

  constructor(opts: LiveAsrSessionOptions) {
    this.cfg = opts.cfg;
    this.options = opts.options ?? defaultLiveAsrOptions(opts.cfg);
    this.source = opts.source;
    this.emit = opts.onEvent;
    this.transcribe = opts.transcribe;
    this.splitter = frameSplitter(opts.cfg);
    this.vad = createVad(opts.cfg);
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve;
    });
  }

  async start(): Promise<void> {
    if (activeSessions > 0 || this.running) {
      this.emit({
        type: 'Error',
        code: 'BUSY',
        message: 'a live transcription is already running',
        wall_ms: performance.now(),
      });
      this.resolveDone();
      return;
    }
    activeSessions++;
    this.owns = true;
    this.running = true;
    this.startWall = performance.now();
    this.emit({
      type: 'Metadata',
      session_id: crypto.randomUUID(),
      config: this.cfg,
      options: this.options,
      wall_ms: this.startWall,
    });
    try {
      await this.source.open(
        (frame) => this.onCapture(frame.pcm, frame.wall_ms),
        () => void this.stop(),
      );
    } catch (error) {
      await this.fail(error);
      return;
    }
    this.timer = setInterval(() => this.tick(), this.cfg.interim_interval_ms);
  }

  async stop(): Promise<void> {
    if (!this.running) return this.done;
    this.running = false;
    this.clearTimer();
    await this.source.close();
    const u = this.utt;
    if (u && !this.faulted) {
      const now = performance.now();
      this.finalize(u, {
        speech_final: true,
        endpoint_wall_ms: now,
        last_speech_wall_ms: now,
        last_speech_end_ms: u.audio_start_ms + this.audioMs(u.samples),
      });
    }
    this.utt = null;
    await this.lock;
    this.release();
    return this.done;
  }

  metrics(): LiveAsrSessionMetrics {
    return sessionMetrics(this.requestMs, (this.endWall ?? performance.now()) - this.startWall);
  }

  private release(): void {
    if (this.endWall === null) this.endWall = performance.now();
    if (this.owns) {
      activeSessions--;
      this.owns = false;
    }
    this.resolveDone();
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private audioMs(samples: number): number {
    return (samples * 1000) / this.cfg.sample_rate;
  }

  private onCapture(pcm: Float32Array, wall: number): void {
    if (!this.running || this.faulted) return;
    for (const frame of this.splitter.push(pcm, wall)) {
      const events = this.vad.push(frame);
      if (this.utt) this.append(this.utt, frame.pcm);
      for (const event of events) this.onVad(event);
    }
  }

  private append(u: Utterance, pcm: Float32Array): void {
    u.parts.push(pcm);
    u.samples += pcm.length;
  }

  private open(pcm: Float32Array, audioStartMs: number, wall: number, speechT: number): Utterance {
    this.counter++;
    const u: Utterance = {
      id: `u${this.counter}`,
      parts: [pcm],
      samples: pcm.length,
      audio_start_ms: audioStartMs,
      speech_start_wall_ms: wall,
      requested_samples: 0,
      first_interim_wall_ms: null,
      interim_count: 0,
      skipped_ticks: 0,
      revisions: 0,
      endpointed: false,
      stab: createStabilizer(this.cfg.agreement),
    };
    this.emit({
      type: 'SpeechStarted',
      utterance_id: u.id,
      timestamp: speechT / 1000,
      wall_ms: wall,
    });
    return u;
  }

  private onVad(event: VadEvent): void {
    if (event.type === 'speech_start') {
      this.utt = this.open(
        this.vad.flushPreRoll(),
        event.audio_start_ms,
        event.wall_ms,
        event.t_ms,
      );
      return;
    }
    const u = this.utt;
    if (!u) return;
    if (event.type === 'speech_end') {
      this.utt = null;
      this.finalize(u, {
        speech_final: true,
        endpoint_wall_ms: event.endpoint_wall_ms,
        last_speech_wall_ms: event.last_speech_wall_ms,
        last_speech_end_ms: event.t_ms,
      });
      return;
    }
    this.forceCut(u, event.cut_t_ms, event.wall_ms);
  }

  /** Forced cut: finalise the head (speech_final false), continue with the tail as a new utterance. */
  private forceCut(u: Utterance, cutMs: number, wall: number): void {
    const pcm = concatPcm(u.parts);
    const cut = Math.max(
      0,
      Math.min(pcm.length, Math.round(((cutMs - u.audio_start_ms) * this.cfg.sample_rate) / 1000)),
    );
    u.parts = [pcm.slice(0, cut)];
    u.samples = cut;
    this.finalize(u, {
      speech_final: false,
      endpoint_wall_ms: wall,
      last_speech_wall_ms: wall,
      last_speech_end_ms: cutMs,
    });
    this.utt = this.open(pcm.slice(cut), cutMs, wall, cutMs);
  }

  /** Interim tick: skip while busy, before min_first_audio_ms, or with < min_new_audio_ms of new audio. */
  private tick(): void {
    const u = this.utt;
    if (!u || u.endpointed || this.faulted || !this.options.interim) return;
    if (this.busy) {
      u.skipped_ticks++;
      return;
    }
    if (this.audioMs(u.samples) < this.cfg.min_first_audio_ms) return;
    if (this.audioMs(u.samples - u.requested_samples) < this.cfg.min_new_audio_ms) return;
    const pcm = concatPcm(u.parts);
    u.requested_samples = pcm.length;
    this.exclusive(async () => {
      const res = await this.request(pcm);
      if (u.endpointed) return;
      const state = u.stab.push(res.text);
      u.revisions = state.revisions;
      const wall = performance.now();
      if (u.first_interim_wall_ms === null) u.first_interim_wall_ms = wall;
      u.interim_count++;
      this.emit({
        type: 'Results',
        utterance_id: u.id,
        start: u.audio_start_ms / 1000,
        duration: this.audioMs(pcm.length) / 1000,
        is_final: false,
        speech_final: false,
        channel: {
          alternatives: [
            {
              transcript: state.display,
              raw_transcript: res.text,
              stable_words: state.stable_words,
            },
          ],
        },
        metrics: this.requestMetrics(res, pcm.length, wall),
        wall_ms: wall,
      });
    });
  }

  private finalize(u: Utterance, end: Endpoint): void {
    u.endpointed = true;
    this.exclusive(async () => {
      const pcm = concatPcm(u.parts);
      const res = await this.request(pcm);
      const wall = performance.now();
      const fmt = this.options.format
        ? formatFinal(res.text, this.options.language)
        : rawFinal(res.text, this.options.language);
      const audio = this.audioMs(pcm.length);
      this.emit({
        type: 'Results',
        utterance_id: u.id,
        start: u.audio_start_ms / 1000,
        duration: audio / 1000,
        is_final: true,
        speech_final: end.speech_final,
        channel: {
          alternatives: [
            {
              transcript: fmt.text,
              raw_transcript: fmt.raw,
              stable_words: fmt.sentences.join(' ').split(/\s+/).filter(Boolean).length,
            },
          ],
        },
        sentences: fmt.sentences,
        metrics: this.requestMetrics(res, pcm.length, wall),
        wall_ms: wall,
        utterance_metrics: utteranceMetrics({
          speech_start_wall_ms: u.speech_start_wall_ms,
          first_interim_wall_ms: u.first_interim_wall_ms,
          last_speech_wall_ms: end.last_speech_wall_ms,
          endpoint_wall_ms: end.endpoint_wall_ms,
          final_wall_ms: wall,
          final_request_ms: res.request_ms,
          audio_ms: audio,
          interim_count: u.interim_count,
          skipped_ticks: u.skipped_ticks,
          revisions: u.revisions,
        }),
      });
      if (end.speech_final) {
        this.emit({
          type: 'UtteranceEnd',
          utterance_id: u.id,
          last_speech_end: end.last_speech_end_ms / 1000,
          wall_ms: wall,
        });
      }
    });
  }

  private requestMetrics(
    res: TranscribeResult,
    samples: number,
    wall: number,
  ): LiveAsrRequestMetrics {
    return {
      request_ms: res.request_ms,
      audio_ms: this.audioMs(samples),
      engine: res.engine,
      wall_ms: wall,
    };
  }

  private async request(pcm: Float32Array): Promise<TranscribeResult> {
    const res = await this.transcribe({ pcm, cfg: this.cfg, options: this.options });
    this.requestMs.push(res.request_ms);
    // A read-back of the hint list is not speech: treat it as an empty answer (no text shown).
    return isHintEcho(res.text, this.options.hints) ? { ...res, text: '' } : res;
  }

  /** The one serial lock: a job starts only after the previous one settled (single-flight). */
  private exclusive(job: () => Promise<void>): void {
    this.lock = this.lock.then(async (): Promise<void> => {
      if (this.faulted) return undefined;
      this.busy = true;
      try {
        await job();
      } catch (error) {
        if (!isAbort(error)) await this.fail(error);
      } finally {
        this.busy = false;
      }
    });
  }

  /** Emit Error once, stop the source and release the mic. No retry, no other engine. */
  private async fail(error: unknown): Promise<void> {
    if (this.faulted) return;
    this.faulted = true;
    this.running = false;
    this.clearTimer();
    this.utt = null;
    this.emit({
      type: 'Error',
      code: errorCode(error),
      ...(typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number'
        ? { status: error.status }
        : {}),
      message: error instanceof Error ? error.message : String(error),
      wall_ms: performance.now(),
    });
    await this.source.close();
    this.release();
  }
}

export function createLiveAsrSession(opts: LiveAsrSessionOptions): LiveAsrSession {
  return new Session(opts);
}
