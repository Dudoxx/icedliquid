/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     omni
 * @purpose   Play streamed wav or PCM chunks back-to-back while they arrive, then join them into one wav blob URL for replay.
 * @status    feature-local
 */

function concat(parts: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** 16-bit PCM mono wav of the concatenated channels at `rate` Hz. */
export function encodeWav(channels: readonly Float32Array[], rate: number): Blob {
  const pcm = concat(channels);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Schedules each decoded chunk right after the previous one, so speech plays while streaming. */
export class SpeechPlayer {
  private readonly ctx = new AudioContext();
  /** Every chunk plays through this analyser, so level() follows what is HEARD, not what arrived. */
  private readonly analyser = this.ctx.createAnalyser();
  private readonly probe = new Float32Array(1024);
  private wired = false;
  private at = 0;
  private readonly buffers: Float32Array[] = [];
  /** Sample rate of the kept buffers (the context rate for wav, the source rate for PCM). */
  private rate: number = this.ctx.sampleRate;
  private pending: Promise<void> = Promise.resolve();

  private schedule(audio: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    source.buffer = audio;
    if (!this.wired) {
      this.analyser.fftSize = this.probe.length;
      this.analyser.connect(this.ctx.destination);
      this.wired = true;
    }
    source.connect(this.analyser);
    this.at = Math.max(this.at, this.ctx.currentTime + 0.05);
    source.start(this.at);
    this.at += audio.duration;
  }

  /** Queue one base64 wav chunk; decoding stays in arrival order. */
  push(b64: string): Promise<void> {
    this.pending = this.pending.then(async () => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const audio = await this.ctx.decodeAudioData(bytes.buffer);
      this.rate = this.ctx.sampleRate;
      this.buffers.push(audio.getChannelData(0).slice());
      this.schedule(audio);
    });
    return this.pending;
  }

  /** Queue one mono Float32 PCM chunk at `rate` Hz; the context resamples on playback. */
  pushPcm(pcm: Float32Array, rate: number): Promise<void> {
    this.pending = this.pending.then(async () => {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const audio = this.ctx.createBuffer(1, pcm.length, rate);
      audio.copyToChannel(Float32Array.from(pcm), 0);
      this.rate = rate;
      this.buffers.push(Float32Array.from(pcm));
      this.schedule(audio);
    });
    return this.pending;
  }

  /** Wait for every queued chunk; return a wav blob URL of the whole answer, or null if none. */
  async finish(): Promise<string | null> {
    await this.pending;
    if (this.buffers.length === 0) return null;
    // decodeAudioData resamples to the context rate; PCM chunks keep their source rate.
    return URL.createObjectURL(encodeWav(this.buffers, this.rate));
  }

  /** Resolve when every queued chunk has played out (scheduled end on the audio clock). */
  async drained(): Promise<void> {
    await this.pending;
    const left = this.at - this.ctx.currentTime;
    if (left > 0) await new Promise((resolve) => setTimeout(resolve, left * 1000));
  }

  /** Loudness of the audio playing right now, 0..1 (RMS ×4, clamped); 0 when stopped or silent. */
  level(): number {
    if (!this.wired || this.ctx.state !== 'running') return 0;
    this.analyser.getFloatTimeDomainData(this.probe);
    let sum = 0;
    for (const s of this.probe) sum += s * s;
    return Math.min(1, Math.sqrt(sum / this.probe.length) * 4);
  }

  /** Idempotent: a second stop (interrupt, then the run's own cleanup) must not throw. */
  stop(): void {
    if (this.ctx.state !== 'closed') void this.ctx.close();
  }
}
