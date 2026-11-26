/**
 * Logo layout: where the DOM puts the hero wordmark, its datum line and the header logo, in CSS
 * px relative to the logo scene's stage. The scene contract gives a scene only its stage size,
 * but scene 1 must match two DOM boxes exactly (the swap at rest, the dock into the header).
 *
 * The DOM side (Hero.astro's script) MEASURES and publishes; the scene only READS. This module is
 * three-free and DOM-free, so it can sit on the pre-3D path and in unit tests. Because the boxes
 * are measured on a sticky full-viewport stage, they change only on resize, not on scroll, so
 * `update(progress, time)` stays a pure function of its inputs between two resizes.
 *
 * If nothing was published (unit tests, a debug page without a header), `fallbackLayout` derives
 * the same boxes from the stage size, so the scene always has a valid layout.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogoLayout {
  /** Stage size when measured; a layout for another size is ignored (stale). */
  stageWidth: number;
  stageHeight: number;
  /** The hero SVG wordmark (whole viewBox box, both lines). */
  hero: Box;
  /** The Rhodamine datum line under the wordmark. */
  datum: Box;
  /** The header's compact wordmark (dock target). Same viewBox, so the same aspect. */
  dock: Box;
  source: 'dom' | 'fallback';
}

/** brand/logo/final/strokes.json viewBox (and wordmark-compact.svg: 4367.2 x 796.8). */
export const WORDMARK_VIEWBOX = { width: 4367.19, height: 796.8 } as const;
export const WORDMARK_ASPECT = WORDMARK_VIEWBOX.width / WORDMARK_VIEWBOX.height;

let published: LogoLayout | null = null;
let version = 0;

/** DOM side: publish a fresh measurement. */
export function publishLogoLayout(layout: Omit<LogoLayout, 'source'>): void {
  published = { ...layout, source: 'dom' };
  version += 1;
}

/** Monotonic counter: lets the scene notice a new measurement without comparing boxes. */
export function logoLayoutVersion(): number {
  return version;
}

/** Test hook. */
export function resetLogoLayout(): void {
  published = null;
  version += 1;
}

/** The layout for a stage of this size: the published one if it matches (within 1 px), else the fallback. */
export function resolveLogoLayout(stageWidth: number, stageHeight: number): LogoLayout {
  if (published && Math.abs(published.stageWidth - stageWidth) <= 1 && Math.abs(published.stageHeight - stageHeight) <= 1) {
    return published;
  }
  return fallbackLayout(stageWidth, stageHeight);
}

/**
 * Deterministic stand-in with the hero proportions of Hero.astro on desktop: the wordmark spans
 * 2/3 of the stage width (max 960 px) on the left gutter, the datum one joint under it, and the
 * header logo 211 px wide at the top-left. Only used when the DOM has not published.
 */
export function fallbackLayout(stageWidth: number, stageHeight: number): LogoLayout {
  const gutter = Math.min(57.6, Math.max(19.2, stageWidth * 0.04));
  const heroWidth = Math.min(960, stageWidth - 2 * gutter);
  const heroHeight = heroWidth / WORDMARK_ASPECT;
  const heroY = Math.max(96, stageHeight * 0.3 - heroHeight / 2);
  const dockWidth = Math.min(211.2, Math.max(153.6, stageWidth * 0.22));
  const dockHeight = dockWidth / WORDMARK_ASPECT;
  return {
    stageWidth,
    stageHeight,
    hero: { x: gutter, y: heroY, width: heroWidth, height: heroHeight },
    datum: { x: gutter, y: heroY + heroHeight + 19.2, width: heroWidth, height: 1 },
    dock: { x: gutter, y: 38.9 - dockHeight / 2, width: dockWidth, height: dockHeight },
    source: 'fallback',
  };
}
