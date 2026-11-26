/**
 * One clock: only src/three/runtime/loop.ts may schedule render frames. Fails if
 * requestAnimationFrame or setAnimationLoop appears anywhere else in src/.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const src = join(root, 'src');
const ALLOWED = new Set(['src/three/runtime/loop.ts']);
const BANNED = /\b(requestAnimationFrame|setAnimationLoop)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|js|mjs|astro)$/.test(name) ? [path] : [];
  });
}

describe('render-loop ownership', () => {
  it('no requestAnimationFrame / setAnimationLoop outside loop.ts', () => {
    const offenders = walk(src)
      .map((file) => relative(root, file).split('\\').join('/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => {
        // Comments may mention the names (to explain the rule); code may not use them.
        const code = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        return BANNED.test(code);
      });
    expect(offenders).toEqual([]);
  });

  it('the check itself detects a violation', () => {
    expect(BANNED.test('window.requestAnimationFrame(tick)')).toBe(true);
    expect(BANNED.test('renderer.setAnimationLoop(fn)')).toBe(true);
  });
});
