/**
 * Scene 1 'Assembly' (src/three/scenes/logo): contract, determinism, dispose, the Rhodamine rule,
 * the rest/dock frames landing on the DOM boxes, the joint seal, and the glb pipeline.
 * Runs in Node on the REAL public/3d/logo.glb (decoded with three's meshopt decoder), no WebGL.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Color, Light, Mesh, Vector3, type Material, type Object3D, type PerspectiveCamera } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createLogoScene, explodeOffset, LAYER_WORDMARK } from '../../src/three/scenes/logo/index.ts';
import { parseLogoGlb, type LogoAsset } from '../../src/three/scenes/logo/parts.ts';
import { LOGO_PARAMS } from '../../src/three/scenes/logo/params.ts';
import { explodeAt, poseAt, sealForWidth } from '../../src/three/scenes/logo/choreography.ts';
import { fallbackLayout, publishLogoLayout, resetLogoLayout, resolveLogoLayout, WORDMARK_VIEWBOX } from '../../src/three/scenes/logo/layout.ts';
import { displayed, hexToSrgb, inverseAgx } from '../../src/three/scenes/logo/agx.ts';
import type { SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';

const GLB = fileURLToPath(new URL('../../public/3d/logo.glb', import.meta.url));
const STROKES = fileURLToPath(new URL('../../../brand/logo/final/strokes.json', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/geo-logo.mjs', import.meta.url));
const strokes = JSON.parse(readFileSync(STROKES, 'utf8')) as { strokes: Array<{ id: string; order: number; bbox: number[] }> };

async function loadAsset(): Promise<LogoAsset> {
  await MeshoptDecoder.ready;
  const bytes = readFileSync(GLB);
  return parseLogoGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, MeshoptDecoder);
}

const ctx = (): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS.high,
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view: Viewport = { width: 1440, height: 900, aspect: 1.6, dir: 'ltr', pixelRatio: 2 };

async function makeScene() {
  const scene = createLogoScene({ loadAsset });
  await scene.create(ctx());
  scene.resize(view);
  return scene;
}

function snapshot(root: Object3D): number[] {
  root.updateMatrixWorld(true);
  const values: number[] = [];
  root.traverse((o) => values.push(...o.matrixWorld.elements));
  return values;
}

/** Project a wordmark-local point (SVG px, y down) to stage CSS px. */
function toScreen(scene: { object3d: Object3D; camera: PerspectiveCamera | unknown }, x: number, y: number): [number, number] {
  const wordmark = scene.object3d.getObjectByName('wordmark')!;
  wordmark.updateMatrixWorld(true);
  const camera = scene.camera as PerspectiveCamera;
  const v = new Vector3(x, -y, 0).applyMatrix4(wordmark.matrixWorld).project(camera);
  return [((v.x + 1) / 2) * view.width, ((1 - v.y) / 2) * view.height];
}

describe('logo.glb pipeline', () => {
  it('is up to date with strokes.json (same check as `npm run geo:check`)', () => {
    expect(() => execFileSync(process.execPath, [SCRIPT, '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('has 43 parts named by stroke id whose silhouettes equal the strokes.json bboxes', async () => {
    const asset = await loadAsset();
    expect(asset.parts).toHaveLength(43);
    for (const part of asset.parts) {
      const source = strokes.strokes.find((s) => s.id === part.id)!;
      expect(source, part.id).toBeDefined();
      expect(part.order).toBe(source.order);
      const bb = part.geometry.boundingBox!;
      const [x, y, w, h] = source.bbox as [number, number, number, number];
      // bevelOffset = -bevelSize: the front silhouette never grows past the outline.
      expect(Math.abs(bb.min.x + part.pivot[0] - x), part.id).toBeLessThan(0.1);
      expect(Math.abs(part.pivot[1] - bb.max.y - y), part.id).toBeLessThan(0.1);
      expect(Math.abs(bb.max.x - bb.min.x - w), part.id).toBeLessThan(0.1);
      expect(Math.abs(bb.max.y - bb.min.y - h), part.id).toBeLessThan(0.1);
      expect(bb.max.z).toBeLessThan(0.05); // front face at z = 0
      expect(bb.min.z).toBeLessThan(-1);
    }
  });

  it('finds joints only on line 1 (line 2 is fused), symmetric per pair', async () => {
    const asset = await loadAsset();
    const line2 = asset.parts.filter((p) => p.line === 'TECHNOLOGIES');
    expect(line2.every((p) => p.joints.length === 0)).toBe(true);
    const pairs = new Map<string, number>();
    for (const p of asset.parts) for (const j of p.joints) pairs.set([p.id, j.with].sort().join('|'), (pairs.get([p.id, j.with].sort().join('|')) ?? 0) + 1);
    expect(pairs.size).toBeGreaterThan(8);
    for (const [pair, count] of pairs) expect(count, pair).toBe(2);
  });
});

describe('choreography (pure)', () => {
  const P = LOGO_PARAMS;
  it('params are in bounds and the marks are ordered', () => {
    for (const [name, p] of Object.entries(P)) {
      expect(p.min, name).toBeLessThanOrEqual(p.value);
      expect(p.max, name).toBeGreaterThanOrEqual(p.value);
    }
    const marks = [P.pSwap, P.pMachineEnd, P.pReseatStart, P.pReseatEnd, P.pDockEnd, P.pHide].map((m) => m.value);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  });

  it('rest frame is flat and front-on; the end frame is flat, docked and hidden', () => {
    expect(poseAt(0, P)).toMatchObject({ depth: 0, lit: 0, rake: 0, dock: 0, leaders: 0, visible: true });
    const docked = poseAt(P.pDockEnd.value, P);
    expect(docked.dock).toBe(1);
    expect(docked.depth).toBe(0);
    expect(docked.lit).toBe(0);
    expect(docked.visible).toBe(true);
    expect(poseAt(1, P).visible).toBe(false);
  });

  it('every part is seated at rest and after the re-seat, and out during the hold', () => {
    const hold = (P.pExplodeEnd.value + P.pReseatStart.value) / 2;
    for (let order = 0; order < 43; order++) {
      expect(explodeAt(0, order, 43, P)).toBe(0);
      expect(explodeAt(P.pReseatEnd.value, order, 43, P)).toBe(0);
      expect(explodeAt(hold, order, 43, P)).toBeGreaterThan(0.99);
    }
  });

  it('joints close around the 480 px rendered width (structure-v1 §2.2.2)', () => {
    expect(sealForWidth(960, P)).toBe(0);
    expect(sealForWidth(P.sealWidthPx.value + P.sealBandPx.value, P)).toBe(0);
    expect(sealForWidth(480, P)).toBeCloseTo(0.5, 5);
    expect(sealForWidth(P.sealWidthPx.value - P.sealBandPx.value, P)).toBe(1);
    expect(sealForWidth(211, P)).toBe(1);
  });

  it('explode offsets translate only, line 2 recedes, line-1 parts come forward', () => {
    const l1 = explodeOffset({ order: 4, line: 'QUOTESDONE', explode: [0, -1], joints: [{ x: 0, y: 0, nx: 0, ny: -1, with: 'x' }] }, P);
    expect(l1.y).toBeGreaterThan(0); // y-down -1 = up
    expect(l1.z).toBeGreaterThan(0);
    const l2 = explodeOffset({ order: 30, line: 'TECHNOLOGIES', explode: [0, 0], joints: [] }, P);
    expect(l2.x).toBe(0);
    expect(l2.y).toBe(0);
    expect(l2.z).toBeLessThan(0);
  });
});

describe('AgX calibration', () => {
  it('displays the flat Alloy exactly (the swap and the dock are invisible)', () => {
    const { linear, error255 } = inverseAgx('#ECEAE4');
    expect(error255).toBeLessThan(0.5);
    displayed(linear).forEach((c, i) => expect(Math.round(c * 255)).toBe(Math.round(hexToSrgb('#ECEAE4')[i]! * 255)));
  });
});

describe('layout', () => {
  it('uses the DOM measurement only for the matching stage size', () => {
    resetLogoLayout();
    expect(resolveLogoLayout(1440, 900).source).toBe('fallback');
    const fb = fallbackLayout(1440, 900);
    publishLogoLayout({ stageWidth: 1440, stageHeight: 900, hero: fb.hero, datum: fb.datum, dock: fb.dock });
    expect(resolveLogoLayout(1440, 900).source).toBe('dom');
    expect(resolveLogoLayout(1280, 800).source).toBe('fallback');
    resetLogoLayout();
  });
});

describe('logo scene contract', () => {
  beforeAll(() => resetLogoLayout());

  it('builds 43 named meshes on the wordmark layer', async () => {
    const scene = await makeScene();
    const meshes: Mesh[] = [];
    scene.object3d.traverse((o) => {
      if ((o as Mesh).isMesh && o.name.startsWith('wl-')) meshes.push(o as Mesh);
    });
    expect(meshes.map((m) => m.name).sort()).toEqual(strokes.strokes.map((s) => s.id).sort());
    expect(meshes.every((m) => m.layers.isEnabled(LAYER_WORDMARK))).toBe(true);
    scene.dispose();
  });

  it('update(progress, time) is deterministic and order-independent', async () => {
    const scene = await makeScene();
    for (const p of [0, 0.3, 0.6, 0.9]) {
      scene.update(p, 1234);
      const first = snapshot(scene.object3d);
      scene.update(0.77, 98765);
      scene.update(0.1, 0);
      scene.update(p, 1234);
      expect(snapshot(scene.object3d)).toEqual(first);
    }
    const other = await makeScene();
    scene.update(0.45, 500);
    other.update(0.45, 500);
    expect(snapshot(other.object3d)).toEqual(snapshot(scene.object3d));
    scene.dispose();
    other.dispose();
  });

  it('rest frame lands on the hero box and the dock frame on the header box (within 0.5 px)', async () => {
    const scene = await makeScene();
    const layout = fallbackLayout(view.width, view.height);
    scene.update(0, 0);
    const [x0, y0] = toScreen(scene, 0, 0);
    const [x1, y1] = toScreen(scene, WORDMARK_VIEWBOX.width, WORDMARK_VIEWBOX.height);
    expect(Math.abs(x0 - layout.hero.x)).toBeLessThan(0.5);
    expect(Math.abs(y0 - layout.hero.y)).toBeLessThan(0.5);
    expect(Math.abs(x1 - (layout.hero.x + layout.hero.width))).toBeLessThan(0.5);
    expect(Math.abs(y1 - (layout.hero.y + layout.hero.height))).toBeLessThan(0.5);

    scene.update(LOGO_PARAMS.pDockEnd.value, 0);
    const [dx0, dy0] = toScreen(scene, 0, 0);
    const [dx1, dy1] = toScreen(scene, WORDMARK_VIEWBOX.width, WORDMARK_VIEWBOX.height);
    expect(Math.abs(dx0 - layout.dock.x)).toBeLessThan(0.5);
    expect(Math.abs(dy0 - layout.dock.y)).toBeLessThan(0.5);
    expect(Math.abs(dx1 - (layout.dock.x + layout.dock.width))).toBeLessThan(0.5);
    expect(Math.abs(dy1 - (layout.dock.y + layout.dock.height))).toBeLessThan(0.5);
    scene.dispose();
  });

  it('Rhodamine never lights or tints the wordmark (structure-v1 §2.2.2)', async () => {
    const scene = await makeScene();
    const rhodamine = new Color('#E3185B');
    const isPink = (c: Color): boolean => c.r > c.g * 1.8 && c.r > c.b * 1.4 && c.r - c.g > 0.05;
    expect(isPink(rhodamine)).toBe(true); // the detector works
    const lights: Light[] = [];
    const materials = new Set<Material>();
    scene.object3d.traverse((o) => {
      if ((o as Light).isLight) lights.push(o as Light);
      const m = (o as Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => materials.add(x));
    });
    expect(lights.length).toBe(1);
    for (const light of lights) expect(Math.abs(light.color.r - light.color.g) + Math.abs(light.color.g - light.color.b)).toBeLessThan(1e-6);
    for (const material of materials) {
      for (const key of ['color', 'emissive'] as const) {
        const c = (material as unknown as Record<string, Color | undefined>)[key];
        if (c) expect(isPink(c), `${material.name}.${key}`).toBe(false);
      }
    }
    scene.dispose();
  });

  it('dispose frees every geometry and material it created', async () => {
    const scene = await makeScene();
    scene.update(0.5, 0);
    const disposals: Array<{ dispose: () => void }> = [];
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.geometry) disposals.push(mesh.geometry);
      const m = mesh.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => disposals.push(x));
    });
    const unique = [...new Set(disposals)];
    expect(unique.length).toBeGreaterThan(44); // 43 part geometries + leaders + 2 materials
    const spies = unique.map((d) => vi.spyOn(d, 'dispose'));
    scene.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    expect(scene.object3d.children).toHaveLength(0);
  });
});
