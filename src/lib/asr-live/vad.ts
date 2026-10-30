/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     asr-live
 * @purpose   Energy VAD with noise-floor tracking, endpointing, forced cut and pre-roll for live ASR.
 * @status    active
 */
import type { LiveAsrConfig, LiveAsrFrame } from './events';

export type VadEvent =
  | {
      type: 'speech_start';
      /** Audio ms of the first speech frame. */
      t_ms: number;
      /** Audio ms of the first sample `flushPreRoll()` returns (onset minus pre-roll). */
      audio_start_ms: number;
      wall_ms: number;
    }
  | {
      type: 'speech_end';
      /** Audio ms where the last speech frame ended. */
      t_ms: number;
      /** Wall ms of the last speech frame (measured speech end). */
      last_speech_wall_ms: number;
      /** Wall ms when endpoint_silence_ms of silence was confirmed. */
      endpoint_wall_ms: number;
    }
  | {
      type: 'force_cut';
      /** Audio ms of the cut; audio after it starts the next utterance. */
      cut_t_ms: number;
      wall_ms: number;
    };

export interface Vad {
  /** Feed one frame of exactly `frame_ms`; returns the events this frame caused, in order. */
  push(frame: LiveAsrFrame): VadEvent[];
  /** At speech_start: pre-roll + onset frames up to and including the current frame. */
  flushPreRoll(): Float32Array;
  reset(): void;
}

type VadState = 'silence' | 'maybe_speech' | 'speech' | 'trailing';

interface FrameLevel {
  t0_ms: number;
  db: number;
}

/** Samples per frame at the configured rate. */
export function frameSamples(cfg: LiveAsrConfig): number {
  return Math.round((cfg.sample_rate * cfg.frame_ms) / 1000);
}

/** Re-chunks arbitrary capture buffers into exact `frame_ms` frames on a sample-counted audio clock. */
export function frameSplitter(cfg: LiveAsrConfig): {
  push(pcm: Float32Array, wall_ms: number): LiveAsrFrame[];
} {
  const size = frameSamples(cfg);
  let pending = new Float32Array(0);
  let emitted = 0;
  return {
    push(pcm, wall_ms) {
      const joined = new Float32Array(pending.length + pcm.length);
      joined.set(pending);
      joined.set(pcm, pending.length);
      const frames: LiveAsrFrame[] = [];
      let offset = 0;
      for (; offset + size <= joined.length; offset += size) {
        frames.push({
          pcm: joined.slice(offset, offset + size),
          t0_ms: (emitted * 1000) / cfg.sample_rate,
          wall_ms,
        });
        emitted += size;
      }
      pending = joined.slice(offset);
      return frames;
    },
  };
}

/** RMS level in dBFS; digital silence maps to the most negative finite level. */
export function levelDb(pcm: Float32Array): number {
  let sum = 0;
  for (const s of pcm) sum += s * s;
  const rms = Math.sqrt(sum / Math.max(1, pcm.length));
  return 20 * Math.log10(Math.max(rms, Number.MIN_VALUE));
}

export function createVad(cfg: LiveAsrConfig): Vad {
  const v = cfg.vad;
  const preRollFrames = Math.max(0, Math.round(v.pre_roll_ms / cfg.frame_ms));
  const ring: LiveAsrFrame[] = [];
  let onset: LiveAsrFrame[] = [];
  let state: VadState = 'silence';
  let floor: number | null = null;
  let calibrated = 0;
  let maybeMs = 0;
  let silentMs = 0;
  let lastSpeech: { end_ms: number; wall_ms: number } = { end_ms: 0, wall_ms: 0 };
  let uttStartMs = 0;
  let levels: FrameLevel[] = [];
  let flushed = new Float32Array(0);

  const startThr = (): number =>
    Math.max(v.start_threshold_db, (floor ?? v.start_threshold_db) + v.noise_margin_db);
  // Hysteresis: the stop level sits 5 dB under the start margin (shard 02 §003).
  const stopThr = (): number =>
    Math.max(v.stop_threshold_db, (floor ?? v.stop_threshold_db) + v.noise_margin_db - 5);

  function trackFloor(db: number): void {
    if (calibrated < v.calibration_ms) {
      calibrated += cfg.frame_ms;
      const n = calibrated / cfg.frame_ms;
      floor = floor === null ? db : floor + (db - floor) / n;
      return;
    }
    floor = floor === null ? db : floor + v.noise_alpha * (db - floor);
  }

  function remember(frame: LiveAsrFrame): void {
    ring.push(frame);
    while (ring.length > preRollFrames) ring.shift();
  }

  function forceCut(frame: LiveAsrFrame): VadEvent | null {
    const end = frame.t0_ms + cfg.frame_ms;
    if (end - uttStartMs < cfg.max_utterance_ms) return null;
    const recent = levels.filter((l) => l.t0_ms >= end - cfg.cut_search_ms);
    const quiet = recent.reduce(
      (a, b) => (b.db < a.db ? b : a),
      recent[0] ?? { t0_ms: frame.t0_ms, db: 0 },
    );
    const cut = quiet.t0_ms + cfg.frame_ms;
    uttStartMs = cut;
    levels = levels.filter((l) => l.t0_ms >= cut);
    return { type: 'force_cut', cut_t_ms: cut, wall_ms: frame.wall_ms };
  }

  function onSilence(frame: LiveAsrFrame, db: number): VadEvent[] {
    trackFloor(db);
    if (calibrated >= v.calibration_ms && db >= startThr()) {
      state = 'maybe_speech';
      maybeMs = cfg.frame_ms;
      onset = [frame];
      return confirmSpeech(frame);
    }
    remember(frame);
    return [];
  }

  function confirmSpeech(frame: LiveAsrFrame): VadEvent[] {
    if (maybeMs < v.speech_start_ms) return [];
    const first = onset[0] ?? frame;
    const pre = ring.splice(0);
    const parts = [...pre, ...onset];
    flushed = new Float32Array(parts.reduce((n, f) => n + f.pcm.length, 0));
    let offset = 0;
    for (const f of parts) {
      flushed.set(f.pcm, offset);
      offset += f.pcm.length;
    }
    uttStartMs = (pre[0] ?? first).t0_ms;
    levels = parts.map((f) => ({ t0_ms: f.t0_ms, db: levelDb(f.pcm) }));
    onset = [];
    state = 'speech';
    lastSpeech = { end_ms: frame.t0_ms + cfg.frame_ms, wall_ms: frame.wall_ms };
    return [
      {
        type: 'speech_start',
        t_ms: first.t0_ms,
        audio_start_ms: uttStartMs,
        wall_ms: first.wall_ms,
      },
    ];
  }

  function onMaybe(frame: LiveAsrFrame, db: number): VadEvent[] {
    if (db < stopThr()) {
      for (const f of onset) remember(f);
      remember(frame);
      onset = [];
      state = 'silence';
      return [];
    }
    onset.push(frame);
    maybeMs += cfg.frame_ms;
    return confirmSpeech(frame);
  }

  function onUtterance(frame: LiveAsrFrame, db: number): VadEvent[] {
    levels.push({ t0_ms: frame.t0_ms, db });
    if (db >= stopThr()) {
      state = 'speech';
      silentMs = 0;
      lastSpeech = { end_ms: frame.t0_ms + cfg.frame_ms, wall_ms: frame.wall_ms };
    } else {
      state = 'trailing';
      silentMs += cfg.frame_ms;
      if (silentMs >= cfg.endpoint_silence_ms) {
        state = 'silence';
        silentMs = 0;
        levels = [];
        return [
          {
            type: 'speech_end',
            t_ms: lastSpeech.end_ms,
            last_speech_wall_ms: lastSpeech.wall_ms,
            endpoint_wall_ms: frame.wall_ms,
          },
        ];
      }
    }
    const cut = forceCut(frame);
    return cut ? [cut] : [];
  }

  return {
    push(frame) {
      const db = levelDb(frame.pcm);
      if (state === 'silence') return onSilence(frame, db);
      if (state === 'maybe_speech') return onMaybe(frame, db);
      return onUtterance(frame, db);
    },
    flushPreRoll() {
      const out = flushed;
      flushed = new Float32Array(0);
      return out;
    },
    reset() {
      ring.length = 0;
      onset = [];
      state = 'silence';
      floor = null;
      calibrated = 0;
      maybeMs = 0;
      silentMs = 0;
      levels = [];
      flushed = new Float32Array(0);
    },
  };
}
