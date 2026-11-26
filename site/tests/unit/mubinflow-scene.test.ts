/**
 * Scene 6 (MubinFlow) contract tests, without WebGL. The animation lives in uniforms, visibility
 * and material state as much as in matrices, so the snapshot includes all of them.
 */
import { describe, expect, it, vi } from 'vitest';
import { Color, type Material, type Mesh, type Object3D, type ShaderMaterial } from 'three';
import { createMubinFlowScene } from '../../src/three/scenes/mubinflow/index.ts';
import { buildSegmentAttributes } from '../../src/three/scenes/mubinflow/draft-line.ts';
import { hatch, plateBox } from '../../src/three/scenes/mubinflow/sheet.ts';
import { payslipContent, seeded, type Layout } from '../../src/three/scenes/mubinflow/geometry.ts';
import { TIMELINE, indexTurn, stripPhases } from '../../src/three/scenes/mubinflow/timeline.ts';
import type { RenderableScene, SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';

const ctx = (): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS.high,
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view: Viewport = { width: 1168, height: 657, aspect: 1168 / 657, dir: 'ltr', pixelRatio: 2 };

async function make(): Promise<RenderableScene> {
  const scene = createMubinFlowScene();
  await scene.create(ctx());
  scene.resize(view);
  return scene;
}

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true;
}

/** Everything a frame depends on: transforms, visibility, line uniforms, solid material state, camera. */
function snapshot(scene: RenderableScene): unknown[] {
  scene.object3d.updateMatrixWorld(true);
  const values: unknown[] = [];
  scene.object3d.traverse((o) => {
    values.push(o.name, o.visible, ...o.matrixWorld.elements);
    if (!isMesh(o)) return;
    const m = o.material as Material & Partial<ShaderMaterial>;
    values.push(m.colorWrite, m.transparent, m.opacity);
    if (m.uniforms) for (const k of ['uDraw', 'uIntensity', 'uDistScale']) values.push(m.uniforms[k]?.value);
  });
  values.push(...scene.camera.projectionMatrix.elements);
  return values;
}

function byName(scene: RenderableScene, name: string): Mesh {
  const found = scene.object3d.getObjectByName(name);
  if (!found || !isMesh(found)) throw new Error(`no mesh ${name}`);
  return found;
}

function meshes(scene: RenderableScene, test: (m: Mesh) => boolean): Mesh[] {
  const out: Mesh[] = [];
  scene.object3d.traverse((o) => {
    if (isMesh(o) && test(o)) out.push(o);
  });
  return out;
}

describe('mubinflow scene contract', () => {
  it('implements the §6.2 members with bounded, described params', async () => {
    const scene = createMubinFlowScene();
    expect(scene.id).toBe('mubinflow');
    expect(scene.stillAt.length).toBeGreaterThan(0);
    for (const [name, p] of Object.entries(scene.params)) {
      expect(p.min, name).toBeLessThanOrEqual(p.value);
      expect(p.max, name).toBeGreaterThanOrEqual(p.value);
      expect(p.description.length, name).toBeGreaterThan(0);
    }
    expect(scene.params.maturity).toMatchObject({ value: 0, min: 0, max: 1 });
    await scene.create(ctx());
    scene.dispose();
  });

  it('update(progress, time) is deterministic, order-independent and ignores time', async () => {
    const scene = await make();
    scene.update(0.63, 1234);
    const first = snapshot(scene);
    scene.update(0.95, 98765);
    scene.update(0, 0);
    scene.update(0.2, 5);
    scene.update(0.63, 777777);
    expect(snapshot(scene)).toEqual(first);

    const other = await make();
    other.update(0.63, 1234);
    expect(snapshot(other)).toEqual(first);
    scene.dispose();
    other.dispose();
  });

  it('different progress gives a different frame at every beat', async () => {
    const scene = await make();
    const frames = [0.05, 0.25, 0.43, 0.55, 0.7, 0.83, 0.97].map((p) => {
      scene.update(p, 0);
      return JSON.stringify(snapshot(scene));
    });
    expect(new Set(frames).size).toBe(frames.length);
    scene.dispose();
  });

  it('the whole drawing is in place at the end, and the ring is drawn but empty of strips at the start', async () => {
    const scene = await make();
    scene.update(1, 0);
    for (const name of ['figure', 'trace-rule', 'trace-source', 'rule', 'source', 'plate', 'plate-ring', 'sheet-frame']) {
      const mesh = byName(scene, name);
      expect(mesh.visible, name).toBe(true);
      expect((mesh.material as ShaderMaterial).uniforms.uDraw!.value, name).toBe(1);
    }
    scene.update(0.1, 0);
    expect(scene.object3d.getObjectByName('strip-people')!.visible).toBe(false);
    expect(byName(scene, 'trace-rule').visible).toBe(false);
    scene.dispose();
  });

  it('maturity 0 is pure linework: solids write depth only, hidden lines and plate show', async () => {
    const scene = await make();
    scene.update(0.97, 0);
    const solids = meshes(scene, (m) => m.name.endsWith(':solid'));
    expect(solids.length).toBe(5);
    for (const s of solids) {
      const mat = s.material as Material;
      expect(mat.colorWrite, s.name).toBe(false);
      expect(mat.depthWrite, s.name).toBe(true);
    }
    for (const h of meshes(scene, (m) => m.name.endsWith(':hidden'))) expect(h.visible, h.name).toBe(true);
    expect(byName(scene, 'plate').visible).toBe(true);
    scene.dispose();
  });

  it('maturity 1 switches to solid Alloy: opaque solids, no hidden lines, no sheet, no plate', async () => {
    const scene = await make();
    scene.params.maturity!.value = 1;
    scene.update(0.97, 0);
    for (const s of meshes(scene, (m) => m.name.endsWith(':solid'))) {
      const mat = s.material as Material;
      expect(mat.colorWrite, s.name).toBe(true);
      expect(mat.transparent, s.name).toBe(false);
      expect(mat.opacity, s.name).toBe(1);
    }
    for (const h of meshes(scene, (m) => m.name.endsWith(':hidden'))) expect(h.visible, h.name).toBe(false);
    for (const n of ['plate', 'plate-ring', 'sheet-frame', 'centre-lines']) expect(byName(scene, n).visible, n).toBe(false);
    // The story (the traced figure) survives the launch.
    expect(byName(scene, 'trace-rule').visible).toBe(true);

    // Back to 0 equals a fresh scene: maturity holds no hidden state.
    scene.params.maturity!.value = 0;
    scene.update(0.97, 0);
    const fresh = await make();
    fresh.update(0.97, 0);
    expect(snapshot(scene)).toEqual(snapshot(fresh));
    scene.dispose();
    fresh.dispose();
  });

  it('Rhodamine is used only as light and status: the trace leaders and the open status ring', async () => {
    const scene = await make();
    const rhodamine = new Color('#E3185B');
    const red = meshes(scene, (m) => {
      const u = (m.material as ShaderMaterial).uniforms;
      return Boolean(u?.uColor && (u.uColor.value as Color).equals(rhodamine));
    }).map((m) => m.name);
    expect(red.sort()).toEqual(['plate-ring', 'trace-rule', 'trace-source']);
    scene.dispose();
  });

  it('RTL mirrors the drawing in one place and keeps solids double-sided', async () => {
    const scene = await make();
    scene.resize({ ...view, dir: 'rtl' });
    scene.update(0.9, 0);
    expect(scene.object3d.getObjectByName('mubinflow-root')!.scale.x).toBe(-1);
    for (const s of meshes(scene, (m) => m.name.endsWith(':solid'))) expect((s.material as Material).side).toBe(2);
    scene.dispose();
  });

  it('dispose frees every geometry and material, including the sheet rebuilt on resize', async () => {
    const scene = await make();
    const firstSheet = meshes(scene, (m) => m.name === 'sheet-frame')[0]!;
    const oldGeo = vi.spyOn(firstSheet.geometry, 'dispose');
    scene.resize({ ...view, width: 900, height: 506, aspect: 900 / 506 });
    expect(oldGeo).toHaveBeenCalledTimes(1);

    const spies: Array<ReturnType<typeof vi.fn>> = [];
    const seen = new Set<unknown>();
    scene.object3d.traverse((o) => {
      if (!isMesh(o)) return;
      for (const r of [o.geometry, o.material as Material]) {
        if (seen.has(r)) continue;
        seen.add(r);
        spies.push(vi.spyOn(r, 'dispose') as never);
      }
    });
    expect(spies.length).toBeGreaterThan(30);
    scene.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
  });
});

describe('mubinflow pure helpers', () => {
  it('segment attributes carry cumulative length and reveal spans', () => {
    const a = buildSegmentAttributes([
      { points: [0, 0, 0, 1, 0, 0, 1, 2, 0], reveal: [0.2, 0.8] },
      { points: [5, 5, 5] }, // a single point draws nothing
    ]);
    expect(a.count).toBe(2);
    expect([...a.dist]).toEqual([0, 1, 1, 3]);
    expect(a.reveal[0]).toBeCloseTo(0.2);
    expect(a.reveal[1]).toBeCloseTo(0.4);
    expect(a.reveal[3]).toBeCloseTo(0.8);
  });

  it('the plate hatch stays inside its field', () => {
    const lines = hatch(10, 0, 100, 30, 6);
    expect(lines.length).toBeGreaterThan(5);
    for (const l of lines) {
      for (let i = 0; i < l.length; i += 3) {
        expect(l[i]!).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(l[i]!).toBeLessThanOrEqual(100 + 1e-9);
        expect(l[i + 1]!).toBeGreaterThanOrEqual(-1e-9);
        expect(l[i + 1]!).toBeLessThanOrEqual(30 + 1e-9);
      }
    }
    const [x0, , x1] = plateBox({ width: 1168, height: 657, dirSign: 1 });
    expect(x1 - x0).toBeGreaterThan(100);
  });

  it('the ring indexes through detents and stops exactly on the month', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const t = indexTurn(p, 7);
      expect(t).toBeGreaterThanOrEqual(last - 1e-9);
      last = t;
    }
    expect(indexTurn(TIMELINE.index[0], 7)).toBe(0);
    expect(indexTurn(TIMELINE.index[1], 7)).toBe(7);
    expect(stripPhases(1, TIMELINE.people)).toEqual({ grow: 1, contents: 1 });
  });

  it('payslips are abstract and fixed: one traced figure, one not-computed row, same every build', () => {
    const l: Layout = {
      ringOuter: 1, ringInner: 0.7, ringHeight: 0.09, ringJoint: 0.024, extractDistance: 0.42,
      stripLength: 2.2, stripDepth: 0.56, stripThickness: 0.03, stripGap: 0.6, stripOffset: 0.3,
      rows: 8, tracedRow: 5, arcSteps: 12,
    };
    const a = payslipContent(l);
    const b = payslipContent(l);
    expect(a).toEqual(b);
    expect(a.rows.figure.x1).toBeGreaterThan(a.rows.figure.x0);
    expect(a.rows.notComputed.length).toBe(1);
    expect(seeded(3)()).toBe(seeded(3)());
  });
});
