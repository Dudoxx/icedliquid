/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     asr-live
 * @purpose   Pure reducers that turn live-ASR wall timestamps into utterance and session metrics, plus median and p95.
 * @status    active
 */
import type { LiveAsrSessionMetrics, LiveAsrUtteranceMetrics } from './events';

export interface UtteranceTimes {
  speech_start_wall_ms: number;
  first_interim_wall_ms: number | null;
  /** Wall of the last speech frame (forced cut: the cut wall). */
  last_speech_wall_ms: number;
  /** Wall when the endpoint (or cut) was detected. */
  endpoint_wall_ms: number;
  final_wall_ms: number;
  final_request_ms: number;
  audio_ms: number;
  interim_count: number;
  skipped_ticks: number;
  revisions: number;
}

export function utteranceMetrics(t: UtteranceTimes): LiveAsrUtteranceMetrics {
  return {
    first_interim_ms:
      t.first_interim_wall_ms === null ? null : t.first_interim_wall_ms - t.speech_start_wall_ms,
    final_after_endpoint_ms: t.final_wall_ms - t.endpoint_wall_ms,
    final_after_speech_end_ms: t.final_wall_ms - t.last_speech_wall_ms,
    rtf_final: t.audio_ms > 0 ? t.final_request_ms / t.audio_ms : 0,
    interim_count: t.interim_count,
    skipped_ticks: t.skipped_ticks,
    revisions: t.revisions,
    audio_ms: t.audio_ms,
  };
}

/** gpu_duty = Σ request ms / session wall ms (share of time a request was in flight). */
export function sessionMetrics(
  requestMs: readonly number[],
  wallMs: number,
): LiveAsrSessionMetrics {
  const total = requestMs.reduce((a, b) => a + b, 0);
  return {
    gpu_duty: wallMs > 0 ? total / wallMs : 0,
    requests: requestMs.length,
    request_ms_total: total,
    wall_ms: wallMs,
  };
}

function sorted(values: readonly number[]): number[] {
  return values.filter((v) => Number.isFinite(v)).toSorted((a, b) => a - b);
}

/** Median; null for an empty list. */
export function median(values: readonly number[]): number | null {
  const s = sorted(values);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** 95th percentile, nearest-rank; null for an empty list. */
export function p95(values: readonly number[]): number | null {
  const s = sorted(values);
  if (s.length === 0) return null;
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] ?? null;
}
