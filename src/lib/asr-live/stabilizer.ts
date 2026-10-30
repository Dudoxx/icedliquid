/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     asr-live
 * @purpose   LocalAgreement-n stabilizer: the word prefix agreed by the last n hypotheses becomes stable.
 * @status    active
 */

export interface StabilizerState {
  /** Committed display tokens + the latest hypothesis tail after them. */
  display: string;
  stable_words: number;
  revisions: number;
}

export interface Stabilizer {
  push(hypothesis: string): StabilizerState;
  reset(): void;
}

interface Token {
  text: string;
  key: string;
}

/** Compare key: lowercase letters and digits only (keeps "morning," equal to "Morning"). */
export function wordKey(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

export function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, key: wordKey(t) }));
}

function commonPrefix(hyps: readonly Token[][]): number {
  const [first, ...rest] = hyps;
  if (!first) return 0;
  let n = 0;
  while (n < first.length && rest.every((h) => h[n]?.key === first[n]?.key)) n++;
  return n;
}

export function createStabilizer(agreement: number): Stabilizer {
  let history: Token[][] = [];
  let committed: Token[] = [];
  let revisions = 0;

  return {
    push(hypothesis) {
      const latest = tokenize(hypothesis);
      const agrees = committed.every((c, i) => latest[i]?.key === c.key);
      if (!agrees) revisions++;
      history = [...history, latest].slice(-Math.max(1, agreement));
      if (agrees && history.length >= agreement) {
        const lcp = commonPrefix(history);
        if (lcp > committed.length)
          committed = [...committed, ...latest.slice(committed.length, lcp)];
      }
      const tail = latest.slice(committed.length).map((t) => t.text);
      return {
        display: [...committed.map((t) => t.text), ...tail].join(' '),
        stable_words: committed.length,
        revisions,
      };
    },
    reset() {
      history = [];
      committed = [];
      revisions = 0;
    },
  };
}

/**
 * true when an answer is only the session hints read back (prompt echo). Measured 2026-10-29: on
 * ambient noise with no speech the model returned the hint list verbatim. Echo = at least 2 words
 * and at least 80 % of them are hint words. Such an answer is not speech and is dropped (invariant 2).
 */
export function isHintEcho(text: string, hints: string): boolean {
  const hintKeys = new Set(
    tokenize(hints)
      .map((t) => t.key)
      .filter((k) => k !== ''),
  );
  if (hintKeys.size === 0) return false;
  const keys = tokenize(text)
    .map((t) => t.key)
    .filter((k) => k !== '');
  if (keys.length < 2) return false;
  return keys.filter((k) => hintKeys.has(k)).length / keys.length >= 0.8;
}
