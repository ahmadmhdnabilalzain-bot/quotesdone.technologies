// Transfer budgets (structure-v1 §4.1) measured on dist/ as gzip sizes.
// Classification is by the module graph, not by filenames:
//   pre-3D JS  = scripts the HTML loads + everything they import STATICALLY;
//   3D runtime = chunks reached only through a dynamic import() (and their static imports),
//                minus pre-3D chunks; each dynamic entry beyond the first is a per-scene chunk.
// Budgets come from src/lib/budgets.ts (Node strips its types). Exit 1 on any overrun.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSFER_BUDGETS_KB, THREE_RUNTIME_TOLERANCE } from '../src/lib/budgets.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.QDT_DIST ? resolve(process.env.QDT_DIST) : join(root, 'dist');
if (!existsSync(dist)) {
  console.error('[budgets] dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const kb = (bytes) => bytes / 1024;
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

/** '/_astro/x.js' relative to dist, or './y.js' relative to a chunk -> dist-relative posix path. */
const resolveRef = (from, ref) => (ref.startsWith('/') ? ref.slice(1) : posix.normalize(posix.join(posix.dirname(from), ref)));

function importsOf(chunk) {
  const code = readFileSync(join(dist, chunk), 'utf8');
  const staticRefs = [...code.matchAll(/(?:\bfrom\s*|\bimport\s*)["'`]([^"'`]+\.js)["'`]/g)].map((m) => resolveRef(chunk, m[1]));
  const dynamicRefs = [...code.matchAll(/\bimport\(\s*["'`]([^"'`]+\.js)["'`]\s*\)/g)].map((m) => resolveRef(chunk, m[1]));
  return { staticRefs: staticRefs.filter((r) => existsSync(join(dist, r))), dynamicRefs: dynamicRefs.filter((r) => existsSync(join(dist, r))) };
}

function staticClosure(entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const chunk = stack.pop();
    if (seen.has(chunk)) continue;
    seen.add(chunk);
    stack.push(...importsOf(chunk).staticRefs);
  }
  return seen;
}

const rows = [];
let failed = false;
const check = (label, bytes, budgetKb, tolerance = 0) => {
  const limit = budgetKb * (1 + tolerance);
  const ok = kb(bytes) <= limit;
  if (!ok) failed = true;
  rows.push({ label, kb: kb(bytes).toFixed(1), budget: `${budgetKb}${tolerance ? ` (+${tolerance * 100}%)` : ''}`, ok: ok ? 'ok' : 'OVER' });
};

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
for (const htmlFile of htmlFiles) {
  const page = relative(dist, htmlFile).split('\\').join('/');
  const html = readFileSync(htmlFile, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => resolveRef(page, m[1]));
  const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => resolveRef(page, m[1]));
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => resolveRef(page, m[1]));
  const inlineStyleBytes = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gzipSync(m[1]).length, 0);

  const pre = staticClosure([...scripts, ...preloads]);
  const dynamicEntries = [...new Set([...pre].flatMap((c) => importsOf(c).dynamicRefs))].filter((c) => !pre.has(c));
  const threeChunks = staticClosure(dynamicEntries.slice(0, 1));
  for (const c of pre) threeChunks.delete(c);
  const sceneEntries = [...new Set([...threeChunks].flatMap((c) => importsOf(c).dynamicRefs))].filter((c) => !pre.has(c) && !threeChunks.has(c));

  const preCode = [...pre].map((c) => readFileSync(join(dist, c), 'utf8')).join('\n');
  if (/\bimport\(/.test(preCode) && dynamicEntries.length === 0) {
    failed = true;
    console.error(`[budgets] ${page}: pre-3D code has import() but no dynamic chunk was resolved; the classifier needs fixing`);
  }

  check(`${page}: HTML`, gz(htmlFile), TRANSFER_BUDGETS_KB.html);
  check(`${page}: CSS (files + inline)`, styles.reduce((n, f) => n + gz(join(dist, f)), 0) + inlineStyleBytes, TRANSFER_BUDGETS_KB.css);
  check(`${page}: JS before 3D [${[...pre].map((c) => posix.basename(c)).join(', ')}]`, [...pre].reduce((n, f) => n + gz(join(dist, f)), 0), TRANSFER_BUDGETS_KB.preThreeJs);
  if (threeChunks.size > 0) {
    check(`${page}: 3D runtime [${[...threeChunks].map((c) => posix.basename(c)).join(', ')}]`, [...threeChunks].reduce((n, f) => n + gz(join(dist, f)), 0), TRANSFER_BUDGETS_KB.threeRuntime, THREE_RUNTIME_TOLERANCE);
  }
  for (const scene of sceneEntries) {
    const closure = [...staticClosure([scene])].filter((c) => !pre.has(c) && !threeChunks.has(c));
    check(`${page}: scene [${closure.map((c) => posix.basename(c)).join(', ')}]`, closure.reduce((n, f) => n + gz(join(dist, f)), 0), TRANSFER_BUDGETS_KB.perScene);
  }
}

console.table(rows);
if (failed) {
  console.error('[budgets] over budget. Do not raise a budget to pass: fix the weight, or record why in structure-v1 §4.1.');
  process.exit(1);
}
console.log('[budgets] ok');
