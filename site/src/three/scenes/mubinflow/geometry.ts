/**
 * Pure geometry builders for the MubinFlow drafting scene. Everything returns plain polylines
 * (flat xyz arrays) or plain numbers, so it is testable without WebGL.
 *
 * Conventions
 * - World: y up. The month ring lies in the XZ plane, centred on the origin. An angle θ maps to
 *   (cos θ, -sin θ) in (x, z), so rotation.y = φ adds φ to θ.
 * - The month that is pulled out is local segment 0, centred on θ = 0, and leaves along +x.
 * - Strips lie along +x, centred on z = 0, stacked upwards: people, payslips, salary file.
 * - Nothing here is real payroll data: rows are abstract bars from a fixed seed.
 */
import type { Polyline } from './draft-line.ts';

export const MONTHS = 12;
const SEG_ANGLE = (Math.PI * 2) / MONTHS;

export interface Layout {
  ringOuter: number;
  ringInner: number;
  ringHeight: number;
  ringJoint: number;
  extractDistance: number;
  stripLength: number;
  stripDepth: number;
  stripThickness: number;
  stripGap: number;
  stripOffset: number;
  rows: number;
  tracedRow: number;
  /** Arc subdivision per 30-degree segment. */
  arcSteps: number;
}

/** Deterministic PRNG (mulberry32), so the abstract row lengths never change between builds. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function arc(r: number, y: number, a0: number, a1: number, steps: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(Math.cos(a) * r, y, -Math.sin(a) * r);
  }
  return pts;
}

function line(...xyz: number[]): number[] {
  return xyz;
}

/** Closed rectangle in the plane y = const, from (x0, z0) to (x1, z1). */
export function rectXZ(x0: number, z0: number, x1: number, z1: number, y: number): number[] {
  return [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, y, z0];
}

/** Closed circle in a horizontal plane. */
export function circleXZ(cx: number, cz: number, r: number, y: number, steps = 32): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
  }
  return pts;
}

/** Angular half-gap so the joint between segments is `joint` wide at the mean radius. */
function halfGap(l: Layout): number {
  return l.ringJoint / (l.ringOuter + l.ringInner);
}

/** The edges of one annular month segment centred on θc. */
export function segmentEdges(l: Layout, centre: number, reveal: [number, number] = [0, 1]): Polyline[] {
  const g = halfGap(l);
  const a0 = centre - SEG_ANGLE / 2 + g;
  const a1 = centre + SEG_ANGLE / 2 - g;
  const yt = l.ringHeight / 2;
  const yb = -yt;
  const R = l.ringOuter;
  const r = l.ringInner;
  const c = (a: number, rad: number, y: number) => [Math.cos(a) * rad, y, -Math.sin(a) * rad];
  return [
    { points: arc(R, yt, a0, a1, l.arcSteps), reveal },
    { points: arc(r, yt, a0, a1, l.arcSteps), reveal },
    { points: arc(R, yb, a0, a1, l.arcSteps), reveal },
    { points: arc(r, yb, a0, a1, l.arcSteps), reveal },
    { points: [...c(a0, r, yt), ...c(a0, R, yt)], reveal },
    { points: [...c(a1, r, yt), ...c(a1, R, yt)], reveal },
    { points: [...c(a0, r, yb), ...c(a0, R, yb)], reveal },
    { points: [...c(a1, r, yb), ...c(a1, R, yb)], reveal },
    { points: [...c(a0, R, yb), ...c(a0, R, yt)], reveal },
    { points: [...c(a1, R, yb), ...c(a1, R, yt)], reveal },
    { points: [...c(a0, r, yb), ...c(a0, r, yt)], reveal },
    { points: [...c(a1, r, yb), ...c(a1, r, yt)], reveal },
  ];
}

/** Segments 1..11 (the ring that stays), each drawn in turn around the ring. */
export function ringRestEdges(l: Layout): Polyline[] {
  const out: Polyline[] = [];
  for (let k = 1; k < MONTHS; k++) {
    const span: [number, number] = [(k - 1) / MONTHS, (k + 1) / MONTHS];
    out.push(...segmentEdges(l, k * SEG_ANGLE, span));
  }
  return out;
}

/** The pulled month: same edges, drawn last. */
export function selectedEdges(l: Layout): Polyline[] {
  return segmentEdges(l, 0, [(MONTHS - 1) / MONTHS, 1]);
}

/** Annular sector outline for the depth-only solid (2D, shape space x = cos θ r, y = sin θ r). */
export function segmentOutline2D(l: Layout, centre: number): Array<[number, number]> {
  const g = halfGap(l);
  const a0 = centre - SEG_ANGLE / 2 + g;
  const a1 = centre + SEG_ANGLE / 2 - g;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= l.arcSteps; i++) {
    const a = a0 + ((a1 - a0) * i) / l.arcSteps;
    pts.push([Math.cos(a) * l.ringOuter, Math.sin(a) * l.ringOuter]);
  }
  for (let i = l.arcSteps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / l.arcSteps;
    pts.push([Math.cos(a) * l.ringInner, Math.sin(a) * l.ringInner]);
  }
  return pts;
}

export const SEGMENT_ANGLE = SEG_ANGLE;

/** The fixed dial under the ring: 60 minor and 12 major ticks, plus the index pointer at θ = 0. */
export function dialLines(l: Layout): Polyline[] {
  const y = -l.ringHeight / 2;
  const r0 = l.ringOuter + 0.05;
  const out: Polyline[] = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + SEG_ANGLE / 2; // majors on the joints
    const major = i % 5 === 0;
    const r1 = r0 + (major ? 0.075 : 0.035);
    const f = i / 60;
    out.push({ points: line(Math.cos(a) * r0, y, -Math.sin(a) * r0, Math.cos(a) * r1, y, -Math.sin(a) * r1), reveal: [f * 0.8, f * 0.8 + 0.2] });
  }
  out.push({ points: arc(r0, y, 0, Math.PI * 2, 96), reveal: [0, 0.8] });
  // Index pointer: an open chevron outside the dial, pointing at the month that comes out.
  const rp = r0 + 0.11;
  const w = 0.035;
  out.push({ points: [rp + 0.06, y, -w, rp, y, 0, rp + 0.06, y, w], reveal: [0.85, 1] });
  return out;
}

/** CAD centre lines through the ring (drawn dash-dot by the material), plus a centre mark. */
export function centreLines(l: Layout): Polyline[] {
  const y = -l.ringHeight / 2;
  const e = l.ringOuter + 0.32;
  return [
    { points: line(-e, y, 0, e, y, 0), reveal: [0, 1] },
    { points: line(0, y, -e, 0, y, e), reveal: [0, 1] },
  ];
}

/** Where the strips start along x. */
export function stripStartX(l: Layout): number {
  return l.ringOuter + l.extractDistance + l.stripOffset;
}

/** Height of the top face of layer i (0 = people, 1 = payslips, 2 = salary file). */
export function layerY(l: Layout, i: number): number {
  return i * l.stripGap + l.stripThickness / 2;
}

/**
 * Strip outline edges in strip-local space: x from 0 to length, z centred, y centred on 0
 * (the group is placed at the layer). Box: top face, bottom face, four verticals.
 */
export function stripEdges(l: Layout): Polyline[] {
  const L = l.stripLength;
  const d = l.stripDepth / 2;
  const t = l.stripThickness / 2;
  return [
    { points: rectXZ(0, -d, L, d, t) },
    { points: rectXZ(0, -d, L, d, -t) },
    { points: line(0, -t, -d, 0, t, -d) },
    { points: line(L, -t, -d, L, t, -d) },
    { points: line(L, -t, d, L, t, d) },
    { points: line(0, -t, d, 0, t, d) },
  ];
}

/** Centre x of cell k along a strip (strip-local). */
export function cellX(l: Layout, k: number): number {
  return ((k + 0.5) / l.rows) * l.stripLength;
}

/** People layer: one cell per person, a head and shoulders drawn flat on the face. */
export function peopleContent(l: Layout): Polyline[] {
  const y = l.stripThickness / 2;
  const cw = l.stripLength / l.rows;
  const d = l.stripDepth / 2;
  const out: Polyline[] = [];
  for (let k = 0; k < l.rows; k++) {
    const x0 = k * cw;
    const cx = x0 + cw / 2;
    const span: [number, number] = [k / l.rows, (k + 1) / l.rows];
    out.push({ points: rectXZ(x0 + 0.03, -d + 0.06, x0 + cw - 0.03, d - 0.06, y), reveal: span });
    const head = Math.min(cw, l.stripDepth) * 0.13;
    out.push({ points: circleXZ(cx, -0.06, head, y, 28), reveal: span });
    // Shoulders: a half ellipse below the head (toward +z, the viewer).
    const pts: number[] = [];
    const sw = head * 2.1;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      pts.push(cx + Math.cos(a) * sw, y, 0.17 + Math.sin(a) * sw * 0.75);
    }
    out.push({ points: pts, reveal: span });
  }
  return out;
}

export interface PayslipRows {
  /** Plain rows (each a line along x on the face). */
  rows: Polyline[];
  /** The one traced figure: x0, x1, z on the face (strip-local). */
  figure: { x0: number; x1: number; z: number };
  /** The row that has no sourced rule yet: drawn as an empty dashed box. */
  notComputed: Polyline[];
}

const PAYSLIP_ROWS = 4;
const NOT_COMPUTED_CARD_OFFSET = 3;

/** Payslip layer: one card per person with four abstract figure rows. Row 1 of the traced card is THE figure. */
export function payslipContent(l: Layout): { cards: Polyline[]; rows: PayslipRows } {
  const y = l.stripThickness / 2;
  const cw = l.stripLength / l.rows;
  const d = l.stripDepth / 2;
  const rand = seeded(1633);
  const cards: Polyline[] = [];
  const rows: Polyline[] = [];
  const notComputed: Polyline[] = [];
  let figure = { x0: 0, x1: 0, z: 0 };
  const notComputedCard = (l.tracedRow + NOT_COMPUTED_CARD_OFFSET) % l.rows;
  for (let k = 0; k < l.rows; k++) {
    const x0 = k * cw + 0.03;
    const x1 = (k + 1) * cw - 0.03;
    const span: [number, number] = [k / l.rows, (k + 1) / l.rows];
    cards.push({ points: rectXZ(x0, -d + 0.04, x1, d - 0.04, y), reveal: span });
    // Header rule near the back edge.
    cards.push({ points: line(x0 + 0.025, y, -d + 0.12, x1 - 0.025, y, -d + 0.12), reveal: span });
    for (let r = 0; r < PAYSLIP_ROWS; r++) {
      const z = -d + 0.2 + r * ((l.stripDepth - 0.3) / PAYSLIP_ROWS);
      const inner = x1 - x0 - 0.05;
      // Right-aligned amounts: a figure is a bar that ends at the card's right margin.
      const len = inner * (0.35 + rand() * 0.55);
      const rx1 = x1 - 0.025;
      const rx0 = rx1 - len;
      if (k === notComputedCard && r === 2) {
        notComputed.push({ points: [rx0, y, z - 0.018, rx1, y, z - 0.018, rx1, y, z + 0.018, rx0, y, z + 0.018, rx0, y, z - 0.018], reveal: span });
        continue;
      }
      if (k === l.tracedRow && r === 1) {
        figure = { x0: rx0, x1: rx1, z };
        continue;
      }
      rows.push({ points: line(rx0, y, z, rx1, y, z), reveal: span });
    }
  }
  return { cards, rows: { rows, figure, notComputed } };
}

/**
 * Salary file layer: one fixed-width record per person (aligned under that person), field
 * separators as ticks, and the control record as one lane along the back edge.
 */
export function sifContent(l: Layout): Polyline[] {
  const y = l.stripThickness / 2;
  const cw = l.stripLength / l.rows;
  const d = l.stripDepth / 2;
  const out: Polyline[] = [];
  const fields = [0, 0.22, 0.38, 0.62, 0.78, 1];
  const z0 = -d + 0.17;
  const z1 = d - 0.05;
  for (let k = 0; k < l.rows; k++) {
    const x0 = k * cw + 0.045;
    const x1 = (k + 1) * cw - 0.045;
    const span: [number, number] = [k / (l.rows + 1), (k + 1) / (l.rows + 1)];
    out.push({ points: rectXZ(x0, z0, x1, z1, y), reveal: span });
    for (const f of fields.slice(1, -1)) {
      const z = z0 + (z1 - z0) * f;
      out.push({ points: line(x0, y, z, x1, y, z), reveal: span });
    }
  }
  // Control record: one lane across all records, two rules (the file's total).
  const span: [number, number] = [l.rows / (l.rows + 1), 1];
  out.push({ points: rectXZ(0.045, -d + 0.05, l.stripLength - 0.045, -d + 0.11, y), reveal: span });
  return out;
}

/** Oblique architectural tick at a dimension end, in the plane spanned by u (along) and v (across). */
function tick(p: number[], u: number[], v: number[], s: number): number[] {
  const dx = (u[0]! + v[0]!) * s;
  const dy = (u[1]! + v[1]!) * s;
  const dz = (u[2]! + v[2]!) * s;
  return [p[0]! - dx, p[1]! - dy, p[2]! - dz, p[0]! + dx, p[1]! + dy, p[2]! + dz];
}

/**
 * A linear dimension from a to b, offset by `off` along unit vector v, in the plane of (b - a, v):
 * two extension lines (with a small gap at the object and an overshoot), the dimension line
 * and two oblique ticks. Draw order: extensions, then the line, then the ticks.
 */
export function dimension(a: number[], b: number[], v: number[], off: number, tickSize = 0.022): Polyline[] {
  const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
  const u = [(b[0]! - a[0]!) / len, (b[1]! - a[1]!) / len, (b[2]! - a[2]!) / len];
  const at = (p: number[], k: number) => [p[0]! + v[0]! * k, p[1]! + v[1]! * k, p[2]! + v[2]! * k];
  const gap = Math.min(0.025, off * 0.25);
  const over = 0.03;
  const da = at(a, off);
  const db = at(b, off);
  return [
    { points: [...at(a, gap), ...at(a, off + over)], reveal: [0, 0.3] },
    { points: [...at(b, gap), ...at(b, off + over)], reveal: [0, 0.3] },
    { points: [...da, ...db], reveal: [0.25, 0.85] },
    { points: tick(da, u, v, tickSize), reveal: [0.8, 1] },
    { points: tick(db, u, v, tickSize), reveal: [0.8, 1] },
  ];
}

/** World positions the callout needs (strips are at x = stripStartX). */
export interface CalloutAnchors {
  figureStart: number[];
  figureEnd: number[];
  rule: { x0: number; x1: number; z0: number; z1: number; y: number };
  source: { x0: number; x1: number; z0: number; z1: number; y: number };
}

export function calloutAnchors(l: Layout, figure: { x0: number; x1: number; z: number }): CalloutAnchors {
  const sx = stripStartX(l);
  const yPay = layerY(l, 1);
  const ySif = layerY(l, 2);
  const rx0 = sx + l.stripLength + 0.28;
  const sy = ySif + l.stripGap * 0.6;
  return {
    figureStart: [sx + figure.x0, yPay, figure.z],
    figureEnd: [sx + figure.x1, yPay, figure.z],
    rule: { x0: rx0, x1: rx0 + 0.5, z0: -0.2, z1: 0.2, y: yPay },
    source: { x0: rx0 + 0.08, x1: rx0 + 0.42, z0: -0.72, z1: -0.28, y: sy },
  };
}

/** The rule card: an outline and a small decision drawn as linework (input, test, output). */
export function ruleCard(a: CalloutAnchors): Polyline[] {
  const { x0, x1, z0, z1, y } = a.rule;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const s = 0.06;
  return [
    { points: rectXZ(x0, z0, x1, z1, y), reveal: [0, 0.5] },
    { points: line(x0 + 0.05, y, cz, cx - s, y, cz), reveal: [0.4, 0.6] },
    { points: [cx - s, y, cz, cx, y, cz - s * 0.8, cx + s, y, cz, cx, y, cz + s * 0.8, cx - s, y, cz], reveal: [0.55, 0.85] },
    { points: line(cx + s, y, cz, x1 - 0.05, y, cz), reveal: [0.8, 1] },
  ];
}

/** The source the rule cites: a sheet with a folded corner and three ruled lines. */
export function sourceDoc(a: CalloutAnchors): Polyline[] {
  const { x0, x1, z0, z1, y } = a.source;
  const f = 0.07;
  const out: Polyline[] = [
    { points: [x0, y, z0, x1 - f, y, z0, x1, y, z0 + f, x1, y, z1, x0, y, z1, x0, y, z0], reveal: [0, 0.55] },
    { points: [x1 - f, y, z0, x1 - f, y, z0 + f, x1, y, z0 + f], reveal: [0.5, 0.65] },
  ];
  for (let i = 0; i < 3; i++) {
    const z = z0 + 0.15 + i * 0.075;
    out.push({ points: line(x0 + 0.05, y, z, x1 - 0.05 - (i === 2 ? 0.1 : 0), y, z), reveal: [0.65 + i * 0.1, 0.8 + i * 0.07] });
  }
  return out;
}

/** The traced path, figure -> rule (on the payslip plane) and rule -> source (rising). */
export function traceLeaders(a: CalloutAnchors): { toRule: Polyline[]; toSource: Polyline[] } {
  const [fx, fy, fz] = a.figureEnd as [number, number, number];
  const r = a.rule;
  const s = a.source;
  const rz = (r.z0 + r.z1) / 2;
  const elbowX = r.x0 - 0.12;
  const toRule: Polyline[] = [{ points: [fx + 0.02, fy, fz, elbowX, fy, fz, elbowX, fy, rz, r.x0, fy, rz] }];
  const top = (r.x0 + r.x1) / 2;
  const toSource: Polyline[] = [{ points: [top, r.y, r.z0, top, r.y, r.z0 - 0.08, top, s.y, s.z1] }];
  return { toRule, toSource };
}

/** Small open circle marking the start of a leader (lies in a horizontal plane). */
export function leaderDot(p: number[], r = 0.016): Polyline {
  return { points: circleXZ(p[0]!, p[2]!, r, p[1]!, 20) };
}

/** Points that bound the whole composition (for camera fitting). */
export function compositionBounds(l: Layout, anchors: CalloutAnchors): number[][] {
  const e = l.ringOuter + 0.32;
  const sx = stripStartX(l);
  const d = l.stripDepth / 2;
  const yTop = layerY(l, 2);
  return [
    [-e, 0, 0], [e, 0, 0], [0, 0, -e], [0, 0, e],
    [sx, 0, -d], [sx, 0, d], [sx + l.stripLength, 0, d], [sx + l.stripLength, yTop, -d], [sx, yTop, -d],
    [anchors.rule.x1, anchors.rule.y, anchors.rule.z1],
    [anchors.source.x1, anchors.source.y, anchors.source.z0],
    [anchors.source.x0, anchors.source.y, anchors.source.z0],
  ];
}

/** Points that bound the ring alone (the opening frame). */
export function ringBounds(l: Layout): number[][] {
  const e = l.ringOuter + 0.3;
  return [[-e, 0, 0], [e, 0, 0], [0, 0, -e], [0, 0, e], [0, l.ringHeight, 0]];
}
