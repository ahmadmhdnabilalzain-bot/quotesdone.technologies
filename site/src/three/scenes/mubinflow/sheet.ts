/**
 * The drawing sheet, built in CSS pixels in camera space (origin = stage centre, y up).
 * It is rebuilt on resize because its border follows the stage size. No text: the
 * "in development" plate is linework only (an open status ring and a hatched field).
 * `dirSign` = -1 mirrors the sheet for RTL (the plate moves to the inline end).
 */
import type { Polyline } from './draft-line.ts';

export interface SheetSpec {
  width: number;
  height: number;
  dirSign: 1 | -1;
}

export const SHEET = {
  /** Inset of the border from the stage edge, CSS px. */
  inset: 14,
  /** Spacing of the zone ticks on the border, CSS px (approximate; fitted to the edge). */
  zone: 112,
  zoneTick: 7,
  plateWidth: 176,
  plateHeight: 44,
  /** Gap between the plate and the border, CSS px. */
  plateGap: 10,
  hatchPitch: 6,
} as const;

function rect(x0: number, y0: number, x1: number, y1: number): number[] {
  return [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0, x0, y0, 0];
}

function mirror(lines: Polyline[], s: 1 | -1): Polyline[] {
  if (s === 1) return lines;
  return lines.map((l) => ({ ...l, points: l.points.map((v, i) => (i % 3 === 0 ? -v : v)) }));
}

/** Border, zone ticks and corner marks. Draws clockwise from the top-left corner. */
export function sheetFrame({ width, height, dirSign }: SheetSpec): Polyline[] {
  const hw = width / 2 - SHEET.inset;
  const hh = height / 2 - SHEET.inset;
  const out: Polyline[] = [{ points: rect(-hw, -hh, hw, hh), reveal: [0, 0.7] }];
  const ticks = (len: number) => Math.max(2, Math.round(len / SHEET.zone));
  const nx = ticks(hw * 2);
  const ny = ticks(hh * 2);
  for (let i = 1; i < nx; i++) {
    const x = -hw + (2 * hw * i) / nx;
    const f = 0.55 + (0.4 * i) / nx;
    out.push({ points: [x, hh, 0, x, hh - SHEET.zoneTick, 0], reveal: [f, f + 0.05] });
    out.push({ points: [x, -hh, 0, x, -hh + SHEET.zoneTick, 0], reveal: [f, f + 0.05] });
  }
  for (let i = 1; i < ny; i++) {
    const y = -hh + (2 * hh * i) / ny;
    const f = 0.55 + (0.4 * i) / ny;
    out.push({ points: [-hw, y, 0, -hw + SHEET.zoneTick, y, 0], reveal: [f, f + 0.05] });
    out.push({ points: [hw, y, 0, hw - SHEET.zoneTick, y, 0], reveal: [f, f + 0.05] });
  }
  return mirror(out, dirSign);
}

/** The plate's box in sheet space (before mirroring): x0, y0, x1, y1. */
export function plateBox({ width, height }: SheetSpec): [number, number, number, number] {
  const x1 = width / 2 - SHEET.inset - SHEET.plateGap;
  const y0 = -height / 2 + SHEET.inset + SHEET.plateGap;
  return [x1 - SHEET.plateWidth, y0, x1, y0 + SHEET.plateHeight];
}

/** 45-degree hatch lines clipped to a rectangle. */
export function hatch(x0: number, y0: number, x1: number, y1: number, pitch: number): number[][] {
  const out: number[][] = [];
  const h = y1 - y0;
  // Lines x - y = c, for c across the rectangle.
  for (let c = x0 - h + pitch / 2; c < x1; c += pitch) {
    const ax = Math.max(x0, c);
    const bx = Math.min(x1, c + h);
    if (bx - ax < 0.5) continue;
    out.push([ax, y0 + (ax - c), 0, bx, y0 + (bx - c), 0]);
  }
  return out;
}

/** The plate: outline, inner rule, divider and the hatched field (Alloy). */
export function plateLines(spec: SheetSpec): Polyline[] {
  const [x0, y0, x1, y1] = plateBox(spec);
  const cell = y1 - y0;
  const out: Polyline[] = [
    { points: rect(x0, y0, x1, y1), reveal: [0, 0.45] },
    { points: rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3), reveal: [0.3, 0.6] },
    { points: [x0 + cell, y0 + 3, 0, x0 + cell, y1 - 3, 0], reveal: [0.5, 0.6] },
  ];
  const lines = hatch(x0 + cell + 6, y0 + 8, x1 - 9, y1 - 8, SHEET.hatchPitch);
  lines.forEach((pts, i) => {
    const f = 0.6 + (0.4 * i) / Math.max(1, lines.length);
    out.push({ points: pts, reveal: [f, Math.min(1, f + 0.08)] });
  });
  return mirror(out, spec.dirSign);
}

/** The plate's status ring: an OPEN circle (outline only = in development; a filled dot means live). */
export function plateStatusRing(spec: SheetSpec): Polyline[] {
  const [x0, y0, , y1] = plateBox(spec);
  const cell = y1 - y0;
  const cx = x0 + cell / 2;
  const cy = (y0 + y1) / 2;
  const r = 7;
  const pts: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI / 2 - (i / 40) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
  }
  return mirror([{ points: pts, reveal: [0.45, 0.75] }], spec.dirSign);
}
