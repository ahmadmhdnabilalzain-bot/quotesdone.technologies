/**
 * The progress map of the MubinFlow scene, as pure functions of progress (0..1).
 * One table, so the choreography can be read and tuned in one place. Each window is [start, end]
 * of scene progress; `phase(p, w)` maps it to 0..1. Named curves only (structure-v1 §6.5).
 */
export type Window = readonly [number, number];

export const TIMELINE = {
  sheet: [0.0, 0.1],
  plate: [0.03, 0.13],
  ring: [0.0, 0.12],
  ringHidden: [0.08, 0.15],
  dial: [0.05, 0.16],
  index: [0.15, 0.38],
  extract: [0.38, 0.47],
  dimExtract: [0.45, 0.53],
  camera: [0.4, 0.62],
  people: [0.48, 0.6],
  payslips: [0.53, 0.65],
  sif: [0.58, 0.7],
  connectors: [0.66, 0.74],
  dimStack: [0.69, 0.77],
  figure: [0.72, 0.79],
  traceToRule: [0.78, 0.86],
  rule: [0.8, 0.87],
  traceToSource: [0.86, 0.92],
  source: [0.88, 0.94],
} as const satisfies Record<string, Window>;

/** Fraction of a strip phase spent growing; the rest draws its contents. */
export const STRIP_GROW_SHARE = 0.45;
/** Fraction of each index step spent resting in the detent before it moves. */
export const INDEX_DWELL = 0.3;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0;
}

export function phase(p: number, w: Window): number {
  return clamp01((p - w[0]) / (w[1] - w[0]));
}

/** ease-out-quart: things arriving (CSS --ease-enter). */
export function easeEnter(t: number): number {
  return 1 - (1 - t) ** 4;
}
/** ease-out-quint: parts settling into a joint (CSS --ease-seat). */
export function easeSeat(t: number): number {
  return 1 - (1 - t) ** 5;
}
/** ease-in-out-cubic: on-screen movement and camera (CSS --ease-travel). */
export function easeTravel(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
/** ease-in-out-quint: a mechanical detent step (fast through the middle, firm at both ends). */
export function easeDetent(t: number): number {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

/**
 * Ring index: how many 30-degree steps have been turned (0..steps), stepping through detents.
 * Each step rests for INDEX_DWELL of its slot, then moves with easeDetent.
 */
export function indexTurn(p: number, steps: number): number {
  const u = phase(p, TIMELINE.index) * steps;
  if (u >= steps) return steps;
  const k = Math.floor(u);
  const f = clamp01((u - k - INDEX_DWELL) / (1 - INDEX_DWELL));
  return k + easeDetent(f);
}

/** A strip's two sub-phases: grow (length 0..1), then contents drawing (0..1). */
export function stripPhases(p: number, w: Window): { grow: number; contents: number } {
  const t = phase(p, w);
  return {
    grow: easeSeat(clamp01(t / STRIP_GROW_SHARE)),
    contents: clamp01((t - STRIP_GROW_SHARE) / (1 - STRIP_GROW_SHARE)),
  };
}
