/**
 * logo.glb (scripts/geo-logo.mjs) -> 43 LogoParts with float geometry local to each part's pivot.
 * Split from the scene so unit tests parse the real glb in Node (no fetch, no WebGL).
 *
 * The glb is quantised (KHR_mesh_quantization): positions are int16 with a dequantising node
 * matrix. We bake that matrix into float attributes once, minus the pivot, so the scene can move
 * each part by setting a plain position. 12k triangles, so the float copy costs about 0.6 MB.
 */
import { BufferAttribute, BufferGeometry, Matrix4, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type LogoLine = 'QUOTESDONE' | 'TECHNOLOGIES';

export interface LogoJoint {
  /** Joint centre, SVG px of the wordmark viewBox, y down. */
  x: number;
  y: number;
  /** Unit normal from the neighbour into this part (y down). */
  nx: number;
  ny: number;
  /** Stroke id of the neighbour. */
  with: string;
}

export interface LogoPart {
  id: string;
  order: number;
  line: LogoLine;
  glyph: string;
  role: string;
  /** SVG px, y down. */
  pivot: [number, number];
  bbox: [number, number, number, number];
  /** Full bar depth incl. chamfers, SVG px. */
  depth: number;
  joints: LogoJoint[];
  /** Mean joint normal (y down), [0, 0] for parts without joints. */
  explode: [number, number];
  /** position, normal, _seal; local to the pivot, SVG px, y up, front face at z = 0. */
  geometry: BufferGeometry;
}

export interface LogoAsset {
  parts: LogoPart[];
  viewBox: [number, number, number, number];
  sourceHash: string;
}

type MeshoptDecoderLike = NonNullable<Parameters<GLTFLoader['setMeshoptDecoder']>[0]>;

interface PartExtras {
  id: string;
  order: number;
  line: LogoLine;
  glyph: string;
  role: string;
  pivot: [number, number];
  bbox: [number, number, number, number];
  depth: number;
  joints: LogoJoint[];
  explode: [number, number];
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

/** Copy any (quantised, normalised) attribute into a Float32 one; getX..getZ de-normalise. */
function toFloat(attribute: BufferAttribute, itemSize: number): BufferAttribute {
  const out = new Float32Array(attribute.count * itemSize);
  for (let i = 0; i < attribute.count; i++) {
    out[i * itemSize] = attribute.getX(i);
    if (itemSize > 1) out[i * itemSize + 1] = attribute.getY(i);
    if (itemSize > 2) out[i * itemSize + 2] = attribute.getZ(i);
  }
  return new BufferAttribute(out, itemSize);
}

export async function parseLogoGlb(data: ArrayBuffer, decoder: MeshoptDecoderLike): Promise<LogoAsset> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(decoder);
  const gltf = await loader.parseAsync(data, '');
  const assetExtras = (gltf.parser.json as { asset?: { extras?: { qdt?: { viewBox?: number[]; sourceHash?: string } } } }).asset?.extras?.qdt;

  const parts: LogoPart[] = [];
  const meshes: Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (isMesh(object)) meshes.push(object);
  });
  for (const mesh of meshes) {
    const extras = mesh.userData as Partial<PartExtras>;
    if (typeof extras.order !== 'number' || !extras.pivot || !extras.id) throw new Error(`logo.glb: mesh "${mesh.name}" has no part extras`);
    const source = mesh.geometry;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', toFloat(source.getAttribute('position') as BufferAttribute, 3));
    geometry.setAttribute('normal', toFloat(source.getAttribute('normal') as BufferAttribute, 3));
    const seal = source.getAttribute('_seal') as BufferAttribute | undefined;
    geometry.setAttribute('_seal', seal ? toFloat(seal, 2) : new BufferAttribute(new Float32Array(source.getAttribute('position').count * 2), 2));
    const index = source.getIndex();
    if (index) geometry.setIndex(new BufferAttribute(Uint32Array.from(index.array as ArrayLike<number>), 1));
    // World matrix = T(pivot) * dequantise; keep the dequantise part only.
    const local = new Matrix4().makeTranslation(-extras.pivot[0], extras.pivot[1], 0).multiply(mesh.matrixWorld);
    geometry.applyMatrix4(local);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    source.dispose();
    parts.push({
      id: extras.id,
      order: extras.order,
      line: extras.line ?? 'QUOTESDONE',
      glyph: extras.glyph ?? '',
      role: extras.role ?? '',
      pivot: extras.pivot,
      bbox: extras.bbox ?? [0, 0, 0, 0],
      depth: extras.depth ?? 0,
      joints: extras.joints ?? [],
      explode: extras.explode ?? [0, 0],
      geometry,
    });
  }
  parts.sort((a, b) => a.order - b.order);
  const vb = assetExtras?.viewBox ?? [0, 0, 4367.19, 796.8];
  return { parts, viewBox: [vb[0] ?? 0, vb[1] ?? 0, vb[2] ?? 4367.19, vb[3] ?? 796.8], sourceHash: assetExtras?.sourceHash ?? '' };
}
