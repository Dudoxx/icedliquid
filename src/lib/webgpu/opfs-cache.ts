/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Keeps the ONNX model files in the browser's Origin Private File System, keyed by the server ETag, so a page reload reads them from disk instead of fetching 1.35 GB again.
 * @status    feature-local
 */

const DIR_NAME = 'lfm3-onnx';

export interface OpfsWriter {
  write: (chunk: Uint8Array) => Promise<void>;
  /** Commit the file and its ETag record. */
  close: () => Promise<void>;
  /** Drop a half-written file (stream failed or size mismatch). */
  abort: () => Promise<void>;
}

function supported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function cacheDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR_NAME, { create: true });
}

/** File-system-safe key for a route path such as `onnx/<decoder>.onnx_data`. */
export function cacheKey(relPath: string): string {
  return relPath.replace(/[^A-Za-z0-9._-]/g, '__');
}

/**
 * What the weight cache holds now: committed files (those with an ETag record) and their bytes;
 * null when OPFS is unavailable. Read-only — validity against the route is checked at load time.
 */
export async function cacheSummary(): Promise<{ files: number; bytes: number; persisted: boolean } | null> {
  if (!supported()) return null;
  try {
    const dir = await cacheDir();
    let files = 0;
    let bytes = 0;
    // FileSystemDirectoryHandle is async-iterable in every OPFS browser (lib.dom types lag).
    const entries = (dir as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
    for await (const handle of entries) {
      if (handle.kind !== 'file' || handle.name.endsWith('.etag')) continue;
      const tagged = await dir.getFileHandle(`${handle.name}.etag`).then(() => true, () => false);
      if (!tagged) continue;
      files += 1;
      bytes += (await (handle as FileSystemFileHandle).getFile()).size;
    }
    const persisted = (await navigator.storage.persisted?.()) ?? false;
    return { files, bytes, persisted };
  } catch {
    return null;
  }
}

/** The cached bytes when the stored ETag and size match the route's current ones, else null. */
export async function readCached(key: string, etag: string, size: number): Promise<ArrayBuffer | null> {
  if (!supported()) return null;
  try {
    const dir = await cacheDir();
    const tag = await (await (await dir.getFileHandle(`${key}.etag`)).getFile()).text();
    if (tag !== etag) return null;
    const file = await (await dir.getFileHandle(key)).getFile();
    if (file.size !== size) return null;
    return await file.arrayBuffer();
  } catch {
    return null; // NotFoundError on first load: not cached yet.
  }
}

/** Open a streaming writer for `key`; null when OPFS or the quota cannot hold `size` bytes. */
export async function openWriter(key: string, etag: string, size: number): Promise<OpfsWriter | null> {
  if (!supported()) return null;
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    if (quota - usage < size * 1.05) return null;
    // Ask the browser not to evict the weights under storage pressure (best effort).
    await navigator.storage.persist?.();
    const dir = await cacheDir();
    await dir.removeEntry(`${key}.etag`).catch(() => undefined);
    const writable = await (await dir.getFileHandle(key, { create: true })).createWritable();
    return {
      // fetch() body chunks are plain ArrayBuffer views (never SharedArrayBuffer).
      write: (chunk) => writable.write(chunk as Uint8Array<ArrayBuffer>),
      close: async () => {
        await writable.close();
        const tagWritable = await (await dir.getFileHandle(`${key}.etag`, { create: true })).createWritable();
        await tagWritable.write(etag);
        await tagWritable.close();
      },
      abort: async () => {
        await writable.abort().catch(() => undefined);
        await dir.removeEntry(key).catch(() => undefined);
      },
    };
  } catch (error) {
    console.warn('[webgpu] OPFS cache unavailable, loading from the route only:', error);
    return null;
  }
}
