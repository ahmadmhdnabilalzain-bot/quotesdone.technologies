import { describe, expect, it } from 'vitest';
import { computeSlotState } from '../../src/motion/scroll.ts';

// A 900px viewport and a stage from y=1800 to y=2700 in document coordinates.
const base = { viewportHeight: 900, visibilityStart: 1800 - 900, visibilityEnd: 2700, progress: 0.25 };

describe('computeSlotState', () => {
  it('fully on screen: distance 0, coverage 1', () => {
    expect(computeSlotState({ ...base, scroll: 1800 })).toEqual({ progress: 0.25, distanceVh: 0, coverage: 1 });
  });
  it('below the fold: distance in viewport heights', () => {
    expect(computeSlotState({ ...base, scroll: 450 }).distanceVh).toBeCloseTo(0.5);
  });
  it('scrolled past: distance after', () => {
    expect(computeSlotState({ ...base, scroll: 3600 }).distanceVh).toBeCloseTo(1);
  });
  it('half visible', () => {
    const state = computeSlotState({ ...base, scroll: 1350 });
    expect(state.distanceVh).toBe(0);
    expect(state.coverage).toBeCloseTo(0.5);
  });
});
