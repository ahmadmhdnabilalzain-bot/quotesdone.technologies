/**
 * Entry of the 3D chunk. Loaded by lib/boot.ts with a dynamic import, after `load` and idle,
 * and never when the tier is 'still'. Wires: renderer -> environment -> presenter -> host ->
 * slot tracker -> quality ladder -> render loop (+ HUD and window.__qdt with ?hud / ?debug).
 *
 * Page contract (any page, any number of scenes):
 *   <section data-scene-slot="hero" data-scene="smoke" data-scene-state="still">
 *     <div data-scene-stage> <figure class="scene-still">...</figure> </div>
 *   </section>
 * data-scene-start / data-scene-end (ScrollTrigger syntax) optionally set the progress range.
 */
import type { WebGLRenderer } from 'three';
import { applyViewportSize, createRenderer, watchContext } from './runtime/renderer.ts';
import { createNeutralEnvironment } from './runtime/environment.ts';
import { Presenter, type StageRect } from './runtime/presenter.ts';
import { SceneHost, type SceneContext } from './runtime/scene.ts';
import { QualityLadder } from './runtime/ladder.ts';
import { FrameStats } from './runtime/frame-stats.ts';
import { createRenderLoop } from './runtime/loop.ts';
import { createHud, type Hud } from './runtime/hud.ts';
import { allSlotsToStill, setSlotState } from './runtime/errors.ts';
import { TIER_CONFIGS, type Tier } from './runtime/tier-types.ts';
import { SCENES } from './scenes/registry.ts';
import { trackSlots, type TrackedSlot } from '../motion/scroll.ts';
import { initClock, shouldSmoothScroll } from '../motion/clock.ts';
import { createLogger } from '../lib/log.ts';
import type { Flags } from '../lib/flags.ts';
import type { TierDecision } from './runtime/tiers.ts';

const log = createLogger('3d:mount');

export interface MountOptions {
  decision: TierDecision & { tier: Exclude<Tier, 'still'> };
  flags: Flags;
  gpuRenderer: string;
}

export interface DebugInfo {
  tier: Tier;
  tierReasons: string[];
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  estimatedBytes: number;
  fps: number;
  p95Ms: number;
  ladderLevel: number;
  dpr: number;
  gpu: string;
  framesDrawn: number;
  slots: ReturnType<SceneHost['describe']>;
}

export interface QdtHandle {
  renderer: WebGLRenderer;
  host: SceneHost;
  dumpInfo(): DebugInfo;
  setProgress(slotOrSceneId: string, progress: number): boolean;
  /** Test helpers: simulate a GPU reset through WEBGL_lose_context, then restore it once. */
  loseContext(): boolean;
  restoreContext(): boolean;
}

declare global {
  interface Window {
    __qdt?: QdtHandle;
  }
}

const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export async function mount3d({ decision, flags, gpuRenderer }: MountOptions): Promise<void> {
  const doc = document;
  const tierConfig = TIER_CONFIGS[decision.tier];
  const dir = doc.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  const slots: TrackedSlot[] = [];
  const sceneIdOf = new Map<string, string>();
  doc.querySelectorAll<HTMLElement>('[data-scene-slot]').forEach((section) => {
    const id = section.dataset.sceneSlot ?? '';
    const sceneId = section.dataset.scene ?? '';
    const stage = section.querySelector<HTMLElement>('[data-scene-stage]');
    if (!id || !stage) {
      log.error(`slot "${id}" has no [data-scene-stage]; skipped`);
      return;
    }
    slots.push({ id, section, stage });
    sceneIdOf.set(id, sceneId);
  });
  if (slots.length === 0) {
    log.info('no scene slots on this page');
    return;
  }
  const sectionOf = new Map(slots.map((s) => [s.id, s.section]));
  const stageOf = new Map(slots.map((s) => [s.id, s.stage]));

  const canvas = doc.createElement('canvas');
  canvas.className = 'gl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.qdtCanvas = '';
  doc.body.prepend(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = createRenderer({ canvas, tierConfig, checkShaderErrors: flags.debug });
  } catch (error) {
    canvas.remove();
    log.error('WebGL renderer could not be created; stills only', error);
    allSlotsToStill('renderer failed');
    return;
  }

  let environment = createNeutralEnvironment(renderer);
  const presenter = new Presenter(renderer, tierConfig, dir);
  const ladder = new QualityLadder({ pinned: flags.level });
  const frameStats = new FrameStats(120);
  let framesDrawn = 0;
  let lastInfo = { drawCalls: 0, triangles: 0 };

  const createContext = (slotId: string): SceneContext => ({
    envMap: environment.texture,
    tierConfig,
    seed: 1,
    log: createLogger(`3d:scene:${sceneIdOf.get(slotId) ?? slotId}`),
    yieldToMain,
  });

  const host = new SceneHost({
    createContext,
    // Compile every program before the slot goes live, so the first visible frame never stalls.
    prepare: async (scene) => {
      await renderer.compileAsync(scene.object3d, scene.camera);
    },
    events: {
      onReady: (slotId) => {
        const section = sectionOf.get(slotId);
        if (section) setSlotState(section, 'loading');
      },
      onFail: (slotId, reason) => {
        presenter.releaseSlot(slotId);
        const section = sectionOf.get(slotId);
        if (section) setSlotState(section, 'failed', reason);
      },
      onRelease: (slotId) => {
        presenter.releaseSlot(slotId);
        const section = sectionOf.get(slotId);
        if (section && section.dataset.sceneState !== 'failed') setSlotState(section, 'still');
      },
    },
  });

  for (const slot of slots) {
    const sceneId = sceneIdOf.get(slot.id) ?? '';
    const loader = SCENES[sceneId];
    if (!loader) {
      log.error(`slot "${slot.id}" asks for unknown scene "${sceneId}"; showing still`);
      setSlotState(slot.section, 'failed', 'unknown scene');
      continue;
    }
    host.register(slot.id, sceneId, loader);
  }
  if (flags.scene !== null) {
    const ok = host.freeze(flags.scene, flags.progress ?? 0);
    if (!ok) log.warn(`?scene=${flags.scene} matches no slot on this page`);
  }

  const clock = initClock({ smooth: shouldSmoothScroll() }); // idempotent: boot.ts already started it
  const tracker = trackSlots(slots);

  const stageRect = (slotId: string): StageRect | null => {
    const stage = stageOf.get(slotId);
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };

  let hud: Hud | null = flags.hud ? createHud(doc) : null;
  let dead = false;

  const dumpInfo = (): DebugInfo => {
    const memory = renderer.info.memory;
    return {
      tier: decision.tier,
      tierReasons: decision.reasons,
      drawCalls: lastInfo.drawCalls,
      triangles: lastInfo.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      estimatedBytes: presenter.estimateTargetBytes(),
      fps: frameStats.fps,
      p95Ms: frameStats.p95,
      ladderLevel: ladder.current.index,
      dpr: renderer.getPixelRatio(),
      gpu: gpuRenderer,
      framesDrawn,
      slots: host.describe(),
    };
  };

  const loop = createRenderLoop((timeMs, deltaMs) => {
    if (dead) return;
    for (const slot of slots) {
      const state = tracker.read(slot.id);
      if (state) host.setScroll(slot.id, state);
    }
    host.step();

    const items = host.drawList();
    const info = presenter.draw(items, host, flags.scene !== null ? 0 : timeMs, stageRect);
    if (info.drawn > 0) {
      lastInfo = info;
      framesDrawn += 1;
      frameStats.push(deltaMs);
      for (const item of items) {
        const section = sectionOf.get(item.slotId);
        if (section && section.dataset.sceneState === 'loading') setSlotState(section, 'live');
      }
      if (doc.documentElement.dataset['3d'] !== 'live') doc.documentElement.dataset['3d'] = 'live';
      const changed = ladder.sample(performance.now(), deltaMs);
      if (changed) {
        log.info(`ladder -> ${changed.index} (${changed.label}), p95 ${frameStats.p95.toFixed(1)} ms`);
        presenter.setQuality(changed);
        host.applyQuality(changed);
      }
    }
    hud?.update({
      ...dumpInfo(),
      estimatedMb: presenter.estimateTargetBytes() / 1048576,
      ladder: `${ladder.current.index} ${ladder.current.label}`,
    });
  });

  clock.onScroll((now) => ladder.noteScroll(now));

  const onResize = (): void => applyViewportSize(renderer, tierConfig);
  window.addEventListener('resize', onResize);

  watchContext(canvas, {
    onLost: (losses) => {
      loop.stop();
      host.suspend('context lost');
      for (const slot of slots) presenter.releaseSlot(slot.id);
      presenter.releaseTarget();
      if (losses > 1) {
        dead = true;
        host.shutdown('context lost twice');
        allSlotsToStill('context lost twice');
      } else {
        doc.documentElement.dataset['3d'] = 'lost';
      }
    },
    onRestored: () => {
      environment.dispose();
      environment = createNeutralEnvironment(renderer);
      host.resume();
      loop.start();
    },
  });

  let loseExt: WEBGL_lose_context | null = null;
  if (flags.debug || flags.hud) {
    window.__qdt = {
      renderer,
      host,
      dumpInfo,
      setProgress: (id, p) => host.freeze(id, p),
      loseContext: () => {
        loseExt = renderer.getContext().getExtension('WEBGL_lose_context');
        if (!loseExt) return false;
        loseExt.loseContext();
        return true;
      },
      restoreContext: () => {
        if (!loseExt) return false;
        loseExt.restoreContext();
        return true;
      },
    };
    log.info('window.__qdt ready');
  }

  window.addEventListener('pagehide', () => {
    loop.stop();
    hud?.dispose();
    hud = null;
  });

  loop.start();
  log.info(`mounted ${slots.length} slot(s), tier ${decision.tier}`);
}
