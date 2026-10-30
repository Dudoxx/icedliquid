/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    api
 * @purpose   Guards of the paid tools route: host allow-list, required same-origin `Origin`, body size cap and a per-client token bucket.
 * @status    foundation
 *
 * The host allow-list stops DNS rebinding: a hostile page that rebinds its own name to 127.0.0.1
 * sends `Origin` = `Host` = its own name, so the same-origin check alone lets it through.
 * Loopback names pass on any port; other names come from the server env `ALLOWED_HOSTS`.
 */
import 'server-only';

import { env } from '@/env';

import { HttpErrors } from './http-errors.server';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Largest tool-call body (the model's JSON arguments). */
export const MAX_TOOL_BODY_BYTES = 16 * 1024;

/** Token bucket: each client may make this many tool calls per window. */
const BUCKET_CAPACITY = 30;
const BUCKET_WINDOW_MS = 5 * 60 * 1000;
/** Above this many tracked clients, full (idle) buckets are dropped. */
const BUCKET_SWEEP_AT = 1000;

const extraHosts: ReadonlySet<string> = new Set(
  (env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h !== ''),
);

/** Host name of a `Host` / `Origin` host value (`[::1]:3400` → `[::1]`), lower case. */
function hostName(host: string): string | null {
  return URL.parse(`http://${host}`)?.hostname.toLowerCase() ?? null;
}

/** True when the `Host` header names loopback (any port) or an `ALLOWED_HOSTS` entry. */
function isAllowedHost(request: Request): boolean {
  const host = request.headers.get('host')?.toLowerCase();
  if (!host) return false;
  const name = hostName(host);
  if (name === null) return false;
  return LOOPBACK_HOSTS.has(name) || extraHosts.has(name) || extraHosts.has(host);
}

/** A POST must carry an `Origin` (browsers always send one) whose host is the `Host` header. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  return URL.parse(origin)?.host === request.headers.get('host');
}

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Client key: the last `X-Forwarded-For` hop (the one the nearest proxy added), else
 * `X-Real-IP`, else one shared local bucket. Without a proxy the header is the caller's word,
 * so the host allow-list and the `Origin` rule stay the main guard.
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const last = forwarded?.split(',').at(-1)?.trim();
  return last || request.headers.get('x-real-ip')?.trim() || 'local';
}

function sweepBuckets(now: number): void {
  if (buckets.size < BUCKET_SWEEP_AT) return;
  for (const [key, b] of buckets) {
    if (now - b.updated >= BUCKET_WINDOW_MS) buckets.delete(key);
  }
}

/** Take one token; false when the client used up its calls for the window. */
function takeToken(key: string, now: number): boolean {
  sweepBuckets(now);
  const b = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, updated: now };
  const refill = ((now - b.updated) / BUCKET_WINDOW_MS) * BUCKET_CAPACITY;
  b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + refill);
  b.updated = now;
  buckets.set(key, b);
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/** Seconds until the client has one token again. */
function retryAfterSeconds(key: string): number {
  const b = buckets.get(key);
  const missing = b ? Math.max(0, 1 - b.tokens) : 0;
  return Math.max(1, Math.ceil((missing / BUCKET_CAPACITY) * (BUCKET_WINDOW_MS / 1000)));
}

/**
 * Every check that runs before the tool route reads its body. Returns the refusal envelope, or
 * null when the call may go on.
 */
function guardToolCall(request: Request, requestId: string): Response | null {
  if (!isAllowedHost(request) || !isSameOrigin(request)) return HttpErrors.crossOrigin(requestId);
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > MAX_TOOL_BODY_BYTES) {
    return HttpErrors.payloadTooLarge(MAX_TOOL_BODY_BYTES, requestId);
  }
  const key = clientKey(request);
  if (!takeToken(key, Date.now())) {
    return HttpErrors.tooManyRequests(retryAfterSeconds(key), requestId);
  }
  return null;
}

export const RequestGuard = { guardToolCall, isAllowedHost, isSameOrigin } as const;
