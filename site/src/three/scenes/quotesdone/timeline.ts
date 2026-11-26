/**
 * The "Sealed" choreography as a PURE function: (progress, timeMs, params, dir, aspect) -> numbers.
 * No three.js here, so the whole motion is unit-testable and easy to print while debugging
 * (`__qdt` users can import nothing; tests call `sealedPose` directly).
 *
 * Easing follows the site's named curves (motion/easing.ts, tokens.css):
 *   travel = ease-in-out-cubic (things already on screen moving), seat = ease-out-quint.
 */
import { PLATE_COUNT, type SealedParams } from './params.ts';

export interface PlatePose {
  x: number;
  y: number;
  z: number;
  /** 1 = full albedo, params.dimFactor = fully dimmed. */
  brightness: number;
  /** Cover slide 0..1 (only the chosen plate ever moves its cover). */
  cover: number;
  /** Contact-shadow strength 0..1 (fades while lifted). */
  shadow: number;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SealedPose {
  plates: PlatePose[];
  chosen: number;
  /** Datum filament: drawn fraction 0..1 (scale from the origin tick outwards). */
  datum: number;
  key: { target: [number, number, number]; angleDeg: number; intensity: number };
  /** Studio (reflection) yaw in radians: the light pass along the row is a turn of the studio. */
  envYaw: number;
  /** Floor datum visibility 0..1: it appears as the plates seat on it, so it never crosses the
   *  stage edge in the close block shot. */
  floorDatum: number;
  camera: CameraPose;
}

// ---- small pure helpers (exported for tests) ----
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Local 0..1 position of `p` inside [a, b]. A degenerate range is a step at a. */
export const segment = (p: number, a: number, b: number): number => (b <= a ? (p >= a ? 1 : 0) : clamp01((p - a) / (b - a)));
export const easeTravel = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeSeat = (t: number): number => 1 - Math.pow(1 - t, 5);
const DEG = Math.PI / 180;

/** Spherical camera around a target: azimuth from +z towards +x, elevation above the floor plane. */
function orbit(target: [number, number, number], distance: number, azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return [
    target[0] + distance * Math.cos(el) * Math.sin(az),
    target[1] + distance * Math.sin(el),
    target[2] + distance * Math.cos(el) * Math.cos(az),
  ];
}

/**
 * The plate index that advances. Indices are layout slots; in RTL the whole layout is mirrored
 * in x (see `sign` below), so the same index lands on the mirrored side. The index itself must
 * NOT be mirrored as well, or the two mirrors cancel out (a unit test guards this).
 */
export function chosenIndexFor(params: SealedParams): number {
  return Math.round(clamp01(params.chosenIndex.value / (PLATE_COUNT - 1)) * (PLATE_COUNT - 1));
}

export function sealedPose(progress: number, timeMs: number, params: SealedParams, dir: 'ltr' | 'rtl', aspect: number): SealedPose {
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  const v = (k: keyof SealedParams): number => params[k].value;
  const sign = dir === 'rtl' ? -1 : 1;
  const chosen = chosenIndexFor(params);
  const mid = (PLATE_COUNT - 1) / 2;

  const H = v('plateHeight');
  const pitch = v('plateDepth') + v('trackDepth') + v('jointGap'); // block: plates stacked front to back
  const split = easeTravel(segment(p, v('splitStart'), v('splitEnd')));
  const advance = easeTravel(segment(p, v('advanceStart'), v('advanceEnd')));
  const cover = easeTravel(segment(p, v('coverStart'), v('coverEnd')));
  const datum = easeSeat(segment(p, v('datumStart'), v('datumEnd')));

  const plates: PlatePose[] = [];
  for (let i = 0; i < PLATE_COUNT; i++) {
    const offset = i - mid; // -2..2, LTR order
    // Stagger the outer plates first so the block "deals" outwards from its centre.
    const order = Math.abs(offset) === 0 ? 2 : 2 - Math.abs(offset);
    const a0 = v('alignStart') + order * v('alignStagger');
    const a1 = v('alignEnd') - (2 - order) * v('alignStagger') * 0.5;
    const align = segment(p, a0, Math.max(a0 + 1e-3, a1));
    const travel = easeTravel(align);

    // Block: stacked in z, front plate = highest index (it carries the visible cover).
    const blockZ = offset * (pitch + split * v('explodeGap'));
    const rowX = offset * v('rowSpacing');
    // Lift during travel (a sine bump: up, across, set down on the datum).
    const lift = Math.sin(Math.PI * travel) * v('liftHeight');

    const isChosen = i === chosen;
    const depth = isChosen ? advance * v('advanceDepth') : -advance * v('fallbackDepth');
    plates.push({
      x: sign * lerp(0, rowX, travel),
      y: H / 2 + lift,
      z: lerp(blockZ, 0, travel) + depth,
      // Sealed plates dim, and the farther from the opened one, the deeper (the key's falloff).
      brightness: isChosen ? 1 : lerp(1, v('dimFactor') * Math.pow(v('dimFalloff'), Math.abs(i - chosen) - 1), advance),
      cover: isChosen ? cover : 0,
      shadow: 1 - clamp01(lift / Math.max(1e-6, v('liftHeight'))) * 0.6,
    });
  }

  // ---- Key light: wide on the block/row, passes along the row, then narrows onto the chosen plate.
  const sweep = segment(p, v('sweepStart'), v('sweepEnd'));
  const rowHalf = mid * v('rowSpacing');
  const sweepX = sign * lerp(-rowHalf * 0.8, rowHalf * 0.8, easeTravel(sweep));
  const sweepWeight = Math.sin(Math.PI * sweep); // 0 at both ends: the pass starts and ends centred
  const chosenX = plates[chosen]?.x ?? 0;
  const keyX = lerp(lerp(0, sweepX, sweepWeight), chosenX, advance);
  const keyZ = lerp(0, v('advanceDepth'), advance);
  const keyAngle = lerp(v('keyAngleWide'), v('keyAngleNarrow'), advance);
  const envYaw = sign * lerp(-1, 1, easeTravel(sweep)) * sweepWeight * v('sweepDegrees') * DEG;

  // ---- Camera: block -> row -> opened plate, with a slow pure idle drift.
  // Each pose's distance is at least what fits its subject's projected width into the stage's
  // horizontal field of view, so a narrow stage pulls back instead of cropping the row.
  const tanHalfV = Math.tan((v('fov') * DEG) / 2);
  const tanHalfH = tanHalfV * Math.max(0.2, aspect);
  const fit = (halfWidth: number, azimuthDeg: number): number =>
    (halfWidth * Math.cos(azimuthDeg * DEG) + v('plateDepth')) * v('frameMargin') / tanHalfH;
  const W = v('plateWidth');
  const blockHalf = Math.max(W, PLATE_COUNT * pitch) / 2;
  const rowHalf2 = mid * v('rowSpacing') + W / 2;
  const dBlock = Math.max(v('blockDistance'), fit(blockHalf, v('blockAzimuth')));
  const dRow = Math.max(v('rowDistance'), fit(rowHalf2, v('rowAzimuth')));
  // The opened plate and its two neighbours stay inside the stage; farther plates are near black.
  const dReveal = Math.max(v('revealDistance'), fit(v('rowSpacing') * 1.05 + W / 2, v('revealAzimuth')));
  const toRow = easeTravel(segment(p, v('splitStart'), v('alignEnd')));
  const toReveal = easeTravel(segment(p, v('advanceStart'), Math.min(1, v('datumEnd') + 0.06)));
  const breath = Math.sin((timeMs / 1000) * ((2 * Math.PI) / v('breathPeriodSec'))) * v('breathDegrees');

  const targetRow: [number, number, number] = [0, H * 0.66, 0];
  const targetBlock: [number, number, number] = [0, H * 0.5, 0];
  const targetReveal: [number, number, number] = [chosenX, H * 0.74, v('advanceDepth')]; // room for the raised cover
  const t1: [number, number, number] = [
    lerp(lerp(targetBlock[0], targetRow[0], toRow), targetReveal[0], toReveal),
    lerp(lerp(targetBlock[1], targetRow[1], toRow), targetReveal[1], toReveal),
    lerp(lerp(targetBlock[2], targetRow[2], toRow), targetReveal[2], toReveal),
  ];
  const distance = lerp(lerp(dBlock, dRow, toRow), dReveal, toReveal);
  const azimuth = sign * (lerp(lerp(v('blockAzimuth'), v('rowAzimuth'), toRow), v('revealAzimuth'), toReveal) + breath);
  const elevation = lerp(lerp(v('blockElevation'), v('rowElevation'), toRow), v('revealElevation'), toReveal) + breath * 0.3;

  return {
    plates,
    chosen,
    datum,
    key: { target: [keyX, H * 0.5, keyZ], angleDeg: keyAngle, intensity: v('keyIntensity') },
    envYaw,
    floorDatum: easeSeat(segment(p, v('alignStart') + (v('alignEnd') - v('alignStart')) * 0.5, v('alignEnd') + 0.06)),
    camera: { position: orbit(t1, distance, azimuth, elevation), target: t1 },
  };
}
