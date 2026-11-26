/**
 * A procedural studio for reflections: a small half-float cube map, computed on the CPU from a
 * few analytic light shapes (no image files). Metal reads as metal only through what it reflects;
 * the runtime's neutral room is evenly bright, which makes bead-blasted Alloy look like grey
 * plastic. This studio is dark, with ONE large softbox (the key) high on the leading side and
 * a faint overhead bounce, so faces get a long soft gradient and the edges catch a bright line.
 *
 * three.js prefilters a CubeTexture used as a Standard/Physical `envMap` (PMREM) on first use,
 * and frees that copy when this texture is disposed. The scene disposes the texture through the
 * materials that reference it (runtime/disposal.ts walks material textures).
 *
 * Cube face directions follow the OpenGL convention (+X, -X, +Y, -Y, +Z, -Z; row 0 = top).
 */
import { CubeTexture, DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearSRGBColorSpace, RGBAFormat } from 'three';

type Vec3 = [number, number, number];

export interface StudioLight {
  /** Direction from the scene to the light's centre (any length). */
  dir: Vec3;
  /** Half extents as tangents of the half-angles (gnomonic), width then height. */
  halfWidth: number;
  halfHeight: number;
  /** Edge softness, in the same tangent units. */
  soft: number;
  radiance: number;
}

export interface StudioOptions {
  size: number;
  lights: StudioLight[];
  /** Radiance of the dark studio walls (above the horizon) and the floor. */
  ambientTop: number;
  ambientFloor: number;
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Radiance seen along unit direction `d`. Pure; exported for tests. */
export function studioRadiance(d: Vec3, options: StudioOptions): number {
  // Dark walls with a gentle gradient to a darker floor; no visible horizon line.
  let L = options.ambientFloor + (options.ambientTop - options.ambientFloor) * smooth(-0.25, 0.35, d[1]);
  for (const light of options.lights) {
    const c = norm(light.dir);
    const facing = dot(d, c);
    if (facing <= 0.05) continue;
    // Light-local basis: r is horizontal (perpendicular to world up), u completes it.
    const r = norm(cross([0, 1, 0], c));
    const u = cross(c, r);
    const x = Math.abs(dot(d, r) / facing);
    const y = Math.abs(dot(d, u) / facing);
    const inside = (1 - smooth(light.halfWidth - light.soft, light.halfWidth + light.soft, x)) *
      (1 - smooth(light.halfHeight - light.soft, light.halfHeight + light.soft, y));
    L += inside * light.radiance;
  }
  return L;
}

/** Direction of texel (x, y) on cube face `face`. */
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

export function createStudioCube(options: StudioOptions): CubeTexture {
  const size = Math.max(8, Math.round(options.size));
  const faces: DataTexture[] = [];
  for (let face = 0; face < 6; face++) {
    const data = new Uint16Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const L = studioRadiance(faceDirection(face, x, y, size), options);
        const h = DataUtils.toHalfFloat(L);
        const i = (y * size + x) * 4;
        data[i] = h;
        data[i + 1] = h;
        data[i + 2] = h;
        data[i + 3] = DataUtils.toHalfFloat(1);
      }
    }
    const texture = new DataTexture(data, size, size, RGBAFormat, HalfFloatType);
    texture.colorSpace = LinearSRGBColorSpace;
    texture.needsUpdate = true;
    faces.push(texture);
  }
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
