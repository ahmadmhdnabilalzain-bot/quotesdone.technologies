/** SceneHost lifecycle with fake scenes: lazy build, max two live, failure isolation, hysteresis. */
import { describe, expect, it, vi } from 'vitest';
import { Object3D, PerspectiveCamera } from 'three';
import { SceneHost, type RenderableScene, type SceneContext, type SceneLoader } from '../../src/three/runtime/scene.ts';
import { TIER_CONFIGS } from '../../src/three/runtime/tier-types.ts';
import { createLogger, setSink } from '../../src/lib/log.ts';

setSink({ debug() {}, info() {}, warn() {}, error() {} });

const ctx = (): SceneContext => ({
  envMap: null,
  tierConfig: TIER_CONFIGS.high,
  seed: 1,
  log: createLogger('test'),
  yieldToMain: () => Promise.resolve(),
});

interface Fake extends RenderableScene {
  disposed: number;
}

function fakeLoader(id: string, behaviour: { createThrows?: boolean; updateThrows?: boolean } = {}, made: Fake[] = []): SceneLoader {
  return async () => () => {
    const scene: Fake = {
      id,
      params: {},
      stillAt: [0],
      object3d: new Object3D(),
      camera: new PerspectiveCamera(),
      disposed: 0,
      async create() {
        if (behaviour.createThrows) throw new Error('boom');
      },
      update() {
        if (behaviour.updateThrows) throw new Error('update boom');
      },
      resize() {},
      dispose() {
        scene.disposed++;
      },
    };
    made.push(scene);
    return scene;
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const at = (distanceVh: number, coverage = 0, progress = 0) => ({ progress, distanceVh, coverage });

async function settle(host: SceneHost, rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    host.step();
    await flush();
  }
}

describe('SceneHost', () => {
  it('builds only near the viewport and frees after (hysteresis 0.35 / 0.4)', async () => {
    const made: Fake[] = [];
    const events = { onReady: vi.fn(), onRelease: vi.fn() };
    const host = new SceneHost({ createContext: ctx, events });
    host.register('a', 'smoke', fakeLoader('smoke', {}, made));

    host.setScroll('a', at(2));
    await settle(host);
    expect(host.statusOf('a')).toBe('idle');

    host.setScroll('a', at(0.3));
    await settle(host);
    expect(host.statusOf('a')).toBe('ready');
    expect(events.onReady).toHaveBeenCalledWith('a');

    host.setScroll('a', at(0.38)); // inside hysteresis band: kept
    await settle(host);
    expect(host.statusOf('a')).toBe('ready');

    host.setScroll('a', at(0.5));
    await settle(host);
    expect(host.statusOf('a')).toBe('disposed');
    expect(made[0]?.disposed).toBe(1);
  });

  it('never holds more than two live scenes across eight slots, nearest first', async () => {
    const host = new SceneHost({ createContext: ctx });
    for (let i = 0; i < 8; i++) host.register(`s${i}`, `scene${i}`, fakeLoader(`scene${i}`));
    for (let i = 0; i < 8; i++) host.setScroll(`s${i}`, at(i === 3 ? 0 : i === 4 ? 0.2 : i === 2 ? 0.3 : 5, i === 3 ? 1 : 0));
    await settle(host, 12);
    const live = host.describe().filter((d) => d.status === 'ready' || d.status === 'loading');
    expect(live.map((d) => d.slotId).sort()).toEqual(['s3', 's4']);

    // Scroll on: s5 comes near, s3 leaves. The farthest live scene is evicted.
    host.setScroll('s3', at(0.6));
    host.setScroll('s4', at(0, 1));
    host.setScroll('s5', at(0.1));
    await settle(host, 12);
    const liveAfter = host.describe().filter((d) => d.status === 'ready');
    expect(liveAfter.map((d) => d.slotId).sort()).toEqual(['s4', 's5']);
  });

  it('a scene that throws in create shows its still; others keep running', async () => {
    const onFail = vi.fn();
    const host = new SceneHost({ createContext: ctx, events: { onFail } });
    host.register('bad', 'bad', fakeLoader('bad', { createThrows: true }));
    host.register('good', 'good', fakeLoader('good'));
    host.setScroll('bad', at(0, 0.5));
    host.setScroll('good', at(0, 0.5));
    await settle(host);
    expect(host.statusOf('bad')).toBe('failed');
    expect(host.statusOf('good')).toBe('ready');
    expect(onFail).toHaveBeenCalledWith('bad', 'create failed', expect.any(Error));
    // A failed slot is never rebuilt this visit.
    await settle(host);
    expect(host.statusOf('bad')).toBe('failed');
  });

  it('a scene that throws in update is disposed and isolated', async () => {
    const made: Fake[] = [];
    const host = new SceneHost({ createContext: ctx });
    host.register('x', 'x', fakeLoader('x', { updateThrows: true }, made));
    host.setScroll('x', at(0, 1));
    await settle(host);
    const [item] = host.drawList();
    expect(item).toBeDefined();
    expect(host.safeUpdate(item!, 0)).toBe(false);
    expect(host.statusOf('x')).toBe('failed');
    expect(made[0]?.disposed).toBe(1);
    expect(host.drawList()).toEqual([]);
  });

  it('a chunk-load failure becomes a still', async () => {
    const host = new SceneHost({ createContext: ctx });
    host.register('c', 'c', () => Promise.reject(new Error('chunk 404')));
    host.setScroll('c', at(0, 1));
    await settle(host);
    expect(host.statusOf('c')).toBe('failed');
  });

  it('suspend (context loss) frees everything; resume rebuilds', async () => {
    const made: Fake[] = [];
    const host = new SceneHost({ createContext: ctx });
    host.register('a', 'a', fakeLoader('a', {}, made));
    host.setScroll('a', at(0, 1));
    await settle(host);
    host.suspend('context lost');
    expect(made[0]?.disposed).toBe(1);
    await settle(host);
    expect(host.statusOf('a')).toBe('disposed');
    host.resume();
    await settle(host);
    expect(host.statusOf('a')).toBe('ready');
  });

  it('freeze (?scene=&p=) pins progress and keeps the slot drawable', async () => {
    const host = new SceneHost({ createContext: ctx });
    host.register('hero', 'smoke', fakeLoader('smoke'));
    host.setScroll('hero', at(3, 0, 0.1));
    expect(host.freeze('smoke', 0.75)).toBe(true);
    await settle(host);
    expect(host.drawList()[0]?.progress).toBe(0.75);
  });

  it('awaits prepare (shader warm-up) before marking a slot ready', async () => {
    let release: () => void = () => {};
    const prepare = vi.fn(() => new Promise<void>((r) => (release = r)));
    const onReady = vi.fn();
    const host = new SceneHost({ createContext: ctx, prepare, events: { onReady } });
    host.register('a', 'a', fakeLoader('a'));
    host.setScroll('a', at(0, 1));
    await settle(host);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(host.statusOf('a')).toBe('loading');
    expect(onReady).not.toHaveBeenCalled();
    release();
    await settle(host);
    expect(host.statusOf('a')).toBe('ready');
    expect(onReady).toHaveBeenCalledWith('a');
  });

  it('a build that never settles times out and unblocks the next scene', async () => {
    const host = new SceneHost({ createContext: ctx, buildTimeoutMs: 20 });
    host.register('hung', 'hung', () => new Promise(() => {}));
    host.register('next', 'next', fakeLoader('next'));
    host.setScroll('hung', at(0, 1));
    host.setScroll('next', at(0.1));
    await settle(host);
    await new Promise((r) => setTimeout(r, 40));
    await settle(host);
    expect(host.statusOf('hung')).toBe('failed');
    expect(host.statusOf('next')).toBe('ready');
  });

  it('rejects duplicate slot ids', () => {
    const host = new SceneHost({ createContext: ctx });
    host.register('a', 'a', fakeLoader('a'));
    expect(() => host.register('a', 'a', fakeLoader('a'))).toThrow(/duplicate/);
  });
});
