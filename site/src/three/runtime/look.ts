/**
 * THE look: every tunable number of the shared render look in one place (runtime/README.md
 * "How the look is built"). Three-free, so it is unit-tested in Node and readable on its own.
 *
 * - `STUDIO`: the procedural reflection studio (environment.ts) every scene gets as ctx.envMap.
 * - `AO`: screen-space ambient occlusion in the post pass (shaders/ao.ts).
 * - `SIGNAL`: how 'signal' pixels (Rhodamine light, material.userData.signal = true) skip AgX.
 * - `POST`: vignette and dither of the composite pass.
 * - `BLOOM`: signal-only bloom (off by default: see README "Bloom decision").
 *
 * `resolveLook(tier, level)` turns tier + quality-ladder level into the switches the presenter
 * uses. Ladder fields added for the look are optional, so older 4-field level literals still work.
 */
import type { Tier } from './tier-types.ts';
import type { QualityLevel } from './ladder.ts';

/** One analytic light shape in the studio. Directions are world space (y up, camera looks -z). */
export interface StudioPanel {
  name: string;
  /** Direction from the subject to the panel centre (any length). */
  dir: readonly [number, number, number];
  /** Half extents as tangents of the half-angles, horizontal then vertical. */
  halfWidth: number;
  halfHeight: number;
  /** Edge softness in the same tangent units (0 = hard edge). */
  soft: number;
  /** Linear radiance at the panel centre (neutral: R = G = B). */
  radiance: number;
  /** Optional vertical falloff across the panel (0 = flat, 1 = dark at the bottom edge). */
  gradient?: number;
}

export interface StudioSpec {
  /** Cube face size in texels (PMREM prefilters it once at mount). */
  size: number;
  /** Radiance of the dark studio walls just above the horizon, and high up. */
  wallLow: number;
  wallHigh: number;
  /** Radiance of the floor far below, and of the bounce band just under the horizon. */
  floor: number;
  floorBounce: number;
  panels: readonly StudioPanel[];
}

/**
 * A dark product studio with real contrast (the old RoomEnvironment was evenly bright, so Alloy
 * read as grey plastic). Bead-blasted metal shows its form only through what it reflects: one
 * long key strip high on the leading side draws the chamfer highlight, a broad soft overhead
 * gives top faces a long gradient, a narrow rim strip behind separates silhouettes from Carbon,
 * a faint front card keeps faces that look at the camera from going black, and a dark floor with
 * a soft bounce band gives undersides a little lift. Neutral: no colour can tint the Alloy.
 */
export const STUDIO: StudioSpec = {
  size: 128,
  wallLow: 0.08,
  wallHigh: 0.03,
  floor: 0.012,
  floorBounce: 0.09,
  panels: [
    { name: 'key strip', dir: [-0.5, 0.62, 0.6], halfWidth: 1.4, halfHeight: 0.16, soft: 0.08, radiance: 10 },
    { name: 'overhead', dir: [0.1, 1, -0.2], halfWidth: 0.8, halfHeight: 0.5, soft: 0.35, radiance: 2.4, gradient: 0.6 },
    { name: 'rim strip', dir: [0.85, 0.3, -0.5], halfWidth: 0.06, halfHeight: 0.85, soft: 0.04, radiance: 4.5 },
    { name: 'front card', dir: [0.25, 0.22, 1], halfWidth: 1.2, halfHeight: 0.7, soft: 0.6, radiance: 2.5, gradient: 0.8 },
    { name: 'kicker', dir: [-1, 0.05, -0.15], halfWidth: 0.08, halfHeight: 0.35, soft: 0.06, radiance: 1.6 },
  ],
};

export const AO = {
  /** Sampling radius as a fraction of the stage height (screen-relative: scene units differ). */
  radius: 0.028,
  /** SAO intensity before the strength mix. */
  intensity: 1.3,
  /** Final mix: base *= mix(1, ao, strength). 1 = full occlusion. */
  strength: 0.85,
  /** Taps per pixel: full ('high', ladder 0) and cheap ('mid', ladder 1-2). */
  samplesFull: 14,
  samplesCheap: 7,
  /** Spiral turns of the tap pattern. */
  turns: 7,
  /** Angle bias: sin of the lowest elevation that counts as an occluder (kills flat-face self-occlusion). */
  bias: 0.3,
  /** The AO buffer's resolution relative to the stage render (0.5 = half). */
  scale: 0.5,
} as const;

export const SIGNAL = {
  /** Coverage -> mask gain: a signal at 25% opacity still skips AgX fully (its colour is linear). */
  maskGain: 4,
  /** Linear values above 1 are scaled down as a whole (hue-preserving), never clamped per channel. */
  limit: 1,
} as const;

export const POST = {
  /** Optical vignette in stage UV (not aspect-corrected: the logo's wordmark spans the width). */
  vignetteStrength: 0.22,
  vignetteInner: 0.35,
  vignetteOuter: 0.85,
  /** Triangular dither amplitude in 8-bit steps, added to the PREMULTIPLIED output. */
  ditherLsb: 1,
} as const;

export const BLOOM = {
  /** Decided off: see runtime/README.md "Bloom decision". `?look=bloom` previews it. Radius in CSS px / 6. */
  enabled: false,
  strength: 0.35,
  radius: 1,
} as const;

export type AoQuality = 'full' | 'cheap' | 'off';

export interface ResolvedLook {
  ao: AoQuality;
  aoSamples: number;
  signal: boolean;
  vignette: number;
  bloom: boolean;
}

const AO_RANK: Record<AoQuality, number> = { off: 0, cheap: 1, full: 2 };
const TIER_AO: Record<Exclude<Tier, 'still'>, AoQuality> = { high: 'full', mid: 'cheap', low: 'off' };
const TIER_VIGNETTE: Record<Exclude<Tier, 'still'>, boolean> = { high: true, mid: true, low: false };

/** The ladder's AO step when a level literal does not say (older 4-field literals). */
export function ladderAo(level: QualityLevel | undefined): AoQuality {
  if (!level) return 'full';
  if (level.ao) return level.ao;
  return level.index >= 3 ? 'off' : level.index >= 1 ? 'cheap' : 'full';
}

/** Tier caps x ladder level -> what the presenter does this frame. Pure. */
export function resolveLook(tier: Exclude<Tier, 'still'>, level?: QualityLevel): ResolvedLook {
  const tierAo = TIER_AO[tier];
  const stepAo = ladderAo(level);
  const ao = AO_RANK[stepAo] < AO_RANK[tierAo] ? stepAo : tierAo;
  return {
    ao,
    aoSamples: ao === 'full' ? AO.samplesFull : ao === 'cheap' ? AO.samplesCheap : 0,
    signal: true, // signals are cheap (only signal meshes re-draw) and carry the brand colour
    vignette: TIER_VIGNETTE[tier] ? POST.vignetteStrength : 0,
    bloom: BLOOM.enabled && tier === 'high' && (level?.index ?? 0) === 0,
  };
}
