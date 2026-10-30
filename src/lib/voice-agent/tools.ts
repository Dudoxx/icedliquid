/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       config
 * @domain    integration
 * @topic     voice-agent
 * @purpose   OpenAI function specs of the voice-agent tools (server: get_weather, get_time, web_search, generate_image; browser UI: set_theme, set_locale, end_session) and the browser call to the server-side tool route.
 * @status    active
 */
import { locales } from '@/i18n/types';

export type VoiceAgentToolSpec = Record<string, unknown>;

/**
 * The tool specs of a session in `language` (e.g. "German"): text the user sees (the image caption)
 * is asked for in that language by name, which a 2B model follows better than "the user's language".
 */
export function voiceAgentTools(language: string): VoiceAgentToolSpec[] {
  return [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description:
        'Get the current weather and the daily forecast (today up to 3 days) for a city or place. Call it for every question about weather, temperature, rain, snow or wind, in any language (Wetter, Temperatur, regnet es; météo, quel temps, il pleut; tiempo, qué tiempo hace, llueve).',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or place as the user names it, in any language, e.g. "München", "Paris, France"',
          },
          days: { type: 'integer', description: 'Days of forecast, 1 to 3' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_time',
      description:
        'Return the current date, weekday and time, here or in any other place. Call it for every question about the time, the date or the day, in any language (wie spät ist es, Uhrzeit, welcher Tag; quelle heure est-il, quel jour; qué hora es, qué día). Pass location when the user names a city or country. Never compute or guess a time yourself.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City or place as the user names it, in any language, e.g. "Tokio", "Londres"' },
          time_zone: { type: 'string', description: 'IANA time zone, e.g. "Europe/Berlin"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for current information: news, facts, prices, releases, people, places. Call it when the user asks to search, look up or find something online, in any language (such, suche, Nachrichten; cherche, recherche, actualités; busca, noticias).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for, as a natural-language question',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description:
        'Create a picture from a description when the user asks to draw, generate, create or show an image, in any language (zeichne, Bild; dessine, image; dibuja, imagen). Write a rich visual prompt in English: subject, setting, style, light, colours.',
      parameters: {
        type: 'object',
        properties: {
          caption: { type: 'string', description: `Short caption of the picture in ${language} only (every word in ${language}, names included), 5 to 15 words; write it first, from the user's own words` },
          prompt: { type: 'string', description: 'Detailed visual description of the picture in English, 20 to 80 words (a translation for the image model)' },
          aspect_ratio: { type: 'string', enum: ['1:1', '4:3', '3:4', '16:9', '9:16'], description: 'Picture shape' },
        },
        required: ['caption', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_theme',
      description:
        'Switch the screen between dark mode and light mode when the user asks for it (dunkel/hell, sombre/clair, oscuro/claro).',
      parameters: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['dark', 'light'], description: 'dark or light' } },
        required: ['mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_locale',
      description:
        'Switch the conversation and the screen to another language when the user asks to speak it (Deutsch, français, español, English). en = English, de = German, fr = French, es = Spanish.',
      parameters: {
        type: 'object',
        properties: { locale: { type: 'string', enum: [...locales], description: 'Language code' } },
        required: ['locale'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_session',
      description:
        'End the voice conversation when the user says goodbye or asks to stop listening. Say a short goodbye first.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];
}

/** Tools the page runs itself (no server round trip). */
export const CLIENT_TOOLS: ReadonlySet<string> = new Set(['set_theme', 'set_locale', 'end_session']);

export interface VoiceAgentToolAnswer {
  result: { ok: boolean; [key: string]: unknown };
  ms: number;
}

/**
 * POST the model's arguments to the server tool route, in the session locale (`lang`: weather
 * conditions, weekday and date words). A transport failure is an `ok:false` result.
 */
export async function callVoiceAgentTool(
  name: string,
  args: Record<string, unknown>,
  lang: string,
): Promise<VoiceAgentToolAnswer> {
  const started = performance.now();
  try {
    const res = await fetch(`/api/agent-tools/${encodeURIComponent(name)}?lang=${encodeURIComponent(lang)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const body: unknown = await res.json().catch(() => null);
    const result =
      typeof body === 'object' && body !== null && 'result' in body ? body.result : null;
    if (!res.ok || typeof result !== 'object' || result === null) {
      return {
        result: { ok: false, error: `tool route answered ${res.status}` },
        ms: performance.now() - started,
      };
    }
    return { result: result as VoiceAgentToolAnswer['result'], ms: performance.now() - started };
  } catch (error) {
    return {
      result: { ok: false, error: error instanceof Error ? error.message : String(error) },
      ms: performance.now() - started,
    };
  }
}

/** The model's JSON argument string → object; malformed JSON becomes `{}` and the tool says what is missing. */
export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
