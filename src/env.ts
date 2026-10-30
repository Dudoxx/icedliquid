/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       config
 * @domain    config
 * @purpose   Server-only environment, validated with zod at first import. Every key is optional.
 * @status    foundation
 *
 * Nothing here reaches the browser: there is no public key, and `server-only` makes a client
 * import a build error. An empty value counts as unset. A missing tool key turns that tool into a
 * visible `tool_unavailable` result; a malformed value (bad URL) throws at boot, naming the key.
 * Template: `.env.example`.
 */
import 'server-only';

import { z } from 'zod';

const optionalText = z.string().optional();
const optionalUrl = z.url().optional();

const serverEnvSchema = z.object({
  // get_weather + get_time for a place (WeatherAPI.com).
  WEATHER_API_KEY: optionalText,
  WEATHER_API_BASE_URL: optionalUrl,
  // web_search (Exa).
  EXA_API_KEY: optionalText,
  EXA_BASE_URL: optionalUrl,
  // generate_image (OpenRouter images API).
  OPENROUTER_API_KEY: optionalText,
  OPENROUTER_BASE_URL: optionalUrl,
  // Folder of the downloaded ONNX weights the model-file route serves.
  MODELS_DIR: optionalText,
  // Extra host names (comma list) the tools route accepts besides localhost / 127.0.0.1 / [::1].
  ALLOWED_HOSTS: optionalText,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Read each declared key; `''` becomes undefined so an empty `.env` line means "not set". */
function readProcessEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(serverEnvSchema.shape)) {
    const value = process.env[key];
    out[key] = value === undefined || value.trim() === '' ? undefined : value.trim();
  }
  return out;
}

function parseEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(readProcessEnv());
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
  );
  throw new Error(`invalid environment: ${issues.join('; ')}`);
}

export const env: ServerEnv = parseEnv();
