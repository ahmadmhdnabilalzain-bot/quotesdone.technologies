/**
 * The shared reflection environment (structure-v1 §3.3): a procedural STUDIO built in code, no HDR
 * download. `studioRadiance` is a pure function of a direction and `STUDIO` (runtime/look.ts):
 * dark walls, a dark floor with a soft bounce band, and a few analytic softboxes (key strip,
 * overhead, rim, front card, kicker). It is baked into a small half-float cube on the CPU, then
 * prefiltered ONCE by PMREM at mount, so every scene shares one texture (ctx.envMap).
 *
 * Neutral by construction (R = G = B everywhere, unit-tested), so it never tints the Alloy and
 * never carries Rhodamine onto the wordmark. Deterministic: the same spec gives the same bytes.
 * Technique borrowed from scenes/quotesdone/studio.ts (that scene keeps its own cube).
 */
import { CubeTexture, DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearSRGBColorSpace, PMREMGenerator, RGBAFormat, type Texture, type WebGLRenderer } from 'three';
import { STUDIO, type StudioPanel, type StudioSpec } from './look.ts';

type Vec3 = [number, number, number];

const norm = (v: readonly [number, number, number]): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Radiance a panel adds along unit direction `d` (gnomonic rectangle with soft edges). */
export function panelRadiance(d: Vec3, panel: StudioPanel): number {
  const c = norm(panel.dir);
  const facing = dot(d, c);
  if (facing <= 0.05) return 0;
  // Panel basis: r horizontal (perpendicular to world up), u completes it. A panel straight
  // overhead uses world z as its reference instead (cross with up would be zero).
  const ref: Vec3 = Math.abs(c[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
  const r = norm(cross(ref, c));
  const u = cross(c, r);
  const x = dot(d, r) / facing;
  const y = dot(d, u) / facing;
  const soft = Math.max(1e-4, panel.soft);
  const inside = (1 - smooth(panel.halfWidth - soft, panel.halfWidth + soft, Math.abs(x))) *
    (1 - smooth(panel.halfHeight - soft, panel.halfHeight + soft, Math.abs(y)));
  if (inside <= 0) return 0;
  // Optional vertical falloff: bright at the top edge, darker toward the bottom (a real softbox).
  const g = panel.gradient ?? 0;
  const v = Math.min(1, Math.max(0, 0.5 + (y / Math.max(1e-4, panel.halfHeight)) * 0.5));
  return inside * panel.radiance * (1 - g + g * v);
}

/** Radiance seen along unit direction `d`. Pure; exported for tests. */
export function studioRadiance(d: Vec3, spec: StudioSpec = STUDIO): number {
  const yv = d[1];
  // Walls: a little brighter just above the horizon, darker high up. Floor: dark, with a soft
  // bounce band just under the horizon. No hard horizon line (smooth blends on both sides).
  const wall = spec.wallLow + (spec.wallHigh - spec.wallLow) * smooth(0.05, 0.85, yv);
  const floor = spec.floor + (spec.floorBounce - spec.floor) * smooth(-0.45, -0.02, yv);
  let radiance = floor + (wall - floor) * smooth(-0.06, 0.06, yv);
  for (const panel of spec.panels) radiance += panelRadiance(d, panel);
  return radiance;
}

/** Direction of texel (x, y) on cube face `face` (OpenGL order +X, -X, +Y, -Y, +Z, -Z). */
export function faceDirection(face: number, x: number, y: number, size: number): Vec3 {
  const u = (2 * (x + 0.5)) / size - 1;
  const v = (2 * (y + 0.5)) / size - 1;
  switch (face) {
    case 0: return norm([1, -v, -u]);
    case 1: return norm([-1, -v, u]);
    case 2: return norm([u, 1, v]);
    case 3: return norm([u, -1, -v]);
    case 4: return norm([u, -v, 1]);
    default: return norm([-u, -v, -1]);
  }
}

/** The six faces as half-float RGBA data. Pure and deterministic (unit-tested). */
export function bakeStudioFaces(spec: StudioSpec = STUDIO): Uint16Array[] {
  const size = Math.max(8, Math.round(spec.size));
  const one = DataUtils.toHalfFloat(1);
  const faces: Uint16Array[] = [];
  for (let face = 0; face < 6; face++) {
    const data = new Uint16Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const h = DataUtils.toHalfFloat(studioRadiance(faceDirection(face, x, y, size), spec));
        const i = (y * size + x) * 4;
        data[i] = h;
        data[i + 1] = h;
        data[i + 2] = h;
        data[i + 3] = one;
      }
    }
    faces.push(data);
  }
  return faces;
}

function createStudioCube(spec: StudioSpec): CubeTexture {
  const size = Math.max(8, Math.round(spec.size));
  const faces = bakeStudioFaces(spec).map((data) => {
    const texture = new DataTexture(data, size, size, RGBAFormat, HalfFloatType);
    texture.colorSpace = LinearSRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
  // WebGLTextures uploads a cube whose images are DataTextures (it reads each one's .image).
  const cube = new CubeTexture(faces as unknown as HTMLImageElement[]);
  cube.type = HalfFloatType;
  cube.format = RGBAFormat;
  cube.colorSpace = LinearSRGBColorSpace;
  cube.magFilter = LinearFilter;
  cube.minFilter = LinearFilter;
  cube.generateMipmaps = false;
  cube.needsUpdate = true;
  return cube;
}

/**
 * Bake the studio and prefilter it with PMREM. Same shape as before ({ texture, dispose }), so
 * the context-restore path in mount.ts is unchanged. The name is kept for mount.ts.
 */
export function createNeutralEnvironment(renderer: WebGLRenderer, spec: StudioSpec = STUDIO): { texture: Texture; dispose(): void } {
  const cube = createStudioCube(spec);
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromCubemap(cube);
  pmrem.dispose();
  cube.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}
