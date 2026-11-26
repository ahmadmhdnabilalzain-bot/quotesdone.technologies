/**
 * Scene 5 (Sonobolt) without WebGL: envelope generator, tape path, timeline, ribbon winding,
 * and the scene contract (determinism, dispose, tier/ladder, RTL, Rhodamine rules).
 */
import { describe, expect, it, vi } from 'vitest';
import { Color, type BufferAttribute, type Material, type Mesh, type MeshBasicMaterial, type Object3D } from 'three';
import { createSonoboltScene } from '../../src/three/scenes/sonobolt/index.ts';
import { SONOBOLT_PARAMS } from '../../src/three/scenes/sonobolt/params.ts';
import { beatShape, generateEnvelopes, mulberry32, type EnvelopeOptions } from '../../src/three/scenes/sonobolt/envelope.ts';
import { pathPoint, reelState, solveWound, radiusAfter, type ReelGeometry } from '../../src/three/scenes/sonobolt/path.ts';
import { cameraAt, timeline } from '../../src/three/scenes/sonobolt/timeline.ts';
import { ribbonIndex, VERTS_PER_ROW } from '../../src/three/scenes/sonobolt/ribbon.ts';
import type { SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';

const ctx = (over: Partial<SceneContext> = {}): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS.high,
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
  ...over,
});
const view: Viewport = { width: 840, height: 900, aspect: 840 / 900, dir: 'ltr', pixelRatio: 2 };

const ENV: EnvelopeOptions = { seed: 7, songCount: 5, beatsPerSong: 32, rowsPerBeat: 12, ampFloor: 0.12, endTaperBeats: 0.9, crossfadeBeats: 2.5, tempoSpread: 0.12 };
const REEL: ReelGeometry = { guide: { x: -1.35, z: 0 }, centre: { x: 0, z: 1.45 }, r0: 0.36, b: 0.07 / (Math.PI * 2) };

async function built(over: Partial<SceneContext> = {}, v: Viewport = view) {
  const scene = createSonoboltScene();
  await scene.create(ctx(over));
  scene.resize(v);
  return scene;
}

function ribbonOf(root: Object3D): Mesh {
  return root.getObjectByName('sonobolt-ribbon') as Mesh;
}

function snapshot(root: Object3D, camera: Object3D): number[] {
  root.updateMatrixWorld(true);
  const values: number[] = [...camera.matrixWorld.elements];
  root.traverse((o) => values.push(...o.matrixWorld.elements));
  values.push(...(ribbonOf(root).geometry.getAttribute('position').array as Float32Array));
  values.push(...(ribbonOf(root).geometry.getAttribute('normal').array as Float32Array));
  return values;
}

describe('sonobolt envelope', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = generateEnvelopes(ENV);
    const b = generateEnvelopes(ENV);
    const c = generateEnvelopes({ ...ENV, seed: 8 });
    expect(a[2]!.fused).toEqual(b[2]!.fused);
    expect(a[2]!.fused).not.toEqual(c[2]!.fused);
    expect(mulberry32(1)()).toBe(mulberry32(1)());
  });

  it('stays in 0..1, pinches separate songs to zero at both ends', () => {
    for (const song of generateEnvelopes(ENV)) {
      for (const x of song.solo) expect(x).toBeGreaterThanOrEqual(0);
      for (const x of song.fused) expect(x).toBeLessThanOrEqual(1);
      expect(song.solo[0]).toBe(0);
      expect(song.solo[song.solo.length - 1]).toBe(0);
      expect(Math.max(...song.solo)).toBeGreaterThan(0.6);
    }
  });

  it('fused envelopes meet exactly at every seam, so the mix is one unbroken band', () => {
    const songs = generateEnvelopes(ENV);
    for (let s = 0; s < songs.length - 1; s++) {
      const tail = songs[s]!.fused[songs[s]!.fused.length - 1]!;
      const head = songs[s + 1]!.fused[0]!;
      expect(Math.abs(tail - head)).toBeLessThan(1e-3);
      expect(tail).toBeGreaterThan(0.05); // a real join, not a pinch
      expect(songs[s]!.seamDistance[songs[s]!.seamDistance.length - 1]).toBe(0);
    }
    expect(songs[0]!.seamDistance[0]).toBe(ENV.beatsPerSong); // the mix head is not a seam: nearest is its tail
  });

  it('beat shape is continuous across beat boundaries', () => {
    expect(Math.abs(beatShape(0, 1) - beatShape(1, 1))).toBeLessThan(1e-3);
    expect(beatShape(0.12, 1)).toBeGreaterThan(beatShape(0.9, 1)); // the kick is near the start
  });
});

describe('sonobolt tape path', () => {
  it('winds nothing until the head reaches the hub, then conserves length', () => {
    const l0 = reelState(0, REEL).spanLength;
    expect(solveWound(l0 - 0.01, REEL)).toBe(0);
    for (const e of [l0 + 0.5, l0 + 5, l0 + 30]) {
      const s = reelState(e, REEL);
      expect(s.wound + s.spanLength).toBeCloseTo(e, 6);
      expect(s.radius).toBeCloseTo(radiusAfter(s.wound, REEL.r0, REEL.b), 9);
    }
  });

  it('is continuous at the guide and at the coil tangent point', () => {
    for (const e of [-3, 0.8, 4, 20]) {
      const s = reelState(e, REEL);
      for (const joint of [s.wound, s.e]) {
        if (joint <= 0) continue;
        const a = pathPoint(joint - 1e-6, s, REEL);
        const b = pathPoint(joint + 1e-6, s, REEL);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-4);
      }
    }
  });

  it('keeps unit speed along the tape (no stretching) on every part of the path', () => {
    const s = reelState(18, REEL);
    for (let sigma = 0.05; sigma < 30; sigma += 0.37) {
      const a = pathPoint(sigma, s, REEL);
      const b = pathPoint(sigma + 0.001, s, REEL);
      expect(Math.hypot(a.x - b.x, a.z - b.z) / 0.001).toBeGreaterThan(0.97);
      expect(Math.hypot(a.x - b.x, a.z - b.z) / 0.001).toBeLessThan(1.03);
    }
  });
});

describe('sonobolt timeline', () => {
  const input = { hubSpan: 1.9, windTravel: 34 };
  it('travel never runs backwards and every value is finite', () => {
    let last = Number.NEGATIVE_INFINITY;
    for (let i = 0; i <= 400; i++) {
      const f = timeline(i / 400, SONOBOLT_PARAMS, input);
      expect(f.travel).toBeGreaterThanOrEqual(last - 1e-9);
      last = f.travel;
      for (const x of [f.align, f.fuse, f.weld, f.grid, f.status, ...f.camera.pos, ...f.camera.target]) expect(Number.isFinite(x)).toBe(true);
    }
  });

  it('the weld light is exactly zero outside its window, and the end state is complete', () => {
    expect(timeline(0, SONOBOLT_PARAMS, input).weld).toBe(0);
    expect(timeline(0.3, SONOBOLT_PARAMS, input).weld).toBe(0);
    expect(timeline(0.7, SONOBOLT_PARAMS, input).weld).toBe(0);
    expect(timeline(0.52, SONOBOLT_PARAMS, input).weld).toBeGreaterThan(0.9);
    const end = timeline(1, SONOBOLT_PARAMS, input);
    expect(end).toMatchObject({ align: 1, fuse: 1, weld: 0, grid: 0, status: 1, travel: 34 });
  });

  it('the camera passes through its keys continuously', () => {
    const a = cameraAt(0.5199);
    const b = cameraAt(0.5201);
    expect(Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2])).toBeLessThan(0.01);
  });
});

describe('sonobolt ribbon geometry', () => {
  it('triangle winding agrees with the vertex normals (straight, upright frame)', async () => {
    const scene = await built();
    scene.update(0.36, 0); // aligned (no roll), on the rail, before any winding
    const geo = ribbonOf(scene.object3d).geometry;
    const pos = geo.getAttribute('position') as BufferAttribute;
    const nrm = geo.getAttribute('normal') as BufferAttribute;
    const index = geo.getIndex()!.array;
    let checked = 0;
    for (let t = 0; t < index.length; t += 3 * 97) {
      const [i, j, k] = [index[t]!, index[t + 1]!, index[t + 2]!];
      const ax = pos.getX(j) - pos.getX(i), ay = pos.getY(j) - pos.getY(i), az = pos.getZ(j) - pos.getZ(i);
      const bx = pos.getX(k) - pos.getX(i), by = pos.getY(k) - pos.getY(i), bz = pos.getZ(k) - pos.getZ(i);
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      const area = Math.hypot(cx, cy, cz);
      if (area < 1e-9) continue; // pinched ends are degenerate
      const dot = (cx * nrm.getX(i) + cy * nrm.getY(i) + cz * nrm.getZ(i)) / area;
      // > 0: winding faces the normal. Not ~1: rim normals follow the (central-difference) envelope slope.
      expect(dot).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    scene.dispose();
  });

  it('index covers every row of every song', () => {
    const idx = ribbonIndex(3, 10);
    expect(idx.length).toBe(3 * 9 * 4 * 6);
    expect(Math.max(...idx)).toBe(3 * 10 * VERTS_PER_ROW - 1);
  });
});

describe('sonobolt scene contract', () => {
  it('implements the §6.2 members with bounded params', async () => {
    const scene = createSonoboltScene();
    expect(scene.id).toBe('sonobolt');
    expect(scene.stillAt.length).toBeGreaterThan(0);
    for (const [name, p] of Object.entries(scene.params)) {
      expect(p.min, name).toBeLessThanOrEqual(p.value);
      expect(p.max, name).toBeGreaterThanOrEqual(p.value);
      expect(p.description.length, name).toBeGreaterThan(0);
    }
    await scene.create(ctx());
    scene.dispose();
  });

  it('update(progress, time) is deterministic and order-independent', async () => {
    const scene = await built();
    scene.update(0.43, 1234);
    const first = snapshot(scene.object3d, scene.camera);
    for (const p of [0.9, 0, 1, 0.2]) scene.update(p, p * 9999);
    scene.update(0.43, 1234);
    expect(snapshot(scene.object3d, scene.camera)).toEqual(first);

    const other = await built();
    other.update(0.43, 1234);
    expect(snapshot(other.object3d, other.camera)).toEqual(first);
    scene.dispose();
    other.dispose();
  });

  it('produces finite geometry at every progress, and the frames differ', async () => {
    const scene = await built();
    const frames: number[][] = [];
    for (const p of [0, 0.2, 0.45, 0.6, 0.8, 1]) {
      scene.update(p, 0);
      const arr = ribbonOf(scene.object3d).geometry.getAttribute('position').array as Float32Array;
      expect(arr.every(Number.isFinite)).toBe(true);
      frames.push([...arr.slice(0, 600)]);
    }
    expect(frames[0]).not.toEqual(frames[5]);
    scene.dispose();
  });

  it('at the end the whole ribbon sits inside the Mix slot', async () => {
    const scene = await built();
    scene.update(1, 0);
    const arr = ribbonOf(scene.object3d).geometry.getAttribute('position').array as Float32Array;
    const cz = SONOBOLT_PARAMS.coilOffsetZ.value;
    let maxR = 0;
    for (let i = 0; i < arr.length; i += 3) maxR = Math.max(maxR, Math.hypot(arr[i]!, arr[i + 2]! - cz));
    expect(maxR).toBeLessThan(SONOBOLT_PARAMS.socketRadius.value - 0.05);
    scene.dispose();
  });

  it('dispose frees every geometry and material it created', async () => {
    const scene = await built();
    const disposers: Array<ReturnType<typeof vi.fn>> = [];
    const seen = new Set<unknown>();
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const r of [mesh.geometry, ...materials]) {
        if (seen.has(r)) continue;
        seen.add(r);
        disposers.push(vi.spyOn(r as { dispose(): void }, 'dispose') as never);
      }
    });
    expect(disposers.length).toBeGreaterThanOrEqual(20);
    scene.dispose();
    for (const d of disposers) expect(d).toHaveBeenCalledTimes(1);
    expect(scene.object3d.children.length).toBe(0);
  });

  it('the contact shadow follows tier and ladder', async () => {
    const shadowOf = (s: { object3d: Object3D }) => s.object3d.getObjectByName('contact-shadow')!;
    const high = await built();
    high.update(1, 0);
    expect(shadowOf(high).visible).toBe(true);
    high.applyQuality?.({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 });
    high.update(1, 0);
    expect(shadowOf(high).visible).toBe(false);
    const mid = await built({ tierConfig: TIER_CONFIGS.mid });
    mid.update(1, 0);
    expect(shadowOf(mid).visible).toBe(false);
    high.dispose();
    mid.dispose();
  });

  it('mirrors the flow for RTL pages', async () => {
    const ltr = await built();
    const rtl = await built({}, { ...view, dir: 'rtl' });
    ltr.update(0.5, 0);
    rtl.update(0.5, 0);
    expect(rtl.object3d.getObjectByName('sonobolt-world')!.scale.x).toBe(-1);
    expect(rtl.camera.position.x).toBeCloseTo(-ltr.camera.position.x, 9);
    expect(rtl.camera.position.y).toBeCloseTo(ltr.camera.position.y, 9);
    ltr.dispose();
    rtl.dispose();
  });

  it('Rhodamine is light only: the capped slots and the Alloy parts carry none', async () => {
    const scene = await built();
    scene.update(1, 0);
    const rhodamine = new Color('#E3185B');
    const hue = (c: Color) => c.getHSL({ h: 0, s: 0, l: 0 });
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as Material & { color?: Color; emissive?: Color };
      const lit = /status|datum/.test(mesh.name);
      if (!lit && m.color) expect(hue(m.color).s * hue(m.color).l, mesh.name).toBeLessThan(0.2);
      if (m.emissive) expect(m.emissive.getHex(), mesh.name).toBe(0);
      if (/cap/.test(mesh.name)) expect((m as MeshBasicMaterial).color.getHex()).not.toBe(rhodamine.getHex());
    });
    // The Mix status ring is lit at the end.
    const status = scene.object3d.getObjectByName('sonobolt-status') as Mesh;
    expect(((status.material as MeshBasicMaterial).color.r)).toBeGreaterThan(0.5);
    scene.dispose();
  });
});
