/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    ui
 * @topic     voice
 * @purpose   Screen form of a spoken answer: the voice prompt asks the model for numbers and units as words (TTS), the conversation shows a measured value the way the tool cards do ("seven point four degrees" → "7.4 °C").
 * @status    feature-local
 *
 * Presentation only: the voice keeps speaking the words (brain.speechText). A run of number words
 * is rewritten ONLY when it carries a decimal word or is followed by a unit (degrees, percent,
 * km/h), so ordinary prose ("one of the sources", "three thirty") stays as written. Units format
 * through Intl like ToolCards, so card and bubble agree in form. en/de/fr/es; other locales pass.
 */

type UnitId = 'celsius' | 'percent' | 'kilometer-per-hour';

interface NumberLexicon {
  /** Number morphemes → value; 100 and 1000 multiply, everything else adds. */
  words: Readonly<Record<string, number>>;
  /** Words allowed between two number words ("and", "und", "et", "y"). */
  joiners: ReadonlySet<string>;
  decimal: ReadonlySet<string>;
  minus: ReadonlySet<string>;
  /** Unit phrase right after the number (case-insensitive, leading space included). */
  units: ReadonlyArray<readonly [RegExp, UnitId]>;
  /** German writes compounds as one word ("siebenundzwanzig"): split into morphemes. */
  compounds: boolean;
}

const range = (names: string, from = 0): Record<string, number> =>
  Object.fromEntries(names.split(' ').map((w, i) => [w, from + i]));

const tens = (names: string): Record<string, number> =>
  Object.fromEntries(names.split(' ').map((w, i) => [w, 20 + 10 * i]));

const LEXICONS: Readonly<Record<string, NumberLexicon>> = {
  en: {
    words: {
      ...range('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'),
      ...tens('twenty thirty forty fifty sixty seventy eighty ninety'),
      hundred: 100,
      thousand: 1000,
    },
    joiners: new Set(['and']),
    decimal: new Set(['point']),
    minus: new Set(['minus']),
    units: [
      [/^\s+degrees?(?:\s+(?:celsius|centigrade))?\b/iu, 'celsius'],
      [/^\s+(?:percent|per\s+cent)\b/iu, 'percent'],
      [/^\s+kilomet(?:er|re)s?\s+(?:per|an)\s+hour\b/iu, 'kilometer-per-hour'],
    ],
    compounds: false,
  },
  de: {
    words: {
      ...range('null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn'),
      ein: 1,
      eine: 1,
      ...tens('zwanzig dreißig vierzig fünfzig sechzig siebzig achtzig neunzig'),
      hundert: 100,
      tausend: 1000,
    },
    joiners: new Set(['und']),
    decimal: new Set(['komma']),
    minus: new Set(['minus']),
    units: [
      [/^\s+grad(?:\s+celsius)?\b/iu, 'celsius'],
      [/^\s+prozent\b/iu, 'percent'],
      [/^\s+kilometer\s+(?:pro|in\s+der)\s+stunde\b/iu, 'kilometer-per-hour'],
    ],
    compounds: true,
  },
  fr: {
    words: {
      ...range('zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize'),
      une: 1,
      vingt: 20,
      vingts: 20,
      trente: 30,
      quarante: 40,
      cinquante: 50,
      soixante: 60,
      cent: 100,
      cents: 100,
      mille: 1000,
    },
    joiners: new Set(['et']),
    decimal: new Set(['virgule']),
    minus: new Set(['moins']),
    units: [
      [/^\s+degrés?(?:\s+celsius)?(?=$|[^\p{L}])/iu, 'celsius'],
      [/^\s+pour\s+cent\b/iu, 'percent'],
      [/^\s+kilomètres?\s+(?:par|à\s+l['’])\s*heure\b/iu, 'kilometer-per-hour'],
    ],
    compounds: false,
  },
  es: {
    words: {
      ...range('cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte'),
      un: 1,
      una: 1,
      ...range('veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve', 21),
      treinta: 30,
      cuarenta: 40,
      cincuenta: 50,
      sesenta: 60,
      setenta: 70,
      ochenta: 80,
      noventa: 90,
      cien: 100,
      ciento: 100,
      doscientos: 200,
      trescientos: 300,
      cuatrocientos: 400,
      quinientos: 500,
      seiscientos: 600,
      setecientos: 700,
      ochocientos: 800,
      novecientos: 900,
      mil: 1000,
    },
    joiners: new Set(['y']),
    decimal: new Set(['coma', 'punto']),
    minus: new Set(['menos']),
    units: [
      [/^\s+grados?(?:\s+(?:celsius|centígrados))?(?=$|[^\p{L}])/iu, 'celsius'],
      [/^\s+por\s+ciento\b/iu, 'percent'],
      [/^\s+kilómetros?\s+por\s+hora\b/iu, 'kilometer-per-hour'],
    ],
    compounds: false,
  },
};

/** Split one word into number morphemes (longest match first); null when any part is not one. */
function morphemes(word: string, lex: NumberLexicon): string[] | null {
  if (word in lex.words || lex.joiners.has(word)) return [word];
  if (!lex.compounds) return null;
  const parts = [...Object.keys(lex.words), ...lex.joiners].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let rest = word;
  while (rest !== '') {
    const head = parts.find((p) => rest.startsWith(p));
    if (!head) return null;
    out.push(head);
    rest = rest.slice(head.length);
  }
  return out;
}

/** Morphemes of a word written with hyphens ("dix-sept", "quatre-vingt-dix"); fr 4×20 folds to 80. */
function wordParts(word: string, lex: NumberLexicon): string[] | null {
  const out: string[] = [];
  for (const piece of word.toLowerCase().split('-')) {
    const m = morphemes(piece, lex);
    if (!m) return null;
    out.push(...m);
  }
  return out;
}

/** Value of a morpheme list, or null when the order is not a number ("one two", "and" first). */
function valueOf(parts: readonly string[], lex: NumberLexicon): number | null {
  let total = 0;
  let group = 0;
  let last = Number.POSITIVE_INFINITY;
  let joined = false;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i] ?? '';
    if (lex.joiners.has(p)) {
      if (i === 0 || i === parts.length - 1) return null;
      joined = true;
      continue;
    }
    const v = lex.words[p];
    if (v === undefined) return null;
    if (v === 1000) {
      total += (group || 1) * 1000;
      group = 0;
      last = Number.POSITIVE_INFINITY;
    } else if (v === 100 && group < 100) {
      group = (group || 1) * 100;
      last = 100;
    } else if (v === 20 && group % 100 === 4 && (p === 'vingt' || p === 'vingts')) {
      group += 76; // quatre-vingt = 80
      last = 20;
    } else {
      // Each added part is smaller than the one before; only a joiner allows units-then-tens (de).
      const reversed = joined && last < 10 && v >= 20 && v % 10 === 0;
      if (v >= last && !reversed) return null;
      group += v;
      last = reversed ? 10 : v;
    }
    joined = false;
  }
  return total + group;
}

interface WordAt {
  word: string;
  start: number;
  end: number;
}

function wordsOf(text: string): WordAt[] {
  return Array.from(text.matchAll(/\p{L}+(?:-\p{L}+)*/gu), (m) => ({ word: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** One digit word (0-9) after a decimal word. */
function digitOf(word: string, lex: NumberLexicon): string | null {
  const v = lex.words[word.toLowerCase()];
  return v === undefined || v > 9 ? null : String(v);
}

interface Match {
  start: number;
  end: number;
  value: number;
  digits: number;
  unit: UnitId | null;
}

/** Read one number starting at word i: [minus] int [decimal digit…] [unit]; null when none. */
function readNumber(text: string, words: readonly WordAt[], i: number, lex: NumberLexicon): { match: Match; next: number } | null {
  const gap = (a: WordAt, b: WordAt): boolean => /^\s+$/u.test(text.slice(a.end, b.start));
  let j = i;
  const first = words[j];
  if (!first) return null;
  const negative = lex.minus.has(first.word.toLowerCase());
  if (negative) j += 1;
  const parts: string[] = [];
  let intEnd = j;
  for (let k = j; k < words.length; k += 1) {
    const w = words[k];
    const prev = words[k - 1];
    if (!w || (k > j && prev && !gap(prev, w))) break;
    const p = wordParts(w.word, lex);
    if (!p || valueOf([...parts, ...p], lex) === null && !(p.length === 1 && lex.joiners.has(p[0] ?? ''))) break;
    parts.push(...p);
    intEnd = k + 1;
  }
  while (intEnd > j && lex.joiners.has(parts.at(-1) ?? '')) {
    parts.pop();
    intEnd -= 1;
  }
  const value = parts.length > 0 ? valueOf(parts, lex) : null;
  const intLast = words[intEnd - 1];
  if (value === null || !intLast || (negative && first && words[j] && !gap(first, words[j] as WordAt))) return null;
  let frac = '';
  let end = intLast.end;
  let next = intEnd;
  const sep = words[intEnd];
  if (sep && lex.decimal.has(sep.word.toLowerCase()) && gap(intLast, sep)) {
    let k = intEnd + 1;
    for (let prev = sep; k < words.length; k += 1) {
      const w = words[k] as WordAt;
      const d = gap(prev, w) ? digitOf(w.word, lex) : null;
      if (d === null) break;
      frac += d;
      end = w.end;
      prev = w;
    }
    if (frac !== '') next = k;
  }
  const unit = lex.units.find(([re]) => re.test(text.slice(end)));
  if (unit) {
    const m = unit[0].exec(text.slice(end));
    end += m?.[0].length ?? 0;
    while (words[next] && (words[next] as WordAt).start < end) next += 1;
  }
  if (frac === '' && !unit) return null;
  const signed = (negative ? -1 : 1) * Number(`${value}${frac ? `.${frac}` : ''}`);
  return { match: { start: first.start, end, value: signed, digits: frac.length, unit: unit?.[1] ?? null }, next };
}

function format(m: Match, locale: string): string {
  const digits = { maximumFractionDigits: m.digits, minimumFractionDigits: m.digits };
  if (m.unit === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', ...digits }).format(m.value / 100);
  if (m.unit) return new Intl.NumberFormat(locale, { style: 'unit', unit: m.unit, ...digits }).format(m.value);
  return new Intl.NumberFormat(locale, digits).format(m.value);
}

/** The screen form of an answer whose numbers were written as words for the voice. */
export function displayText(text: string, locale: string): string {
  const lex = LEXICONS[locale.slice(0, 2).toLowerCase()];
  if (!lex || text === '') return text;
  const words = wordsOf(text);
  let out = '';
  let cursor = 0;
  for (let i = 0; i < words.length; ) {
    const hit = readNumber(text, words, i, lex);
    if (!hit) {
      i += 1;
      continue;
    }
    out += text.slice(cursor, hit.match.start) + format(hit.match, locale);
    cursor = hit.match.end;
    i = Math.max(hit.next, i + 1);
  }
  return out + text.slice(cursor);
}
