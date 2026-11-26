/**
 * Progress (0..1) -> every animated value of scene 5. Pure, no three.js, unit-tested.
 *
 * Progress map (defaults; each breakpoint is a param):
 *   0.00-0.54  the songs travel toward the station and slow down (ease-out)
 *   0.06-0.20  the beat grid appears as ticks on the rail
 *   0.10-0.34  songs align to the grid: tempo, height and roll settle (ease "seat")
 *   0.33-0.52  gaps close and the seams fuse; the weld light peaks at 0.52, cools to 0 by 0.61
 *   0.54-0.93  the one ribbon winds into a flat coil (ease "travel"); the grid fades by 0.66
 *   0.86-1.00  the Mix slot's status light comes fully on
 * Camera: one continuous Catmull-Rom move over six keys, from a low look up the rail to a
 * high look down on the coil and the three product slots.
 */
import type { SonoboltParams } from './params.ts';

// Named curves: Penner equivalents of the CSS tokens (styles/tokens.css, motion/easing.ts).
/** --ease-enter: ease-out-quart. */
export const easeEnter = (t: number): number => 1 - (1 - t) ** 4;
/** --ease-seat: ease-out-quint. */
export const easeSeat = (t: number): number => 1 - (1 - t) ** 5;
/** --ease-travel: ease-in-out-cubic. */
export const easeTravel = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Deceleration used for the approach: ease-out-cubic. */
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
/** 0..1 position of p inside [a, b], clamped. */
export const span = (p: number, a: number, b: number): number => (b > a ? clamp01((p - a) / (b - a)) : p >= b ? 1 : 0);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = span(x, a, b);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type Vec3 = [number, number, number];

export interface CameraKey {
  p: number;
  pos: Vec3;
  target: Vec3;
}

/**
 * Camera keys in scene units, coil centre at the origin, rail along x at z = 0, the camera on
 * the +z side. Tuned by eye on /debug/sonobolt screenshots.
 */
export const CAMERA_KEYS: readonly CameraKey[] = [
  { p: 0.0, pos: [-8.0, 1.15, 1.25], target: [-12.5, 0.15, -0.15] },
  { p: 0.3, pos: [-2.7, 1.2, 1.5], target: [-7.0, 0.15, -0.15] },
  { p: 0.52, pos: [-0.3, 1.5, 2.3], target: [-4.2, 0.2, -0.1] },
  { p: 0.64, pos: [-0.4, 2.3, 3.9], target: [-0.8, 0.15, 0.85] },
  { p: 0.8, pos: [-1.2, 3.6, 4.6], target: [0.2, 0.1, 1.35] },
  { p: 1.0, pos: [-3.7, 5.3, 5.5], target: [0.95, 0.0, 1.45] },
];

export interface TimelineInput {
  /** Span length at the empty hub, l0: the head travel at which winding starts. */
  hubSpan: number;
  /** Head travel when the whole ribbon (plus overshoot) is wound. */
  windTravel: number;
}

export interface TimelineFrame {
  /** Head travel past the guide roller, along the tape. */
  travel: number;
  /** 0 = songs at their own tempo/height/roll, 1 = locked to the grid. */
  align: number;
  /** 0 = separate songs with gaps, 1 = one ribbon. */
  fuse: number;
  /** Weld light level, exactly 0 outside its window. */
  weld: number;
  /** Beat grid opacity 0..1. */
  grid: number;
  /** Mix status light level 0..1. */
  status: number;
  camera: { pos: Vec3; target: Vec3 };
}

export function timeline(progress: number, params: SonoboltParams, input: TimelineInput): TimelineFrame {
  const p = clamp01(progress);
  const v = (name: keyof SonoboltParams): number => params[name].value;

  // Travel: approach (decelerating), a near-stop while the seams weld, then the wind.
  let travel: number;
  if (p <= v('windStart')) {
    const u = span(p, 0, v('windStart'));
    travel = lerp(v('approachStart'), input.hubSpan, lerp(u, easeOutCubic(u), v('approachSlow')));
  } else {
    travel = lerp(input.hubSpan, input.windTravel, easeTravel(span(p, v('windStart'), v('windEnd'))));
  }

  const weldRise = lerp(v('fuseStart'), v('fuseEnd'), 0.6);
  const weld = smoothstep(weldRise, v('fuseEnd'), p) * (1 - smoothstep(v('fuseEnd'), v('fuseEnd') + v('weldFade'), p));

  return {
    travel,
    align: easeSeat(span(p, v('alignStart'), v('alignEnd'))),
    fuse: easeTravel(span(p, v('fuseStart'), v('fuseEnd'))),
    weld,
    grid: smoothstep(v('gridIn'), v('gridFull'), p) * (1 - smoothstep(v('windStart'), v('gridOut'), p)),
    status: lerp(v('statusIdle'), 1, easeEnter(span(p, v('statusStart'), 1))),
    camera: cameraAt(p),
  };
}

/** Camera position and target at p: Catmull-Rom through the keys, eased per segment. */
export function cameraAt(p: number, keys: readonly CameraKey[] = CAMERA_KEYS): { pos: Vec3; target: Vec3 } {
  const last = keys.length - 1;
  let i = 0;
  while (i < last - 1 && p > (keys[i + 1]?.p ?? 1)) i++;
  const k1 = keys[i]!;
  const k2 = keys[Math.min(last, i + 1)]!;
  const k0 = keys[Math.max(0, i - 1)]!;
  const k3 = keys[Math.min(last, i + 2)]!;
  // No per-segment easing: Catmull-Rom is C1 through the keys, and scroll itself is the clock,
  // so an ease per segment would put a speed kink at every key.
  const t = span(p, k1.p, k2.p);
  return { pos: catmull(k0.pos, k1.pos, k2.pos, k3.pos, t), target: catmull(k0.target, k1.target, k2.target, k3.target, t) };
}

function catmull(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (2 * b[k]! + (-a[k]! + c[k]!) * t + (2 * a[k]! - 5 * b[k]! + 4 * c[k]! - d[k]!) * t2 + (-a[k]! + 3 * b[k]! - 3 * c[k]! + d[k]!) * t3);
  }
  return out;
}
