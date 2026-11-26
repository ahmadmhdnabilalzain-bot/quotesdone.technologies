/**
 * The ribbon: every song is a thin Alloy band standing on edge, its height following the song's
 * amplitude envelope (mirrored about its centre line, as a waveform is drawn). All songs live in
 * ONE geometry and ONE draw call. Each frame the CPU places every cross-section ("row") on the tape
 * path (path.ts) and writes positions and normals. That is about 16k vertices: cheap on a desktop,
 * and it keeps one testable copy of the path maths instead of a GLSL duplicate.
 *
 * Cross-section, 8 vertices per row (front = +N side, N = T x up):
 *   0 front-top  1 front-bottom  2 back-top  3 back-bottom      (faces, normal +-N)
 *   4 rim-top-front  5 rim-top-back  6 rim-bottom-front  7 rim-bottom-back (edges, normal from the
 *   envelope slope, so every beat transient catches the key light on the rim)
 *
 * The seam weld is the one shader patch: a per-vertex distance to the nearest seam feeds a thin
 * Rhodamine emissive line whose level is a uniform (0 outside the weld window, so it ends exactly dark).
 */
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Mesh, MeshPhysicalMaterial, Sphere, Vector3 } from 'three';
import type { SongEnvelope } from './envelope.ts';
import { pathPoint, type ReelGeometry, type ReelState, type Vec2 } from './path.ts';

export const VERTS_PER_ROW = 8;
/** A seam distance that means "no seam here" (the mix head and tail). */
const NO_SEAM = 1e4;

export interface RibbonLayout {
  songCount: number;
  rowsPerSong: number;
  /** Aligned song length, units (beatsPerSong x beatLength). */
  songLength: number;
}

/** Per-frame inputs for one song. */
export interface SongPose {
  /** sigma of the song's first row (distance from the mix head along the tape). */
  start: number;
  /** Length factor (tempo) for this frame. */
  scale: number;
  /** Vertical offset and roll around the tape direction. */
  lift: number;
  roll: number;
}

export interface RibbonFrame {
  poses: SongPose[];
  /** 0 = separate envelopes (pinched ends), 1 = fused mix envelope. */
  fuse: number;
  reel: ReelGeometry;
  state: ReelState;
  halfHeight: number;
  thickness: number;
  centreY: number;
  /** Face normal tilt toward the edges (0 = flat strip). */
  crown: number;
}

export interface Ribbon {
  mesh: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  layout: RibbonLayout;
  /** Write every vertex for this frame. Pure in its inputs. */
  apply(frame: RibbonFrame): void;
  setWeld(level: number): void;
}

/** Triangle indices for `songCount` songs of `rowsPerSong` rows each. Exported for the winding test. */
export function ribbonIndex(songCount: number, rowsPerSong: number): Uint32Array {
  const quads = songCount * (rowsPerSong - 1) * 4;
  const index = new Uint32Array(quads * 6);
  let o = 0;
  for (let s = 0; s < songCount; s++) {
    for (let k = 0; k < rowsPerSong - 1; k++) {
      const a = (s * rowsPerSong + k) * VERTS_PER_ROW;
      const c = a + VERTS_PER_ROW;
      // Counter-clockwise seen from each face's outward normal (checked in tests).
      const tris = [
        a + 0, a + 1, c + 1, a + 0, c + 1, c + 0, // front (+N)
        a + 2, c + 3, a + 3, a + 2, c + 2, c + 3, // back (-N)
        a + 4, c + 4, c + 5, a + 4, c + 5, a + 5, // top rim (+up)
        a + 6, c + 7, c + 6, a + 6, a + 7, c + 7, // bottom rim (-up)
      ];
      index.set(tris, o);
      o += tris.length;
    }
  }
  return index;
}

export function createRibbon(songs: SongEnvelope[], beatLength: number, rowsPerBeat: number, color: Color, roughness: number, weldColor: Color, weldWidth: number): Ribbon {
  const songCount = songs.length;
  const rowsPerSong = songs[0]?.solo.length ?? 0;
  if (songCount === 0 || rowsPerSong < 2) throw new Error('sonobolt ribbon: no envelope rows');
  const layout: RibbonLayout = { songCount, rowsPerSong, songLength: ((rowsPerSong - 1) / rowsPerBeat) * beatLength };
  const vertexCount = songCount * rowsPerSong * VERTS_PER_ROW;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const seams = new Float32Array(vertexCount);
  songs.forEach((song, s) => {
    for (let r = 0; r < rowsPerSong; r++) {
      const d = song.seamDistance[r] ?? Number.POSITIVE_INFINITY;
      const units = Number.isFinite(d) ? d * beatLength : NO_SEAM;
      seams.fill(units, (s * rowsPerSong + r) * VERTS_PER_ROW, (s * rowsPerSong + r + 1) * VERTS_PER_ROW);
    }
  });

  const geometry = new BufferGeometry();
  const positionAttr = new BufferAttribute(positions, 3);
  const normalAttr = new BufferAttribute(normals, 3);
  positionAttr.setUsage(DynamicDrawUsage);
  normalAttr.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('normal', normalAttr);
  geometry.setAttribute('aSeam', new BufferAttribute(seams, 1));
  geometry.setIndex(new BufferAttribute(ribbonIndex(songCount, rowsPerSong), 1));
  // The shape changes every frame; a fixed generous sphere keeps three from culling or recomputing.
  geometry.boundingSphere = new Sphere(new Vector3(-8, 0, 0), 40);

  const weld = { value: 0 };
  const material = new MeshPhysicalMaterial({ color, metalness: 1, roughness });
  material.name = 'sonobolt-ribbon';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWeld = weld;
    shader.uniforms.uWeldColor = { value: weldColor };
    shader.uniforms.uWeldWidth = { value: weldWidth };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeam;\nvarying float vSeam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeam = aSeam;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWeld;\nuniform vec3 uWeldColor;\nuniform float uWeldWidth;\nvarying float vSeam;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uWeldColor * (uWeld * exp(-(vSeam * vSeam) / (uWeldWidth * uWeldWidth)));',
      );
  };
  material.customProgramCacheKey = () => 'sonobolt-ribbon-weld-v1';

  const mesh = new Mesh(geometry, material);
  mesh.name = 'sonobolt-ribbon';
  mesh.frustumCulled = false;

  // Scratch values reused every frame (no allocation in apply).
  const p0: Vec2 = { x: 0, z: 0 };
  const pf: Vec2 = { x: 0, z: 0 };
  const pb: Vec2 = { x: 0, z: 0 };
  const amps = new Float32Array(rowsPerSong);
  const sigmas = new Float32Array(rowsPerSong);
  const EPS = 0.004;

  return {
    mesh,
    layout,
    setWeld(level: number) {
      weld.value = level;
    },
    apply(frame: RibbonFrame) {
      const { fuse, reel, state, halfHeight, centreY } = frame;
      const halfT = frame.thickness * 0.5;
      for (let s = 0; s < songCount; s++) {
        const song = songs[s]!;
        const pose = frame.poses[s]!;
        const length = layout.songLength * pose.scale;
        for (let r = 0; r < rowsPerSong; r++) {
          sigmas[r] = pose.start + (r / (rowsPerSong - 1)) * length;
          amps[r] = ((song.solo[r] ?? 0) + ((song.fused[r] ?? 0) - (song.solo[r] ?? 0)) * fuse) * halfHeight;
        }
        const cosR = Math.cos(pose.roll);
        const sinR = Math.sin(pose.roll);
        for (let r = 0; r < rowsPerSong; r++) {
          const sigma = sigmas[r]!;
          pathPoint(sigma, state, reel, p0);
          pathPoint(sigma + EPS, state, reel, pf);
          pathPoint(sigma - EPS, state, reel, pb);
          let tx = pf.x - pb.x;
          let tz = pf.z - pb.z;
          const tl = Math.hypot(tx, tz) || 1;
          tx /= tl;
          tz /= tl;
          // N = T x up = (-tz, 0, tx). Roll rotates (up, N) about T.
          const nx0 = -tz;
          const nz0 = tx;
          const upX = sinR * nx0;
          const upY = cosR;
          const upZ = sinR * nz0;
          const nX = cosR * nx0;
          const nY = -sinR;
          const nZ = cosR * nz0;

          // Envelope slope along the tape (one-sided at the song ends).
          const rPrev = Math.max(0, r - 1);
          const rNext = Math.min(rowsPerSong - 1, r + 1);
          const dSigma = (sigmas[rNext]! - sigmas[rPrev]!) || 1;
          const slope = (amps[rNext]! - amps[rPrev]!) / dSigma;
          const amp = amps[r]!;

          const cx = p0.x;
          const cy = centreY + pose.lift;
          const cz = p0.z;
          const base = (s * rowsPerSong + r) * VERTS_PER_ROW * 3;

          // Rim normals: top (-A' T + up), bottom (-A' T - up), normalised.
          const topNx = upX - slope * tx;
          const topNy = upY;
          const topNz = upZ - slope * tz;
          const topL = Math.hypot(topNx, topNy, topNz) || 1;
          const botNx = -upX - slope * tx;
          const botNy = -upY;
          const botNz = -upZ - slope * tz;
          const botL = Math.hypot(botNx, botNy, botNz) || 1;

          // [vertical sign, side sign, normal kind] for vertices 0..7
          for (let v = 0; v < VERTS_PER_ROW; v++) {
            const vert = v < 4 ? (v % 2 === 0 ? 1 : -1) : v < 6 ? 1 : -1;
            const side = v < 4 ? (v < 2 ? 1 : -1) : v % 2 === 0 ? 1 : -1;
            const o = base + v * 3;
            positions[o] = cx + upX * amp * vert + nX * halfT * side;
            positions[o + 1] = cy + upY * amp * vert + nY * halfT * side;
            positions[o + 2] = cz + upZ * amp * vert + nZ * halfT * side;
            if (v < 4) {
              // Crowned face: the normal leans toward the edge it sits on (top or bottom).
              const fx = nX * side + upX * vert * frame.crown;
              const fy = nY * side + upY * vert * frame.crown;
              const fz = nZ * side + upZ * vert * frame.crown;
              const fl = Math.hypot(fx, fy, fz) || 1;
              normals[o] = fx / fl;
              normals[o + 1] = fy / fl;
              normals[o + 2] = fz / fl;
            } else if (v < 6) {
              normals[o] = topNx / topL;
              normals[o + 1] = topNy / topL;
              normals[o + 2] = topNz / topL;
            } else {
              normals[o] = botNx / botL;
              normals[o + 1] = botNy / botL;
              normals[o + 2] = botNz / botL;
            }
          }
        }
      }
      positionAttr.needsUpdate = true;
      normalAttr.needsUpdate = true;
    },
  };
}
