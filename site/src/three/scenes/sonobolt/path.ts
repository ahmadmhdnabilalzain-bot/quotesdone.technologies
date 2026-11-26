/**
 * The tape path, in the rail's ground plane (x along the rail, z across it). No three.js.
 *
 * The one ribbon behaves like tape on a reel:
 *
 *        straight feed on the rail        guide G      span        coil (Archimedean spiral)
 *   tail ======================================o-------------->  ((( @ )))  head innermost
 *
 * - `sigma` is distance along the ribbon from its HEAD (the first song's start), growing toward the tail.
 * - `e` is how far the head has travelled past the guide roller G, along the tape.
 * - `W` is the wound length. The coil is r = r0 + b*theta (b = pitch / 2pi); for small b, arc length
 *   gives theta(a) = (-r0 + sqrt(r0^2 + 2 b a)) / b and the outer radius R(W) = sqrt(r0^2 + 2 b W).
 * - The span runs from G to the tangent point T on the current outer turn. Its length is
 *   l(R) = sqrt(d^2 - R^2) with d = |G - C|. Length is conserved: e = W + l(R(W)), solved in
 *   closed form (see solveWound), so the feed slides in without stretching.
 * - The reel turns, the feed stays still: the spiral is rotated so that its point at a = W sits on T.
 *
 * All functions are pure and unit-tested for continuity at G and at T.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface ReelGeometry {
  /** Guide roller position (on the rail centre line). */
  guide: Vec2;
  /** Coil centre. */
  centre: Vec2;
  /** Inner (hub) radius. */
  r0: number;
  /** Spiral growth per radian: pitch / 2pi. */
  b: number;
}

export interface ReelState {
  /** Head distance past the guide, along the tape. */
  e: number;
  /** Wound length (0 until the head reaches the hub). */
  wound: number;
  /** Current outer radius. */
  radius: number;
  /** Tangent point on the current outer turn, and its polar angle around the centre. */
  tangent: Vec2;
  tangentAngle: number;
  /** Unit direction from the guide to the tangent point. */
  spanDir: Vec2;
  spanLength: number;
  /** theta(W): the spiral angle at the outer end. */
  thetaWound: number;
}

/** Spiral angle at arc length a from the inner end. */
export function thetaAt(a: number, r0: number, b: number): number {
  return (-r0 + Math.sqrt(r0 * r0 + 2 * b * Math.max(0, a))) / b;
}

/** Outer radius after winding length W. */
export function radiusAfter(wound: number, r0: number, b: number): number {
  return Math.sqrt(r0 * r0 + 2 * b * Math.max(0, wound));
}

/**
 * Wound length for a head travel `e`: solves W + sqrt(d^2 - R(W)^2) = e with R(W)^2 = r0^2 + 2bW.
 * With u = sqrt(d^2 - r0^2 - 2bW): u^2 - 2bu + 2be - l0^2 = 0, so u = b + sqrt(b^2 - 2be + l0^2),
 * where l0 = sqrt(d^2 - r0^2) is the span at the empty hub. W = 0 while e <= l0.
 */
export function solveWound(e: number, reel: ReelGeometry): number {
  const d2 = dist2(reel.guide, reel.centre);
  const l0sq = d2 - reel.r0 * reel.r0;
  if (l0sq <= 0) throw new Error('sonobolt path: the guide roller is inside the hub');
  const l0 = Math.sqrt(l0sq);
  if (e <= l0) return 0;
  const disc = reel.b * reel.b - 2 * reel.b * e + l0sq;
  if (disc < 0) throw new Error(`sonobolt path: head travel ${e.toFixed(2)} exceeds what this reel can wind`);
  const u = reel.b + Math.sqrt(disc);
  return Math.max(0, (l0sq - u * u) / (2 * reel.b));
}

/** Full reel state for a head travel `e`. */
export function reelState(e: number, reel: ReelGeometry): ReelState {
  const wound = solveWound(e, reel);
  const radius = radiusAfter(wound, reel.r0, reel.b);
  const vx = reel.guide.x - reel.centre.x;
  const vz = reel.guide.z - reel.centre.z;
  const d = Math.hypot(vx, vz);
  const base = Math.atan2(vz, vx);
  const beta = Math.acos(Math.min(1, radius / d));
  // Of the two tangents from G, take the one where the tape continues counter-clockwise (angle
  // increasing toward the head), so the span and the coil meet without a kink.
  let best: { angle: number; point: Vec2; dir: Vec2; length: number } | null = null;
  for (const angle of [base + beta, base - beta]) {
    const point = { x: reel.centre.x + radius * Math.cos(angle), z: reel.centre.z + radius * Math.sin(angle) };
    const length = Math.hypot(point.x - reel.guide.x, point.z - reel.guide.z);
    const dir = { x: (point.x - reel.guide.x) / length, z: (point.z - reel.guide.z) / length };
    const ccw = { x: -Math.sin(angle), z: Math.cos(angle) };
    if (dir.x * ccw.x + dir.z * ccw.z > 0) best = { angle, point, dir, length };
  }
  if (!best) throw new Error('sonobolt path: no counter-clockwise tangent from the guide');
  return {
    e,
    wound,
    radius,
    tangent: best.point,
    tangentAngle: best.angle,
    spanDir: best.dir,
    spanLength: best.length,
    thetaWound: thetaAt(wound, reel.r0, reel.b),
  };
}

/** Ground-plane position of the ribbon point at `sigma` (distance from the head). */
export function pathPoint(sigma: number, state: ReelState, reel: ReelGeometry, out: Vec2 = { x: 0, z: 0 }): Vec2 {
  if (sigma < state.wound) {
    // On the coil: the head (sigma 0) is innermost; sigma = W sits on the tangent point.
    const theta = thetaAt(sigma, reel.r0, reel.b);
    const r = reel.r0 + reel.b * theta;
    const angle = state.tangentAngle + (state.thetaWound - theta);
    out.x = reel.centre.x + r * Math.cos(angle);
    out.z = reel.centre.z + r * Math.sin(angle);
  } else if (sigma < state.e) {
    // On the span from the guide to the coil.
    const along = state.e - sigma;
    out.x = reel.guide.x + state.spanDir.x * along;
    out.z = reel.guide.z + state.spanDir.z * along;
  } else {
    // On the rail, before the guide.
    out.x = reel.guide.x - (sigma - state.e);
    out.z = reel.guide.z;
  }
  return out;
}

function dist2(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}
