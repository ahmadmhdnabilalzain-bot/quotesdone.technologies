/**
 * Capability detection -> tier. Pure decision function (`decideTier`) plus a browser probe
 * (`detectCapabilities`) that uses a raw canvas, so three.js is never loaded just to decide.
 *
 * Missing signals are NEUTRAL: iOS Safari exposes no deviceMemory and masks the GPU string
 * ("Apple GPU"), so an iPhone 13 must land on 'mid' without either of them.
 */
import type { Tier } from './tier-types.ts';

export interface Capabilities {
  webgl2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB (Chromium only); undefined when not exposed. */
  deviceMemoryGb: number | undefined;
  /** navigator.hardwareConcurrency; undefined when not exposed. */
  cores: number | undefined;
  /** Unmasked or masked GPU renderer string; undefined when not exposed. */
  gpuRenderer: string | undefined;
  /** Device class from UA + pointer + screen size. */
  formFactor: 'phone' | 'tablet' | 'desktop';
}

export interface TierDecision {
  tier: Tier;
  /** Human-readable reasons, shown in the HUD and logs, so a wrong pick is easy to explain. */
  reasons: string[];
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render driver|microsoft basic/i;

export function decideTier(caps: Capabilities, forced: Tier | null = null): TierDecision {
  if (forced !== null) return { tier: forced, reasons: [`forced by ?tier=${forced}`] };

  const stillReasons: string[] = [];
  if (!caps.webgl2) stillReasons.push('no WebGL2');
  if (caps.reducedMotion) stillReasons.push('prefers-reduced-motion');
  if (caps.saveData) stillReasons.push('Save-Data');
  if (caps.gpuRenderer !== undefined && SOFTWARE_GPU.test(caps.gpuRenderer)) {
    // A CPU rasteriser cannot hold a scroll-driven scene; stills are kinder than a stutter.
    stillReasons.push(`software renderer (${caps.gpuRenderer})`);
  }
  if (stillReasons.length > 0) return { tier: 'still', reasons: stillReasons };

  if (caps.deviceMemoryGb !== undefined && caps.deviceMemoryGb < 4) {
    return { tier: 'low', reasons: [`deviceMemory ${caps.deviceMemoryGb} GB < 4`] };
  }

  if (caps.formFactor === 'phone') {
    if (caps.cores !== undefined && caps.cores <= 2) return { tier: 'low', reasons: [`phone with ${caps.cores} cores`] };
    return { tier: 'mid', reasons: ['phone'] };
  }
  if (caps.formFactor === 'tablet') return { tier: 'mid', reasons: ['tablet'] };

  if (caps.cores !== undefined && caps.cores < 4) return { tier: 'mid', reasons: [`desktop with ${caps.cores} cores`] };
  return { tier: 'high', reasons: ['desktop'] };
}

export interface FormFactorInput {
  userAgent: string;
  coarsePointer: boolean;
  /** Shorter screen side in CSS px. */
  shortSidePx: number;
  maxTouchPoints: number;
}

/** UA + pointer + size. iPadOS reports a Mac UA, so touch points decide there. */
export function classifyFormFactor(input: FormFactorInput): Capabilities['formFactor'] {
  const ua = input.userAgent;
  if (/iPhone|iPod/.test(ua) || /Android.+Mobile/.test(ua)) return 'phone';
  if (/iPad|Android/.test(ua)) return 'tablet';
  if (/Macintosh/.test(ua) && input.maxTouchPoints > 1) return 'tablet';
  if (input.coarsePointer) return input.shortSidePx < 600 ? 'phone' : 'tablet';
  return 'desktop';
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Probe the browser. Creates and immediately releases one WebGL2 context. */
export function detectCapabilities(win: Window = window): Capabilities {
  const nav = win.navigator as Navigator & NavigatorExtras;
  const probe = probeWebGL2(win.document);
  return {
    webgl2: probe.ok,
    reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData === true,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : undefined,
    gpuRenderer: probe.renderer,
    formFactor: classifyFormFactor({
      userAgent: nav.userAgent,
      coarsePointer: win.matchMedia('(pointer: coarse)').matches,
      shortSidePx: Math.min(win.screen.width, win.screen.height),
      maxTouchPoints: nav.maxTouchPoints ?? 0,
    }),
  };
}

function probeWebGL2(doc: Document): { ok: boolean; renderer: string | undefined } {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { ok: false, renderer: undefined };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: undefined };
  }
}
