/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Keyless generate_image: returns one of the bundled Dudoxx sample pictures from public/demo/ as a data URL, labelled as a demo, never as a picture of the prompt.
 * @status    active
 *
 * Used only when OPENROUTER_API_KEY is not set. The pick is stable per prompt (hash), so the same
 * request shows the same sample. A missing folder or no PNG in it is an `{ok:false}` result.
 */
import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { demoFields, type AgentToolResult } from './tool-http.server';

const DEMO_DIR = path.join('public', 'demo');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** FNV-1a 32-bit: a cheap, stable index into the sample list. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export async function demoImage(
  prompt: string,
  caption: string | null,
  aspect: string,
): Promise<AgentToolResult> {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), DEMO_DIR);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.png')).toSorted();
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : 'error';
    return { ok: false, error: `the bundled demo pictures could not be read (${name})` };
  }
  const file = files[hash(prompt) % Math.max(1, files.length)];
  if (!file) return { ok: false, error: 'no bundled demo picture found in public/demo' };
  const bytes = await readFile(path.join(dir, file));
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) return { ok: false, error: `public/demo/${file} is not a PNG` };
  return {
    ok: true,
    prompt,
    caption,
    aspect_ratio: aspect,
    model: null,
    cost_usd: null,
    bytes: bytes.length,
    demo_image: `demo/${file}`,
    image_data_url: `data:image/png;base64,${bytes.toString('base64')}`,
    ...demoFields(
      'OPENROUTER_API_KEY',
      'bundled-image',
      'this is a bundled Dudoxx sample picture, not a picture of what was asked',
    ),
  };
}
