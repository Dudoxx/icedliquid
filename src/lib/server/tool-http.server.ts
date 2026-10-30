/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Shared pieces of the server-side voice-agent tools: the result type, JSON narrowing helpers and a bounded, never-throwing fetch → JSON with secrets scrubbed from errors.
 * @status    active
 */
import 'server-only';

export type AgentToolResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string };

export type Json = Record<string, unknown>;

/** Largest upstream body read (an 8 MB image is ~10.7 MB as base64 JSON). */
const MAX_UPSTREAM_BYTES = 12 * 1024 * 1024;

export function rec(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function numv(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** fetch → JSON with a timeout; never throws; secrets scrubbed from the error text. */
export async function httpJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  service: string,
  secret: string,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const length = Number(res.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_UPSTREAM_BYTES) {
      await res.body?.cancel();
      return { ok: false, error: `${service} answered a body larger than ${MAX_UPSTREAM_BYTES} bytes` };
    }
    const text = await res.text();
    if (!res.ok) {
      // Scrub before cutting, so a key split at the cut cannot leave its prefix behind.
      const snippet = (secret ? text.replaceAll(secret, '***') : text).slice(0, 200);
      return { ok: false, error: `${service} answered ${res.status}: ${snippet}` };
    }
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : 'error';
    return {
      ok: false,
      error:
        name === 'TimeoutError'
          ? `${service} timed out after ${timeoutMs} ms`
          : `${service} failed (${name})`,
    };
  }
}

/** Env key names a keyless (demo) result may name; the card shows the one it got. */
export const DEMO_KEYS = ['EXA_API_KEY', 'WEATHER_API_KEY', 'OPENROUTER_API_KEY'] as const;
export type DemoKey = (typeof DEMO_KEYS)[number];

/**
 * The fields every keyless result carries: `mode: "demo"`, the missing key, where the data came
 * from, and a note the model reads so it tells the user (the card shows a Demo badge).
 */
export function demoFields(key: DemoKey, source: string, what: string): Json {
  return {
    mode: 'demo',
    demo_key: key,
    source,
    note: `demo mode: no ${key} is set, so ${what}. Tell the user this in one short sentence, and that adding ${key} to .env.local and restarting the app turns on the real service.`,
  };
}
