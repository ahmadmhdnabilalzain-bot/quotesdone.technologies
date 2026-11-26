/**
 * glTF loading with the meshopt decoder served from OUR origin (/decoders/, copied from the
 * pinned three package by scripts/copy-decoders.mjs). Never a CDN (structure-v1 §3.6).
 *
 * Status at M0: no .glb exists yet (logo.glb arrives with scripts/geo-logo.mjs in M1), so this
 * module is type-checked but not exercised by any test. It is not imported by mount.ts, so it
 * costs nothing in the bundle until a scene imports it.
 */
import { PerspectiveCamera, type WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createLogger } from '../../lib/log.ts';

const log = createLogger('3d:loader');

/** The decoder shape GLTFLoader expects (taken from its own typings, so they cannot drift). */
type MeshoptDecoderLike = NonNullable<Parameters<GLTFLoader['setMeshoptDecoder']>[0]>;

let decoder: Promise<MeshoptDecoderLike> | null = null;

function decoderUrl(): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/decoders/meshopt_decoder.module.js`;
}

/** Loads the decoder once. It embeds its WebAssembly, so the CSP needs 'wasm-unsafe-eval'. */
export function meshoptDecoder(): Promise<MeshoptDecoderLike> {
  decoder ??= (async () => {
    const module = (await import(/* @vite-ignore */ decoderUrl())) as { MeshoptDecoder: MeshoptDecoderLike };
    await module.MeshoptDecoder.ready;
    if (!module.MeshoptDecoder.supported) throw new Error('meshopt decoder: WebAssembly not supported');
    return module.MeshoptDecoder;
  })();
  return decoder;
}

export async function loadGlb(url: string, renderer: WebGLRenderer): Promise<GLTF> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(await meshoptDecoder());
  const started = performance.now();
  const gltf = await loader.loadAsync(url);
  log.info(`${url} loaded in ${Math.round(performance.now() - started)} ms`);
  // Upload now (off the scroll path) instead of on first draw.
  await renderer.compileAsync(gltf.scene, gltf.cameras[0] ?? new PerspectiveCamera());
  return gltf;
}
