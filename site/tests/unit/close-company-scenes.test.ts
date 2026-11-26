/**
 * Scenes 7 (company) and 8 (close): the §6.2 contract without WebGL (determinism, dispose),
 * plus the brand rules: the Q comes from mark.svg byte for byte, it is never Rhodamine, the
 * datum never reaches the mark, and the close ends fully faded (alpha) for the footer.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, Color, type Light, type Material, type Mesh, type Object3D, type ShaderMaterial } from 'three';
import { createCloseScene, CLOSE_NAMES } from '../../src/three/scenes/close/index.ts';
import { createCompanyScene, COMPANY_NAMES } from '../../src/three/scenes/company/index.ts';
import { CLOSE_PARAMS } from '../../src/three/scenes/close/params.ts';
import { COMPANY_PARAMS } from '../../src/three/scenes/company/params.ts';
import { MARK_SVG_TEXT, MARK_TAIL_SVG } from '../../src/three/scenes/close/mark.ts';
import type { RenderableScene, SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';
import { parsePathsForTest } from './helpers/svg-path.ts';

const ctx = (tier: 'high' | 'mid' = 'high'): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS[tier],
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view: Viewport = { width: 1440, height: 860, aspect: 1440 / 860, dir: 'ltr', pixelRatio: 2 };
const RHODAMINE = new Color('#E3185B');

const factories: Array<[string, () => RenderableScene]> = [
  ['close', () => createCloseScene({ parseSvg: parsePathsForTest })],
  ['company', () => createCompanyScene()],
];

function snapshot(scene: RenderableScene): number[] {
  scene.object3d.updateMatrixWorld(true);
  scene.camera.updateMatrixWorld(true);
  const values: number[] = [...scene.camera.matrixWorld.elements, ...scene.camera.projectionMatrix.elements];
  scene.object3d.traverse((o) => {
    values.push(...o.matrixWorld.elements, o.visible ? 1 : 0);
    const m = (o as Mesh).material as Material | undefined;
    if (m && !Array.isArray(m)) {
      values.push(m.opacity);
      const u = (m as ShaderMaterial).uniforms;
      if (u) for (const v of Object.values(u)) if (typeof v.value === 'number') values.push(v.value);
    }
  });
  return values;
}

async function built(make: () => RenderableScene, v: Viewport = view): Promise<RenderableScene> {
  const s = make();
  await s.create(ctx());
  s.resize(v);
  return s;
}

describe.each(factories)('%s scene contract', (id, make) => {
  it('implements §6.2 with bounded, described params', async () => {
    const scene = make();
    expect(scene.id).toBe(id);
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
    const a = await built(make);
    a.update(0.37, 1234);
    const first = snapshot(a);
    a.update(0.95, 99999);
    a.update(0, 0);
    a.update(0.37, 1234);
    expect(snapshot(a)).toEqual(first);
    // Time is not an input to either scene: a quiet frame holds still at rest.
    a.update(0.37, 777777);
    expect(snapshot(a)).toEqual(first);

    const b = await built(make);
    b.update(0.37, 1234);
    expect(snapshot(b)).toEqual(first);
    a.dispose();
    b.dispose();
  });

  it('progress changes the frame, and junk input is clamped', async () => {
    const s = await built(make);
    s.update(0.1, 0);
    const early = snapshot(s);
    s.update(0.6, 0);
    expect(snapshot(s)).not.toEqual(early);
    s.update(Number.NaN, 0);
    const nan = snapshot(s);
    s.update(0, 0);
    expect(nan).toEqual(snapshot(s));
    s.dispose();
  });

  it('dispose frees every geometry and material exactly once', async () => {
    const s = await built(make);
    const geometries = new Set<{ dispose(): void }>();
    const materials = new Set<{ dispose(): void }>();
    s.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const list = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      list.forEach((m) => materials.add(m));
    });
    const spies = [...geometries, ...materials].map((r) => vi.spyOn(r, 'dispose'));
    expect(spies.length).toBeGreaterThanOrEqual(8);
    s.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(s.object3d.parent).toBeNull();
  });

  it('only neutral lights (Rhodamine is never a light source)', async () => {
    const s = await built(make);
    s.object3d.traverse((o) => {
      const light = o as Light;
      if (!light.isLight) return;
      const c = light.color;
      // Neutral or slightly cool: no channel dominates red.
      expect(c.r, o.type).toBeLessThanOrEqual(Math.max(c.g, c.b) + 1e-6);
    });
    s.dispose();
  });
});

describe('close: the Q end cap', () => {
  it('mark.svg is an unmodified copy of the brand master', () => {
    const master = readFileSync(fileURLToPath(new URL('../../../brand/logo/final/mark.svg', import.meta.url)), 'utf8');
    expect(MARK_SVG_TEXT).toBe(master);
    // The tail constant matches the outline (one horizontal edge at each of these y values).
    expect(master).toContain('L676.26 625.91L676.26 557.61');
    expect(MARK_TAIL_SVG).toBeCloseTo(68.3, 5);
  });

  it('is seated on the line: baseline y = 0, tail tip x = 0, tail as thick as the rail', async () => {
    const s = await built(() => createCloseScene({ parseSvg: parsePathsForTest }));
    s.update(1, 0);
    s.object3d.updateMatrixWorld(true); // Box3.setFromObject does not update parents
    const mark = s.object3d.getObjectByName(CLOSE_NAMES.mark)!;
    const box = new Box3().setFromObject(mark);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect(box.max.x).toBeCloseTo(0, 4);
    const height = box.max.y - box.min.y;
    // Mark height / tail thickness from the SVG: (625.91 - 173.3) / 68.3 ~ 6.63.
    expect(height / CLOSE_PARAMS.railHeight.value).toBeGreaterThan(6.4);
    expect(height / CLOSE_PARAMS.railHeight.value).toBeLessThan(6.8);
    // Front faces point at the camera (+Z): a flipped winding would put them at -Z.
    const geo = (mark as Mesh).geometry;
    const n = geo.getAttribute('normal');
    let towardCamera = 0;
    for (let i = 0; i < n.count; i++) if (n.getZ(i) > 0.9) towardCamera++;
    expect(towardCamera).toBeGreaterThan(10);
    s.dispose();
  });

  it('starts lifted and seats by seatEnd', async () => {
    const s = await built(() => createCloseScene({ parseSvg: parsePathsForTest }));
    const pivot = s.object3d.getObjectByName(CLOSE_NAMES.markPivot)!;
    s.update(0, 0);
    expect(pivot.position.y).toBeCloseTo(CLOSE_PARAMS.liftHeight.value, 5);
    s.update(CLOSE_PARAMS.seatEnd.value, 0);
    expect(pivot.position.y).toBeCloseTo(0, 6);
    expect(pivot.rotation.y).toBeCloseTo(0, 6);
    s.dispose();
  });

  it('the mark is never Rhodamine, and the datum stops short of it and is out once seated', async () => {
    const s = await built(() => createCloseScene({ parseSvg: parsePathsForTest }));
    s.update(1, 0);
    s.object3d.updateMatrixWorld(true);
    const mark = s.object3d.getObjectByName(CLOSE_NAMES.mark) as Mesh;
    const markMat = mark.material as Material & { color: Color; emissive?: Color };
    expect(markMat.color.equals(RHODAMINE)).toBe(false);
    expect(markMat.emissive?.getHex() ?? 0).toBe(0);
    const datum = s.object3d.getObjectByName(CLOSE_NAMES.datum) as Mesh;
    const markBox = new Box3().setFromObject(mark);
    const datumBox = new Box3().setFromObject(datum);
    expect(markBox.min.x - datumBox.max.x).toBeGreaterThanOrEqual(CLOSE_PARAMS.datumClearance.value - 1e-6);
    s.update(CLOSE_PARAMS.datumOutEnd.value, 0);
    expect(datum.visible).toBe(false);
    s.update(0, 0);
    expect(datum.visible).toBe(true);
    s.dispose();
  });

  it('fades to transparent (page Carbon) at progress 1, and draws no fade before fadeStart', async () => {
    const s = await built(() => createCloseScene({ parseSvg: parsePathsForTest }));
    const fade = s.object3d.getObjectByName('fade-pass') as Mesh;
    s.update(CLOSE_PARAMS.fadeStart.value - 0.01, 0);
    expect(fade.visible).toBe(false);
    s.update(1, 0);
    expect(fade.visible).toBe(true);
    expect((fade.material as ShaderMaterial).uniforms.uFade!.value).toBeCloseTo(1, 6);
    s.dispose();
  });

  it('RTL mirrors the line but never the mark', async () => {
    const s = await built(() => createCloseScene({ parseSvg: parsePathsForTest }), { ...view, dir: 'rtl' });
    s.update(1, 0);
    const mark = s.object3d.getObjectByName(CLOSE_NAMES.mark)!;
    mark.updateWorldMatrix(true, false);
    expect(mark.matrixWorld.determinant()).toBeGreaterThan(0);
    s.dispose();
  });

  it('the contact shadow follows tier and ladder', async () => {
    const mid = createCloseScene({ parseSvg: parsePathsForTest });
    await mid.create(ctx('mid'));
    mid.resize(view);
    mid.update(1, 0);
    expect(mid.object3d.getObjectByName('contact-shadow')!.visible).toBe(false);
    const high = await built(() => createCloseScene({ parseSvg: parsePathsForTest }));
    high.update(0.6, 0);
    expect(high.object3d.getObjectByName('contact-shadow')!.visible).toBe(true);
    high.applyQuality?.({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 });
    high.update(0.6, 0);
    expect(high.object3d.getObjectByName('contact-shadow')!.visible).toBe(false);
    mid.dispose();
    high.dispose();
  });
});

describe('company: the line from a distance', () => {
  it('has every dock, the products first and empty docks after, status drawn not written', async () => {
    const s = await built(() => createCompanyScene());
    const kinds: string[] = [];
    for (let i = 0; i < COMPANY_PARAMS.stationCount.value; i++) {
      kinds.push(String(s.object3d.getObjectByName(COMPANY_NAMES.dock(i))!.userData.kind));
    }
    expect(kinds.slice(0, 3)).toEqual(['quotesdone', 'sonobolt', 'mubinflow']);
    expect(kinds.slice(3).every((k) => k === 'empty')).toBe(true);
    // In development = linework only: the MubinFlow dock holds no Alloy surface.
    const mf = s.object3d.getObjectByName(COMPANY_NAMES.dock(2))!;
    const lines: Object3D[] = [];
    mf.traverse((o) => {
      if ((o as { isLineSegments?: boolean }).isLineSegments) lines.push(o);
    });
    expect(lines.length).toBe(1);
    s.dispose();
  });

  it('the datum dims to a hairline and the camera pulls back', async () => {
    const s = await built(() => createCompanyScene());
    const datum = s.object3d.getObjectByName(COMPANY_NAMES.datum)!;
    s.update(0, 0);
    const near = s.camera.position.length();
    const thick = datum.scale.y;
    s.update(1, 0);
    // A hairline: thinner than at the start, never under ~1 device pixel (clamped, then dimmed).
    expect(datum.scale.y).toBeLessThan(thick);
    expect(datum.scale.y).toBeGreaterThanOrEqual(COMPANY_PARAMS.datumHairline.value);
    const mat = (datum as Mesh).material as Material;
    expect(mat.opacity).toBeLessThanOrEqual(COMPANY_PARAMS.datumHairlineOpacity.value + 1e-9);
    expect(s.camera.position.distanceTo(s.object3d.position)).toBeGreaterThan(near);
    s.dispose();
  });

  it('shares the rail profile with the close scene (one line)', () => {
    for (const k of ['railHeight', 'railDepth', 'railChamfer'] as const) {
      expect(COMPANY_PARAMS[k].value, k).toBe(CLOSE_PARAMS[k].value);
    }
  });
});
