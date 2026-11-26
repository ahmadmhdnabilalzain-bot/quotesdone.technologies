import { describe, expect, it } from 'vitest';
import { QualityLadder, isSteadyThirtyHz } from '../../src/three/runtime/ladder.ts';
import { FrameStats } from '../../src/three/runtime/frame-stats.ts';

function feed(ladder: QualityLadder, startMs: number, frames: number, frameMs: number) {
  let changed = null;
  let t = startMs;
  for (let i = 0; i < frames; i++) {
    t += frameMs;
    changed = ladder.sample(t, frameMs) ?? changed;
  }
  return { changed, t };
}

describe('FrameStats', () => {
  it('computes quantiles over a ring buffer', () => {
    const stats = new FrameStats(4);
    [10, 20, 30, 40, 50].forEach((v) => stats.push(v));
    expect(stats.size).toBe(4);
    expect(stats.p50).toBe(30);
    expect(stats.p95).toBe(50);
  });
});

describe('QualityLadder', () => {
  it('never steps while scrolling, even when slow', () => {
    const ladder = new QualityLadder({ minSamples: 10 });
    let t = 0;
    for (let i = 0; i < 100; i++) {
      t += 40;
      ladder.noteScroll(t);
      expect(ladder.sample(t, 40)).toBeNull();
    }
    expect(ladder.current.index).toBe(0);
  });

  it('steps down once at rest when p95 is over budget, and never steps up', () => {
    const ladder = new QualityLadder({ minSamples: 10 });
    ladder.noteScroll(0);
    const slow = feed(ladder, 400, 10, 28);
    expect(slow.changed?.index).toBe(1);
    feed(ladder, slow.t, 200, 8);
    expect(ladder.current.index).toBe(1);
  });

  it('leaves a steady 30 Hz alone (Low Power Mode)', () => {
    expect(isSteadyThirtyHz(33.3, 34)).toBe(true);
    const ladder = new QualityLadder({ minSamples: 10 });
    feed(ladder, 1000, 100, 33.3);
    expect(ladder.current.index).toBe(0);
  });

  it('a pinned level never moves', () => {
    const ladder = new QualityLadder({ pinned: 2, minSamples: 1 });
    feed(ladder, 1000, 50, 60);
    expect(ladder.current.index).toBe(2);
  });
});
