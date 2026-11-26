/**
 * The runtime look (src/three/runtime/look.ts, environment.ts, signal.ts): the procedural studio
 * is deterministic, neutral and has real contrast; signal classification and the composite's
 * colour rule display Rhodamine exactly; the quality ladder resolves AO per tier and level.
 * Node only, no WebGL.
 */
import { describe, expect, it } from 'vitest';
import { Group, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, BoxGeometry } from 'three';
import { AO, STUDIO, resolveLook, ladderAo } from '../../src/three/runtime/look.ts';
import { bakeStudioFaces, faceDirection, studioRadiance } from '../../src/three/runtime/environment.ts';
import { classifyScene, compositePixel, materialRole, SIGNAL_LAYER } from '../../src/three/runtime/signal.ts';
import { LADDER } from '../../src/three/runtime/ladder.ts';
import { agx, hexToSrgb, linearToSrgb, srgbToLinear } from '../../src/three/shared/agx.ts';

const small = { ...STUDIO, size: 16 };

describe('procedural studio environment', () => {
  it('is deterministic: the same spec bakes the same bytes', () => {
    const a = bakeStudioFaces(small);
    const b = bakeStudioFaces(small);
    expect(a).toHaveLength(6);
    a.forEach((face, i) => expect(Buffer.from(face.buffer).equals(Buffer.from(b[i]!.buffer))).toBe(true));
  });

  it('is neutral: R = G = B in every texel (nothing can tint Alloy or carry Rhodamine)', () => {
    for (const face of bakeStudioFaces(small)) {
      for (let i = 0; i < face.length; i += 4) {
        expect(face[i]).toBe(face[i + 1]);
        expect(face[i]).toBe(face[i + 2]);
      }
    }
  });

  it('has real contrast: a bright key strip, dark walls and floor', () => {
    const key = studioRadiance(norm(STUDIO.panels[0]!.dir));
    const wall = studioRadiance([0, 0.3, -1].map((v) => v / Math.hypot(0, 0.3, -1)) as [number, number, number]);
    const floor = studioRadiance([0, -1, 0]);
    expect(key).toBeGreaterThan(5);
    expect(key / wall).toBeGreaterThan(50);
    expect(floor).toBeLessThan(0.05);
    // every texel is finite and non-negative
    for (let face = 0; face < 6; face++) {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const r = studioRadiance(faceDirection(face, x, y, 8));
        expect(Number.isFinite(r) && r >= 0).toBe(true);
      }
    }
  });

  it('a panel straight overhead still has a valid basis (no NaN)', () => {
    const spec = { ...small, panels: [{ name: 'top', dir: [0, 1, 0] as const, halfWidth: 0.5, halfHeight: 0.5, soft: 0.1, radiance: 3 }] };
    expect(studioRadiance([0, 1, 0], spec)).toBeGreaterThan(2.9);
  });
});

describe('signal classification', () => {
  it('reads material.userData.signal and never lets a wordmark material be a signal', () => {
    const plain = new MeshStandardMaterial();
    const signal = new MeshBasicMaterial({ userData: { signal: true } });
    const wordmark = new MeshStandardMaterial();
    wordmark.userData = { wordmark: true, signal: true };
    expect(materialRole(plain)).toBe('plain');
    expect(materialRole(signal)).toBe('signal');
    expect(materialRole(wordmark)).toBe('wordmark');
    expect(materialRole(null)).toBe('plain');
  });

  it('puts signal objects on SIGNAL_LAYER, keeps their own layers, and reports the scene', () => {
    const root = new Group();
    const geometry = new BoxGeometry();
    const body = new Mesh(geometry, new MeshStandardMaterial());
    const datum = new Mesh(geometry, new MeshBasicMaterial({ userData: { signal: true } }));
    datum.layers.enable(1);
    const mixed = new Mesh(geometry, [new MeshStandardMaterial(), new LineBasicMaterial({ userData: { signal: true } })]);
    const mark = new Mesh(geometry, Object.assign(new MeshStandardMaterial(), { userData: { wordmark: true, signal: true } }));
    root.add(body, datum, mixed, mark);
    root.userData.ao = { strength: 0.4 };

    const info = classifyScene(root);
    expect(info.signalObjects).toBe(2);
    expect(datum.layers.isEnabled(SIGNAL_LAYER)).toBe(true);
    expect(datum.layers.isEnabled(1)).toBe(true);
    expect(body.layers.isEnabled(SIGNAL_LAYER)).toBe(false);
    expect(mark.layers.isEnabled(SIGNAL_LAYER)).toBe(false);
    expect(info.mixedPlain).toHaveLength(1); // the standard material of the mixed mesh
    expect(info.hasWordmark).toBe(true);
    expect(info.refused).toHaveLength(1);
    expect(info.ao).toEqual({ enabled: true, strength: 0.4, radius: undefined });

    // Turning the flag off later takes the object off the layer on the next frame.
    (datum.material as MeshBasicMaterial).userData.signal = false;
    expect(classifyScene(root).signalObjects).toBe(1);
    expect(datum.layers.isEnabled(SIGNAL_LAYER)).toBe(false);

    root.userData.ao = false;
    expect(classifyScene(root).ao.enabled).toBe(false);
  });
});

describe('composite colour rule', () => {
  const rhodamine = hexToSrgb('#E3185B').map(srgbToLinear) as [number, number, number];
  const to255 = (c: [number, number, number]) => c.map((v) => Math.round(linearToSrgb(Math.min(1, Math.max(0, v))) * 255));

  it('through AgX, Rhodamine is NOT displayed (the problem this solves)', () => {
    const shown = to255(compositePixel(rhodamine, 0, agx));
    expect(Math.abs(shown[0]! - 227) + Math.abs(shown[1]! - 24) + Math.abs(shown[2]! - 91)).toBeGreaterThan(40);
  });

  it('a signal pixel displays #E3185B exactly', () => {
    expect(to255(compositePixel(rhodamine, 1, agx))).toEqual([227, 24, 91]);
  });

  it('above 1 the limit keeps the hue (scaled as a whole, never clamped per channel)', () => {
    const hot = rhodamine.map((v) => v * 3) as [number, number, number];
    const out = compositePixel(hot, 1, agx);
    expect(Math.max(...out)).toBeCloseTo(1, 6);
    expect(out[2]! / out[0]!).toBeCloseTo(rhodamine[2]! / rhodamine[0]!, 6);
  });

  it('non-signal pixels are unchanged: they still go through the tone curve', () => {
    const alloy = hexToSrgb('#ECEAE4').map(srgbToLinear) as [number, number, number];
    expect(compositePixel(alloy, 0, agx)).toEqual(agx(alloy));
  });
});

describe('look resolution (tier x ladder)', () => {
  it('high gets full AO, mid cheap, low none; signals on every tier', () => {
    expect(resolveLook('high')).toMatchObject({ ao: 'full', aoSamples: AO.samplesFull, signal: true });
    expect(resolveLook('mid')).toMatchObject({ ao: 'cheap', aoSamples: AO.samplesCheap, signal: true });
    expect(resolveLook('low')).toMatchObject({ ao: 'off', aoSamples: 0, signal: true, vignette: 0 });
  });

  it('the ladder steps AO down (full, cheap, cheap, off) and never above the tier cap', () => {
    expect(LADDER.map((l) => resolveLook('high', l).ao)).toEqual(['full', 'cheap', 'cheap', 'off']);
    expect(LADDER.map((l) => resolveLook('mid', l).ao)).toEqual(['cheap', 'cheap', 'cheap', 'off']);
    expect(LADDER.map((l) => resolveLook('low', l).ao)).toEqual(['off', 'off', 'off', 'off']);
  });

  it('older 4-field level literals still resolve (ao derived from the index)', () => {
    expect(ladderAo({ index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 })).toBe('cheap');
    expect(ladderAo({ index: 3, label: 'scale 0.7', contactShadow: false, renderScale: 0.7 })).toBe('off');
    expect(ladderAo(undefined)).toBe('full');
  });
});

function norm(v: readonly [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
