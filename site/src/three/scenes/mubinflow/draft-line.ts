/**
 * Drafting lines: constant-pixel-width, analytically antialiased segments for an ORTHOGRAPHIC
 * camera. Why not three's Line2/LineMaterial: its dashed mode drops the end caps (notches at
 * every joint), dashes in world units only, and has no antialiasing of its own.
 *
 * How it works
 * - Each segment is one instance of a 4-vertex quad. The vertex shader projects both endpoints
 *   to target pixels and expands the quad by half the width + 1 px on every side.
 * - The fragment shader measures the pixel's distance to the segment (a capsule, so joints are
 *   round and seamless) and turns it into coverage. That is the antialiasing; it does not need
 *   MSAA and it does not shimmer when the line moves, because coverage is exact per pixel.
 * - Lines below 1 device px are drawn 1 px wide and dimmed instead (thin lines shimmer).
 * - Brightness is a MIX toward Carbon, not an alpha. Overlapping round caps of a translucent
 *   line would double up into dots at every vertex; an opaque dim colour cannot.
 * - Dashes: a pattern of (dash, gap, dash, gap) in device px, measured along the polyline's
 *   cumulative length, so dashes are anchored to the geometry and never crawl. The second
 *   pair gives CAD centre lines (long dash, short dash).
 * - Draw-on: each segment carries a reveal span (0..1 along its group); fragments past `uDraw`
 *   are discarded, so a line draws itself like a pen, with no geometry rebuild.
 *
 * Requires an orthographic camera: pixel varyings are interpolated linearly, which is only exact
 * when w = 1.
 */
import {
  BufferAttribute,
  Color,
  DoubleSide,
  GreaterDepth,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LessEqualDepth,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector4,
  type IUniform,
} from 'three';

/** A polyline (flat xyz list, at least 2 points) and the slice of its group's draw-on it occupies. */
export interface Polyline {
  points: number[];
  /** Reveal span [start, end] in 0..1 of the group's draw. Default: whole polyline at [0, 1]. */
  reveal?: [number, number];
}

/** How a line set treats depth. */
export type DepthMode = 'visible' | 'hidden' | 'overlay';

/** Uniforms shared by every line in a scene (set once in resize). */
export interface SharedLineUniforms {
  /** Render target size in device pixels. */
  uResolution: IUniform<Vector2>;
  /** Device pixels per CSS pixel. */
  uPixelRatio: IUniform<number>;
  /** Linear Carbon, the colour a line fades into. */
  uCarbon: IUniform<Color>;
}

export function createSharedLineUniforms(carbon: Color): SharedLineUniforms {
  return {
    uResolution: { value: new Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    uCarbon: { value: carbon.clone() },
  };
}

const VERTEX = /* glsl */ `
  attribute vec3 iStart;
  attribute vec3 iEnd;
  attribute vec2 iDist;    // cumulative length (geometry units) at start, end
  attribute vec2 iReveal;  // draw-on span at start, end

  uniform vec2 uResolution;
  uniform float uPixelRatio;
  uniform float uWidth;    // CSS px

  varying vec2 vA;
  varying vec2 vB;
  varying vec2 vDist;
  varying vec2 vReveal;

  vec2 toPixels(vec4 clip) {
    return (clip.xy / clip.w * 0.5 + 0.5) * uResolution;
  }

  void main() {
    vec4 cA = projectionMatrix * modelViewMatrix * vec4(iStart, 1.0);
    vec4 cB = projectionMatrix * modelViewMatrix * vec4(iEnd, 1.0);
    vec2 a = toPixels(cA);
    vec2 b = toPixels(cB);
    vec2 d = b - a;
    float len = length(d);
    vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float ext = max(uWidth * uPixelRatio, 1.0) * 0.5 + 1.0;   // half width + 1 px of AA fringe

    vec2 p = position.y < 0.5 ? a - dir * ext : b + dir * ext;
    p += nrm * position.x * ext;
    vec4 c = position.y < 0.5 ? cA : cB;
    gl_Position = vec4((p / uResolution * 2.0 - 1.0) * c.w, c.z, c.w);

    vA = a;
    vB = b;
    vDist = iDist;
    vReveal = iReveal;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uWidth;      // CSS px
  uniform vec3 uColor;       // linear
  uniform vec3 uCarbon;      // linear
  uniform float uIntensity;  // 0 = Carbon, 1 = uColor
  uniform float uGain;
  uniform float uDraw;       // draw-on 0..1
  uniform vec4 uDash;        // dash, gap, dash, gap in CSS px; x <= 0 = solid
  uniform float uDistScale;  // CSS px per geometry unit along the line

  varying vec2 vA;
  varying vec2 vB;
  varying vec2 vDist;
  varying vec2 vReveal;

  // Coverage of a 1D interval [lo, hi] for a pixel centred at x (box filter, 1 px wide).
  float cover1(float x, float lo, float hi) {
    return clamp(min(x - lo, hi - x) + 0.5, 0.0, 1.0);
  }

  void main() {
    vec2 p = gl_FragCoord.xy;
    vec2 ab = vB - vA;
    float l2 = dot(ab, ab);
    float t = l2 > 1e-6 ? clamp(dot(p - vA, ab) / l2, 0.0, 1.0) : 0.0;

    if (mix(vReveal.x, vReveal.y, t) > uDraw) discard;

    float widthDev = uWidth * uPixelRatio;
    float drawn = max(widthDev, 1.0);
    float dist = length(p - (vA + ab * t));
    float coverage = clamp(drawn * 0.5 + 0.5 - dist, 0.0, 1.0);

    if (uDash.x > 0.0) {
      float along = mix(vDist.x, vDist.y, t) * uDistScale * uPixelRatio;
      vec4 pat = uDash * uPixelRatio;
      float period = pat.x + pat.y + pat.z + pat.w;
      float m = mod(along, period);
      float on = max(cover1(m, 0.0, pat.x), pat.z > 0.0 ? cover1(m, pat.x + pat.y, pat.x + pat.y + pat.z) : 0.0);
      // Wrap: the start of the next period also covers the pixel at the end of this one.
      on = max(on, cover1(m - period, 0.0, pat.x));
      coverage *= on;
    }
    if (coverage <= 0.003) discard;

    float k = clamp(uIntensity * min(1.0, widthDev), 0.0, 1.0);
    vec3 color = mix(uCarbon, uColor * uGain, k);
    gl_FragColor = vec4(color, coverage);
  }
`;

export interface DraftLineOptions {
  name: string;
  color: Color;
  /** CSS px. */
  width: number;
  intensity: number;
  depth: DepthMode;
  /** Dash pattern in CSS px; omit for a solid line. */
  dash?: [number, number, number, number];
  gain: number;
  renderOrder?: number;
}

/** Uniform names every DraftLine material owns (useful for tests and snapshots). */
export const LINE_UNIFORMS = ['uColor', 'uIntensity', 'uDraw', 'uWidth', 'uDash', 'uGain', 'uDistScale'] as const;

/**
 * Build instanced segment geometry from polylines. Pure and exported for tests.
 * Each polyline's cumulative length restarts at 0; reveal spans map length to 0..1 within the span.
 */
export function buildSegmentAttributes(polylines: Polyline[]): {
  start: Float32Array;
  end: Float32Array;
  dist: Float32Array;
  reveal: Float32Array;
  count: number;
} {
  let count = 0;
  for (const line of polylines) count += Math.max(0, line.points.length / 3 - 1);
  const start = new Float32Array(count * 3);
  const end = new Float32Array(count * 3);
  const dist = new Float32Array(count * 2);
  const reveal = new Float32Array(count * 2);
  let s = 0;
  for (const line of polylines) {
    const pts = line.points;
    const n = pts.length / 3;
    if (n < 2) continue;
    let total = 0;
    for (let i = 0; i < n - 1; i++) total += segLength(pts, i);
    const [r0, r1] = line.reveal ?? [0, 1];
    let acc = 0;
    for (let i = 0; i < n - 1; i++) {
      const len = segLength(pts, i);
      start.set([pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!], s * 3);
      end.set([pts[i * 3 + 3]!, pts[i * 3 + 4]!, pts[i * 3 + 5]!], s * 3);
      dist[s * 2] = acc;
      dist[s * 2 + 1] = acc + len;
      const f0 = total > 0 ? acc / total : 0;
      const f1 = total > 0 ? (acc + len) / total : 1;
      // A segment that ends exactly at the span end must be fully drawn at uDraw = r1.
      reveal[s * 2] = r0 + (r1 - r0) * f0;
      reveal[s * 2 + 1] = r0 + (r1 - r0) * f1;
      acc += len;
      s++;
    }
  }
  return { start, end, dist, reveal, count };
}

function segLength(p: number[], i: number): number {
  const dx = p[i * 3 + 3]! - p[i * 3]!;
  const dy = p[i * 3 + 4]! - p[i * 3 + 1]!;
  const dz = p[i * 3 + 5]! - p[i * 3 + 2]!;
  return Math.hypot(dx, dy, dz);
}

export function createLineGeometry(polylines: Polyline[]): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  // Base quad: x = side (-1, 1), y = which end (0 = start, 1 = end).
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const a = buildSegmentAttributes(polylines);
  geometry.setAttribute('iStart', new InstancedBufferAttribute(a.start, 3));
  geometry.setAttribute('iEnd', new InstancedBufferAttribute(a.end, 3));
  geometry.setAttribute('iDist', new InstancedBufferAttribute(a.dist, 2));
  geometry.setAttribute('iReveal', new InstancedBufferAttribute(a.reveal, 2));
  geometry.instanceCount = a.count;
  return geometry;
}

/** A material per line set (its own colour, width, draw-on); the program is shared by all. */
export function createLineMaterial(shared: SharedLineUniforms, options: DraftLineOptions): ShaderMaterial {
  const dash = options.dash ?? [0, 0, 0, 0];
  const material = new ShaderMaterial({
    name: `draft-line:${options.name}`,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uResolution: shared.uResolution,
      uPixelRatio: shared.uPixelRatio,
      uCarbon: shared.uCarbon,
      uColor: { value: options.color.clone() },
      uIntensity: { value: options.intensity },
      uGain: { value: options.gain },
      uDraw: { value: 1 },
      uWidth: { value: options.width },
      uDash: { value: new Vector4(...dash) },
      uDistScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    // The quad is built in screen space; its winding flips with the segment direction.
    side: DoubleSide,
    depthTest: options.depth !== 'overlay',
    depthFunc: options.depth === 'hidden' ? GreaterDepth : LessEqualDepth,
  });
  return material;
}

/** One drawable line set. frustumCulled is off: the base quad's bounds say nothing about the segments. */
export function createLineMesh(
  polylines: Polyline[],
  shared: SharedLineUniforms,
  options: DraftLineOptions,
  geometry?: InstancedBufferGeometry,
): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const mesh = new Mesh(geometry ?? createLineGeometry(polylines), createLineMaterial(shared, options));
  mesh.name = options.name;
  mesh.frustumCulled = false;
  mesh.renderOrder = options.renderOrder ?? (options.depth === 'hidden' ? 1 : 2);
  return mesh;
}
