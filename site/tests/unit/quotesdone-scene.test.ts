/**
 * Scene 4, QuotesDone "Sealed": contract, determinism, identity of the five plates, RTL mirroring,
 * disposal, and the brand rules (no textures beyond the procedural studio, no teal or gold,
 * Rhodamine only as emitted light). Runs in Node without WebGL (envMap null).
 */
import { describe, expect, it, vi } from 'vitest';
import { Color, type Material, type Mesh, type Object3D, type Texture } from 'three';
import { ALLOY, COVER, NAMES, RHODAMINE, createQuotesDoneScene } from '../../src/three/scenes/quotesdone/index.ts';
import { PLATE_COUNT, SEALED_PARAMS } from '../../src/three/scenes/quotesdone/params.ts';
import { chosenIndexFor, easeSeat, easeTravel, sealedPose, segment } from '../../src/three/scenes/quotesdone/timeline.ts';
import { faceDirection, studioRadiance } from '../../src/three/scenes/quotesdone/studio.ts';
import { kelvinToRgb } from '../../src/three/scenes/quotesdone/color.ts';
import type { SceneContext, Viewport } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger } from '../../src/lib/log.ts';

const ctx = (tier: keyof typeof TIER_CONFIGS = 'high'): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS[tier],
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});
const view = (dir: 'ltr' | 'rtl' = 'ltr', aspect = 0.93): Viewport => ({ width: 836, height: 900, aspect, dir, pixelRatio: 2 });

function snapshot(root: Object3D): number[] {
  root.updateMatrixWorld(true);
  const values: number[] = [];
  root.traverse((o) => {
    values.push(...o.matrixWorld.elements, o.visible ? 1 : 0);
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      const m = mesh.material as Material & { color?: Color; envMapIntensity?: number };
      if (m.color) values.push(m.color.r, m.color.g, m.color.b);
      if (typeof m.envMapIntensity === 'number') values.push(m.envMapIntensity);
    }
  });
  return values;
}

async function built(dir: 'ltr' | 'rtl' = 'ltr', tier: keyof typeof TIER_CONFIGS = 'high') {
  const scene = createQuotesDoneScene();
  await scene.create(ctx(tier));
  scene.resize(view(dir));
  return scene;
}

describe('quotesdone scene: contract', () => {
  it('implements the §6.2 members, with bounded and described params', async () => {
    const scene = createQuotesDoneScene();
    expect(scene.id).toBe('quotesdone');
    expect(scene.stillAt.length).toBeGreaterThan(0);
    for (const [name, p] of Object.entries(scene.params)) {
      expect(p.min, name).toBeLessThanOrEqual(p.value);
      expect(p.max, name).toBeGreaterThanOrEqual(p.value);
      expect(p.description.length, name).toBeGreaterThan(0);
    }
    await scene.create(ctx());
    scene.dispose();
  });

  it('keeps its beats in order', () => {
    const v = (k: keyof typeof SEALED_PARAMS) => SEALED_PARAMS[k].value;
    expect(v('splitStart')).toBeLessThan(v('splitEnd'));
    expect(v('alignStart')).toBeLessThan(v('alignEnd'));
    expect(v('alignEnd')).toBeLessThanOrEqual(v('sweepStart'));
    expect(v('sweepEnd')).toBeLessThanOrEqual(v('advanceStart'));
    expect(v('advanceStart')).toBeLessThan(v('advanceEnd'));
    expect(v('coverStart')).toBeLessThan(v('coverEnd'));
    expect(v('datumStart')).toBeLessThan(v('datumEnd'));
    expect(v('datumEnd')).toBeLessThanOrEqual(1);
  });

  it('update(progress, time) is deterministic and order-independent', async () => {
    const scene = await built();
    scene.update(0.71, 4321);
    const first = snapshot(scene.object3d);
    scene.update(0.95, 98765);
    scene.update(0, 0);
    scene.update(0.33, 12);
    scene.update(0.71, 4321);
    expect(snapshot(scene.object3d)).toEqual(first);

    const other = await built();
    other.update(0.71, 4321);
    expect(snapshot(other.object3d)).toEqual(first);
    scene.dispose();
    other.dispose();
  });

  it('every beat changes the frame', async () => {
    const scene = await built();
    const frames = [0, 0.15, 0.3, 0.5, 0.65, 0.78, 0.9].map((p) => {
      scene.update(p, 0);
      return snapshot(scene.object3d);
    });
    for (let i = 1; i < frames.length; i++) expect(frames[i], `beat ${i}`).not.toEqual(frames[i - 1]);
    scene.dispose();
  });

  it('survives bad input without NaN', async () => {
    const scene = await built();
    for (const p of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY]) {
      scene.update(p, 0);
      for (const n of snapshot(scene.object3d)) expect(Number.isFinite(n)).toBe(true);
    }
    scene.dispose();
  });
});

describe('quotesdone scene: the story', () => {
  const pose = (p: number, dir: 'ltr' | 'rtl' = 'ltr') => sealedPose(p, 0, SEALED_PARAMS, dir, 0.93);

  it('starts as one block: plates share x and touch front to back', () => {
    const { plates } = pose(0);
    const pitch = SEALED_PARAMS.plateDepth.value + SEALED_PARAMS.trackDepth.value + SEALED_PARAMS.jointGap.value;
    for (let i = 0; i < PLATE_COUNT; i++) {
      expect(plates[i]!.x).toBeCloseTo(0, 6);
      if (i > 0) expect(plates[i]!.z - plates[i - 1]!.z).toBeCloseTo(pitch, 6);
    }
  });

  it('aligns into an evenly spaced row, all sealed and equally lit', () => {
    const { plates } = pose(0.5);
    for (let i = 1; i < PLATE_COUNT; i++) {
      expect(plates[i]!.x - plates[i - 1]!.x).toBeCloseTo(SEALED_PARAMS.rowSpacing.value, 6);
      expect(plates[i]!.z).toBeCloseTo(0, 6);
    }
    for (const plate of plates) {
      expect(plate.cover).toBe(0);
      expect(plate.brightness).toBe(1);
    }
  });

  it('opens exactly one plate; the others dim and fall back', () => {
    const { plates, chosen, datum } = pose(1);
    expect(datum).toBeCloseTo(1, 6);
    plates.forEach((plate, i) => {
      if (i === chosen) {
        expect(plate.cover).toBeCloseTo(1, 6);
        expect(plate.brightness).toBe(1);
        expect(plate.z).toBeGreaterThan(0);
      } else {
        expect(plate.cover).toBe(0);
        expect(plate.brightness).toBeLessThan(SEALED_PARAMS.dimFactor.value + 1e-9);
        expect(plate.z).toBeLessThan(0);
      }
    });
  });

  it('RTL mirrors the row and puts the opened plate on the mirrored side', () => {
    const ltr = pose(1, 'ltr');
    const rtl = pose(1, 'rtl');
    expect(rtl.chosen).toBe(chosenIndexFor(SEALED_PARAMS));
    for (let i = 0; i < PLATE_COUNT; i++) expect(rtl.plates[i]!.x).toBeCloseTo(-ltr.plates[i]!.x, 6);
    expect(rtl.plates[rtl.chosen]!.x).toBeCloseTo(-ltr.plates[ltr.chosen]!.x, 6);
    expect(rtl.camera.position[0]).toBeCloseTo(-ltr.camera.position[0], 6);
  });

  it('a narrow stage pulls the camera back instead of cropping the row', () => {
    const wide = sealedPose(0.5, 0, SEALED_PARAMS, 'ltr', 1.8);
    const narrow = sealedPose(0.5, 0, SEALED_PARAMS, 'ltr', 0.6);
    const dist = (c: typeof wide.camera) => Math.hypot(...c.position.map((x, i) => x - c.target[i]!));
    expect(dist(narrow.camera)).toBeGreaterThan(dist(wide.camera));
  });

  it('easing helpers hit their ends', () => {
    expect(easeTravel(0)).toBe(0);
    expect(easeTravel(1)).toBe(1);
    expect(easeSeat(0)).toBe(0);
    expect(easeSeat(1)).toBe(1);
    expect(segment(0.5, 0.2, 0.8)).toBeCloseTo(0.5);
    expect(segment(0.1, 0.5, 0.5)).toBe(0);
    expect(segment(0.6, 0.5, 0.5)).toBe(1);
  });
});

describe('quotesdone scene: identical plates', () => {
  it('the five plates share one body, cover and engraving geometry, with equal materials at rest', async () => {
    const scene = await built();
    scene.update(0.5, 0);
    const parts = (i: number) => ({
      body: scene.object3d.getObjectByName(NAMES.body(i)) as Mesh,
      cover: scene.object3d.getObjectByName(NAMES.cover(i)) as Mesh,
      engraving: scene.object3d.getObjectByName(NAMES.engraving(i)) as Mesh,
    });
    const first = parts(0);
    for (let i = 1; i < PLATE_COUNT; i++) {
      const p = parts(i);
      expect(p.body.geometry).toBe(first.body.geometry);
      expect(p.cover.geometry).toBe(first.cover.geometry);
      expect(p.engraving.geometry).toBe(first.engraving.geometry);
      type Physical = Material & { color: Color; roughness: number };
      const a = p.body.material as Physical;
      const b = first.body.material as Physical;
      expect(a.color.equals(b.color)).toBe(true);
      expect(a.roughness).toBe(b.roughness);
    }
    scene.dispose();
  });
});

describe('quotesdone scene: brand and resource rules', () => {
  const isTealOrGold = (c: Color) => {
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    const hue = hsl.h * 360;
    return hsl.s > 0.25 && ((hue > 160 && hue < 200) || (hue > 35 && hue < 60));
  };

  it('uses no image textures, no sprites, and no teal or gold anywhere', async () => {
    const scene = await built();
    scene.update(1, 0);
    scene.object3d.traverse((o) => {
      expect((o as { isSprite?: boolean }).isSprite, o.name).not.toBe(true);
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as Material & Record<string, unknown>;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'bumpMap']) {
        expect(m[key] ?? null, `${o.name}.${key}`).toBeNull();
      }
      const color = m.color as Color | undefined;
      if (color) expect(isTealOrGold(color), `${o.name} colour`).toBe(false);
    });
    for (const c of [ALLOY, COVER, RHODAMINE]) expect(isTealOrGold(c)).toBe(false);
    scene.dispose();
  });

  it('Rhodamine appears only on unlit (emitted light) materials', async () => {
    const scene = await built();
    scene.update(1, 0);
    const rhodHue = (() => {
      const h = { h: 0, s: 0, l: 0 };
      RHODAMINE.getHSL(h);
      return h.h;
    })();
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as Material & { color?: Color; type: string };
      const uniforms = (m as unknown as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      const colors = [m.color, uniforms?.uColor?.value].filter((c): c is Color => c instanceof Color);
      for (const c of colors) {
        const h = { h: 0, s: 0, l: 0 };
        c.getHSL(h);
        if (h.s > 0.5 && Math.abs(h.h - rhodHue) < 0.03) expect(['MeshBasicMaterial', 'ShaderMaterial'], o.name).toContain(m.type);
      }
    });
    scene.dispose();
  });

  it('dispose frees every geometry, material and texture it created, once', async () => {
    const scene = await built();
    scene.update(0.9, 0); // the filament is attached to the chosen plate here
    const geometries = new Set<{ dispose(): void }>();
    const materials = new Set<{ dispose(): void }>();
    const textures = new Set<Texture>();
    scene.object3d.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      const m = mesh.material as Material & { envMap?: Texture | null };
      materials.add(m);
      if (m.envMap) textures.add(m.envMap);
    });
    const spies = [...geometries, ...materials, ...textures].map((r) => vi.spyOn(r, 'dispose'));
    // 4 shared plate geometries + shadow + filament + floor datum + pool = 8; studio cube = 1 texture.
    expect(geometries.size).toBeGreaterThanOrEqual(8);
    expect(textures.size).toBe(1);
    scene.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    expect(scene.object3d.parent).toBeNull();
  });

  it('contact shadows follow tier and ladder', async () => {
    const shadows = (root: Object3D) => [...Array(PLATE_COUNT).keys()].map((i) => root.getObjectByName(NAMES.shadow(i))!.visible);
    const high = await built('ltr', 'high');
    expect(shadows(high.object3d).every(Boolean)).toBe(true);
    high.applyQuality?.({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 });
    expect(shadows(high.object3d).some(Boolean)).toBe(false);
    const mid = await built('ltr', 'mid');
    expect(shadows(mid.object3d).some(Boolean)).toBe(false);
    high.dispose();
    mid.dispose();
  });
});

describe('quotesdone studio and colour helpers', () => {
  it('cube face directions are unit vectors pointing out of their face', () => {
    const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    axes.forEach((axis, face) => {
      const d = faceDirection(face, 7, 7, 16);
      expect(Math.hypot(...d)).toBeCloseTo(1, 6);
      expect(d[0] * axis[0]! + d[1] * axis[1]! + d[2] * axis[2]!).toBeGreaterThan(0.9);
    });
  });

  it('the softbox is far brighter than the walls, and the floor is darkest', () => {
    const options = {
      size: 16,
      ambientTop: 0.03,
      ambientFloor: 0.01,
      lights: [{ dir: [0, 0.5, 1] as [number, number, number], halfWidth: 0.5, halfHeight: 0.3, soft: 0.1, radiance: 5 }],
    };
    const n = Math.hypot(0, 0.5, 1);
    expect(studioRadiance([0, 0.5 / n, 1 / n], options)).toBeGreaterThan(4);
    expect(studioRadiance([0, 0, -1], options)).toBeLessThan(0.05);
    expect(studioRadiance([0, -1, 0], options)).toBeLessThan(studioRadiance([0, 1, 0], options));
  });

  it('colour temperature: warm is red-heavy, cool is blue-heavy, max channel is 1', () => {
    const warm = kelvinToRgb(3000);
    const cool = kelvinToRgb(9000);
    expect(warm[0]).toBe(1);
    expect(warm[2]).toBeLessThan(warm[0]);
    expect(cool[2]).toBe(1);
    expect(Math.max(...kelvinToRgb(5200))).toBeCloseTo(1, 6);
  });
});
