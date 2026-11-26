/**
 * Presenter: draws the host's draw list into each slot's on-screen stage rectangle.
 * One fixed full-viewport canvas, many stages ("one canvas, many views"). Scenes are drawn one
 * after another into ONE shared half-float MSAA target (a sub-rectangle per stage), and each is
 * composited into its stage rect by the post pass before the next one draws: tone mapping (AgX),
 * sRGB output, an optional vignette and dithering (structure-v1 §3.3).
 *
 * Memory: a half-float MSAA target costs about 56 bytes per pixel (4 samples x (8 colour + 4 depth)
 * plus an 8-byte resolve). A full-bleed 1440x900 stage at DPR 2 would be ~290 MB, over the 192 MB
 * 'high' budget (§4.1), so the target is capped at `TierConfig.maxTargetPixels`: big stages render
 * at a slightly lower internal resolution, small stages keep the full DPR.
 *
 * Dithering runs AFTER the sRGB conversion: that is where 8-bit quantisation bands gradients,
 * so that is where the noise has to go.
 *
 * Scenes render on a TRANSPARENT background and the post pass outputs premultiplied alpha, so
 * the page's own CSS Carbon shows through the empty parts of a stage. Clearing to Carbon would
 * put Carbon through tone mapping and leave a visible seam around every stage.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  NoBlending,
  OrthographicCamera,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { DrawItem, SceneHost } from './scene.ts';
import type { TierConfig } from './tier-types.ts';
import type { QualityLevel } from './ladder.ts';
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

const POST_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAGMENT = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uUvScale;   // the stage's sub-rectangle of the shared target
  uniform float uVignette;
  varying vec2 vUv;

  // Triangular-PDF dither, +-1 LSB at 8 bits. Hash from gl_FragCoord so it is stable per pixel.
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec4 color = texture2D(tInput, vUv * uUvScale);   // linear, premultiplied (NormalBlending into a cleared target)
    float alpha = clamp(color.a, 0.0, 1.0);
    vec3 straight = alpha > 0.0 ? color.rgb / alpha : vec3(0.0);
    // Soft optical vignette: darkens only the far corners of the object, never the page.
    vec2 centered = vUv - 0.5;
    straight *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(centered));
    gl_FragColor = vec4(straight, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    float noise = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 17.17) - 1.0;
    vec3 dithered = gl_FragColor.rgb + noise / 255.0;
    gl_FragColor = vec4(dithered * alpha, alpha);   // canvas is premultipliedAlpha: true
  }
`;

export class Presenter {
  private target: WebGLRenderTarget | null = null;
  /** Last CSS size + pixel ratio passed to each slot's resize(). */
  private readonly sizes = new Map<string, string>();
  private readonly postScene = new ThreeScene();
  private readonly postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postMaterial: ShaderMaterial;
  private readonly postGeometry: BufferGeometry;
  private renderScale = 1;
  private clearedEmpty = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly tierConfig: TierConfig,
    private readonly dir: 'ltr' | 'rtl',
  ) {
    // One triangle that covers the screen (cheaper than a quad, no diagonal seam).
    this.postGeometry = new BufferGeometry();
    this.postGeometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.postMaterial = new ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tInput: { value: null },
        uUvScale: { value: new Vector2(1, 1) },
        uVignette: { value: tierConfig.vignette ? 0.22 : 0 },
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending, // overwrite the (already cleared) stage rect with premultiplied output
      toneMapped: true,
    });
    const quad = new Mesh(this.postGeometry, this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  setQuality(level: QualityLevel): void {
    this.renderScale = level.renderScale;
    this.sizes.clear(); // re-run resize() with the new pixel ratio
    this.releaseTarget(); // reallocate at the new scale on the next draw
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
        const target = this.ensureTarget(width, height);
        target.viewport.set(0, 0, width, height);
        target.scissor.set(0, 0, width, height);
        target.scissorTest = true;
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(item.scene.object3d, item.scene.camera);

        renderer.setRenderTarget(null);
        const y = canvasHeight - (rect.y + rect.height); // GL origin is bottom-left
        renderer.setViewport(rect.x, y, rect.width, rect.height);
        renderer.setScissor(rect.x, y, rect.width, rect.height);
        renderer.setScissorTest(true);
        this.postMaterial.uniforms.tInput!.value = target.texture;
        (this.postMaterial.uniforms.uUvScale!.value as Vector2).set(width / target.width, height / target.height);
        renderer.render(this.postScene, this.postCamera);
        renderer.setScissorTest(false);
        drawn += 1;
      } catch (error) {
        host.reportFailure(item.slotId, 'draw threw', error);
      }
    }
    renderer.setViewport(0, 0, this.renderer.domElement.clientWidth || window.innerWidth, canvasHeight);
    return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, drawn };
  }

  /** Forget a slot's size (it is resized again when it next draws). */
  releaseSlot(slotId: string): void {
    this.sizes.delete(slotId);
  }

  /** Free the shared target (context loss, quality change). Recreated on the next draw. */
  releaseTarget(): void {
    this.target?.dispose();
    this.target = null;
  }

  /** Estimated bytes of the shared target: samples x (8 colour + 4 depth) + 8 resolve, per pixel. */
  estimateTargetBytes(): number {
    if (!this.target) return 0;
    const samples = Math.max(1, this.tierConfig.msaaSamples);
    return this.target.width * this.target.height * (samples * 12 + 8);
  }

  dispose(): void {
    this.releaseTarget();
    this.sizes.clear();
    this.postMaterial.dispose();
    this.postGeometry.dispose();
  }

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
  private ensureTarget(width: number, height: number): WebGLRenderTarget {
    if (this.target && this.target.width >= width && this.target.height >= height) return this.target;
    const newWidth = Math.max(width, this.target?.width ?? 0);
    const newHeight = Math.max(height, this.target?.height ?? 0);
    this.releaseTarget();
    const target = new WebGLRenderTarget(newWidth, newHeight, {
      type: HalfFloatType,
      samples: this.tierConfig.msaaSamples,
      depthBuffer: true,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    this.target = target;
    log.debug(`shared target ${newWidth}x${newHeight} (msaa ${this.tierConfig.msaaSamples})`);
    return target;
  }
}
