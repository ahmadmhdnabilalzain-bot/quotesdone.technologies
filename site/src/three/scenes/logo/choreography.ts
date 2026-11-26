/**
 * Scene 1 choreography as PURE functions of (progress, params). No three.js, no DOM: the scene
 * applies these numbers to objects, and the unit tests check them directly.
 *
 * Curves are the Penner forms of the named CSS tokens (styles/tokens.css, motion/easing.ts):
 *   seat   = ease-out-quint   (parts settling into a joint)
 *   travel = ease-in-out-cubic (on-screen movement, camera)
 *   enter  = ease-out-quart   (things arriving)
 */
import type { LogoParams } from './params.ts';

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
/** 0..1 position of `p` inside [a, b]. */
export const span = (p: number, a: number, b: number): number => (b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const ease = {
  seat: (t: number): number => 1 - Math.pow(1 - clamp01(t), 5),
  enter: (t: number): number => 1 - Math.pow(1 - clamp01(t), 4),
  travel: (t: number): number => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  /** Hermite smoothstep: only for fades, never for motion. */
  fade: (t: number): number => {
    const x = clamp01(t);
    return x * x * (3 - 2 * x);
  },
};

/** Global pose of the scene at one progress (everything except per-part explode). */
export interface Pose {
  /** Extrusion depth multiplier: 0 = flat SVG, 1 = machined bar. */
  depth: number;
  /** 0 = flat Alloy fill (matches the DOM SVG), 1 = fully lit metal. */
  lit: number;
  /** Camera: 0 = front-on (matches the SVG), 1 = at the raking angle. */
  rake: number;
  /** 0..1 across the exploded view, for slow camera and light drift. */
  drift: number;
  /** Leader lines and joint ticks opacity multiplier, 0..1. */
  leaders: number;
  /** 0 = at the hero box, 1 = at the header logo box. */
  dock: number;
  /** Canvas wordmark drawn at all (false once the DOM header logo has taken over). */
  visible: boolean;
}

const v = (params: LogoParams, key: keyof LogoParams): number => params[key].value;

export function poseAt(progress: number, params: LogoParams): Pose {
  const p = clamp01(progress);
  const machine = ease.travel(span(p, v(params, 'pSwap'), v(params, 'pMachineEnd')));
  const reseat = ease.travel(span(p, v(params, 'pReseatStart'), v(params, 'pReseatEnd')));
  const dock = ease.travel(span(p, v(params, 'pDockStart'), v(params, 'pDockEnd')));
  // The bars flatten and lose their lighting in the last part of the dock, so the final frame is
  // the flat Alloy logo the DOM header shows.
  const flatten = ease.fade(span(dock, 0.45, 1));
  const explodeIn = ease.fade(span(p, v(params, 'pExplodeStart'), lerp(v(params, 'pExplodeStart'), v(params, 'pExplodeEnd'), 0.5)));
  return {
    depth: machine * (1 - flatten),
    lit: machine * (1 - flatten),
    rake: machine * (1 - reseat),
    drift: span(p, v(params, 'pExplodeStart'), v(params, 'pReseatStart')),
    leaders: explodeIn * (1 - ease.fade(span(p, v(params, 'pReseatStart'), lerp(v(params, 'pReseatStart'), v(params, 'pReseatEnd'), 0.6)))),
    dock,
    visible: p < v(params, 'pHide'),
  };
}

/**
 * How far one part is out of its joints, 0..1. Parts leave in draw order (`order` 0..42) with a
 * stagger, travel with the travel curve, and re-seat in the same order with the seat curve.
 */
export function explodeAt(progress: number, order: number, partCount: number, params: LogoParams): number {
  const p = clamp01(progress);
  const k = partCount > 1 ? order / (partCount - 1) : 0;
  const stagger = clamp01(v(params, 'explodeStagger'));

  const outA = v(params, 'pExplodeStart');
  const outW = v(params, 'pExplodeEnd') - outA;
  const outStart = outA + outW * stagger * k;
  const out = ease.travel(span(p, outStart, outStart + outW * (1 - stagger)));

  const inA = v(params, 'pReseatStart');
  const inW = v(params, 'pReseatEnd') - inA;
  const inStart = inA + inW * stagger * 0.6 * k;
  const back = ease.seat(span(p, inStart, inStart + inW * (1 - stagger * 0.6)));
  return out * (1 - back);
}

/**
 * Joint closure for the compact cut (structure-v1 §2.2.2): follows the wordmark's RENDERED width,
 * not the viewport. 0 = open master joints (>= width + band), 1 = closed (<= width - band).
 */
export function sealForWidth(renderedWidthPx: number, params: LogoParams): number {
  const centre = v(params, 'sealWidthPx');
  const band = Math.max(1e-3, v(params, 'sealBandPx'));
  return ease.fade(1 - span(renderedWidthPx, centre - band, centre + band));
}

/** Small deterministic hash -> 0..1 (mulberry32 step), so per-part variation never uses Math.random. */
export function hash01(seed: number, index: number): number {
  let t = (seed * 0x9e3779b1 + index * 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
