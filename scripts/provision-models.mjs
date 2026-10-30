#!/usr/bin/env node
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     scripts
 * @purpose   Downloads and sha256-verifies the voice model set at the pinned Hugging Face revision into the git-ignored models folder that /api/models serves.
 * @status    reusable
 *
 *   pnpm models:provision                                 # download + verify into models/webgpu-onnx
 *   node scripts/provision-models.mjs --dry-run --json    # plan only: {files:[{path,bytes,sha256}], total_bytes}
 *   node scripts/provision-models.mjs --dir models/alt    # another folder (also MODELS_DIR)
 *
 * Voice set = decoder, audio encoder, codec, depth, tokenizer + config files. Repo, revision, onnx_dir,
 * decoder, graphs and preprocess_files come from config/icedliquid.json `webgpu`; Node stdlib only.
 * Sizes and sha256 come from the Hugging Face tree API at the pinned revision: LFS files carry their
 * sha256 there; small git files carry only their git blob id, so the plan reads their bytes (a few KB),
 * checks the blob id and hashes them. HF_TOKEN is sent only when set, and never to the CDN hop.
 * The file list must match fileNames() in src/lib/server/model-files.server.ts (the route's allowlist).
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = 'config/icedliquid.json';
const DEFAULT_DIR = 'models/webgpu-onnx';
// Text-lane root files the browser reads (src/lib/webgpu/model-cache.ts modelFileUrls).
const TEXT_ROOT_FILES = [
  'tokenizer.json',
  'tokenizer_config.json',
  'chat_template.jinja',
  'config.json',
  'generation_config.json',
];
// A non-LFS file is read into memory to hash it; anything larger is a fault, not a guess.
const MAX_INLINE_BYTES = 1 << 20;
const MAX_REDIRECTS = 5;

class ProvisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProvisionError';
  }
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      dir: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  return values;
}

function readWebgpuConfig() {
  const raw = JSON.parse(readFileSync(join(appRoot, CONFIG_FILE), 'utf8'));
  const cfg = raw.webgpu;
  if (!cfg || typeof cfg !== 'object') throw new ProvisionError(`${CONFIG_FILE}: webgpu is missing`);
  for (const key of ['hf_base_url', 'hf_repo', 'hf_revision', 'onnx_dir', 'decoder']) {
    if (typeof cfg[key] !== 'string' || cfg[key].trim() === '') {
      throw new ProvisionError(`${CONFIG_FILE}: webgpu.${key} is missing`);
    }
  }
  if (!/^[0-9a-f]{40}$/.test(cfg.hf_revision)) {
    throw new ProvisionError(`${CONFIG_FILE}: webgpu.hf_revision must be a 40-hex commit sha`);
  }
  const graphs = cfg.graphs;
  if (!graphs || typeof graphs !== 'object' || Object.keys(graphs).length === 0) {
    throw new ProvisionError(`${CONFIG_FILE}: webgpu.graphs is missing`);
  }
  if (!Array.isArray(cfg.preprocess_files) || cfg.preprocess_files.length === 0) {
    throw new ProvisionError(`${CONFIG_FILE}: webgpu.preprocess_files is missing`);
  }
  return cfg;
}

/** Repo-relative paths of the voice set, in download order (small files first). */
function fileNames(cfg) {
  const onnxDir = cfg.onnx_dir.replace(/^\/+|\/+$/g, '');
  const stems = [cfg.decoder, ...Object.values(cfg.graphs)];
  const graphFiles = stems.flatMap((stem) => [`${onnxDir}/${stem}.onnx`, `${onnxDir}/${stem}.onnx_data`]);
  const rootFiles = [...TEXT_ROOT_FILES, ...cfg.preprocess_files.map((p) => p.replace(/^\/+/, ''))];
  return [...new Set([...rootFiles, ...graphFiles])];
}

/** Models folder: --dir, else MODELS_DIR, else models/webgpu-onnx; relative paths resolve from the app root. */
function modelsDir(option) {
  const fromEnv = process.env.MODELS_DIR?.trim();
  const chosen = option?.trim() || fromEnv || DEFAULT_DIR;
  const dir = resolve(appRoot, chosen);
  const rel = relative(appRoot, dir);
  const insideApp = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  // Inside the app only models/ is git-ignored; public/ would be copied into every build.
  if (insideApp && rel !== 'models' && !rel.startsWith(`models${sep}`)) {
    throw new ProvisionError(`refusing ${dir}: inside the app, weights live under models/ only`);
  }
  return dir;
}

function authHeaders() {
  const token = process.env.HF_TOKEN?.trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** GET with manual redirects so the Authorization header stays on the Hugging Face origin. */
async function hfFetch(url) {
  const origin = new URL(url).origin;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const headers = new URL(current).origin === origin ? authHeaders() : {};
    const response = await fetch(current, { headers, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new ProvisionError(`${current}: redirect ${response.status} without location`);
    current = new URL(location, current).toString();
  }
  throw new ProvisionError(`${url}: more than ${MAX_REDIRECTS} redirects`);
}

async function expectOk(response, what) {
  if (response.ok) return response;
  const detail = (await response.text().catch(() => '')).slice(0, 200);
  throw new ProvisionError(`${what}: HTTP ${response.status} ${detail}`.trim());
}

function resolveUrl(cfg, file) {
  const base = cfg.hf_base_url.replace(/\/+$/, '');
  const encoded = file.split('/').map(encodeURIComponent).join('/');
  return `${base}/${cfg.hf_repo}/resolve/${cfg.hf_revision}/${encoded}`;
}

/** Every file entry of the repo tree at the pinned revision, following `Link: rel="next"` pages. */
async function readTree(cfg) {
  const base = cfg.hf_base_url.replace(/\/+$/, '');
  let url = `${base}/api/models/${cfg.hf_repo}/tree/${cfg.hf_revision}?recursive=true`;
  const entries = new Map();
  while (url) {
    const response = await expectOk(await hfFetch(url), `tree API ${cfg.hf_repo}@${cfg.hf_revision}`);
    for (const entry of await response.json()) {
      if (entry.type === 'file') entries.set(entry.path, entry);
    }
    const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '');
    url = next ? next[1] : null;
  }
  return entries;
}

function gitBlobId(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** Size + sha256 of every planned file; a missing entry or blob-id mismatch is a fault. */
async function planFiles(cfg, tree) {
  const files = [];
  for (const path of fileNames(cfg)) {
    const entry = tree.get(path);
    if (!entry) throw new ProvisionError(`${path} is not in ${cfg.hf_repo}@${cfg.hf_revision}`);
    if (entry.lfs?.oid) {
      files.push({ path, bytes: entry.lfs.size ?? entry.size, sha256: entry.lfs.oid, inline: null });
      continue;
    }
    if (entry.size > MAX_INLINE_BYTES) {
      throw new ProvisionError(`${path}: ${entry.size} B git file without an LFS sha256`);
    }
    const response = await expectOk(await hfFetch(resolveUrl(cfg, path)), path);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== entry.size || gitBlobId(bytes) !== entry.oid) {
      throw new ProvisionError(`${path}: downloaded bytes do not match git blob ${entry.oid}`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    files.push({ path, bytes: entry.size, sha256, inline: bytes });
  }
  return files;
}

async function sha256OfFile(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

async function alreadyThere(target, plan) {
  const info = await stat(target).catch(() => null);
  if (!info?.isFile() || info.size !== plan.bytes) return false;
  return (await sha256OfFile(target)) === plan.sha256;
}

function mb(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

/** Pass-through stream that hashes, counts and (on a TTY) prints a percent line. */
function meter(label, total) {
  const digest = createHash('sha256');
  const tty = process.stdout.isTTY && total > MAX_INLINE_BYTES;
  const state = { written: 0, sha256: '' };
  let shown = -1;
  const stream = new Transform({
    transform(chunk, _enc, done) {
      digest.update(chunk);
      state.written += chunk.length;
      const pct = Math.floor((state.written / total) * 100);
      if (tty && pct !== shown) {
        shown = pct;
        process.stdout.write(`\r  ...   ${label} ${pct}% (${mb(state.written)} / ${mb(total)})`);
      }
      done(null, chunk);
    },
    flush(done) {
      state.sha256 = digest.digest('hex');
      if (tty) process.stdout.write('\n');
      done();
    },
  });
  return { stream, state };
}

/** Stream one file to <target>.part, hash on the fly, rename only when size + sha256 match. */
async function download(cfg, plan, target) {
  const part = `${target}.part`;
  await mkdir(dirname(target), { recursive: true });
  const { stream, state } = meter(plan.path, plan.bytes);
  let source;
  if (plan.inline) {
    source = Readable.from([plan.inline]);
  } else {
    const response = await expectOk(await hfFetch(resolveUrl(cfg, plan.path)), plan.path);
    if (!response.body) throw new ProvisionError(`${plan.path}: empty response body`);
    source = Readable.fromWeb(response.body);
  }
  await pipeline(source, stream, createWriteStream(part));
  if (state.written !== plan.bytes || state.sha256 !== plan.sha256) {
    await rm(part, { force: true });
    const got = `got ${state.written} B sha256 ${state.sha256}`;
    return { ok: false, detail: `${got}, want ${plan.bytes} B sha256 ${plan.sha256}` };
  }
  await rename(part, target);
  return { ok: true };
}

function printPlan(cfg, dir, plan, totalBytes, asJson) {
  const files = plan.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
  if (asJson) {
    const out = { repo: cfg.hf_repo, revision: cfg.hf_revision, dir, files, total_bytes: totalBytes };
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  for (const f of files) console.log(`${f.sha256}  ${String(f.bytes).padStart(12)}  ${f.path}`);
  console.log(`plan: ${files.length} files, ${mb(totalBytes)} -> ${dir} (dry run, nothing written)`);
}

async function provision(cfg, dir, plan, totalBytes, started) {
  console.log(`provision: ${cfg.hf_repo}@${cfg.hf_revision.slice(0, 12)} -> ${dir}`);
  const failed = [];
  let fetchedBytes = 0;
  let kept = 0;
  for (const f of plan) {
    const target = join(dir, ...f.path.split('/'));
    if (await alreadyThere(target, f)) {
      kept += 1;
      console.log(`  ok    ${f.path} (${mb(f.bytes)}, already verified)`);
      continue;
    }
    const result = await download(cfg, f, target);
    if (!result.ok) {
      failed.push(f.path);
      console.error(`  FAIL  ${f.path}: sha256 mismatch, ${result.detail}`);
      continue;
    }
    fetchedBytes += f.bytes;
    console.log(`  got   ${f.path} (${mb(f.bytes)}, sha256 verified)`);
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const downloaded = plan.length - kept - failed.length;
  console.log(
    `provision: ${plan.length} files (${kept} kept, ${downloaded} downloaded, ${failed.length} failed), ` +
      `${mb(totalBytes)} total, ${mb(fetchedBytes)} fetched, ${seconds} s`,
  );
  if (failed.length > 0) {
    console.error(`provision: sha256 mismatch on ${failed.join(', ')}; run again`);
    process.exitCode = 1;
  }
}

async function main() {
  const options = readOptions();
  if (options.help) {
    console.log('usage: node scripts/provision-models.mjs [--dry-run] [--json] [--dir <folder>]');
    console.log(`  --dir  models folder (default MODELS_DIR, else ${DEFAULT_DIR}; inside the app: models/ only)`);
    return;
  }
  const started = performance.now();
  const cfg = readWebgpuConfig();
  const dir = modelsDir(options.dir);
  const plan = await planFiles(cfg, await readTree(cfg));
  const totalBytes = plan.reduce((sum, f) => sum + f.bytes, 0);
  if (options['dry-run']) return printPlan(cfg, dir, plan, totalBytes, options.json);
  await provision(cfg, dir, plan, totalBytes, started);
}

main().catch((error) => {
  console.error(`provision: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
