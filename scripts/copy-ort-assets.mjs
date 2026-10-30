#!/usr/bin/env node
// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Copies the onnxruntime-web runtime files (*.wasm, *.mjs) into public/ort/ (runs as predev / prebuild).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const target = join(root, 'public', 'ort');

let files;
try {
  files = readdirSync(source).filter((name) => name.endsWith('.wasm') || name.endsWith('.mjs'));
} catch (error) {
  console.error(`copy-ort-assets: cannot read ${source} (${error.message}); run pnpm install first`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`copy-ort-assets: no .wasm/.mjs files in ${source}`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
for (const name of files) copyFileSync(join(source, name), join(target, name));
console.log(`copy-ort-assets: ${files.length} files -> public/ort/`);
