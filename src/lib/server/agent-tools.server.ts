/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Server-side tools of the voice agent: get_weather (WeatherAPI.com), get_time (Intl + WeatherAPI zone lookup), web_search (Exa) and generate_image (OpenRouter images API), keys kept on the server.
 * @status    active
 *
 * Keyless demo mode: a tool whose key is NOT set answers from a free or bundled source and says
 * so (`mode: "demo"`, `demo_key`, `source`, `note`): get_weather → Open-Meteo, get_time for a
 * place → the Open-Meteo geocoder's zone, web_search → bundled knowledge/*.md, generate_image →
 * a bundled sample PNG. A key that IS set and fails upstream stays `{ok:false}`; never a demo.
 */
import 'server-only';

import { voiceAgentTools, type AppVoiceAgentToolsConfig } from '@/config';
import { env } from '@/env';

import { demoImage } from './demo-image.server';
import { searchKnowledge } from './knowledge-search.server';
import { openMeteoWeather } from './open-meteo-weather.server';
import { demoFields, httpJson, numv, rec, str, type AgentToolResult, type Json } from './tool-http.server';

export type { AgentToolResult } from './tool-http.server';

export const AGENT_TOOL_NAMES = ['get_weather', 'get_time', 'web_search', 'generate_image'] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

const WEATHER_DEFAULT_BASE = 'https://api.weatherapi.com/v1';
/** Keyless geocoder that knows local place names per language (München, Tokio, Londres, Pekín). */
const GEOCODER_BASE = 'https://geocoding-api.open-meteo.com/v1';
const EXA_DEFAULT_BASE = 'https://api.exa.ai';
const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Longest string argument per field; a longer one is refused, never cut. */
const MAX_ARG_CHARS = { query: 500, prompt: 2000, location: 200, caption: 300 } as const;
/** Shipped session locales; a place unknown in the session language is looked up in the others. */
const GEOCODER_LANGS = ['en', 'de', 'fr', 'es'] as const;

type ToolsConfig = AppVoiceAgentToolsConfig;

/** A string argument over its cap → the error the model reads; else null. */
function tooLong(field: keyof typeof MAX_ARG_CHARS, value: string | undefined): AgentToolResult | null {
  const max = MAX_ARG_CHARS[field];
  return value !== undefined && value.length > max
    ? { ok: false, error: `${field} is longer than ${max} characters` }
    : null;
}

function weatherKey(): { key: string; base: string } | null {
  return env.WEATHER_API_KEY
    ? { key: env.WEATHER_API_KEY, base: env.WEATHER_API_BASE_URL ?? WEATHER_DEFAULT_BASE }
    : null;
}

/** The geocoder's hits for a name in one language, with coordinates, most populous first. */
async function geocode(location: string, lang: string, cfg: ToolsConfig): Promise<Json[]> {
  const params = new URLSearchParams({ name: location, count: '10', language: lang, format: 'json' });
  const r = await httpJson(`${GEOCODER_BASE}/search?${params.toString()}`, {}, cfg.timeout_ms, 'Open-Meteo geocoder', '');
  const hits = r.ok && Array.isArray(rec(r.body)?.['results']) ? (rec(r.body)?.['results'] as unknown[]) : [];
  return hits
    .map(rec)
    .filter((h): h is Json => h !== null && numv(h['latitude']) !== undefined && numv(h['longitude']) !== undefined)
    .toSorted((a, b) => (numv(b['population']) ?? 0) - (numv(a['population']) ?? 0));
}

function isPopulated(hit: Json | undefined): hit is Json {
  return (numv(hit?.['population']) ?? 0) > 0;
}

/**
 * A place name → WeatherAPI query `lat,lon` + the local display name. The geocoder matches names
 * only in the language it is asked in, so "Tokio" in English finds only villages without a
 * population (Tokio, Texas). When no hit of the session language has a population, the other
 * shipped languages are asked too and the most populous hit of all wins; its name then comes from
 * WeatherAPI (in the session language), not from the foreign-language hit. No hit or a geocoder
 * failure keeps the user's text, which WeatherAPI then resolves itself (`resolved_by` says which).
 */
/** `lat`/`lon`/`zone`/`hit_name` are set only for a geocoder hit (the keyless tools need them). */
interface ResolvedPlace {
  q: string;
  name: string | null;
  resolved_by: 'geocoder' | 'weatherapi';
  lat?: number;
  lon?: number;
  zone?: string;
  /** Display name of the hit itself, also when it came from another language. */
  hit_name?: string;
}

async function resolvePlace(
  location: string,
  lang: string,
  cfg: ToolsConfig,
): Promise<ResolvedPlace> {
  const local = await geocode(location, lang, cfg);
  let best = local[0];
  let name: string | null = best ? [str(best['name']), str(best['country'])].filter(Boolean).join(', ') : null;
  if (!isPopulated(best)) {
    const others = await Promise.all(
      GEOCODER_LANGS.filter((l) => l !== lang).map((l) => geocode(location, l, cfg)),
    );
    const foreign = others
      .map((hits) => hits[0])
      .filter(isPopulated)
      .toSorted((a, b) => (numv(b['population']) ?? 0) - (numv(a['population']) ?? 0))[0];
    if (foreign) {
      best = foreign;
      name = null;
    }
  }
  if (!best) return { q: location, name: null, resolved_by: 'weatherapi' };
  const lat = numv(best['latitude']) ?? 0;
  const lon = numv(best['longitude']) ?? 0;
  const zone = str(best['timezone']);
  return {
    q: `${lat},${lon}`,
    name,
    resolved_by: 'geocoder',
    lat,
    lon,
    ...(zone ? { zone } : {}),
    hit_name: [str(best['name']), str(best['country'])].filter(Boolean).join(', '),
  };
}

async function getWeather(args: Json, cfg: ToolsConfig, lang: string): Promise<AgentToolResult> {
  const location = str(args['location']);
  if (!location) return { ok: false, error: 'location is required' };
  const longLocation = tooLong('location', location);
  if (longLocation) return longLocation;
  const w = weatherKey();
  const days = Math.min(3, Math.max(1, numv(args['days']) ?? cfg.weather_days));
  const where = await resolvePlace(location, lang, cfg);
  if (!w) {
    if (where.lat === undefined || where.lon === undefined) return { ok: false, error: `no place found for "${location}"` };
    return openMeteoWeather({ lat: where.lat, lon: where.lon, place: where.name ?? where.hit_name ?? location }, days, lang, cfg.timeout_ms);
  }
  const q = new URLSearchParams({
    key: w.key,
    q: where.q,
    days: String(days),
    aqi: 'no',
    alerts: 'no',
    // WeatherAPI translates condition text for these codes; English is its default.
    ...(lang === 'en' ? {} : { lang }),
  });
  const r = await httpJson(
    `${w.base}/forecast.json?${q.toString()}`,
    {},
    cfg.timeout_ms,
    'WeatherAPI',
    w.key,
  );
  if (!r.ok) return r;
  const body = rec(r.body);
  const loc = rec(body?.['location']);
  const cur = rec(body?.['current']);
  const place = where.name ?? [str(loc?.['name']), str(loc?.['country'])].filter(Boolean).join(', ');
  if (!place || !cur) return { ok: false, error: 'WeatherAPI returned no location for that place' };
  const forecast = Array.isArray(rec(body?.['forecast'])?.['forecastday'])
    ? (rec(body?.['forecast'])?.['forecastday'] as unknown[])
    : [];
  return {
    ok: true,
    place,
    resolved_by: where.resolved_by,
    local_time: str(loc?.['localtime']),
    now: {
      temp_c: numv(cur['temp_c']),
      feels_like_c: numv(cur['feelslike_c']),
      condition: str(rec(cur['condition'])?.['text']),
      // WeatherAPI condition code (1000 clear … 1282 thunder) + day/night: the UI card's icon.
      code: numv(rec(cur['condition'])?.['code']),
      is_day: numv(cur['is_day']) === 1,
      wind_kph: numv(cur['wind_kph']),
      humidity: numv(cur['humidity']),
    },
    days: forecast.map((d) => {
      const day = rec(rec(d)?.['day']);
      return {
        date: str(rec(d)?.['date']),
        min_c: numv(day?.['mintemp_c']),
        max_c: numv(day?.['maxtemp_c']),
        condition: str(rec(day?.['condition'])?.['text']),
        code: numv(rec(day?.['condition'])?.['code']),
        chance_of_rain: numv(day?.['daily_chance_of_rain']),
      };
    }),
  };
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Intl tag of the date words per session locale (en-GB keeps the 24 h, day-month order). */
const DATE_LOCALE: Readonly<Record<string, string>> = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };

function zonedNow(zone: string, lang: string, place?: string): AgentToolResult {
  const now = new Date();
  const fmt = (o: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(DATE_LOCALE[lang] ?? 'en-GB', { timeZone: zone, ...o }).format(now);
  return {
    ok: true,
    ...(place ? { place } : {}),
    time_zone: zone,
    date: fmt({ year: 'numeric', month: 'long', day: 'numeric' }),
    weekday: fmt({ weekday: 'long' }),
    time: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
    utc_offset: new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'shortOffset' }).format(now).split(' ').at(-1),
  };
}

async function getTime(args: Json, cfg: ToolsConfig, lang: string): Promise<AgentToolResult> {
  const zone = str(args['time_zone']);
  if (zone && isZone(zone)) return zonedNow(zone, lang);
  const location = str(args['location']);
  if (!location) return zonedNow(cfg.default_time_zone, lang);
  const longLocation = tooLong('location', location);
  if (longLocation) return longLocation;
  const w = weatherKey();
  const where = await resolvePlace(location, lang, cfg);
  if (!w) {
    if (!where.zone || !isZone(where.zone)) return { ok: false, error: `no time zone found for "${location}"` };
    const now = zonedNow(where.zone, lang, where.name ?? where.hit_name ?? location);
    return now.ok
      ? { ...now, ...demoFields('WEATHER_API_KEY', 'open-meteo', 'the place and its time zone come from the free Open-Meteo geocoder instead of WeatherAPI; the time itself is exact') }
      : now;
  }
  const q = new URLSearchParams({ key: w.key, q: where.q });
  const r = await httpJson(
    `${w.base}/timezone.json?${q.toString()}`,
    {},
    cfg.timeout_ms,
    'WeatherAPI',
    w.key,
  );
  if (!r.ok) return r;
  const loc = rec(rec(r.body)?.['location']);
  const tz = str(loc?.['tz_id']);
  if (!tz || !isZone(tz)) return { ok: false, error: `no time zone found for "${location}"` };
  return zonedNow(tz, lang, where.name ?? [str(loc?.['name']), str(loc?.['country'])].filter(Boolean).join(', '));
}

async function webSearch(args: Json, cfg: ToolsConfig, lang: string): Promise<AgentToolResult> {
  const query = str(args['query']);
  if (!query) return { ok: false, error: 'query is required' };
  const longQuery = tooLong('query', query);
  if (longQuery) return longQuery;
  if (!env.EXA_API_KEY) return searchKnowledge(query, lang, cfg.search_results, cfg.summary_max_chars);
  const key = env.EXA_API_KEY;
  const r = await httpJson(
    `${env.EXA_BASE_URL ?? EXA_DEFAULT_BASE}/search`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: cfg.search_results,
        contents: { summary: { query } },
      }),
    },
    cfg.timeout_ms,
    'Exa search',
    key,
  );
  if (!r.ok) return r;
  const results = Array.isArray(rec(r.body)?.['results'])
    ? (rec(r.body)?.['results'] as unknown[])
    : [];
  return {
    ok: true,
    query,
    results: results.slice(0, cfg.search_results).map((hit) => {
      const h = rec(hit);
      const summary = str(h?.['summary']) ?? '';
      return {
        title: str(h?.['title']),
        url: str(h?.['url']),
        published: str(h?.['publishedDate']),
        summary:
          summary.length > cfg.summary_max_chars
            ? `${summary.slice(0, cfg.summary_max_chars)}…`
            : summary,
      };
    }),
  };
}

/** Magic-byte sniff: the bytes decide the type, never the upstream claim. */
function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * OpenRouter images API (`POST {base}/images`, body {model, prompt, aspect_ratio, n}). Answer
 * `data[0].b64_json` (+ `usage.cost`) → a data URL for the card. The browser strips
 * `image_data_url` before the result goes back into the model's context.
 */
async function generateImage(args: Json, cfg: ToolsConfig): Promise<AgentToolResult> {
  const prompt = str(args['prompt']);
  if (!prompt) return { ok: false, error: 'prompt is required' };
  const longText = tooLong('prompt', prompt) ?? tooLong('caption', str(args['caption']));
  if (longText) return longText;
  const asked = str(args['aspect_ratio']);
  const aspect = asked && cfg.image_aspect_ratios.includes(asked) ? asked : (cfg.image_aspect_ratios[0] ?? '1:1');
  if (!env.OPENROUTER_API_KEY) return demoImage(prompt, str(args['caption']) ?? null, aspect);
  const key = env.OPENROUTER_API_KEY;
  const r = await httpJson(
    `${env.OPENROUTER_BASE_URL ?? OPENROUTER_DEFAULT_BASE}/images`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: cfg.image_model, prompt, aspect_ratio: aspect, n: 1 }),
    },
    cfg.image_timeout_ms,
    'OpenRouter images',
    key,
  );
  if (!r.ok) return r;
  const body = rec(r.body);
  const first = Array.isArray(body?.['data']) ? rec((body['data'] as unknown[])[0]) : null;
  const b64 = str(first?.['b64_json']);
  if (!b64) return { ok: false, error: str(rec(body?.['error'])?.['message']) ?? 'OpenRouter returned no image' };
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: 'OpenRouter returned an image of an unusable size' };
  const mime = sniffImageMime(bytes);
  if (!mime) return { ok: false, error: 'OpenRouter returned bytes that are not an image' };
  return {
    ok: true,
    prompt,
    // Caption in the session language for the card; the English prompt drives the image model.
    caption: str(args['caption']) ?? null,
    aspect_ratio: aspect,
    model: cfg.image_model,
    cost_usd: numv(rec(body?.['usage'])?.['cost']) ?? null,
    bytes: bytes.length,
    image_data_url: `data:${mime};base64,${b64}`,
  };
}

/** Run one voice-agent tool by name with the model's JSON arguments, in the session locale. */
export async function runAgentTool(
  name: AgentToolName,
  args: Json,
  lang: string,
): Promise<AgentToolResult> {
  const cfg = voiceAgentTools;
  if (name === 'get_weather') return getWeather(args, cfg, lang);
  if (name === 'get_time') return getTime(args, cfg, lang);
  if (name === 'generate_image') return generateImage(args, cfg);
  return webSearch(args, cfg, lang);
}

export function isAgentToolName(value: string): value is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(value);
}

/** The voice-agent tool runner. */
export const AgentTools = { run: runAgentTool, names: AGENT_TOOL_NAMES } as const;
