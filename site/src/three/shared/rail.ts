/**
 * One source for what the three rail scenes (rail = scenes 2-3, company = 7, close = 8) must agree
 * on, so the line reads as ONE object across the page:
 *   - the palette: Alloy, and the Rhodamine SIGNAL colour (the datum and the status lights);
 *   - the rail cross-section ratios (depth, chamfer and datum height per unit of rail height).
 *
 * Why not one rail mesh builder: the rail scene's profile carries a machined datum groove and a far
 * fade shader; company and close are distance and end-of-line shots with a smaller, groove-less
 * bar and their own dock shapes. Swapping their geometry changes their framing (camera distances
 * and film offsets are tuned to it), so it is a follow-up (site/docs/integration-notes.md).
 *
 * Three-light: only `Color` is imported, so every scene chunk can share this without weight.
 */
import { Color, LinearSRGBColorSpace } from 'three';

/** Brand Alloy (bead-blasted metal, linework). */
export const ALLOY_HEX = '#ECEAE4';
/** Brand Rhodamine. Never a surface colour; light and status only. */
export const RHODAMINE_HEX = '#E3185B';

/**
 * The linear scene colour every rail scene uses for Rhodamine LIGHT (datum, status lights).
 *
 * The presenter tone-maps the whole render target with AgX (runtime/presenter.ts); a material's
 * `toneMapped: false` does NOT bypass it, because three applies per-material tone mapping only
 * when drawing to the screen. Plain #E3185B therefore lands near rgb(206, 88, 111). This value was
 * solved against three's AgX forward transform to land as close as AgX allows (about
 * rgb(192, 66, 83)).
 *
 * The runtime now has an opt-in bypass: `material.userData.signal = true` (runtime/signal.ts)
 * draws that material's pixels without AgX. None of the rail scenes opt in yet. When they do,
 * return plain #E3185B here and flag the datum and status materials, in all three scenes at
 * once, so the line stays one colour.
 */
export const RAIL_SIGNAL_LINEAR: readonly [number, number, number] = [0.5548, 0, 0.0499];

export function railSignalColor(): Color {
  return new Color().setRGB(RAIL_SIGNAL_LINEAR[0], RAIL_SIGNAL_LINEAR[1], RAIL_SIGNAL_LINEAR[2], LinearSRGBColorSpace);
}

/**
 * Rail cross-section ratios, from the rail scene's params (railHeight 0.34, railDepth 0.56,
 * railChamfer 0.045, grooveY -0.2). Company and close scale their bar from these.
 */
export const RAIL_PROFILE = {
  /** Datum centre below the top face, as a fraction of the rail height (0.2 / 0.34). */
  datumDepth: 0.2 / 0.34,
  /** Rail depth per unit of height (0.56 / 0.34). */
  depthPerHeight: 0.56 / 0.34,
  /** Long-edge chamfer per unit of height (0.045 / 0.34). */
  chamferPerHeight: 0.045 / 0.34,
} as const;
