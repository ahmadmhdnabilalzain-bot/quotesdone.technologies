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

  it('the signal colour is the TRUE linear #E3185B (the runtime signal pass shows it 1:1, no AgX pre-compensation)', () => {
    const c = railSignalColor();
    // #E3185B in linear sRGB: [0.7681, 0.0091, 0.1046]
    expect(c.r).toBeCloseTo(0.7681, 3);
    expect(c.g).toBeCloseTo(0.0091, 3);
    expect(c.b).toBeCloseTo(0.1046, 3);
  });

  it('every shared-rail signal material opts into the runtime signal pass', () => {
    expect(datumMaterial().userData.signal).toBe(true);
  });

  it('the datum height ratio and Alloy match the rail scene', () => {
    expect(DATUM_Y).toBeCloseTo(-RAIL_PARAMS.grooveY.value / RAIL_PARAMS.railHeight.value, 6);
    expect(RAIL_PROFILE.depthPerHeight).toBeCloseTo(RAIL_PARAMS.railDepth.value / RAIL_PARAMS.railHeight.value, 6);
    expect(CLOSE_ALLOY.equals(RAIL_ALLOY)).toBe(true);
  });
});
