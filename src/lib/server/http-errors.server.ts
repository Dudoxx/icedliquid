/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    api
 * @purpose   One JSON error envelope for every route handler of this app.
 * @status    foundation
 */
import 'server-only';

/** Error envelope every route handler returns for a refused or failed request. */
export interface HttpErrorBody {
  statusCode: number;
  message: string;
  code: string;
  requestId: string;
}

function envelope(
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
  extra?: HeadersInit,
): Response {
  const body: HttpErrorBody = { statusCode, message, code, requestId };
  const headers = new Headers(extra);
  headers.set('x-request-id', requestId);
  headers.set('cache-control', 'no-store');
  return Response.json(body, { status: statusCode, headers });
}

export const HttpErrors = {
  /** Any envelope; prefer the named helpers below. */
  envelope,
  badRequest: (message: string, requestId: string): Response =>
    envelope(400, 'BAD_REQUEST', message, requestId),
  notFound: (requestId: string, message = 'Not Found'): Response =>
    envelope(404, 'NOT_FOUND', message, requestId),
  /** A state-changing call whose `Origin` is not this app. */
  crossOrigin: (requestId: string): Response =>
    envelope(403, 'CROSS_ORIGIN', 'Cross-origin request refused', requestId),
  /** A body above the route's byte cap. */
  payloadTooLarge: (maxBytes: number, requestId: string): Response =>
    envelope(413, 'PAYLOAD_TOO_LARGE', `body is larger than ${maxBytes} bytes`, requestId),
  /** The client used up its calls for the window; `retry-after` is in seconds. */
  tooManyRequests: (retryAfterSeconds: number, requestId: string): Response =>
    envelope(429, 'RATE_LIMITED', 'Too many tool calls, try again later', requestId, {
      'retry-after': String(retryAfterSeconds),
    }),
  methodNotAllowed: (requestId: string, allow: readonly string[]): Response =>
    envelope(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed', requestId, {
      allow: allow.join(', '),
    }),
  /** A server-side dependency (key, folder, file) is not configured. */
  unavailable: (code: string, message: string, requestId: string): Response =>
    envelope(503, code, message, requestId),
} as const;
