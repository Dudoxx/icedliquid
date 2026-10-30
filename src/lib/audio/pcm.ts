/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     audio
 * @purpose   Mic PCM helpers shared by live ASR and speech playback: concat, resample, 16-bit wav encode.
 * @status    active
 */

/** The gateway decodes 16 kHz mono wav (app.js toggleMic). */
export const MIC_SAMPLE_RATE = 16_000;

export function concatPcm(parts: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Nearest-sample resample, as app.js resample. */
export function resamplePcm(pcm: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return pcm;
  const out = new Float32Array(Math.floor((pcm.length * to) / from));
  const ratio = from / to;
  for (let i = 0; i < out.length; i++) out[i] = pcm[Math.floor(i * ratio)] ?? 0;
  return out;
}

/** 16-bit PCM mono RIFF/WAVE (app.js encodeWav). */
export function encodeWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
