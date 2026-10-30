/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Builds the ONNX model file URLs from the webgpu config block and loads each file from the browser OPFS copy or, on a miss, streams it from the local model route with byte progress.
 * @status    feature-local
 */
import { cacheKey, openWriter, readCached, type OpfsWriter } from './opfs-cache';
import { WebgpuEngineError, type WebgpuConfig, type WebgpuErrorCode, type WebgpuGraphKey } from './protocol';

export interface ModelFileUrls {
  graph: string;
  graphData: string;
  tokenizer: string;
  tokenizerConfig: string;
  chatTemplate: string;
  modelConfig: string;
  generationConfig: string;
}

/** One ONNX graph: the .onnx URL, its external-data URL and the data name the graph references. */
export interface GraphFileUrls {
  graph: string;
  data: string;
  dataName: string;
}

export interface FetchedFile {
  bytes: ArrayBuffer;
  cacheHit: boolean;
}

export type ProgressSink = (file: string, loaded: number, total: number) => void;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/** File name of the external-data blob, as the ONNX graph references it. */
export function externalDataName(config: WebgpuConfig): string {
  return `${config.decoder}.onnx_data`;
}

export function modelFileUrls(config: WebgpuConfig): ModelFileUrls {
  const root = config.files_base.replace(/\/+$/, '');
  const onnx = `${root}/${trimSlashes(config.onnx_dir)}`;
  return {
    graph: `${onnx}/${config.decoder}.onnx`,
    graphData: `${onnx}/${externalDataName(config)}`,
    tokenizer: `${root}/tokenizer.json`,
    tokenizerConfig: `${root}/tokenizer_config.json`,
    chatTemplate: `${root}/chat_template.jinja`,
    modelConfig: `${root}/config.json`,
    generationConfig: `${root}/generation_config.json`,
  };
}

function onnxBase(config: WebgpuConfig): string {
  return `${config.files_base.replace(/\/+$/, '')}/${trimSlashes(config.onnx_dir)}`;
}

/** Graph stem for `key`: `config.decoder`, else `config.graphs[key]`; an absent key is MISSING_GRAPH. */
function graphStem(config: WebgpuConfig, key: WebgpuGraphKey): string {
  if (key === 'decoder') return config.decoder;
  const stem = config.graphs?.[key];
  if (!stem) {
    throw new WebgpuEngineError(
      'MISSING_GRAPH',
      `${key}: config webgpu.graphs has no entry`,
    );
  }
  return stem;
}

export function graphFileUrls(config: WebgpuConfig, key: WebgpuGraphKey): GraphFileUrls {
  const stem = graphStem(config, key);
  const onnx = onnxBase(config);
  const dataName = `${stem}.onnx_data`;
  return { graph: `${onnx}/${stem}.onnx`, data: `${onnx}/${dataName}`, dataName };
}

/** Preprocessing files (config/icedliquid.json webgpu.preprocess_files) keyed by their path relative to files_base. */
export function preprocessFileUrls(config: WebgpuConfig): Record<string, string> {
  const root = config.files_base.replace(/\/+$/, '');
  const urls: Record<string, string> = {};
  for (const rel of config.preprocess_files ?? []) urls[rel] = `${root}/${trimSlashes(rel)}`;
  return urls;
}

function fileLabel(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

async function readStream(
  response: Response,
  file: string,
  onProgress: ProgressSink,
  sink: OpfsWriter | null,
): Promise<ArrayBuffer> {
  const total = Number(response.headers.get('content-length') ?? 0);
  const body = response.body;
  if (!body) {
    const bytes = await response.arrayBuffer();
    onProgress(file, bytes.byteLength, bytes.byteLength);
    return bytes;
  }
  const reader = body.getReader();
  // Known size: fill one buffer in place (the 1.41 GB data file must not be copied twice).
  const target = total > 0 ? new Uint8Array(total) : null;
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (target && loaded + value.byteLength <= total) target.set(value, loaded);
    else parts.push(value);
    await sink?.write(value);
    loaded += value.byteLength;
    onProgress(file, loaded, total);
  }
  if (target && loaded === total) return target.buffer;
  // Size header missing or wrong: join the parts once.
  const joined = new Uint8Array(loaded);
  let offset = 0;
  if (target) {
    const head = target.subarray(0, Math.min(loaded, total));
    joined.set(head, 0);
    offset = head.byteLength;
  }
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined.buffer;
}

async function routeError(response: Response, file: string, missingCode: WebgpuErrorCode): Promise<WebgpuEngineError> {
  const detail = await response.json().then((b: { message?: string }) => b.message ?? '', () => '');
  const code = response.status === 404 ? missingCode : 'LOAD_FAILED';
  return new WebgpuEngineError(code, `${file}: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
}

async function request(
  url: string,
  file: string,
  method: 'GET' | 'HEAD',
  missingCode: WebgpuErrorCode,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { method, cache: 'no-store' });
  } catch (error) {
    throw new WebgpuEngineError('LOAD_FAILED', `${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw await routeError(response, file, missingCode);
  return response;
}

/**
 * One model file: from the browser's OPFS copy when its ETag and size still match the route
 * (cacheHit true, no download), else streamed from the local model route with progress and
 * written to OPFS on the way. A 404 carries the route's message, which names the download command;
 * its code is `missingCode` (LOAD_FAILED by default, MISSING_GRAPH for graph files).
 */
export async function fetchModelFile(
  url: string,
  onProgress: ProgressSink,
  missingCode: WebgpuErrorCode = 'LOAD_FAILED',
): Promise<FetchedFile> {
  const file = fileLabel(url);
  const head = await request(url, file, 'HEAD', missingCode);
  const etag = head.headers.get('etag');
  const size = Number(head.headers.get('content-length') ?? 0);
  const key = cacheKey(new URL(url, self.location.origin).pathname);
  if (etag && size > 0) {
    const cached = await readCached(key, etag, size);
    if (cached) {
      onProgress(file, size, size);
      return { bytes: cached, cacheHit: true };
    }
  }
  const response = await request(url, file, 'GET', missingCode);
  const writer = etag && size > 0 ? await openWriter(key, etag, size) : null;
  try {
    const bytes = await readStream(response, file, onProgress, writer);
    if (writer && bytes.byteLength === size) await writer.close();
    else await writer?.abort();
    return { bytes, cacheHit: false };
  } catch (error) {
    await writer?.abort();
    throw error;
  }
}

export async function fetchModelText(url: string, onProgress: ProgressSink): Promise<FetchedFile & { text: string }> {
  const fetched = await fetchModelFile(url, onProgress);
  return { ...fetched, text: new TextDecoder().decode(fetched.bytes) };
}
