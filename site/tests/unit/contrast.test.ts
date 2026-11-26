/**
 * WCAG 2.2 contrast for every text/ground pair the site uses (docs/typography.md, contrast table).
 * Reads the palette straight from src/styles/tokens.css, so a palette change that breaks AA fails
 * here before it ships. Ratios are also printed in the specimen (/debug/type) and the docs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');

function hex(name: string): string {
  const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  const value = m?.[1];
  if (!value) throw new Error(`token --${name} not found as a hex value in tokens.css`);
  return value;
}

function luminance(h: string): number {
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

// [text, ground, minimum ratio, documented ratio]
const PAIRS: Array<[string, string, number, number]> = [
  ['alloy', 'carbon', 7, 15.84],       // body + headings on dark (AAA)
  ['mist', 'carbon', 4.5, 5.86],       // muted text on dark (AA)
  ['carbon', 'alloy', 7, 15.84],       // body + headings on light, skip link (AAA)
  ['graphite', 'alloy', 4.5, 5.03],    // muted text on light (AA)
  ['rhodamine', 'carbon', 3, 4.13],    // light/status only: >= 24px or non-text (AA large / 1.4.11)
];

describe('palette contrast (WCAG 2.2)', () => {
  for (const [fg, bg, min, documented] of PAIRS) {
    it(`${fg} on ${bg} >= ${min}:1 and matches the documented ${documented}:1`, () => {
      const ratio = contrast(hex(fg), hex(bg));
      expect(ratio).toBeGreaterThanOrEqual(min);
      expect(round(ratio)).toBe(documented);
    });
  }

  it('pairs documented as NOT for text really fail AA (so the rule stays necessary)', () => {
    expect(round(contrast(hex('graphite'), hex('carbon')))).toBe(3.15);
    expect(round(contrast(hex('mist'), hex('alloy')))).toBe(2.7);
  });
});
