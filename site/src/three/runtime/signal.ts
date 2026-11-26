/**
 * Signal classification (runtime/README.md "Signal API").
 *
 * AgX cannot display Rhodamine #E3185B: its gamut compression pulls saturated reds toward
 * ~rgb(192, 66, 83). Rhodamine is LIGHT (structure-v1 §2.2), so the runtime lets a scene mark the
 * materials that ARE light as 'signal'. Their pixels bypass the AgX curve in the composite and are
 * written straight to sRGB (hue-preserving limit above 1), so #E3185B is displayed as #E3185B.
 *
 * API (set before create() resolves; read every frame, so toggling later also works):
 *   material.userData.signal = true     the whole material is light (unlit lines, dots, filaments)
 *   material.userData.wordmark = true   wordmark material: can NEVER be signal (structure-v1
 *                                       §2.2.2); a scene with one gets no signal bloom.
 *   object3d.userData.ao = false        opt the whole scene out of screen-space AO (linework)
 *   object3d.userData.ao = { strength, radius }   per-scene AO overrides (look.ts AO units)
 *
 * How the mask is made: signal meshes are put on SIGNAL_LAYER and re-drawn after the main pass
 * into a small RGBA8 target that shares the main pass's resolved depth, so they are occluded
 * exactly as in the main image. Only signal meshes re-draw (a few draw calls). The colour itself
 * stays in the main buffer, so fades, contact shadows and additive glows still apply.
 *
 * Lit materials with a Rhodamine EMISSIVE term (e.g. the Sonobolt weld) cannot opt in: the mask
 * is per material, so the whole surface would skip AgX. Their emissive stays tone-mapped.
 */
import type { Material, Object3D } from 'three';

/** A layer no scene uses (logo uses 1 for the wordmark). Enabled ON TOP of a mesh's own layers. */
export const SIGNAL_LAYER = 30;

export type MaterialRole = 'signal' | 'wordmark' | 'plain';

/** The role a material asks for. A wordmark material is never a signal, whatever else it says. */
export function materialRole(material: Material | null | undefined): MaterialRole {
  if (!material) return 'plain';
  const data = material.userData as { signal?: unknown; wordmark?: unknown } | undefined;
  if (data?.wordmark === true) return 'wordmark';
  if (data?.signal === true) return 'signal';
  return 'plain';
}

export interface AoOverride {
  enabled: boolean;
  strength?: number;
  radius?: number;
}

export interface SceneLookInfo {
  /** Renderable objects carrying at least one signal material (now on SIGNAL_LAYER). */
  signalObjects: number;
  /** Materials of signal objects that are NOT signal (multi-material meshes): colorWrite off in the replay. */
  mixedPlain: Material[];
  /** The signal materials themselves (the mask pass biases their depth slightly toward the camera). */
  signalMaterials: Material[];
  /** The scene has a wordmark material: no signal bloom anywhere in it. */
  hasWordmark: boolean;
  /** Materials that asked for signal AND wordmark (refused; logged by the presenter). */
  refused: string[];
  ao: AoOverride;
}

type Renderable = Object3D & { material?: Material | Material[] };

/**
 * Walk a scene: put signal objects on SIGNAL_LAYER (and take others off it), and report what the
 * presenter needs. Cheap enough to run every frame (a few hundred objects at most).
 */
export function classifyScene(root: Object3D): SceneLookInfo {
  const info: SceneLookInfo = { signalObjects: 0, mixedPlain: [], signalMaterials: [], hasWordmark: false, refused: [], ao: readAo(root) };
  root.traverse((object) => {
    const material = (object as Renderable).material;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    let signal = false;
    const plain: Material[] = [];
    for (const m of materials) {
      const role = materialRole(m);
      if (role === 'wordmark') {
        info.hasWordmark = true;
        if ((m.userData as { signal?: unknown }).signal === true) info.refused.push(m.name || m.type);
        plain.push(m);
      } else if (role === 'signal') {
        signal = true;
        if (!info.signalMaterials.includes(m)) info.signalMaterials.push(m);
      } else {
        plain.push(m);
      }
    }
    if (signal) {
      object.layers.enable(SIGNAL_LAYER);
      info.signalObjects += 1;
      info.mixedPlain.push(...plain);
    } else if (object.layers.isEnabled(SIGNAL_LAYER)) {
      object.layers.disable(SIGNAL_LAYER);
    }
  });
  return info;
}

function readAo(root: Object3D): AoOverride {
  const value = (root.userData as { ao?: unknown }).ao;
  if (value === false) return { enabled: false };
  if (value && typeof value === 'object') {
    const o = value as { strength?: unknown; radius?: unknown };
    return {
      enabled: true,
      strength: typeof o.strength === 'number' ? o.strength : undefined,
      radius: typeof o.radius === 'number' ? o.radius : undefined,
    };
  }
  return { enabled: true };
}

/**
 * The composite's per-pixel colour rule, in TypeScript (mirrors shaders/post.ts so it is tested):
 * signal pixels show their linear colour directly (hue-preserving limit), others go through the
 * tone curve. `toneMap` is AgX in the real pass.
 */
export function compositePixel(
  linear: readonly [number, number, number],
  mask: number,
  toneMap: (c: [number, number, number]) => [number, number, number],
  limit = 1,
): [number, number, number] {
  const m = Math.min(1, Math.max(0, mask));
  const tone = toneMap([linear[0], linear[1], linear[2]]);
  const peak = Math.max(linear[0], linear[1], linear[2]);
  const k = peak > limit ? limit / peak : 1;
  return [0, 1, 2].map((i) => tone[i]! * (1 - m) + linear[i]! * k * m) as [number, number, number];
}
