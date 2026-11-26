/**
 * Scene contract tests on the smoke scene, without WebGL: create/update/resize/dispose run on
 * plain three.js objects (envMap null), so the contract is checked in Node.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Mesh, Object3D } from 'three';
import { createSmokeScene } from '../../src/three/scenes/smoke/index.ts';
import type { SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';

const ctx = (): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS.high,
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view: Viewport = { width: 600, height: 600, aspect: 1, dir: 'ltr', pixelRatio: 2 };

function snapshot(root: Object3D): number[] {
  root.updateMatrixWorld(true);
  const values: number[] = [];
  root.traverse((o) => values.push(...o.matrixWorld.elements));
  return values;
}

describe('smoke scene contract', () => {
  it('implements the §6.2 members', async () => {
    const scene = createSmokeScene();
    expect(scene.id).toBe('smoke');
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
    const scene = createSmokeScene();
    await scene.create(ctx());
    scene.resize(view);

    scene.update(0.3, 1234);
    const first = snapshot(scene.object3d);
    scene.update(0.9, 98765);
    scene.update(0, 0);
    scene.update(0.3, 1234);
    expect(snapshot(scene.object3d)).toEqual(first);

    const other = createSmokeScene();
    await other.create(ctx());
    other.resize(view);
    other.update(0.3, 1234);
    expect(snapshot(other.object3d)).toEqual(first);
    scene.dispose();
    other.dispose();
  });

  it('different progress gives a different frame', async () => {
    const scene = createSmokeScene();
    await scene.create(ctx());
    scene.resize(view);
    scene.update(0.1, 0);
    const a = snapshot(scene.object3d);
    scene.update(0.6, 0);
    expect(snapshot(scene.object3d)).not.toEqual(a);
    scene.dispose();
  });

  it('dispose frees every geometry and material it created', async () => {
    const scene = createSmokeScene();
    await scene.create(ctx());
    const disposers: Array<ReturnType<typeof vi.fn>> = [];
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      disposers.push(vi.spyOn(mesh.geometry, 'dispose') as never);
      for (const m of materials) disposers.push(vi.spyOn(m, 'dispose') as never);
    });
    expect(disposers.length).toBeGreaterThanOrEqual(6); // box, datum, shadow: geometry + material each
    scene.dispose();
    for (const d of disposers) expect(d).toHaveBeenCalledTimes(1);
  });

  it('the contact shadow follows tier and ladder', async () => {
    const find = (root: Object3D) => root.getObjectByName('contact-shadow')!;
    const high = createSmokeScene();
    await high.create(ctx());
    expect(find(high.object3d).visible).toBe(true);
    high.applyQuality?.({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 });
    expect(find(high.object3d).visible).toBe(false);

    const mid = createSmokeScene();
    await mid.create({ ...ctx(), tierConfig: TIER_CONFIGS.mid });
    expect(find(mid.object3d).visible).toBe(false);
  });
});
