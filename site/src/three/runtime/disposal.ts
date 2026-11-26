/**
 * Disposal and memory accounting. renderer.info.memory only gives COUNTS, so the byte estimate
 * here sums buffer and texture sizes (structure-v1 §4.1, GPU memory row).
 */
import type { BufferGeometry, Material, Object3D, Texture } from 'three';

export interface DisposalReport {
  geometries: number;
  materials: number;
  textures: number;
}

function isMesh(object: Object3D): object is Object3D & { geometry?: BufferGeometry; material?: Material | Material[] } {
  return 'geometry' in object || 'material' in object;
}

function texturesOf(material: Material): Texture[] {
  const found: Texture[] = [];
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && (value as Texture).isTexture === true) found.push(value as Texture);
  }
  return found;
}

/** Free every geometry, material and texture under `root`. Shared resources are freed once. */
export function disposeObject3D(root: Object3D, keep: ReadonlySet<Texture> = new Set()): DisposalReport {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!isMesh(object)) return;
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const texture of texturesOf(material)) if (!keep.has(texture)) textures.add(texture);
    }
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  root.removeFromParent();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

/** Rough GPU bytes for buffers under `root` (textures are added by the presenter for its targets). */
export function estimateGeometryBytes(root: Object3D): number {
  const seen = new Set<BufferGeometry>();
  let bytes = 0;
  root.traverse((object) => {
    if (!isMesh(object) || !object.geometry || seen.has(object.geometry)) return;
    seen.add(object.geometry);
    const geometry = object.geometry;
    for (const attribute of Object.values(geometry.attributes)) {
      const array = (attribute as { array?: ArrayLike<number> & { byteLength?: number } }).array;
      bytes += array?.byteLength ?? 0;
    }
    bytes += (geometry.index?.array as { byteLength?: number } | undefined)?.byteLength ?? 0;
  });
  return bytes;
}
