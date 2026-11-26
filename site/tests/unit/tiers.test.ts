import { describe, expect, it } from 'vitest';
import { classifyFormFactor, decideTier, type Capabilities } from '../../src/three/runtime/tiers.ts';

const IPHONE_13_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const MAC_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

/** iPhone 13 as Safari reports it: no deviceMemory, masked GPU string, 390x844 screen. */
const iphone13: Capabilities = {
  webgl2: true,
  reducedMotion: false,
  saveData: false,
  deviceMemoryGb: undefined,
  cores: 4,
  gpuRenderer: 'Apple GPU',
  formFactor: classifyFormFactor({ userAgent: IPHONE_13_UA, coarsePointer: true, shortSidePx: 390, maxTouchPoints: 5 }),
};

const desktop: Capabilities = {
  webgl2: true,
  reducedMotion: false,
  saveData: false,
  deviceMemoryGb: 16,
  cores: 10,
  gpuRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
  formFactor: classifyFormFactor({ userAgent: MAC_CHROME_UA, coarsePointer: false, shortSidePx: 900, maxTouchPoints: 0 }),
};

describe('classifyFormFactor', () => {
  it('iPhone 13 UA is a phone', () => expect(iphone13.formFactor).toBe('phone'));
  it('desktop Chrome is a desktop', () => expect(desktop.formFactor).toBe('desktop'));
  it('iPadOS (Mac UA + touch points) is a tablet', () => {
    expect(classifyFormFactor({ userAgent: MAC_CHROME_UA, coarsePointer: true, shortSidePx: 820, maxTouchPoints: 5 })).toBe('tablet');
  });
  it('Android phone vs tablet', () => {
    expect(classifyFormFactor({ userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-A556B) Mobile Safari', coarsePointer: true, shortSidePx: 384, maxTouchPoints: 5 })).toBe('phone');
    expect(classifyFormFactor({ userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-X710) Safari', coarsePointer: true, shortSidePx: 800, maxTouchPoints: 5 })).toBe('tablet');
  });
});

describe('decideTier', () => {
  it('iPhone 13 is mid, without deviceMemory or an unmasked GPU string', () => {
    expect(decideTier(iphone13).tier).toBe('mid');
  });

  it('a capable desktop is high (desktop-first design target)', () => {
    expect(decideTier(desktop).tier).toBe('high');
  });

  it('no WebGL2, reduced motion or Save-Data all mean still', () => {
    expect(decideTier({ ...desktop, webgl2: false }).tier).toBe('still');
    expect(decideTier({ ...desktop, reducedMotion: true }).tier).toBe('still');
    expect(decideTier({ ...iphone13, saveData: true }).tier).toBe('still');
  });

  it('a software rasteriser (SwiftShader, llvmpipe) means still', () => {
    const decision = decideTier({ ...desktop, gpuRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' });
    expect(decision.tier).toBe('still');
    expect(decision.reasons.join(' ')).toMatch(/software renderer/);
    expect(decideTier({ ...desktop, gpuRenderer: 'llvmpipe (LLVM 17.0.6, 256 bits)' }).tier).toBe('still');
  });

  it('low memory means low', () => {
    expect(decideTier({ ...desktop, deviceMemoryGb: 2 }).tier).toBe('low');
  });

  it('missing signals are neutral', () => {
    expect(decideTier({ ...desktop, deviceMemoryGb: undefined, cores: undefined, gpuRenderer: undefined }).tier).toBe('high');
  });

  it('weak desktops and 2-core phones step down', () => {
    expect(decideTier({ ...desktop, cores: 2 }).tier).toBe('mid');
    expect(decideTier({ ...iphone13, cores: 2 }).tier).toBe('low');
  });

  it('a forced tier wins and says why', () => {
    const decision = decideTier({ ...desktop, webgl2: false }, 'high');
    expect(decision).toEqual({ tier: 'high', reasons: ['forced by ?tier=high'] });
  });
});
