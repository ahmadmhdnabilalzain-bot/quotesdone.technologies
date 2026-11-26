/**
 * The single WebGLRenderer for the page (structure-v1 §3.3). One canvas, one context.
 * Colour pipeline: scenes render linear HDR into a half-float target; the post pass
 * (presenter.ts) tone-maps (AgX), converts to sRGB and dithers on the way to the screen.
 */
import { AgXToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';
import type { TierConfig } from './tier-types.ts';
import { createLogger } from '../../lib/log.ts';

const log = createLogger('3d:renderer');

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  tierConfig: TierConfig;
  /** Shader compile checks (structure-v1 §6.6). Costly, so only with ?debug. */
  checkShaderErrors: boolean;
}

export function createRenderer({ canvas, tierConfig, checkShaderErrors }: RendererOptions): WebGLRenderer {
  // Throws when WebGL2 is unavailable; mount.ts catches it and keeps the stills.
  const renderer = new WebGLRenderer({
    canvas,
    // MSAA happens on the scene render target; the screen pass is a full-screen triangle.
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.debug.checkShaderErrors = checkShaderErrors;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.autoClear = false;
  // The presenter resets counters once per frame so the HUD sees scene + post together.
  renderer.info.autoReset = false;
  renderer.setClearColor(0x000000, 0);
  applyViewportSize(renderer, tierConfig);
  log.info(`created; dpr ${renderer.getPixelRatio()} (cap ${tierConfig.maxDpr}), tier ${tierConfig.tier}`);
  return renderer;
}

/**
 * Size the drawing buffer from the canvas's own CSS box (position: fixed; inset: 0), not from
 * innerWidth/innerHeight: on iOS those differ from 100vh/100vw while the address bar moves.
 * Call on window resize.
 */
export function applyViewportSize(renderer: WebGLRenderer, tierConfig: TierConfig): void {
  const canvas = renderer.domElement;
  const dpr = Math.min(window.devicePixelRatio || 1, tierConfig.maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
}

export interface ContextWatch {
  /** How many times the context was lost this visit. */
  readonly losses: number;
  stop(): void;
}

/**
 * Context-loss policy (structure-v1 §4.2): on loss, show stills; one restore attempt;
 * after a second loss, stills for the rest of the visit.
 */
export function watchContext(
  canvas: HTMLCanvasElement,
  handlers: { onLost: (losses: number) => void; onRestored: () => void },
): ContextWatch {
  let losses = 0;
  const lost = (event: Event): void => {
    losses += 1;
    log.warn(`WebGL context lost (${losses})`);
    // preventDefault allows the browser to restore the context; we only accept one restore.
    if (losses === 1) event.preventDefault();
    handlers.onLost(losses);
  };
  const restored = (): void => {
    if (losses > 1) return;
    log.warn('WebGL context restored; rebuilding scenes');
    handlers.onRestored();
  };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return {
    get losses() {
      return losses;
    },
    stop() {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    },
  };
}
