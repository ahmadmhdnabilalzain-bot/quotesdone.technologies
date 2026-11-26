/**
 * three.js r187 AgX tone mapping, re-implemented in plain TypeScript (from
 * three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js), plus its inverse.
 *
 * Why: the presenter tone-maps every scene with AgX. A flat Alloy fill that must match the DOM
 * SVG pixel for pixel (the swap at rest, the dock into the header), and a Rhodamine datum that must
 * match the CSS line, need the LINEAR input that AgX maps to the brand sRGB value. AgX mixes
 * channels and compresses highlights, so we solve for it numerically, once, at create().
 * Three-free so it is unit-tested in Node. Exposure is the renderer's toneMappingExposure (1).
 */

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3]; // COLUMNS, as GLSL mat3(vec3, vec3, vec3)

const SRGB_TO_REC2020: Mat3 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const INSET: Mat3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const OUTSET: Mat3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const REC2020_TO_SRGB: Mat3 = invert(SRGB_TO_REC2020);
const MIN_EV = -12.47393;
const MAX_EV = 4.026069;

function mul(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
    m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
    m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
  ];
}

function invert(m: Mat3): Mat3 {
  // Row-major view of the column matrix.
  const a = m[0][0], b = m[1][0], c = m[2][0];
  const d = m[0][1], e = m[1][1], f = m[2][1];
  const g = m[0][2], h = m[1][2], i = m[2][2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const r = [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
  // Back to columns.
  return [
    [r[0]![0]!, r[1]![0]!, r[2]![0]!],
    [r[0]![1]!, r[1]![1]!, r[2]![1]!],
    [r[0]![2]!, r[1]![2]!, r[2]![2]!],
  ];
}

const sigmoid = (x: number): number => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
};

/** Linear-sRGB in -> linear-sRGB out, exactly as the GLSL (exposure 1). */
export function agx(linear: Vec3): Vec3 {
  let c = mul(INSET, mul(SRGB_TO_REC2020, linear));
  c = c.map((v) => Math.min(1, Math.max(0, (Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)))) as Vec3;
  c = c.map(sigmoid) as Vec3;
  c = mul(OUTSET, c);
  c = c.map((v) => Math.pow(Math.max(0, v), 2.2)) as Vec3;
  c = mul(REC2020_TO_SRGB, c);
  return c.map((v) => Math.min(1, Math.max(0, v))) as Vec3;
}

export const srgbToLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const linearToSrgb = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function hexToSrgb(hex: string): Vec3 {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** What the screen shows (sRGB 0..1) for a linear scene colour, through the post pass. */
export function displayed(linear: Vec3): Vec3 {
  return agx(linear).map(linearToSrgb) as Vec3;
}

/**
 * The linear scene colour that AgX displays as `targetHex`. Gauss-Newton in log2 space (AgX is a
 * log encoder, so the problem is nearly linear there). Returns the best input and its error in
 * 8-bit steps; colours outside AgX's output gamut come back as the closest reachable value.
 */
export function inverseAgx(targetHex: string, iterations = 40): { linear: Vec3; error255: number } {
  const target = hexToSrgb(targetHex);
  let x: Vec3 = target.map((v) => Math.log2(Math.max(srgbToLinear(v), 1e-4))) as Vec3;
  const residual = (lx: Vec3): Vec3 => {
    const out = displayed(lx.map((v) => 2 ** v) as Vec3);
    return [out[0] - target[0], out[1] - target[1], out[2] - target[2]];
  };
  for (let k = 0; k < iterations; k++) {
    const r = residual(x);
    if (Math.max(...r.map(Math.abs)) < 1e-5) break;
    const h = 1e-4;
    const J: Mat3 = [0, 1, 2].map((j) => {
      const xp = [...x] as Vec3;
      xp[j] = x[j as 0 | 1 | 2] + h;
      const rp = residual(xp);
      return [(rp[0] - r[0]) / h, (rp[1] - r[1]) / h, (rp[2] - r[2]) / h];
    }) as Mat3; // columns = d r / d x_j
    // Damped step: (J^T J + lambda I) dx = -J^T r, solved with the 3x3 inverse.
    const lambda = 1e-6;
    const JtJ: Mat3 = [0, 1, 2].map((col) => [0, 1, 2].map((row) => dot(J[row]!, J[col]!) + (row === col ? lambda : 0))) as Mat3;
    const Jtr: Vec3 = [dot(J[0], r), dot(J[1], r), dot(J[2], r)];
    const step = mul(invert(JtJ), Jtr);
    x = [x[0] - step[0], x[1] - step[1], x[2] - step[2]].map((v) => Math.min(8, Math.max(-14, v))) as Vec3;
  }
  const r = residual(x);
  return { linear: x.map((v) => 2 ** v) as Vec3, error255: Math.max(...r.map(Math.abs)) * 255 };
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
