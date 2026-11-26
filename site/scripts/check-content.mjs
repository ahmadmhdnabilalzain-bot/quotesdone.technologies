// Build-time content check (structure-v1 §6.4) on dist/: copy rules on visible text, no source
// maps, every <img> has alt, title/description lengths. Exit 1 on any violation.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findContentViolations, visibleText } from './content-rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.QDT_DIST ? resolve(process.env.QDT_DIST) : join(root, 'dist');
if (!existsSync(dist)) {
  console.error('[check-content] dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const files = walk(dist);
const problems = [];

for (const file of files.filter((f) => f.endsWith('.map'))) problems.push(`${relative(root, file)}: source map in dist/`);
for (const file of files.filter((f) => /(^|\/)\.env/.test(f))) problems.push(`${relative(root, file)}: env file in dist/`);

for (const file of files.filter((f) => f.endsWith('.html'))) {
  const rel = relative(root, file);
  const html = readFileSync(file, 'utf8');
  for (const v of findContentViolations(visibleText(html))) problems.push(`${rel}: ${v.rule} "${v.match}" (${v.why})`);
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) if (!/\balt=/.test(img)) problems.push(`${rel}: <img> without alt`);
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (title.length === 0 || title.length > 60) problems.push(`${rel}: <title> length ${title.length} (1..60)`);
  if (description.length < 110 || description.length > 160) problems.push(`${rel}: description length ${description.length} (110..160)`);
  if (!/<h1[\s>]/.test(html)) problems.push(`${rel}: no <h1>`);
}

if (problems.length > 0) {
  console.error(`[check-content] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`[check-content] ok: ${files.filter((f) => f.endsWith('.html')).length} page(s) checked`);
