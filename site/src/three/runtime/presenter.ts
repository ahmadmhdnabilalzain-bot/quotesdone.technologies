/**
 * Presenter: draws the host's draw list into each slot's on-screen stage rectangle.
 * One fixed full-viewport canvas, many stages ("one canvas, many views"). Scenes are drawn one
 * after another into ONE shared half-float MSAA target (a sub-rectangle per stage), and each is
 * composited into its stage rect before the next one draws.
 *
 * Per stage (runtime/README.md "How the look is built"):
 *   1. main pass    scene -> shared MSAA target (linear HDR) + resolved depth (shared DepthTexture)
 *   2. signal pass  only meshes with signal materials re-draw into an RGBA8 mask target that uses
 *                   the SAME resolved depth, so they are occluded exactly (skipped without signals)
 *   3. AO pass      SAO from the resolved depth into a reduced-resolution buffer (skipped when off)
 *   4. composite    AgX for everything except signal pixels (direct sRGB), AO and vignette on the
 *                   non-signal part only, sRGB, premultiplied output, dither (structure-v1 §3.3)
 *
 * Memory (per pixel of the shared size): half-float MSAA x4 ~56 B (4 x (8 colour + 4 depth) + 8
 * resolve), resolved depth 4 B, signal mask 4 B, AO at half resolution ~1 B. The target is capped
 * at `TierConfig.maxTargetPixels`, so big stages render at a slightly lower internal resolution.
 *
 * Scenes render on a TRANSPARENT background and the composite outputs premultiplied alpha, so the
 * page's own CSS Carbon shows through the empty parts of a stage. Clearing to Carbon would put
 * Carbon through tone mapping and leave a visible seam around every stage.
 */
import {
  BufferGeometry,
  DepthTexture,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  Scene as ThreeScene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type WebGLRenderer,
} from 'three';
import type { DrawItem, SceneHost } from './scene.ts';
import type { TierConfig } from './tier-types.ts';
import type { QualityLevel } from './ladder.ts';
import { AO, BLOOM, POST, SIGNAL, resolveLook, type ResolvedLook } from './look.ts';
import { classifyScene, SIGNAL_LAYER, type SceneLookInfo } from './signal.ts';
import { AO_FRAGMENT, COMPOSITE_FRAGMENT, FULLSCREEN_VERTEX } from '../shaders/post.ts';
import { createLogger } from '../../lib/log.ts';

const log = createLogger('3d:presenter');

/** Stage rectangle in CSS pixels relative to the viewport (getBoundingClientRect). */
export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameInfo {
  drawCalls: number;
  triangles: number;
  drawn: number;
}

/** What the look did on the last frame, for the HUD and window.__qdt.dumpInfo(). */
export interface LookStats {
  ao: ResolvedLook['ao'];
  signalObjects: number;
  signalPasses: number;
  aoPasses: number;
}

type CameraWithProjection = Camera & { isOrthographicCamera?: boolean };

export class Presenter {
  private target: WebGLRenderTarget | null = null;
  private maskTarget: WebGLRenderTarget | null = null;
  private aoTarget: WebGLRenderTarget | null = null;
  private depthTexture: DepthTexture | null = null;
  /** Last CSS size + pixel ratio passed to each slot's resize(). */
  private readonly sizes = new Map<string, string>();
  private readonly postScene = new ThreeScene();
  private readonly postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postQuad: Mesh;
  private readonly compositeMaterial: ShaderMaterial;
  private readonly aoMaterial: ShaderMaterial;
  private readonly postGeometry: BufferGeometry;
  private renderScale = 1;
  private look: ResolvedLook;
  private clearedEmpty = false;
  private readonly refusedLogged = new Set<string>();
  private lastStats: LookStats = { ao: 'off', signalObjects: 0, signalPasses: 0, aoPasses: 0 };

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly tierConfig: TierConfig,
    private readonly dir: 'ltr' | 'rtl',
    /** Dev switches from ?look= (lib/flags.ts): 'noao', 'nosignal', or a view 'ao' | 'mask'. */
    private readonly lookFlags: readonly string[] = [],
  ) {
    this.look = resolveLook(tierConfig.tier === 'still' ? 'low' : tierConfig.tier);
    // One triangle that covers the screen (cheaper than a quad, no diagonal seam).
    this.postGeometry = new BufferGeometry();
    this.postGeometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.compositeMaterial = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tInput: { value: null },
        tMask: { value: null },
        tAo: { value: null },
        tDepth: { value: null },
        uUvScale: { value: new Vector2(1, 1) },
        uUvMax: { value: new Vector2(1, 1) },
        uAoUvScale: { value: new Vector2(1, 1) },
        uAoUvMax: { value: new Vector2(1, 1) },
        uAoTexel: { value: new Vector2(1, 1) },
        uAoOn: { value: 0 },
        uAoStrength: { value: AO.strength },
        uMaskOn: { value: 0 },
        uMaskGain: { value: SIGNAL.maskGain },
        uSignalLimit: { value: SIGNAL.limit },
        uVignette: { value: this.look.vignette },
        uVignetteRange: { value: new Vector2(POST.vignetteInner, POST.vignetteOuter) },
        uDither: { value: POST.ditherLsb },
        uView: { value: lookFlags.includes('ao') ? 1 : lookFlags.includes('mask') ? 2 : 0 },
        uBloom: { value: 0 },
        uBloomPx: { value: new Vector2(0, 0) },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending, // overwrite the (already cleared) stage rect with premultiplied output
      toneMapped: true, // gives the shader three's AgX `toneMapping()` and sRGB `linearToOutputTexel()`
    });
    this.aoMaterial = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: AO_FRAGMENT,
      uniforms: {
        tDepth: { value: null },
        uUvScale: { value: new Vector2(1, 1) },
        uUvMax: { value: new Vector2(1, 1) },
        uStagePx: { value: new Vector2(1, 1) },
        uProjInv: { value: null },
        uProjScale: { value: 1 },
        uOrtho: { value: 0 },
        uRadiusPx: { value: 8 },
        uIntensity: { value: AO.intensity },
        uBias: { value: AO.bias },
        uTurns: { value: AO.turns },
        uSamples: { value: AO.samplesFull },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
      toneMapped: false,
    });
    this.postQuad = new Mesh(this.postGeometry, this.compositeMaterial);
    this.postQuad.frustumCulled = false;
    this.postScene.add(this.postQuad);
  }

  setQuality(level: QualityLevel): void {
    this.renderScale = level.renderScale;
    this.look = resolveLook(this.tierConfig.tier === 'still' ? 'low' : this.tierConfig.tier, level);
    this.compositeMaterial.uniforms.uVignette!.value = this.look.vignette;
    this.sizes.clear(); // re-run resize() with the new pixel ratio
    this.releaseTarget(); // reallocate at the new scale on the next draw
  }

  /** The resolved look switches (tier caps x ladder) and what the last frame did. */
  lookStats(): LookStats {
    return { ...this.lastStats, ao: this.look.ao };
  }

  /** Canvas CSS size; the GL y origin is the canvas bottom. */
  private canvasHeight(): number {
    return this.renderer.domElement.clientHeight || window.innerHeight;
  }

  /**
   * Draw one frame. `stageRect` reads the slot's DOM stage (at most two reads per frame).
   * Returns counts for the HUD. Scene update/resize run inside the host's error boundary.
   */
  draw(items: DrawItem[], host: SceneHost, timeMs: number, stageRect: (slotId: string) => StageRect | null): FrameInfo {
    const renderer = this.renderer;
    renderer.info.reset();

    if (items.length === 0) {
      if (!this.clearedEmpty) {
        renderer.setRenderTarget(null);
        renderer.setScissorTest(false);
        renderer.clear();
        this.clearedEmpty = true;
      }
      return { drawCalls: 0, triangles: 0, drawn: 0 };
    }
    this.clearedEmpty = false;

    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.clear();

    const canvasHeight = this.canvasHeight();
    const stats: LookStats = { ao: this.look.ao, signalObjects: 0, signalPasses: 0, aoPasses: 0 };
    let drawn = 0;
    for (const item of items) {
      const rect = stageRect(item.slotId);
      if (!rect || rect.width < 1 || rect.height < 1) continue;
      if (rect.y > canvasHeight || rect.y + rect.height < 0) continue;

      const { width, height, pixelRatio } = this.internalSize(rect);
      const sizeKey = `${Math.round(rect.width)}x${Math.round(rect.height)}@${pixelRatio.toFixed(3)}`;
      if (this.sizes.get(item.slotId) !== sizeKey) {
        this.sizes.set(item.slotId, sizeKey);
        host.safeResize(item.slotId, { width: rect.width, height: rect.height, aspect: rect.width / rect.height, dir: this.dir, pixelRatio });
      }
      if (!host.safeUpdate(item, timeMs)) continue;

      try {
        const info = classifyScene(item.scene.object3d);
        this.logRefused(item.slotId, info);
        const target = this.ensureTargets(width, height);

        // 1. Main pass.
        this.bindStage(target, width, height);
        renderer.clear();
        renderer.render(item.scene.object3d, item.scene.camera);

        // 2. Signal mask: only signal meshes, depth-tested against the resolved main depth.
        const useMask = this.look.signal && info.signalObjects > 0 && !this.lookFlags.includes('nosignal');
        if (useMask) {
          this.renderMask(item, info, width, height);
          stats.signalObjects += info.signalObjects;
          stats.signalPasses += 1;
        }

        // 3. Ambient occlusion.
        const useAo = this.look.ao !== 'off' && info.ao.enabled && !this.lookFlags.includes('noao');
        if (useAo) {
          this.renderAo(item.scene.camera as CameraWithProjection, info, width, height);
          stats.aoPasses += 1;
        }

        // 4. Composite into the stage rect on the canvas.
        renderer.setRenderTarget(null);
        const y = canvasHeight - (rect.y + rect.height); // GL origin is bottom-left
        renderer.setViewport(rect.x, y, rect.width, rect.height);
        renderer.setScissor(rect.x, y, rect.width, rect.height);
        renderer.setScissorTest(true);
        this.setComposite(target, width, height, useMask, useAo, info);
        this.postQuad.material = this.compositeMaterial;
        renderer.render(this.postScene, this.postCamera);
        renderer.setScissorTest(false);
        drawn += 1;
      } catch (error) {
        host.reportFailure(item.slotId, 'draw threw', error);
      }
    }
    renderer.setViewport(0, 0, this.renderer.domElement.clientWidth || window.innerWidth, canvasHeight);
    this.lastStats = stats;
    return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, drawn };
  }

  /** Forget a slot's size (it is resized again when it next draws). */
  releaseSlot(slotId: string): void {
    this.sizes.delete(slotId);
  }

  /** Free the shared targets (context loss, quality change). Recreated on the next draw. */
  releaseTarget(): void {
    this.target?.dispose();
    this.maskTarget?.dispose();
    this.aoTarget?.dispose();
    this.depthTexture?.dispose();
    this.target = null;
    this.maskTarget = null;
    this.aoTarget = null;
    this.depthTexture = null;
  }

  /** Estimated bytes of the shared targets: MSAA colour + depth + resolve, resolved depth, mask, AO. */
  estimateTargetBytes(): number {
    if (!this.target) return 0;
    const samples = Math.max(1, this.tierConfig.msaaSamples);
    const pixels = this.target.width * this.target.height;
    const main = pixels * (samples * 12 + 8);
    const depth = pixels * 4;
    const mask = this.maskTarget ? pixels * 4 : 0;
    const ao = this.aoTarget ? this.aoTarget.width * this.aoTarget.height * 4 : 0;
    return main + depth + mask + ao;
  }

  dispose(): void {
    this.releaseTarget();
    this.sizes.clear();
    this.compositeMaterial.dispose();
    this.aoMaterial.dispose();
    this.postGeometry.dispose();
  }

  // ---- passes ----

  private bindStage(target: WebGLRenderTarget, width: number, height: number): void {
    target.viewport.set(0, 0, width, height);
    target.scissor.set(0, 0, width, height);
    target.scissorTest = true;
    this.renderer.setRenderTarget(target);
  }

  private renderMask(item: DrawItem, info: SceneLookInfo, width: number, height: number): void {
    const renderer = this.renderer;
    const mask = this.ensureMaskTarget();
    this.bindStage(mask, width, height);
    renderer.clear(true, false, false); // keep the resolved main depth
    const camera = item.scene.camera;
    const savedMask = camera.layers.mask;
    const savedWrites = info.mixedPlain.map((m: Material) => m.colorWrite);
    // The resolved depth is ONE MSAA sample per pixel, the mask pass tests at the pixel centre: on
    // a tilted surface the two differ with one sign across the whole face. A small slope-scaled
    // bias toward the camera keeps the signal's own depth test passing (GL state, no recompile).
    const savedOffsets = info.signalMaterials.map((m) => [m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits] as const);
    camera.layers.set(SIGNAL_LAYER);
    for (const m of info.mixedPlain) m.colorWrite = false;
    info.signalMaterials.forEach((m, i) => {
      const [had, factor, units] = savedOffsets[i]!;
      m.polygonOffset = true;
      m.polygonOffsetFactor = (had ? factor : 0) - 1;
      m.polygonOffsetUnits = (had ? units : 0) - 4;
    });
    try {
      renderer.render(item.scene.object3d, camera);
    } finally {
      camera.layers.mask = savedMask;
      info.mixedPlain.forEach((m, i) => {
        m.colorWrite = savedWrites[i] ?? true;
      });
      info.signalMaterials.forEach((m, i) => {
        const saved = savedOffsets[i]!;
        m.polygonOffset = saved[0];
        m.polygonOffsetFactor = saved[1];
        m.polygonOffsetUnits = saved[2];
      });
    }
  }

  private renderAo(camera: CameraWithProjection, info: SceneLookInfo, width: number, height: number): void {
    const target = this.target!;
    const aw = Math.max(1, Math.round(width * AO.scale));
    const ah = Math.max(1, Math.round(height * AO.scale));
    const aoTarget = this.ensureAoTarget(aw, ah);
    const u = this.aoMaterial.uniforms;
    u.tDepth!.value = this.depthTexture;
    (u.uUvScale!.value as Vector2).set(width / target.width, height / target.height);
    (u.uUvMax!.value as Vector2).set((width - 0.5) / target.width, (height - 0.5) / target.height);
    (u.uStagePx!.value as Vector2).set(width, height);
    u.uProjInv!.value = camera.projectionMatrixInverse;
    // Pixels per world unit at view depth 1 (perspective) or absolute (orthographic).
    u.uProjScale!.value = Math.abs(camera.projectionMatrix.elements[5]!) * 0.5 * height;
    u.uOrtho!.value = camera.isOrthographicCamera ? 1 : 0;
    u.uRadiusPx!.value = (info.ao.radius ?? AO.radius) * height;
    u.uSamples!.value = this.look.aoSamples;
    aoTarget.viewport.set(0, 0, aw, ah);
    aoTarget.scissor.set(0, 0, aw, ah);
    aoTarget.scissorTest = true;
    this.renderer.setRenderTarget(aoTarget);
    this.postQuad.material = this.aoMaterial;
    this.renderer.render(this.postScene, this.postCamera);
  }

  private setComposite(target: WebGLRenderTarget, width: number, height: number, useMask: boolean, useAo: boolean, info: SceneLookInfo): void {
    const u = this.compositeMaterial.uniforms;
    u.tInput!.value = target.texture;
    u.tDepth!.value = this.depthTexture;
    (u.uUvScale!.value as Vector2).set(width / target.width, height / target.height);
    (u.uUvMax!.value as Vector2).set((width - 0.5) / target.width, (height - 0.5) / target.height);
    u.uMaskOn!.value = useMask ? 1 : 0;
    // Signal bloom: off by default (look.ts BLOOM), never in a scene with a wordmark material.
    const bloom = (this.look.bloom || this.lookFlags.includes('bloom')) && useMask && !info.hasWordmark;
    u.uBloom!.value = bloom ? BLOOM.strength : 0;
    (u.uBloomPx!.value as Vector2).set((BLOOM.radius * 6 * this.renderer.getPixelRatio()) / target.width, (BLOOM.radius * 6 * this.renderer.getPixelRatio()) / target.height);
    u.tMask!.value = useMask ? this.maskTarget!.texture : null;
    u.uAoOn!.value = useAo ? 1 : 0;
    if (useAo && this.aoTarget) {
      const ao = this.aoTarget;
      const aw = Math.max(1, Math.round(width * AO.scale));
      const ah = Math.max(1, Math.round(height * AO.scale));
      u.tAo!.value = ao.texture;
      (u.uAoUvScale!.value as Vector2).set(aw / ao.width, ah / ao.height);
      (u.uAoUvMax!.value as Vector2).set((aw - 0.5) / ao.width, (ah - 0.5) / ao.height);
      (u.uAoTexel!.value as Vector2).set(1 / ao.width, 1 / ao.height);
      u.uAoStrength!.value = info.ao.strength ?? AO.strength;
    } else {
      u.tAo!.value = null;
    }
  }

  private logRefused(slotId: string, info: SceneLookInfo): void {
    if (info.refused.length === 0 || this.refusedLogged.has(slotId)) return;
    this.refusedLogged.add(slotId);
    log.error(`${slotId}: wordmark material(s) asked to be signal, refused (Rhodamine never on the wordmark): ${info.refused.join(', ')}`);
  }

  // ---- targets ----

  /** Internal pixel size for a stage: DPR cap x ladder scale, then the tier's pixel cap. */
  private internalSize(rect: StageRect): { width: number; height: number; pixelRatio: number } {
    let pixelRatio = this.renderer.getPixelRatio() * this.renderScale;
    const pixels = rect.width * rect.height * pixelRatio * pixelRatio;
    if (pixels > this.tierConfig.maxTargetPixels) pixelRatio *= Math.sqrt(this.tierConfig.maxTargetPixels / pixels);
    return {
      width: Math.max(1, Math.round(rect.width * pixelRatio)),
      height: Math.max(1, Math.round(rect.height * pixelRatio)),
      pixelRatio,
    };
  }

  /** Grow-only shared target, so two stages of different sizes never reallocate every frame. */
  private ensureTargets(width: number, height: number): WebGLRenderTarget {
    if (this.target && this.target.width >= width && this.target.height >= height) return this.target;
    const newWidth = Math.max(width, this.target?.width ?? 0);
    const newHeight = Math.max(height, this.target?.height ?? 0);
    this.releaseTarget();
    // The main pass resolves its depth into this texture; the signal mask pass and AO read it.
    const depthTexture = new DepthTexture(newWidth, newHeight, UnsignedIntType);
    depthTexture.minFilter = NearestFilter;
    depthTexture.magFilter = NearestFilter;
    const target = new WebGLRenderTarget(newWidth, newHeight, {
      type: HalfFloatType,
      samples: this.tierConfig.msaaSamples,
      depthBuffer: true,
      depthTexture,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    this.target = target;
    this.depthTexture = depthTexture;
    log.debug(`shared target ${newWidth}x${newHeight} (msaa ${this.tierConfig.msaaSamples})`);
    return target;
  }

  private ensureMaskTarget(): WebGLRenderTarget {
    const main = this.target!;
    if (this.maskTarget) return this.maskTarget;
    const mask = new WebGLRenderTarget(main.width, main.height, {
      type: UnsignedByteType,
      depthBuffer: true,
      depthTexture: this.depthTexture,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    this.maskTarget = mask;
    return mask;
  }

  private ensureAoTarget(width: number, height: number): WebGLRenderTarget {
    if (this.aoTarget && this.aoTarget.width >= width && this.aoTarget.height >= height) return this.aoTarget;
    const w = Math.max(width, this.aoTarget?.width ?? 0);
    const h = Math.max(height, this.aoTarget?.height ?? 0);
    this.aoTarget?.dispose();
    this.aoTarget = new WebGLRenderTarget(w, h, {
      type: UnsignedByteType,
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    return this.aoTarget;
  }
}
