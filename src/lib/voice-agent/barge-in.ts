/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Voice barge-in: watches the raw microphone level while the assistant talks and fires once when the user speaks over it (level above min_dbfs for hold_ms).
 * @status    active
 */
import type { VoiceAgentConfig } from './types';

export interface BargeInMonitor {
  /** Arm while the agent thinks or speaks; disarm when it listens again. */
  setArmed(armed: boolean): void;
  close(): Promise<void>;
}

const TICK_MS = 50;

export function createBargeIn(
  microphone: MediaStream,
  cfg: VoiceAgentConfig['barge_in'],
  onBargeIn: () => void,
  /** Playback loudness 0..1 (SpeechPlayer.level = RMS ×4): the echo reference. */
  playbackLevel: () => number = () => 0,
): BargeInMonitor {
  if (!cfg.enabled) return { setArmed: () => undefined, close: async () => undefined };
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(microphone);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let armed = false;
  let loudMs = 0;
  const timer = setInterval(() => {
    if (!armed) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const s of buf) sum += s * s;
    const dbfs = 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-9);
    // Echo guard: the assistant's voice reaches the mic quieter than it plays; the user's own
    // voice next to the mic is at least as loud. Both the absolute floor and the margin must hold.
    const playDb = 20 * Math.log10(playbackLevel() / 4 || 1e-9);
    loudMs = dbfs >= cfg.min_dbfs && dbfs >= playDb + cfg.echo_margin_db ? loudMs + TICK_MS : 0;
    if (loudMs >= cfg.hold_ms) {
      armed = false;
      loudMs = 0;
      onBargeIn();
    }
  }, TICK_MS);
  return {
    setArmed(next) {
      armed = next;
      loudMs = 0;
    },
    async close() {
      clearInterval(timer);
      source.disconnect();
      if (ctx.state !== 'closed') await ctx.close();
    },
  };
}
