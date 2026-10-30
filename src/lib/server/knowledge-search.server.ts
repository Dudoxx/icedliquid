/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Keyless web_search: ranks the sections of the bundled knowledge/*.md files by term overlap with the query and returns the best ones in the web-search result shape.
 * @status    active
 *
 * Used only when EXA_API_KEY is not set; the result carries the demo fields
 * (`source: "local-knowledge"`). A file is `# Title` + `## Section` blocks; a section line
 * `Source: https://…` becomes the hit URL, else the URL is the section on GitHub. The files are
 * English; the result keeps the session `lang` so the model answers in the user's language.
 * A query that matches nothing returns zero hits and says so; nothing is made up.
 */
import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { demoFields, type AgentToolResult } from './tool-http.server';

const KNOWLEDGE_DIR = 'knowledge';
/** Public home of the bundled files: a hit links to its section there. */
const REPO_BLOB = 'https://github.com/Dudoxx/icedliquid/blob/main';
const SOURCE_LINE = /^Source:\s*(https:\/\/\S+)\s*$/im;

/** Short words of the four session languages that carry no meaning for ranking. */
const STOPWORDS = new Set(
  (
    'the a an and or of to in on at for is are was be by with what who how why when where which about tell me you your it this that do does can ' +
    'der die das ein eine und oder ist sind was wer wie warum wann wo von zu im mit über mir du ich es bitte such suche ' +
    'le la les un une des et ou est sont qui quoi comment pourquoi quand où de du au aux en sur pour avec moi tu je cherche ' +
    'el los las uno unos una y o es son qué quién cómo por cuándo dónde del al con sobre para mí tú yo busca'
  ).split(' '),
);

interface Section {
  file: string;
  title: string;
  heading: string;
  anchor: string;
  body: string;
  url: string | undefined;
  words: string[];
  headWords: string[];
}

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces → hyphens. */
function anchorOf(heading: string): string {
  return heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
}

/** Markdown → plain text for the summary (links keep their label, marks are dropped). */
function plain(md: string): string {
  return md
    .replace(SOURCE_LINE, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFile(file: string, text: string): Section[] {
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? file;
  return text
    .split(/^##\s+/m)
    .slice(1)
    .map((block) => {
      const [first = '', ...rest] = block.split('\n');
      const heading = first.trim();
      const raw = rest.join('\n');
      const body = plain(raw);
      return {
        file,
        title,
        heading,
        anchor: anchorOf(heading),
        body,
        url: SOURCE_LINE.exec(raw)?.[1],
        words: terms(body),
        headWords: terms(`${title} ${heading}`),
      };
    })
    .filter((s) => s.heading !== '' && s.body !== '');
}

let cache: Promise<Section[]> | null = null;

/** All sections of `knowledge/*.md`, read once per server process. A read failure is not cached. */
function loadSections(): Promise<Section[]> {
  cache ??= (async () => {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), KNOWLEDGE_DIR);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).toSorted();
    const texts = await Promise.all(files.map(async (f) => [f, await readFile(path.join(dir, f), 'utf8')] as const));
    return texts.flatMap(([f, text]) => parseFile(f, text));
  })().catch((cause: unknown) => {
    cache = null;
    throw cause;
  });
  return cache;
}

/** Same word, or one a prefix of the other (both >= 4 letters: "model" ~ "models"). */
function matches(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

/** Heading/title hits weigh 3, body hits 1 each (capped at 3 per query term). */
function score(section: Section, query: string[]): number {
  return query.reduce((sum, q) => {
    const head = section.headWords.some((w) => matches(w, q)) ? 3 : 0;
    const body = Math.min(3, section.words.filter((w) => matches(w, q)).length);
    return sum + head + body;
  }, 0);
}

/** Top `limit` sections for `query`, in the web_search result shape plus the demo fields. */
export async function searchKnowledge(
  query: string,
  lang: string,
  limit: number,
  summaryMaxChars: number,
): Promise<AgentToolResult> {
  let sections: Section[];
  try {
    sections = await loadSections();
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : 'error';
    return { ok: false, error: `the bundled knowledge folder could not be read (${name})` };
  }
  const q = [...new Set(terms(query))];
  const ranked = sections
    .map((s) => ({ s, n: score(s, q) }))
    .filter((r) => r.n > 0)
    .toSorted((a, b) => b.n - a.n)
    .slice(0, limit);
  return {
    ok: true,
    query,
    lang,
    results: ranked.map(({ s }) => ({
      title: `${s.title}: ${s.heading}`,
      url: s.url ?? `${REPO_BLOB}/${KNOWLEDGE_DIR}/${s.file}#${s.anchor}`,
      path: `${KNOWLEDGE_DIR}/${s.file}#${s.anchor}`,
      summary: s.body.length > summaryMaxChars ? `${s.body.slice(0, summaryMaxChars)}…` : s.body,
    })),
    ...demoFields(
      'EXA_API_KEY',
      'local-knowledge',
      ranked.length > 0
        ? 'these results come from the bundled knowledge files about Dudoxx, Acceleate, Liquid AI, LFM3 and icedLiquid, not from the live web'
        : 'only the bundled knowledge files about Dudoxx, Acceleate, Liquid AI, LFM3 and icedLiquid were searched and none matched; say you found nothing there',
    ),
  };
}
