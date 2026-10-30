/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     asr-live
 * @purpose   Live-ASR audio source: the microphone, yielding mono frames at asr_live.sample_rate.
 * @status    active
 */
import { resamplePcm } from '@/lib/audio/pcm';

import type { LiveAsrConfig, LiveAsrFrame } from './events';

/** Capture buffer of the mic ScriptProcessorNode (MicRecorder precedent). */
const MIC_BUFFER_SIZE = 2048;

export interface LiveAsrSource {
  /** Starts producing frames; `onEnd` fires once when a finite source has played out. */
  open(onFrame: (frame: LiveAsrFrame) => void, onEnd: () => void): Promise<void>;
  close(): Promise<void>;
}

/** A capture failure mapped to its live-ASR code. */
export class LiveAsrSourceError extends Error {
  readonly code: 'MIC_DENIED' | 'MIC_MISSING';
  constructor(code: 'MIC_DENIED' | 'MIC_MISSING', message: string) {
    super(message);
    this.name = 'LiveAsrSourceError';
    this.code = code;
  }
}

/** getUserMedia DOMException → code (same mapping idea as the audio capture helper). */
export function micErrorCode(error: unknown): 'MIC_DENIED' | 'MIC_MISSING' {
  if (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
  ) {
    return 'MIC_MISSING';
  }
  return 'MIC_DENIED';
}

/** Ask for the microphone; a refusal throws LiveAsrSourceError. */
export async function openMicStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new LiveAsrSourceError('MIC_MISSING', 'getUserMedia is not available');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  } catch (error) {
    throw new LiveAsrSourceError(
      micErrorCode(error),
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function micSource(stream: MediaStream, cfg: LiveAsrConfig): LiveAsrSource {
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let input: MediaStreamAudioSourceNode | null = null;
  let t0 = 0;
  return {
    async open(onFrame) {
      ctx = new AudioContext();
      input = ctx.createMediaStreamSource(stream);
      node = ctx.createScriptProcessor(MIC_BUFFER_SIZE, 1, 1);
      const rate = ctx.sampleRate;
      node.onaudioprocess = (event) => {
        const pcm = resamplePcm(
          new Float32Array(event.inputBuffer.getChannelData(0)),
          rate,
          cfg.sample_rate,
        );
        onFrame({ pcm, t0_ms: t0, wall_ms: performance.now() });
        t0 += (pcm.length * 1000) / cfg.sample_rate;
      };
      input.connect(node);
      node.connect(ctx.destination);
      await ctx.resume();
    },
    async close() {
      node?.disconnect();
      input?.disconnect();
      if (node) node.onaudioprocess = null;
      for (const track of stream.getTracks()) track.stop();
      const c = ctx;
      ctx = null;
      node = null;
      input = null;
      if (c && c.state !== 'closed') await c.close();
    },
  };
}
