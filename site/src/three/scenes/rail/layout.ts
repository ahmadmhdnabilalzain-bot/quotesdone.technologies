/**
 * Pure layout and choreography maths for the rail scene. NO three.js import, no DOM: the scene
 * and ProductIndex.astro (at build time) both import this, so the product labels in the DOM sit
 * exactly beside the stations the canvas draws.
 *
 * Why a fixed HORIZONTAL field of view: with perspective, a point's horizontal screen position is
 * then independent of the stage's aspect ratio, and its vertical offset from the centre is a fixed
 * multiple of the stage WIDTH. CSS can express both with container units (cqw), so the labels are
 * anchored at every aspect without the scene ever touching the DOM.
 */
import { RAIL_BEATS, DOCK_TRAVEL_FRACTION, type RailParams } from './params.ts';

export type Vec3 = readonly [number, number, number];
export type ProductStatus = 'live' | 'in-development';
/** Live products are solid Alloy; products in development are drafting linework (structure-v1 §2.2.1). */
export type RenderMode = 'solid' | 'linework';
export type ObjectKind = 'plate' | 'coil' | 'ring';

export interface ProductInput {
  slug: string;
  status: string;
}

export interface Station {
  index: number;
  x: number;
  /** null = an empty, capped station (room for more; no claim). */
  product: { slug: string; kind: ObjectKind; mode: RenderMode; status: ProductStatus } | null;
}

/** Stand-in object per product slug. Unknown future products get the neutral plate. */
const KIND_BY_SLUG: Readonly<Record<string, ObjectKind>> = { quotesdone: 'plate', sonobolt: 'coil', mubinflow: 'ring' };

/** Status drives render state, and nothing else does: honest status at a glance. */
export function renderModeFor(status: string): RenderMode {
  return status === 'live' ? 'solid' : 'linework';
}

export function normaliseStatus(status: string): ProductStatus {
  return status === 'live' ? 'live' : 'in-development';
}

export function buildStations(products: readonly ProductInput[], params: RailParams): Station[] {
  const stations: Station[] = products.map((p, index) => ({
    index,
    x: params.stationFirstX.value + index * params.stationSpacing.value,
    product: { slug: p.slug, kind: KIND_BY_SLUG[p.slug] ?? 'plate', mode: renderModeFor(p.status), status: normaliseStatus(p.status) },
  }));
  for (let e = 0; e < Math.round(params.emptyStations.value); e++) {
    const index = products.length + e;
    stations.push({ index, x: params.stationFirstX.value + index * params.stationSpacing.value, product: null });
  }
  return stations;
}

// ---------------------------------------------------------------------------------------------
// Easing (Penner forms of the named CSS curves in tokens.css; never ad-hoc curves)
// ---------------------------------------------------------------------------------------------
export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 0..1 position of `p` inside the window [a, b]. */
export const windowed = (p: number, w: readonly [number, number]): number => clamp01((p - w[0]) / (w[1] - w[0]));
/** --ease-enter: things arriving. */
export const easeEnter = (t: number): number => 1 - Math.pow(1 - clamp01(t), 4);
/** --ease-seat: parts settling into a joint. */
export const easeSeat = (t: number): number => 1 - Math.pow(1 - clamp01(t), 5);
/** --ease-travel: on-screen movement and camera. */
export const easeTravel = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// ---------------------------------------------------------------------------------------------
// Choreography
// ---------------------------------------------------------------------------------------------
/** 0 = a single datum line, 1 = the full machined rail. */
export function extrudeAt(progress: number): number {
  return easeSeat(windowed(progress, RAIL_BEATS.extrude));
}

export interface DockState {
  /** false before the dock starts: the object is not drawn. */
  visible: boolean;
  /** Height above the seat, world units (negative during the small settle). */
  lift: number;
  /** Upstream offset against the flow, world units (multiply by the flow sign). */
  lead: number;
  /** Status light 0..1, on only once the object is seated. */
  light: number;
}

export function dockAt(progress: number, productIndex: number, params: RailParams): DockState {
  const beat = RAIL_BEATS.docks[productIndex] ?? RAIL_BEATS.docks[RAIL_BEATS.docks.length - 1]!;
  const t = windowed(progress, beat);
  const light = windowed(progress, [beat[1], beat[1] + 0.03]);
  if (progress <= beat[0]) return { visible: false, lift: params.dockLift.value, lead: params.dockLead.value, light: 0 };
  if (t < DOCK_TRAVEL_FRACTION) {
    const u = t / DOCK_TRAVEL_FRACTION;
    // Lateral motion finishes slightly before the vertical one, so the object comes DOWN onto the pad.
    const lateral = easeEnter(Math.min(1, u / 0.85));
    const vertical = easeEnter(u);
    return { visible: true, lift: params.dockLift.value * (1 - vertical), lead: params.dockLead.value * (1 - lateral), light };
  }
  // Seat: a tiny dip below the seat and back (one damped half-wave), then rest exactly at 0.
  const s = (t - DOCK_TRAVEL_FRACTION) / (1 - DOCK_TRAVEL_FRACTION);
  const dip = -params.settleOvershoot.value * params.objectHeight.value * Math.sin(Math.PI * s) * (1 - s);
  return { visible: true, lift: dip, lead: 0, light };
}

/** Cap seat for an empty station: a short drop, cascading along the rail. 0 = up, 1 = seated. */
export function capAt(progress: number, emptyIndex: number, emptyCount: number): number {
  const [a, b] = RAIL_BEATS.caps;
  const span = b - a;
  const each = span * 0.45;
  const start = a + (emptyCount <= 1 ? 0 : (emptyIndex / (emptyCount - 1)) * (span - each));
  return easeSeat(windowed(progress, [start, start + each]));
}

// ---------------------------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------------------------
export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** The datum line's world position (y, z). The rail body grows around it. */
export function datumYZ(params: RailParams): readonly [number, number] {
  return [params.grooveY.value, params.railDepth.value / 2 - params.grooveDepth.value * 0.5];
}

/**
 * Camera pose for a progress. `flow` is +1 for LTR, -1 for RTL (the upstream side mirrors).
 * Front view at 0 (the datum crosses the screen centre), three-quarter view after the camera beat.
 */
export function cameraAt(progress: number, params: RailParams, flow: 1 | -1 = 1): CameraPose {
  const c = easeTravel(windowed(progress, RAIL_BEATS.camera));
  const push = easeTravel(windowed(progress, RAIL_BEATS.push));
  const [dy, dz] = datumYZ(params);
  const deg = Math.PI / 180;
  const yaw = lerp(0, params.finalYawDeg.value * deg, c);
  const pitch = lerp(0, params.finalPitchDeg.value * deg, c);
  const distance = lerp(params.frontDistance.value, params.finalDistance.value, c) * (1 - params.finalPush.value * 0.1 * push);
  const tx = params.finalTargetX.value * flow;
  const target: Vec3 = [tx, lerp(dy, params.finalTargetY.value, c), lerp(dz, 0, c)];
  const position: Vec3 = [
    target[0] - flow * Math.sin(yaw) * Math.cos(pitch) * distance,
    target[1] + Math.sin(pitch) * distance,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
  ];
  return { position, target };
}

/** Vertical FOV (degrees) for a stage aspect, keeping the horizontal FOV fixed. */
export function verticalFovDeg(hfovDeg: number, aspect: number): number {
  const h = (hfovDeg * Math.PI) / 360;
  return (Math.atan(Math.tan(h) / Math.max(0.05, aspect)) * 360) / Math.PI;
}

export interface Projected {
  /** Normalised device x, -1..1 (left to right in LTR). */
  ndcX: number;
  /** Vertical offset from the stage centre as a fraction of HALF the stage WIDTH (up = positive). */
  k: number;
  /** Distance in front of the camera (> 0 means visible side). */
  depth: number;
}

/** Project a world point for a look-at camera with a fixed horizontal FOV (up = +y). */
export function project(point: Vec3, pose: CameraPose, hfovDeg: number): Projected {
  const [cx, cy, cz] = pose.position;
  const f = normalise([pose.target[0] - cx, pose.target[1] - cy, pose.target[2] - cz]);
  const r = normalise(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d: Vec3 = [point[0] - cx, point[1] - cy, point[2] - cz];
  const x = dot(d, r);
  const y = dot(d, u);
  const z = dot(d, f);
  const t = Math.tan((hfovDeg * Math.PI) / 360);
  return { ndcX: x / z / t, k: y / z / t, depth: z };
}

export interface LabelAnchor {
  slug: string;
  /** Distance from the stage's inline-start edge as a fraction of its width (works for RTL too). */
  inlineFraction: number;
  /** Vertical offset from the stage centre in units of half the stage width (CSS: k * 50cqw). */
  k: number;
}

/** Where each product's DOM label goes, at the end of the choreography (progress 1, LTR). */
export function labelAnchors(products: readonly ProductInput[], params: RailParams): LabelAnchor[] {
  const pose = cameraAt(1, params, 1);
  const [, dz] = datumYZ(params);
  return buildStations(products, params)
    .filter((s) => s.product !== null)
    .map((s) => {
      const below: Vec3 = [s.x, -params.railHeight.value - 0.08, dz];
      const p = project(below, pose, params.hfovDeg.value);
      return { slug: s.product!.slug, inlineFraction: (p.ndcX + 1) / 2, k: p.k };
    });
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalise(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
