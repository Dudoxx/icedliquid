/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Keyless get_weather: real current weather and daily forecast from the free Open-Meteo forecast API, mapped to the result shape of the WeatherAPI path so the same card renders it.
 * @status    active
 *
 * Used only when WEATHER_API_KEY is not set; the result carries the demo fields (`mode: "demo"`,
 * `source: "open-meteo"`). Open-Meteo returns WMO weather codes; each one is mapped to the closest
 * WeatherAPI condition code (the card's icon table) and a condition text per session locale.
 */
import 'server-only';

import { demoFields, httpJson, numv, rec, type AgentToolResult } from './tool-http.server';

const FORECAST_BASE = 'https://api.open-meteo.com/v1';

const LANGS = ['en', 'de', 'fr', 'es'] as const;
type Lang = (typeof LANGS)[number];
type Words = Readonly<Record<Lang, string>>;

/** WMO code → [WeatherAPI code for the icon, condition text per locale]. */
const WMO: ReadonlyArray<[codes: number[], weatherApiCode: number, text: Words]> = [
  [[0], 1000, { en: 'Clear sky', de: 'Klarer Himmel', fr: 'Ciel dégagé', es: 'Despejado' }],
  [[1], 1000, { en: 'Mainly clear', de: 'Überwiegend klar', fr: 'Plutôt dégagé', es: 'Mayormente despejado' }],
  [[2], 1003, { en: 'Partly cloudy', de: 'Teilweise bewölkt', fr: 'Partiellement nuageux', es: 'Parcialmente nublado' }],
  [[3], 1009, { en: 'Overcast', de: 'Bedeckt', fr: 'Couvert', es: 'Cubierto' }],
  [[45, 48], 1135, { en: 'Fog', de: 'Nebel', fr: 'Brouillard', es: 'Niebla' }],
  [[51, 53, 55], 1153, { en: 'Drizzle', de: 'Nieselregen', fr: 'Bruine', es: 'Llovizna' }],
  [[56, 57], 1168, { en: 'Freezing drizzle', de: 'Gefrierender Nieselregen', fr: 'Bruine verglaçante', es: 'Llovizna helada' }],
  [[61], 1183, { en: 'Light rain', de: 'Leichter Regen', fr: 'Pluie faible', es: 'Lluvia ligera' }],
  [[63], 1189, { en: 'Rain', de: 'Regen', fr: 'Pluie', es: 'Lluvia' }],
  [[65], 1195, { en: 'Heavy rain', de: 'Starker Regen', fr: 'Forte pluie', es: 'Lluvia fuerte' }],
  [[66, 67], 1201, { en: 'Freezing rain', de: 'Gefrierender Regen', fr: 'Pluie verglaçante', es: 'Lluvia helada' }],
  [[71], 1213, { en: 'Light snow', de: 'Leichter Schneefall', fr: 'Faible neige', es: 'Nieve ligera' }],
  [[73], 1219, { en: 'Snow', de: 'Schneefall', fr: 'Neige', es: 'Nieve' }],
  [[75], 1225, { en: 'Heavy snow', de: 'Starker Schneefall', fr: 'Forte neige', es: 'Nieve fuerte' }],
  [[77], 1237, { en: 'Snow grains', de: 'Schneegriesel', fr: 'Neige en grains', es: 'Granos de nieve' }],
  [[80, 81], 1243, { en: 'Rain showers', de: 'Regenschauer', fr: 'Averses', es: 'Chubascos' }],
  [[82], 1246, { en: 'Heavy rain showers', de: 'Starke Regenschauer', fr: 'Fortes averses', es: 'Chubascos fuertes' }],
  [[85, 86], 1258, { en: 'Snow showers', de: 'Schneeschauer', fr: 'Averses de neige', es: 'Chubascos de nieve' }],
  [[95], 1276, { en: 'Thunderstorm', de: 'Gewitter', fr: 'Orage', es: 'Tormenta' }],
  [[96, 99], 1276, { en: 'Thunderstorm with hail', de: 'Gewitter mit Hagel', fr: 'Orage avec grêle', es: 'Tormenta con granizo' }],
];

/** A WMO code → {code, condition}; an unknown code keeps no text and no icon code (never a guess). */
function condition(wmo: number | undefined, lang: string): { code: number | undefined; condition: string | undefined } {
  const row = WMO.find(([codes]) => wmo !== undefined && codes.includes(wmo));
  if (!row) return { code: undefined, condition: undefined };
  return { code: row[1], condition: row[2][LANGS.find((l) => l === lang) ?? 'en'] };
}

function numAt(list: unknown, i: number): number | undefined {
  return Array.isArray(list) ? numv(list[i]) : undefined;
}

export interface OpenMeteoPlace {
  lat: number;
  lon: number;
  place: string;
}

/** Current weather + `days` daily rows for a geocoded place, in the WeatherAPI result shape. */
export async function openMeteoWeather(
  where: OpenMeteoPlace,
  days: number,
  lang: string,
  timeoutMs: number,
): Promise<AgentToolResult> {
  const q = new URLSearchParams({
    latitude: String(where.lat),
    longitude: String(where.lon),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(Math.round(days)),
    wind_speed_unit: 'kmh',
  });
  const r = await httpJson(`${FORECAST_BASE}/forecast?${q.toString()}`, {}, timeoutMs, 'Open-Meteo forecast', '');
  if (!r.ok) return r;
  const body = rec(r.body);
  const cur = rec(body?.['current']);
  const daily = rec(body?.['daily']);
  if (!cur) return { ok: false, error: 'Open-Meteo returned no current weather for that place' };
  const times = daily?.['time'];
  const dates: unknown[] = Array.isArray(times) ? times : [];
  const now = condition(numv(cur['weather_code']), lang);
  const time = cur['time'];
  return {
    ok: true,
    place: where.place,
    resolved_by: 'geocoder',
    // Open-Meteo gives local ISO time ("2026-10-30T11:15"); WeatherAPI's form is "2026-10-30 11:15".
    local_time: typeof time === 'string' ? time.replace('T', ' ') : undefined,
    now: {
      temp_c: numv(cur['temperature_2m']),
      feels_like_c: numv(cur['apparent_temperature']),
      condition: now.condition,
      code: now.code,
      is_day: numv(cur['is_day']) === 1,
      wind_kph: numv(cur['wind_speed_10m']),
      humidity: numv(cur['relative_humidity_2m']),
    },
    days: dates.map((date, i) => {
      const day = condition(numAt(daily?.['weather_code'], i), lang);
      return {
        date: typeof date === 'string' ? date : undefined,
        min_c: numAt(daily?.['temperature_2m_min'], i),
        max_c: numAt(daily?.['temperature_2m_max'], i),
        condition: day.condition,
        code: day.code,
        chance_of_rain: numAt(daily?.['precipitation_probability_max'], i),
      };
    }),
    ...demoFields('WEATHER_API_KEY', 'open-meteo', 'this is live data from the free Open-Meteo service instead of WeatherAPI'),
  };
}
