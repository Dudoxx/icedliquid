/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    ui
 * @topic     voice
 * @purpose   Narrow the voice-agent tool results (get_weather, web_search, generate_image) to the shapes the icedLiquid cards render, and map a WeatherAPI condition code to a lucide glyph.
 * @status    feature-local
 *
 * Shapes: lib/server/agent-tools.server.ts. The glyph table maps WeatherAPI condition codes
 * 1000-1282. A result that does not match returns null and
 * the plain tool chip is shown instead — never raw JSON, never invented values.
 */
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export interface WeatherNow {
  temp_c: number | null;
  feels_like_c: number | null;
  condition: string | null;
  code: number | null;
  is_day: boolean;
  wind_kph: number | null;
  humidity: number | null;
}

export interface WeatherDay {
  date: string | null;
  min_c: number | null;
  max_c: number | null;
  condition: string | null;
  code: number | null;
  chance_of_rain: number | null;
}

export interface WeatherResult {
  place: string;
  now: WeatherNow;
  days: WeatherDay[];
}

export interface WebHit {
  title: string;
  url: string;
  site: string;
  published: string | null;
  summary: string;
}

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function asWeather(result: unknown): WeatherResult | null {
  const r = rec(result);
  const now = rec(r?.['now']);
  const place = txt(r?.['place']);
  if (!r || r['ok'] !== true || !now || !place) return null;
  const days = Array.isArray(r['days']) ? r['days'] : [];
  return {
    place,
    now: {
      temp_c: num(now['temp_c']),
      feels_like_c: num(now['feels_like_c']),
      condition: txt(now['condition']),
      code: num(now['code']),
      is_day: now['is_day'] !== false,
      wind_kph: num(now['wind_kph']),
      humidity: num(now['humidity']),
    },
    days: days.map(rec).flatMap((d) =>
      d
        ? [{ date: txt(d['date']), min_c: num(d['min_c']), max_c: num(d['max_c']), condition: txt(d['condition']), code: num(d['code']), chance_of_rain: num(d['chance_of_rain']) }]
        : [],
    ),
  };
}

export interface ImageResult {
  url: string;
  prompt: string;
  /** Caption in the session language (model-written); the card prefers it over the English prompt. */
  caption: string | null;
  model: string | null;
  cost_usd: number | null;
  aspect_ratio: string | null;
}

/** generate_image: only a data:image/(png|jpeg|webp) URL is accepted (never a remote URL). */
export function asImage(result: unknown): ImageResult | null {
  const r = rec(result);
  const url = txt(r?.['image_data_url']);
  if (!r || r['ok'] !== true || !url || !/^data:image\/(png|jpeg|webp);base64,/.test(url)) return null;
  return { url, prompt: txt(r['prompt']) ?? '', caption: txt(r['caption']) ?? null, model: txt(r['model']), cost_usd: num(r['cost_usd']), aspect_ratio: txt(r['aspect_ratio']) };
}

/** web_search hits with an https URL; the site name is the URL host (no remote favicon is loaded). */
export function asWebHits(result: unknown): WebHit[] | null {
  const r = rec(result);
  if (!r || r['ok'] !== true || !Array.isArray(r['results'])) return null;
  return r['results'].map(rec).flatMap((h) => {
    const url = txt(h?.['url']);
    if (!h || !url || !url.startsWith('https://')) return [];
    return [{ title: txt(h['title']) ?? url, url, site: new URL(url).hostname.replace(/^www\./, ''), published: txt(h['published']), summary: txt(h['summary']) ?? '' }];
  });
}

const GLYPH: ReadonlyArray<[number[], LucideIcon]> = [
  [[1000], Sun],
  [[1003], CloudSun],
  [[1006, 1009], Cloudy],
  [[1030, 1135, 1147], CloudFog],
  [[1063, 1150, 1153, 1180, 1183, 1240], CloudDrizzle],
  [[1186, 1189, 1192, 1195, 1243, 1246], CloudRain],
  [[1069, 1072, 1168, 1171, 1198, 1201, 1204, 1207, 1237, 1249, 1252, 1261, 1264], CloudHail],
  [[1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258], CloudSnow],
  [[1087, 1273, 1276, 1279, 1282], CloudLightning],
];

export function weatherGlyph(code: number | null, isDay = true): LucideIcon {
  const icon = GLYPH.find(([codes]) => code !== null && codes.includes(code))?.[1] ?? Cloud;
  if (!isDay && icon === Sun) return Moon;
  if (!isDay && icon === CloudSun) return CloudMoon;
  return icon;
}
