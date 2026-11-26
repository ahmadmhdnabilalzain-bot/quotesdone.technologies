// Project lint rules that tsc / astro check cannot express. Exit 1 on any violation.
//  1. requestAnimationFrame / setAnimationLoop only in src/three/runtime/loop.ts (one clock).
//  2. No physical CSS properties (left/right/margin-left/...) in src: logical properties only (RTL).
//  3. No `any` in src/three and src/motion.
//  4. No three.js import on the pre-3D path (boot, flags, log, tiers, errors, motion).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
const files = walk(join(root, 'src')).map((f) => relative(root, f).split('\\').join('/'));
const problems = [];

const PRE_3D = ['src/lib/boot.ts', 'src/lib/flags.ts', 'src/lib/log.ts', 'src/lib/budgets.ts', 'src/three/runtime/tiers.ts', 'src/three/runtime/tier-types.ts', 'src/three/runtime/errors.ts', 'src/motion/clock.ts', 'src/motion/reveal.ts', 'src/motion/easing.ts'];
const PHYSICAL_CSS = /(?<![-\w])(margin|padding|border)-(left|right)(?![-\w])|(?<![-\w])(left|right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)/;

for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), 'utf8'));
  if (/\.(ts|js|mjs|astro)$/.test(file) && file !== 'src/three/runtime/loop.ts' && /\b(requestAnimationFrame|setAnimationLoop)\b/.test(code)) {
    problems.push(`${file}: requestAnimationFrame/setAnimationLoop outside loop.ts`);
  }
  if (/\.(css|astro)$/.test(file)) {
    const css = file.endsWith('.astro') ? (code.match(/<style[\s\S]*?<\/style>/g) ?? []).join('\n') : code;
    css.split('\n').forEach((line, i) => {
      if (PHYSICAL_CSS.test(line)) problems.push(`${file}:${i + 1}: physical CSS property, use logical (${line.trim()})`);
    });
  }
  if (/^src\/(three|motion)\/.*\.ts$/.test(file) && /(:\s*any\b|\bas\s+any\b|<any>)/.test(code)) problems.push(`${file}: 'any' is not allowed in three/ and motion/`);
  if (PRE_3D.includes(file) && /from\s+['"]three(\/[^'"]*)?['"]/.test(code.replace(/import\s+type[^;]+;/g, ''))) {
    problems.push(`${file}: imports three.js on the pre-3D path`);
  }
}

if (problems.length) {
  console.error(`[lint-source] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`[lint-source] ok: ${files.length} files`);
