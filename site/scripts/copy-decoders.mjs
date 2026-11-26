// Copies the glTF meshopt decoder from the pinned three.js package into public/decoders/
// so it is served from our own origin (never a CDN; structure-v1 §3.6).
// Note: the decoder embeds its WebAssembly as a base64 string, so a strict CSP must allow
// 'wasm-unsafe-eval' in script-src once a .glb is actually loaded.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [['node_modules/three/examples/jsm/libs/meshopt_decoder.module.js', 'public/decoders/meshopt_decoder.module.js']];

mkdirSync(resolve(root, 'public/decoders'), { recursive: true });
for (const [from, to] of files) {
  const src = resolve(root, from);
  if (!existsSync(src)) {
    console.error(`[decoders] missing ${from}. Run npm install first.`);
    process.exit(1);
  }
  copyFileSync(src, resolve(root, to));
  console.log(`[decoders] ${from} -> ${to}`);
}
