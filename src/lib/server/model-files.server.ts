/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     webgpu
 * @purpose   Streams provisioned ONNX model files from the local models folder to the browser WebGPU worker.
 * @status    active
 *
 * The folder is `MODELS_DIR` (relative paths resolve from the app root), else `models/webgpu-onnx`
 * (git-ignored, filled by `pnpm models:provision`). Only the files the `webgpu` config names are
 * served (fileNames(), the same list scripts/provision-models.mjs downloads); a missing file is a
 * loud 404 naming the provisioning command, never a fall back to the network.
 */
import 'server-only';

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { webgpu, type AppWebgpuConfig } from '@/config';
import { env } from '@/env';

const DEFAULT_DIR = 'models/webgpu-onnx';
const PROVISION_HINT = 'run: pnpm models:provision';
/** Text-lane root files the browser reads (src/lib/webgpu/model-cache.ts modelFileUrls). */
const TEXT_ROOT_FILES = [
  'tokenizer.json',
  'tokenizer_config.json',
  'chat_template.jinja',
  'config.json',
  'generation_config.json',
] as const;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.json': 'application/json; charset=utf-8',
  '.jinja': 'text/plain; charset=utf-8',
};

export class ModelFileError extends Error {
  constructor(
    readonly status: 400 | 404,
    readonly code: 'MODEL_FILE_REJECTED' | 'MODEL_FILE_MISSING',
    message: string,
  ) {
    super(message);
    this.name = 'ModelFileError';
  }
}

export interface ModelFile {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly size: number;
  readonly etag: string;
  readonly contentType: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/** Paths (relative to the models folder) of the voice set: graphs + data, text root and preprocess files. */
export function fileNames(config: AppWebgpuConfig): readonly string[] {
  const onnxDir = trimSlashes(config.onnx_dir);
  const stems = [config.decoder, ...Object.values(config.graphs)];
  const graphFiles = stems.flatMap((stem) => [`${onnxDir}/${stem}.onnx`, `${onnxDir}/${stem}.onnx_data`]);
  const rootFiles = [...TEXT_ROOT_FILES, ...config.preprocess_files.map(trimSlashes)];
  return [...new Set([...rootFiles, ...graphFiles])];
}

const allowed: ReadonlySet<string> = new Set(fileNames(webgpu));

/** Absolute models folder: MODELS_DIR, else models/webgpu-onnx, resolved from the app root. */
export function modelsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.MODELS_DIR ?? DEFAULT_DIR);
}

/** Resolve URL segments to an allowlisted file inside the models folder. */
function resolveModelFile(segments: readonly string[]): { file: string; rel: string } {
  const rel = segments.join('/');
  if (segments.length === 0 || segments.some((s) => s === '' || s === '.' || s === '..' || s.includes('\\'))) {
    throw new ModelFileError(400, 'MODEL_FILE_REJECTED', `invalid model path "${rel}"`);
  }
  if (!allowed.has(rel)) {
    throw new ModelFileError(400, 'MODEL_FILE_REJECTED', `"${rel}" is not a configured model file`);
  }
  const root = modelsDir();
  const file = path.resolve(/*turbopackIgnore: true*/ root, rel);
  if (!file.startsWith(root + path.sep)) {
    throw new ModelFileError(400, 'MODEL_FILE_REJECTED', `"${rel}" is outside the models folder`);
  }
  return { file, rel };
}

/** Stat (and optionally open) one model file. `withBody: false` answers HEAD and 304. */
async function openModelFile(segments: readonly string[], withBody: boolean): Promise<ModelFile> {
  const { file, rel } = resolveModelFile(segments);
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(file);
  } catch {
    throw new ModelFileError(404, 'MODEL_FILE_MISSING', `model file "${rel}" is not provisioned (${PROVISION_HINT})`);
  }
  if (!info.isFile()) {
    throw new ModelFileError(404, 'MODEL_FILE_MISSING', `"${rel}" is not a file (${PROVISION_HINT})`);
  }
  const body = withBody ? (Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>) : null;
  return {
    body,
    size: info.size,
    // The weights change only when re-provisioned; size + mtime is a cheap validator.
    etag: `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`,
    contentType: CONTENT_TYPES[path.extname(rel)] ?? 'application/octet-stream',
  };
}

export const ModelFiles = { fileNames, modelsDir, openModelFile } as const;
