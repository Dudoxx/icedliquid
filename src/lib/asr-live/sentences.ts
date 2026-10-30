/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     asr-live
 * @purpose   Split a final transcript into sentences and apply the only allowed formatting: sentence-start case and one terminal period.
 * @status    active
 */

export interface FormattedFinal {
  text: string;
  sentences: string[];
  raw: string;
  /** Sentences whose first letter was upper-cased. */
  capitalized: number;
  terminal_added: boolean;
}

const TERMINAL = /[.?!…]["'”’)\]]*$/u;

/** A terminal mark followed by space and a lowercase letter: ICU keeps it in one sentence. */
const LOWERCASE_BREAK = /(?<=[.?!…])\s+(?=\p{Ll})/u;

export function toSentences(text: string, lang: string): string[] {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
  // ICU does not break before a lowercase start ("nine. please"); ASR answers can be lowercase,
  // so split those too. Only whitespace is cut, never a word (invariant 2).
  return Array.from(segmenter.segment(text), (s) => s.segment.trim())
    .flatMap((s) => s.split(LOWERCASE_BREAK))
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function capitalizeFirst(sentence: string): { text: string; changed: boolean } {
  const match = /\p{L}/u.exec(sentence);
  if (!match) return { text: sentence, changed: false };
  const upper = match[0].toUpperCase();
  if (upper === match[0]) return { text: sentence, changed: false };
  return {
    text: sentence.slice(0, match.index) + upper + sentence.slice(match.index + 1),
    changed: true,
  };
}

export function formatFinal(raw: string, lang: string): FormattedFinal {
  let capitalized = 0;
  const sentences = toSentences(raw, lang).map((s) => {
    const c = capitalizeFirst(s);
    if (c.changed) capitalized++;
    return c.text;
  });
  let terminal_added = false;
  const last = sentences.length - 1;
  if (last >= 0 && !TERMINAL.test(sentences[last] ?? '')) {
    sentences[last] = `${sentences[last] ?? ''}.`;
    terminal_added = true;
  }
  return { text: sentences.join(' '), sentences, raw, capitalized, terminal_added };
}

/** Format off: the model text as returned, only split into sentences (no case or mark change). */
export function rawFinal(raw: string, lang: string): FormattedFinal {
  const sentences = toSentences(raw, lang);
  return { text: sentences.join(' '), sentences, raw, capitalized: 0, terminal_added: false };
}
