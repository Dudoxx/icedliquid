/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     asr-live
 * @purpose   The transcriber seam of the live-ASR engine: one window of PCM in, its text and timing out.
 * @status    feature-local
 */
import type { LiveAsrConfig, LiveAsrErrorCode, LiveAsrOptions } from './events';

export interface TranscribeResult {
  text: string;
  /** Engine that answered (the browser lane names the WebGPU worker). */
  engine: string;
  request_ms: number;
}

export interface TranscribeArgs {
  pcm: Float32Array;
  cfg: LiveAsrConfig;
  options: LiveAsrOptions;
  signal?: AbortSignal;
}

export type TranscribeFn = (args: TranscribeArgs) => Promise<TranscribeResult>;

/** A refused or failed request, already mapped to its live-ASR error code. */
export class LiveAsrRequestError extends Error {
  readonly code: LiveAsrErrorCode;
  readonly status: number | undefined;
  constructor(code: LiveAsrErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'LiveAsrRequestError';
    this.code = code;
    this.status = status;
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
