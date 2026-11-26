/**
 * Rail scene (home scenes 2 and 3) contract tests, without WebGL: create/update/resize/dispose
 * run on plain three.js objects (envMap null), as in smoke-scene.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { Color, LinearSRGBColorSpace, MeshPhysicalMaterial, Vector3, type Material, type Object3D } from 'three';
import { createRailScene, materialsOf } from '../../src/three/scenes/rail/index.ts';
import { RHODAMINE_LIGHT } from '../../src/three/scenes/rail/materials.ts';
import { RAIL_PARAMS } from '../../src/three/scenes/rail/params.ts';
import type { SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';
import home from '../../src/content/en/home.json';

const ctx = (tier: 'high' | 'mid' = 'high'): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS[tier],
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view = (dir: 'ltr' | 'rtl' = 'ltr'): Viewport => ({ width: 1440, height: 900, aspect: 1.6, dir, pixelRatio: 2 });

async function ready(dir: 'ltr' | 'rtl' = 'ltr', tier: 'high' | 'mid' = 'high') {
  const scene = createRailScene();
  await scene.create(ctx(tier));
  scene.resize(view(dir));
  return scene;
}

/** World matrices + visibility of everything, plus the camera: a full frame fingerprint. */
function snapshot(root: Object3D, camera: Object3D): number[] {
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const values: number[] = [...camera.matrixWorld.elements];
  root.traverse((o) => {
    values.push(...o.matrixWorld.elements, o.visible ? 1 : 0);
    const inst = o as Object3D & { instanceMatrix?: { array: ArrayLike<number> } };
    if (inst.instanceMatrix) values.push(...Array.from(inst.instanceMatrix.array));
  });
  return values;
}

const byName = (root: Object3D, name: string) => root.getObjectByName(name)!;

describe('rail scene contract', () => {
  it('implements the §6.2 members with bounded, described params', async () => {
    const scene = createRailScene();
    expect(scene.id).toBe('rail');
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
    const scene = await ready();
    scene.update(0.55, 4321);
    const first = snapshot(scene.object3d, scene.camera);
    scene.update(0.1, 99);
    scene.update(1, 120000);
    scene.update(0.55, 4321);
    expect(snapshot(scene.object3d, scene.camera)).toEqual(first);

    const other = await ready();
    other.update(0.55, 4321);
    expect(snapshot(other.object3d, other.camera)).toEqual(first);
    scene.dispose();
    other.dispose();
  });

  it('different progress gives a different frame at every beat', async () => {
    const scene = await ready();
    const frames = [0, 0.2, 0.45, 0.62, 0.75, 1].map((p) => {
      scene.update(p, 0);
      return JSON.stringify(snapshot(scene.object3d, scene.camera));
    });
    expect(new Set(frames).size).toBe(frames.length);
    scene.dispose();
  });

  it('dispose frees every geometry and material, lines and instanced meshes included', async () => {
    const scene = await ready();
    const spies: Array<ReturnType<typeof vi.fn>> = [];
    const seen = new Set<object>();
    let lines = 0;
    let instanced = 0;
    scene.object3d.traverse((o) => {
      const d = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[]; isLineSegments?: boolean; isInstancedMesh?: boolean };
      if (d.isLineSegments) lines++;
      if (d.isInstancedMesh) instanced++;
      const targets = [d.geometry, ...(Array.isArray(d.material) ? d.material : d.material ? [d.material] : [])];
      for (const t of targets) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        spies.push(vi.spyOn(t as { dispose(): void }, 'dispose') as never);
      }
    });
    expect(lines).toBeGreaterThanOrEqual(3); // linework object: visible, hidden, dimensions
    expect(instanced).toBe(2); // pads and caps
    expect(spies.length).toBeGreaterThan(20);
    scene.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    expect(scene.object3d.children.length).toBe(0);
  });
});

describe('rail scene: honest status', () => {
  it('render state follows home.json status: live = solid, in development = linework, the rest empty', async () => {
    const scene = await ready();
    const report = scene.stations();
    home.productIndex.items.forEach((item, i) => {
      expect(report[i]!.slug).toBe(item.slug);
      expect(report[i]!.mode).toBe(item.status === 'live' ? 'solid' : 'linework');
    });
    const extra = report.slice(home.productIndex.items.length);
    expect(extra.length).toBe(RAIL_PARAMS.emptyStations.value);
    for (const s of extra) expect(s).toMatchObject({ slug: null, mode: 'empty', status: null });
    scene.dispose();
  });

  it('a product in development has no lit surfaces and casts no contact shadow', async () => {
    const scene = await ready();
    for (const item of home.productIndex.items.filter((p) => p.status !== 'live')) {
      expect(scene.object3d.getObjectByName(`shadow-${item.slug}`)).toBeUndefined();
    }
    const linework = scene.object3d.getObjectByName('object-ring-linework')!;
    linework.traverse((o) => {
      const m = (o as { material?: Material }).material;
      if (m && (o as { isMesh?: boolean }).isMesh) expect(m.colorWrite, 'depth mask only').toBe(false);
    });
    scene.dispose();
  });

  it('status lights: off until seated, Rhodamine once seated (dot for live, ring for in development)', async () => {
    const scene = await ready();
    const colourOf = (slug: string) => (byName(scene.object3d, `status-${slug}`) as unknown as { material: { color: Color } }).material.color;
    scene.update(0.3, 0);
    for (const p of home.productIndex.items) expect(colourOf(p.slug).equals(RHODAMINE_LIGHT)).toBe(false);
    scene.update(1, 0);
    for (const p of home.productIndex.items) expect(colourOf(p.slug).getHex(LinearSRGBColorSpace)).toBe(RHODAMINE_LIGHT.getHex(LinearSRGBColorSpace));
    for (const p of home.productIndex.items) {
      const type = (byName(scene.object3d, `status-${p.slug}`) as unknown as { geometry: { type: string } }).geometry.type;
      expect(type).toBe(p.status === 'live' ? 'CircleGeometry' : 'RingGeometry');
    }
    scene.dispose();
  });

  it('Rhodamine is light only: no lit surface material is reddish or emissive', async () => {
    const scene = await ready();
    for (const m of materialsOf(scene.object3d)) {
      if (!(m instanceof MeshPhysicalMaterial)) continue;
      // Alloy is a warm neutral and Carbon a cool one; Rhodamine has almost no green. A surface
      // colour must keep green within 10% of red, so nothing red can sneak onto a surface.
      const { r, g } = m.color;
      expect(g / Math.max(r, 1e-6), `${m.name || m.type} is neutral`).toBeGreaterThan(0.9);
      expect(m.emissive.getHex()).toBe(0);
    }
    scene.dispose();
  });
});

describe('rail scene: choreography', () => {
  it('progress 0 is only the datum line, spanning past both stage edges', async () => {
    const scene = await ready();
    scene.update(0, 0);
    expect(byName(scene.object3d, 'rail-extrude').visible).toBe(false);
    for (const p of home.productIndex.items) {
      const kind = { quotesdone: 'plate', sonobolt: 'coil', mubinflow: 'ring' }[p.slug];
      const mode = p.status === 'live' ? 'solid' : 'linework';
      expect(byName(scene.object3d, `object-${kind}-${mode}`).visible).toBe(false);
    }
    scene.camera.updateMatrixWorld(true);
    const ends = [RAIL_PARAMS.railStart.value + 0.01, RAIL_PARAMS.fadeStart.value].map((x) => new Vector3(x, RAIL_PARAMS.grooveY.value, 0.27).project(scene.camera));
    expect(ends[0]!.x).toBeLessThan(-1);
    expect(ends[1]!.x).toBeGreaterThan(1);
    expect(Math.abs(ends[0]!.y)).toBeLessThan(0.01); // the line sits on the stage centre
    scene.dispose();
  });

  it('progress 1: every product docked and seated on its pad', async () => {
    const scene = await ready();
    scene.update(1, 0);
    const padTop = RAIL_PARAMS.padHeight.value;
    for (const name of ['object-plate-solid', 'object-coil-solid', 'object-ring-linework']) {
      const o = byName(scene.object3d, name);
      expect(o.visible).toBe(true);
      expect(o.position.y).toBeCloseTo(padTop, 6);
    }
    scene.dispose();
  });

  it('RTL mirrors the line and the camera', async () => {
    const ltr = await ready('ltr');
    const rtl = await ready('rtl');
    ltr.update(1, 0);
    rtl.update(1, 0);
    expect(byName(rtl.object3d, 'rail-root').scale.x).toBe(-1);
    expect(rtl.camera.position.x).toBeCloseTo(-ltr.camera.position.x, 6);
    expect(rtl.camera.position.y).toBeCloseTo(ltr.camera.position.y, 6);
    ltr.dispose();
    rtl.dispose();
  });

  it('contact shadows follow the tier and the ladder', async () => {
    const high = await ready('ltr', 'high');
    const shadow = byName(high.object3d, 'shadow-quotesdone');
    expect(shadow.visible).toBe(true);
    high.applyQuality?.({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 });
    expect(shadow.visible).toBe(false);
    const mid = await ready('ltr', 'mid');
    expect(byName(mid.object3d, 'shadow-quotesdone').visible).toBe(false);
    high.dispose();
    mid.dispose();
  });
});
