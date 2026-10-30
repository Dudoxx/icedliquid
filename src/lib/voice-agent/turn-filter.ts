/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Pure turn filters of the voice agent: drop noise and echo finals (too short, or a lone filler right after the agent spoke), detect a goodbye that ends the session and a theme request.
 * @status    active
 */
import type { VoiceAgentConfig } from './types';

/** Lower case, letters/digits/apostrophes only, single spaces. */
export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

/** Why a final is not a request, or null when it is one. */
export function rejectReason(
  text: string,
  durationMs: number,
  msSinceSpoke: number,
  cfg: Pick<VoiceAgentConfig, 'min_utterance_ms' | 'filler_window_ms' | 'fillers' | 'phantom_phrases'>,
): 'too-short' | 'echo-filler' | 'phantom' | null {
  if (durationMs < cfg.min_utterance_ms) return 'too-short';
  if (hasPhrase(text, cfg.phantom_phrases)) return 'phantom';
  const norm = normalizeUtterance(text);
  if (msSinceSpoke < cfg.filler_window_ms && cfg.fillers.some((f) => normalizeUtterance(f) === norm)) return 'echo-filler';
  return null;
}

/** True when the utterance contains one of the phrases as whole words. */
function hasPhrase(text: string, phrases: readonly string[]): boolean {
  const norm = ` ${normalizeUtterance(text)} `;
  return phrases.some((p) => norm.includes(` ${normalizeUtterance(p)} `));
}

/** True when the utterance contains a configured goodbye phrase. */
export function isGoodbye(text: string, phrases: readonly string[]): boolean {
  return hasPhrase(text, phrases);
}

/**
 * The locale the user asked to switch to: a switch verb AND the name of exactly one language, in
 * any order ("sprich bitte Französisch mit mir"); else null. A name alone never switches.
 */
export function localeIntent(
  text: string,
  rule: { verbs: readonly string[]; names: Readonly<Record<string, readonly string[]>> },
): string | null {
  if (!hasPhrase(text, rule.verbs)) return null;
  const hits = Object.keys(rule.names).filter((code) => hasPhrase(text, rule.names[code] ?? []));
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

/** The theme the user asked for, or null (both or neither matched). */
export function themeIntent(text: string, phrases: { dark: readonly string[]; light: readonly string[] }): 'dark' | 'light' | null {
  const dark = hasPhrase(text, phrases.dark);
  const light = hasPhrase(text, phrases.light);
  return dark === light ? null : dark ? 'dark' : 'light';
}

/** A clock time ("14:30", "14h30"): a data number even without a marker word. */
const CLOCK_TIME = /\b\d{1,2}\s?[:h]\s?\d{2}\b/u;

/**
 * True when `answer` states a data number: a digit with one of `markers` (°, %, degrés, km/h …)
 * as a whole word or symbol, or a clock time. Used by the grounding guard: such an answer needs a
 * tool result behind it.
 */
export function hasDataNumber(answer: string, markers: readonly string[]): boolean {
  if (!/\d/u.test(answer)) return false;
  if (CLOCK_TIME.test(answer)) return true;
  const lower = answer.toLowerCase();
  return markers.some((m) => {
    const marker = m.toLowerCase();
    return /^[\p{L}]/u.test(marker) ? hasPhrase(lower, [marker]) : lower.includes(marker);
  });
}
