#!/usr/bin/env node
/**
 * geo-logo: brand/logo/final/strokes.json -> public/3d/logo.glb (structure-v1 §2.2.1, §3.6).
 *
 *   npm run geo          regenerate public/3d/logo.glb
 *   npm run geo:check    exit 1 if the glb is missing or was built from other inputs (CI / prebuild)
 *   GEO_VERBOSE=1        per-part log lines
 *
 * What it writes, per stroke part (43 meshes, mesh/node name = stroke `id`):
 * - the part's `outline` (rings keep their inner subpath as a hole), extruded to a machined bar:
 *   one-segment 45-degree chamfer of 0.6 design units, `bevelOffset = -bevelSize` so the front
 *   silhouette is EXACTLY the outline (never grown); depth per line (GEO.depthUnits).
 * - creased normals (smooth across curved walls, hard at the chamfer), welded and indexed.
 * - `_SEAL` (vec2, SVG px, y up): per-vertex offset that closes the 2.4-unit joints. Only vertices
 *   on a joint face get one; it points at the neighbouring part and is sized so that seal = 1 gives
 *   the compact cut's joint overlap (gap -0.6 units). Line 2 is already fused, so it has no seal.
 * - node translation = the part's pivot (bbox centre, SVG px, y flipped); the mesh is local to it.
 * - node extras: order, id, line, glyph, role, weight, bbox, butt_reproducible, depth, pivot,
 *   joints [{ x, y, nx, ny, with }] (SVG px, y down; n points from the neighbour into this part),
 *   explode [x, y] (unit, y down: the mean of the part's joint normals).
 * Coordinates are SVG px of the wordmark viewBox with y flipped (y up): the scene scales them.
 * Compression: EXT_meshopt_compression + KHR_mesh_quantization (positions 14 bit, normals 10 bit).
 * asset.extras.qdt.sourceHash = sha256(strokes.json bytes + GEO params + GEO_VERSION): the check
 * compares hashes, never bytes, so an encoder change alone does not fail CI.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExtrudeGeometry, Path, Shape, ShapeUtils, Vector2 } from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(here, '..');
const STROKES = resolve(SITE, '../brand/logo/final/strokes.json');
const OUT = resolve(SITE, 'public/3d/logo.glb');

/** Bump when the geometry code changes in a way that changes the output. */
const GEO_VERSION = 4;

/** Every number that shapes the geometry. Design units (cap height = 100) unless noted. */
export const GEO = {
  /** Chamfer: one segment = a true 45-degree chamfer, 0.6 units (structure-v1 §2.2). */
  chamferUnits: 0.6,
  /** Bar depth per line, before the chamfers. Line 2 is about a third of the weight, so shallower. */
  depthUnits: { QUOTESDONE: 12, TECHNOLOGIES: 4.5 },
  /** Samples per cubic segment. The outlines already use short segments (about 12 px each). */
  curveSegments: 3,
  /** Crease angle for normals, degrees: below = smooth (curved walls), above = hard (chamfer, caps). */
  creaseDeg: 30,
  /** Joint detection: an outline point within gap + this many units of a neighbour is on a joint. */
  jointToleranceUnits: 1.2,
  /** Compact cut joint (brand/logo/source/build.py COMPACT: gap = -0.6): overlap at seal = 1. */
  compactGapUnits: -0.6,
  quantizePositionBits: 14,
  quantizeNormalBits: 10,
};

const verbose = process.env.GEO_VERBOSE === '1';
const log = (...a) => console.log('[geo-logo]', ...a);

// ---------------------------------------------------------------------------------------------
// Inputs and hash

function sourceHash(strokesBytes) {
  return createHash('sha256').update(strokesBytes).update(JSON.stringify(GEO)).update(`v${GEO_VERSION}`).digest('hex');
}

/** Read asset.extras.qdt.sourceHash from a .glb without decoding any buffer. */
function readGlbHash(file) {
  const bytes = readFileSync(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a glb`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  return json.asset?.extras?.qdt?.sourceHash ?? null;
}

// ---------------------------------------------------------------------------------------------
// SVG outline parsing (the outlines use only M, L, C, Z; anything else is a hard error)

/** -> array of subpaths; each subpath = list of segments { type: 'L'|'C', pts } starting at `start`. */
export function parseOutline(d) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const other = d.match(/[A-DF-KN-Za-df-kn-z]/g)?.filter((c) => !/[MLCZmlcz]/.test(c));
  if (other?.length) throw new Error(`outline uses unsupported commands: ${[...new Set(other)].join(',')}`);
  const subpaths = [];
  let current = null;
  let i = 0;
  let cmd = null;
  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`bad number near token ${i}`);
    return v;
  };
  while (i < tokens.length) {
    if (/^[MLCZ]$/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'M') {
      current = { start: [num(), num()], segments: [] };
      subpaths.push(current);
      cmd = 'L'; // implicit lineto after moveto
    } else if (cmd === 'L') {
      current.segments.push({ type: 'L', pts: [[num(), num()]] });
    } else if (cmd === 'C') {
      current.segments.push({ type: 'C', pts: [[num(), num()], [num(), num()], [num(), num()]] });
    } else if (cmd === 'Z') {
      cmd = null;
    } else {
      throw new Error(`unexpected token "${tokens[i]}"`);
    }
  }
  return subpaths;
}

/**
 * Dense polyline of a subpath in SVG coordinates (for joint detection and areas). Points are
 * spaced about `spacing` px apart, so a long straight joint face gets as many samples as a short one.
 */
function flatten(subpath, spacing = 2) {
  const out = [subpath.start];
  let p = subpath.start;
  for (const s of subpath.segments) {
    if (s.type === 'L') {
      const q = s.pts[0];
      const samples = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / spacing));
      for (let k = 1; k <= samples; k++) out.push([p[0] + ((q[0] - p[0]) * k) / samples, p[1] + ((q[1] - p[1]) * k) / samples]);
      p = q;
    } else {
      const [c1, c2, q] = s.pts;
      const chord = Math.hypot(c1[0] - p[0], c1[1] - p[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(q[0] - c2[0], q[1] - c2[1]);
      const samples = Math.max(1, Math.ceil(chord / spacing));
      for (let k = 1; k <= samples; k++) {
        const t = k / samples;
        const u = 1 - t;
        out.push([
          u * u * u * p[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * q[0],
          u * u * u * p[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * q[1],
        ]);
      }
      p = q;
    }
  }
  return out;
}

/** Build a three Shape (local, y up, around the pivot). The largest subpath is the outer contour. */
function toShape(subpaths, pivot) {
  const local = ([x, y]) => [x - pivot[0], -(y - pivot[1])];
  const ranked = subpaths
    .map((sp) => ({ sp, area: Math.abs(ShapeUtils.area(flatten(sp, 8).map(([x, y]) => new Vector2(x, y)))) }))
    .sort((a, b) => b.area - a.area);
  const draw = (target, sp) => {
    const [sx, sy] = local(sp.start);
    target.moveTo(sx, sy);
    for (const s of sp.segments) {
      if (s.type === 'L') target.lineTo(...local(s.pts[0]));
      else target.bezierCurveTo(...local(s.pts[0]), ...local(s.pts[1]), ...local(s.pts[2]));
    }
    target.closePath();
  };
  const shape = new Shape();
  draw(shape, ranked[0].sp);
  for (const { sp } of ranked.slice(1)) {
    const hole = new Path();
    draw(hole, sp);
    shape.holes.push(hole);
  }
  return shape;
}

// ---------------------------------------------------------------------------------------------
// Joints: where one part's outline runs within one gap of a neighbour's outline

function nearestOnPolylines(point, polylines) {
  let best = { d2: Infinity, x: 0, y: 0 };
  for (const line of polylines) {
    for (let k = 0; k + 1 < line.length; k++) {
      const [ax, ay] = line[k];
      const [bx, by] = line[k + 1];
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy || 1e-9;
      const t = Math.max(0, Math.min(1, ((point[0] - ax) * vx + (point[1] - ay) * vy) / len2));
      const x = ax + vx * t;
      const y = ay + vy * t;
      const d2 = (point[0] - x) ** 2 + (point[1] - y) ** 2;
      if (d2 < best.d2) best = { d2, x, y };
    }
  }
  return { d: Math.sqrt(best.d2), x: best.x, y: best.y };
}

const bboxesNear = (a, b, pad) =>
  a[0] - pad < b[0] + b[2] && b[0] - pad < a[0] + a[2] && a[1] - pad < b[1] + b[3] && b[1] - pad < a[1] + a[3];

/**
 * For one part: its joints with each neighbour (cluster centre and normal), in SVG px, y down.
 * Normal = unit vector from the neighbour into this part (the direction the part leaves its joint).
 */
function findJoints(part, others, pxPerUnit, gapUnits) {
  const reach = (gapUnits + GEO.jointToleranceUnits) * pxPerUnit;
  const joints = [];
  for (const other of others) {
    if (!bboxesNear(part.bbox, other.bbox, reach)) continue;
    const hits = [];
    for (const line of part.polylines) {
      for (const p of line) {
        const n = nearestOnPolylines(p, other.polylines);
        if (n.d <= reach) hits.push({ p, n });
      }
    }
    if (hits.length < 3) continue;
    let x = 0;
    let y = 0;
    let nx = 0;
    let ny = 0;
    for (const h of hits) {
      x += (h.p[0] + h.n.x) / 2;
      y += (h.p[1] + h.n.y) / 2;
      const len = Math.hypot(h.p[0] - h.n.x, h.p[1] - h.n.y) || 1;
      nx += (h.p[0] - h.n.x) / len;
      ny += (h.p[1] - h.n.y) / len;
    }
    const nlen = Math.hypot(nx, ny) || 1;
    joints.push({ x: round(x / hits.length), y: round(y / hits.length), nx: round(nx / nlen, 4), ny: round(ny / nlen, 4), with: other.id });
  }
  return joints;
}

/**
 * Per-vertex seal offset (local, y up). A vertex within reach of a neighbour moves toward it.
 * The total closure per joint is (gap - compactGap), so the faces end overlapping exactly like the
 * compact cut. If the neighbour also has outline corners facing this vertex, both sides move half;
 * if the neighbour's face is one long edge with no vertices there (an E arm meeting the stem's
 * side), that face cannot move, so this side moves the full amount.
 */
function sealAttribute(position, pivot, neighbours, pxPerUnit, gapUnits) {
  const count = position.count;
  const seal = new Float32Array(count * 2);
  if (neighbours.length === 0 || gapUnits <= 0) return seal;
  const reach = (gapUnits + 2 * GEO.chamferUnits + GEO.jointToleranceUnits) * pxPerUnit;
  const closure = (gapUnits - GEO.compactGapUnits) * pxPerUnit;
  const polylines = neighbours.flatMap((n) => n.polylines);
  const corners = neighbours.flatMap((n) => n.corners);
  for (let v = 0; v < count; v++) {
    const svg = [position.getX(v) + pivot[0], pivot[1] - position.getY(v)];
    const n = nearestOnPolylines(svg, polylines);
    if (n.d > reach || n.d < 1e-6) continue;
    const shared = corners.some(([cx, cy]) => Math.hypot(cx - svg[0], cy - svg[1]) <= reach);
    const move = shared ? closure / 2 : closure;
    const dx = (n.x - svg[0]) / n.d;
    const dy = (n.y - svg[1]) / n.d;
    seal[v * 2] = dx * move;
    seal[v * 2 + 1] = -dy * move; // y up
  }
  return seal;
}

// ---------------------------------------------------------------------------------------------

function round(v, digits = 2) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

async function build(strokesBytes) {
  const data = JSON.parse(strokesBytes.toString('utf8'));
  const strokes = [...data.strokes].sort((a, b) => a.order - b.order);
  if (strokes.length !== 43) throw new Error(`expected 43 stroke parts, found ${strokes.length}`);
  const pxPerUnit = { QUOTESDONE: data.design_units.svg_px_per_unit_line1, TECHNOLOGIES: data.design_units.svg_px_per_unit_line2 };
  const gapUnits = { QUOTESDONE: data.params_line1.gap, TECHNOLOGIES: data.params_line2.gap };

  const parts = strokes.map((s) => {
    const subpaths = parseOutline(s.outline);
    const [bx, by, bw, bh] = s.bbox;
    return { ...s, subpaths, polylines: subpaths.map((sp) => flatten(sp, 2)), corners: subpaths.flatMap((sp) => [sp.start, ...sp.segments.map((seg) => seg.pts[seg.pts.length - 1])]), pivot: [bx + bw / 2, by + bh / 2] };
  });

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('logo');
  const root = doc.createNode('wordmark');
  scene.addChild(root);

  let triangles = 0;
  for (const part of parts) {
    const unit = pxPerUnit[part.line];
    const gap = gapUnits[part.line];
    const sameLine = parts.filter((o) => o !== part && o.line === part.line);
    const joints = gap > 0 ? findJoints(part, sameLine, unit, gap) : [];
    const neighbours = sameLine.filter((o) => joints.some((j) => j.with === o.id));

    const chamfer = GEO.chamferUnits * unit;
    const depth = GEO.depthUnits[part.line] * unit;
    let geometry = new ExtrudeGeometry(toShape(part.subpaths, part.pivot), {
      depth,
      curveSegments: GEO.curveSegments,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelThickness: chamfer,
      bevelSize: chamfer,
      bevelOffset: -chamfer,
    });
    // Front face at z = 0, the bar extends to -(depth + 2 chamfers).
    geometry.translate(0, 0, -(depth + chamfer));
    geometry.deleteAttribute('uv');
    geometry = toCreasedNormals(geometry, (GEO.creaseDeg * Math.PI) / 180);
    geometry = mergeVertices(geometry, 1e-4);

    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const seal = sealAttribute(position, part.pivot, neighbours, unit, gap);
    const index = geometry.getIndex();
    triangles += index.count / 3;

    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(position.array)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normal.array)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index.array)).setBuffer(buffer));
    if (seal.some((v) => v !== 0)) prim.setAttribute('_SEAL', doc.createAccessor().setType('VEC2').setArray(seal).setBuffer(buffer));
    const mesh = doc.createMesh(part.id).addPrimitive(prim);

    let ex = 0;
    let ey = 0;
    for (const j of joints) {
      ex += j.nx;
      ey += j.ny;
    }
    const elen = Math.hypot(ex, ey);
    const extras = {
      id: part.id,
      order: part.order,
      line: part.line,
      glyph: part.glyph,
      glyph_index: part.glyph_index,
      role: part.role,
      weight: part.weight,
      bbox: part.bbox,
      butt_reproducible: part.butt_reproducible,
      pivot: [round(part.pivot[0], 3), round(part.pivot[1], 3)],
      depth: round(depth + 2 * chamfer, 3),
      joints,
      explode: elen > 1e-3 ? [round(ex / elen, 4), round(ey / elen, 4)] : [0, 0],
    };
    root.addChild(doc.createNode(part.id).setMesh(mesh).setTranslation([part.pivot[0], -part.pivot[1], 0]).setExtras(extras));
    if (verbose) log(`${part.order} ${part.id}: ${position.count} verts, ${index.count / 3} tris, ${joints.length} joints`);
  }

  doc.getRoot().getAsset().extras = {
    qdt: {
      sourceHash: sourceHash(strokesBytes),
      source: 'brand/logo/final/strokes.json',
      viewBox: data.viewBox.split(/\s+/).map(Number),
      pxPerUnit,
      gapUnits,
      geo: GEO,
      generator: `scripts/geo-logo.mjs v${GEO_VERSION}`,
    },
  };

  await MeshoptEncoder.ready;
  await doc.transform(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: GEO.quantizePositionBits, quantizeNormal: GEO.quantizeNormalBits }),
  );
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  mkdirSync(dirname(OUT), { recursive: true });
  await io.write(OUT, doc);
  const size = readFileSync(OUT).length;
  log(`wrote ${OUT.replace(SITE + '/', '')}: 43 parts, ${triangles} triangles, ${(size / 1024).toFixed(1)} KB`);
}

async function main() {
  if (!existsSync(STROKES)) throw new Error(`missing ${STROKES}`);
  const strokesBytes = readFileSync(STROKES);
  if (process.argv.includes('--check')) {
    const want = sourceHash(strokesBytes);
    const have = existsSync(OUT) ? readGlbHash(OUT) : null;
    if (have !== want) {
      console.error(`[geo-logo] public/3d/logo.glb is ${have ? 'out of date' : 'missing'} (inputs changed). Run \`npm run geo\` and commit the result.`);
      process.exit(1);
    }
    log('logo.glb is up to date');
    return;
  }
  await build(strokesBytes);
}

main().catch((error) => {
  console.error('[geo-logo] failed:', error);
  process.exit(1);
});
