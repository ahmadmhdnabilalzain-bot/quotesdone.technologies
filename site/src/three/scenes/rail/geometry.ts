/**
 * Procedural geometry for the rail scene (structure-v1 §2.2.1: no modeller, no textures).
 * Every builder returns plain BufferGeometry; the scene owns and disposes it.
 *
 * Axes: the rail runs along +x, its top face is y = 0, its front face looks toward +z.
 */
import { BufferGeometry, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RailParams } from './params.ts';

/**
 * The rail: one extruded cross-section with four chamfered long edges and the datum groove cut
 * into the front face. ExtrudeGeometry is non-indexed, so every face keeps a flat normal and the
 * chamfers read as crisp machined facets.
 */
export function createRailGeometry(params: RailParams): BufferGeometry {
  const H = params.railHeight.value;
  const D = params.railDepth.value;
  const c = params.railChamfer.value;
  const gy = params.grooveY.value;
  const gh = params.grooveHeight.value / 2;
  const gd = params.grooveDepth.value;
  const length = params.railEnd.value - params.railStart.value;

  // Shape plane: (u, v) = (-z, y). The rotation below maps u to -z, so the FRONT (z = +D/2) is u = -D/2.
  const front = -D / 2;
  const back = D / 2;
  const pts: Array<[number, number]> = [
    [front + c, 0],
    [front, -c],
    [front, gy + gh],
    [front + gd, gy + gh], // groove
    [front + gd, gy - gh],
    [front, gy - gh],
    [front, -H + c],
    [front + c, -H],
    [back - c, -H],
    [back, -H + c],
    [back, -c],
    [back - c, 0],
  ];
  const shape = new Shape();
  pts.forEach(([u, v], i) => (i === 0 ? shape.moveTo(u, v) : shape.lineTo(u, v)));
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1, curveSegments: 1 });
  // Extrusion runs along local +Z. Rotate +90 deg about Y: x' = Z (along the rail), z' = -u.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(params.railStart.value, 0, 0);
  geometry.computeBoundingSphere();
  return geometry;
}

/** A rectangular block with chamfered vertical and top edges (pads and caps), centred on x/z, base at y = 0. */
export function createChamferedBlock(width: number, depth: number, height: number, chamfer: number): BufferGeometry {
  const c = Math.min(chamfer, width / 4, depth / 4);
  const w = width / 2 - c;
  const d = depth / 2 - c;
  const shape = new Shape();
  // Footprint in the XZ plane (u = x, v = -z), with chamfered corners.
  shape.moveTo(-w, -d - c);
  shape.lineTo(w, -d - c);
  shape.lineTo(w + c, -d);
  shape.lineTo(w + c, d);
  shape.lineTo(w, d + c);
  shape.lineTo(-w, d + c);
  shape.lineTo(-w - c, d);
  shape.lineTo(-w - c, -d);
  shape.closePath();
  const bevel = Math.min(c, height * 0.45);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelOffset: -bevel * 0.8,
    bevelSegments: 1, // one segment = a true chamfer, not a round
    curveSegments: 1,
  });
  // Extruded along +Z: stand it up so the extrusion becomes +Y. Bevel extends below 0 by `bevel`.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox!.min.y;
  geometry.translate(0, -minY, 0);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Deterministic PRNG (mulberry32): the same seed always gives the same envelope. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A synthetic, musically plausible amplitude envelope (0..1) of `count` samples: beats with a
 * transient and a decay, phrased in bars. Generated from a seed; no Sonobolt data (structure-v1 Q4).
 */
export function syntheticEnvelope(count: number, seed: number, beats = 48): Float32Array {
  const rand = mulberry32(seed);
  const accents = Array.from({ length: beats }, (_, i) => (i % 4 === 0 ? 1 : 0.55 + 0.35 * rand()));
  const phraseA = rand() * Math.PI * 2;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const s = i / Math.max(1, count - 1);
    const beatPos = s * beats;
    const beat = Math.min(beats - 1, Math.floor(beatPos));
    const local = beatPos - beat;
    const transient = Math.exp(-local * 5.5) * accents[beat]!;
    const body = 0.32 + 0.18 * Math.sin(s * Math.PI * 2 * 3 + phraseA);
    out[i] = Math.min(1, body + 0.55 * transient);
  }
  // Smoothing (two box passes, radius ~0.6% of the length) so the edge reads as a machined
  // envelope, not as noise or a torn edge.
  const radius = Math.max(1, Math.round(count * 0.006));
  let src = out;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      let n = 0;
      for (let j = i - radius; j <= i + radius; j++) {
        if (j < 0 || j >= count) continue;
        sum += src[j]!;
        n++;
      }
      dst[i] = sum / n;
    }
    src = dst;
  }
  return src;
}

/**
 * Sonobolt stand-in: a flat ribbon wound into a coil, standing upright and facing +z. The ribbon's
 * width (its z extent) follows the waveform envelope, so its edge profile is the envelope.
 * Centre at (0, radius, 0): it rests on y = 0.
 */
export function createCoilGeometry(params: RailParams, detail: number): BufferGeometry {
  const outer = params.objectHeight.value / 2;
  const inner = outer * 0.3;
  const turns = params.coilTurns.value;
  const thickness = 0.008;
  const baseWidth = 0.15;
  const samples = Math.max(160, Math.round(900 * detail));
  const envelope = syntheticEnvelope(samples, Math.round(params.coilSeed.value));

  const positions: number[] = [];
  const normals: number[] = [];
  const pushQuad = (a: number[], b: number[], c: number[], d: number[], na: number[], nb: number[]): void => {
    // a-b along the ribbon at sample i, c-d at sample i+1. Two triangles: a b c, b d c.
    positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    normals.push(...na, ...na, ...nb, ...na, ...nb, ...nb);
  };
  for (let i = 0; i < samples - 1; i++) {
    const s0 = i / (samples - 1);
    const s1 = (i + 1) / (samples - 1);
    const ring = (s: number, k: number, side: number) => {
      const theta = s * turns * Math.PI * 2;
      const r = inner + (outer - thickness - inner) * s + side * thickness * 0.5;
      const w = baseWidth * (0.72 + 0.28 * envelope[k]!) * 0.5;
      return { x: Math.cos(theta) * r, y: Math.sin(theta) * r + outer, w, nx: Math.cos(theta), ny: Math.sin(theta) };
    };
    for (const side of [1, -1]) {
      const p0 = ring(s0, i, side);
      const p1 = ring(s1, i + 1, side);
      const n0 = [p0.nx * side, p0.ny * side, 0];
      const n1 = [p1.nx * side, p1.ny * side, 0];
      // Outer surface winds one way, inner the other, so both face outward.
      if (side === 1) pushQuad([p0.x, p0.y, p0.w], [p0.x, p0.y, -p0.w], [p1.x, p1.y, p1.w], [p1.x, p1.y, -p1.w], n0, n1);
      else pushQuad([p0.x, p0.y, -p0.w], [p0.x, p0.y, p0.w], [p1.x, p1.y, -p1.w], [p1.x, p1.y, p1.w], n0, n1);
    }
    // Front (+z) and back (-z) edges: the envelope profile.
    const o0 = ring(s0, i, 1);
    const i0 = ring(s0, i, -1);
    const o1 = ring(s1, i + 1, 1);
    const i1 = ring(s1, i + 1, -1);
    pushQuad([i0.x, i0.y, i0.w], [o0.x, o0.y, o0.w], [i1.x, i1.y, i1.w], [o1.x, o1.y, o1.w], [0, 0, 1], [0, 0, 1]);
    pushQuad([o0.x, o0.y, -o0.w], [i0.x, i0.y, -i0.w], [o1.x, o1.y, -o1.w], [i1.x, i1.y, -i1.w], [0, 0, -1], [0, 0, -1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * MubinFlow stand-in: a ring of 12 month segments (the product's own scene motif), upright and
 * facing +z, resting on y = 0. Returned as a solid (used only as an invisible depth mask) plus
 * its feature edges for the drafting linework.
 */
export function createMonthRing(params: RailParams): { solid: BufferGeometry; edges: BufferGeometry } {
  const outer = params.objectHeight.value / 2;
  const inner = outer * 0.66;
  const depth = 0.1;
  const segments = 12;
  const gap = 0.045; // radians between segments
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2 + gap / 2 + Math.PI / 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2 - gap / 2 + Math.PI / 2;
    const shape = new Shape();
    shape.absarc(0, 0, outer, a0, a1, false);
    const innerArc = new Path();
    innerArc.absarc(0, 0, inner, a1, a0, true);
    shape.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
    for (const p of innerArc.getPoints(8)) shape.lineTo(p.x, p.y);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, outer, -depth / 2);
    parts.push(g);
  }
  const solid = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!solid) throw new Error('rail: month ring merge failed');
  solid.computeBoundingSphere();
  const edges = new EdgesGeometry(solid, 25);
  return { solid, edges };
}

/**
 * Drafting annotations for the linework object: a diameter dimension above the ring with
 * extension lines and architectural tick marks, plus a centre mark. Line segments only.
 */
export function createDimensionLines(params: RailParams): BufferGeometry {
  const r = params.objectHeight.value / 2;
  const top = r * 2 + 0.16;
  const tick = 0.035;
  const ext = 0.04;
  const v: number[] = [];
  const seg = (x0: number, y0: number, x1: number, y1: number): void => {
    v.push(x0, y0, 0.06, x1, y1, 0.06);
  };
  seg(-r, r + 0.03, -r, top + ext); // extension lines start just off the part (drafting convention)
  seg(r, r + 0.03, r, top + ext);
  seg(-r, top, r, top); // dimension line
  seg(-r - tick, top - tick, -r + tick, top + tick); // ticks
  seg(r - tick, top - tick, r + tick, top + tick);
  const cm = 0.06; // centre mark
  seg(-cm, r, cm, r);
  seg(0, r - cm, 0, r + cm);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(v, 3));
  return geometry;
}
