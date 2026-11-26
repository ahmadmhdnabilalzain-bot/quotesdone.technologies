/**
 * The three rail scenes (rail, company, close) must draw ONE line: same signal colour, same
 * datum height ratio, same Alloy. Guards three/shared/rail.ts against drift (integration phase).
 */
import { describe, expect, it } from 'vitest';
import { ALLOY as RAIL_ALLOY, RHODAMINE_LIGHT } from '../../src/three/scenes/rail/materials.ts';
import { RAIL_PARAMS } from '../../src/three/scenes/rail/params.ts';
import { ALLOY as CLOSE_ALLOY, DATUM_Y, SIGNAL, datumMaterial } from '../../src/three/scenes/close/shared.ts';
import { RAIL_PROFILE, railSignalColor } from '../../src/three/shared/rail.ts';
import { inverseAgx } from '../../src/three/shared/agx.ts';

describe('shared rail module', () => {
  it('rail, company and close draw the same Rhodamine signal colour', () => {
    expect(RHODAMINE_LIGHT.equals(railSignalColor())).toBe(true);
    expect(SIGNAL.equals(railSignalColor())).toBe(true);
    expect(datumMaterial().color.equals(railSignalColor())).toBe(true);
  });

  it('the signal colour is close to the best AgX can do for #E3185B', () => {
    // The best reachable input (numerical inverse) and the shared constant display within a few 8-bit steps.
    const best = inverseAgx('#E3185B');
    const c = railSignalColor();
    const dist = Math.hypot(c.r - best.linear[0], c.g - best.linear[1], c.b - best.linear[2]);
    expect(dist).toBeLessThan(0.08);
  });

  it('the datum height ratio and Alloy match the rail scene', () => {
    expect(DATUM_Y).toBeCloseTo(-RAIL_PARAMS.grooveY.value / RAIL_PARAMS.railHeight.value, 6);
    expect(RAIL_PROFILE.depthPerHeight).toBeCloseTo(RAIL_PARAMS.railDepth.value / RAIL_PARAMS.railHeight.value, 6);
    expect(CLOSE_ALLOY.equals(RAIL_ALLOY)).toBe(true);
  });
});
