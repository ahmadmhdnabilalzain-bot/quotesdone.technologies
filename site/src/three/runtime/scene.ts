/**
 * The scene contract (structure-v1 §6.2) and the SceneHost that owns scene lifecycles.
 *
 * Contract rules:
 * - A scene never touches the DOM, the scroll position or the clock. It receives `progress`
 *   (0..1, from scroll) and `timeMs` (from the single clock).
 * - `update(progress, timeMs)` is a PURE function of its inputs: the same input always gives the
 *   same frame, in any call order. Never accumulate state between frames.
 * - No scene calls requestAnimationFrame or renderer.setAnimationLoop (tested).
 * - `dispose()` frees every geometry, material, texture and render target it created.
 *
 * The host is renderer-agnostic (it never imports three.js at runtime), so its lifecycle rules
 * are unit-tested with fake scenes.
 */
import type { Camera, Object3D, Texture } from 'three';
import type { TierConfig } from './tier-types.ts';
import type { QualityLevel } from './ladder.ts';
import { createLogger, type Logger } from '../../lib/log.ts';

/** One tunable number. Drives the future ?gui panel; every value is named and bounded. */
export interface SceneParam {
  value: number;
  min: number;
  max: number;
  step?: number;
  description: string;
}
export type SceneParams = Record<string, SceneParam>;

export interface Viewport {
  /** Stage size in CSS pixels. */
  width: number;
  height: number;
  aspect: number;
  /** Page direction: scenes mirror flow (rail direction, docking side) for 'rtl'. */
  dir: 'ltr' | 'rtl';
  /** Effective pixel ratio of the render target (DPR cap x ladder scale). */
  pixelRatio: number;
}

export interface SceneContext {
  /** Neutral procedural environment for reflections (PMREM'd RoomEnvironment); null in unit tests. */
  envMap: Texture | null;
  tierConfig: TierConfig;
  /** Fixed seed for any pseudo-random values (?seed later). */
  seed: number;
  log: Logger;
  /** Cooperative yield for long builds, so create() never blocks the main thread > 50 ms. */
  yieldToMain: () => Promise<void>;
}

/** structure-v1 §6.2, unchanged. */
export interface Scene {
  id: string;
  params: SceneParams;
  create(ctx: SceneContext): Promise<void>;
  update(progress: number, timeMs: number): void;
  resize(view: Viewport): void;
  stillAt: number[];
  dispose(): void;
}

/**
 * What the presenter needs to draw a scene. Kept separate from `Scene` so §6.2 stays exact.
 * `applyQuality` is optional: the host calls it when the ladder steps down (at rest only).
 */
export interface RenderableScene extends Scene {
  readonly object3d: Object3D;
  readonly camera: Camera;
  applyQuality?(level: QualityLevel): void;
}

/** A scene module exports a factory; the registry lazy-loads modules so each scene is its own chunk. */
export type SceneFactory = () => RenderableScene;
export type SceneLoader = () => Promise<SceneFactory>;

/** Where a scene slot is on the page, computed by motion/scroll.ts every tick. */
export interface SlotScrollState {
  /** Scene progress 0..1 (the scene's own start/end mapping). */
  progress: number;
  /** Distance from the viewport in viewport heights; 0 while any part is on screen. */
  distanceVh: number;
  /** Fraction of the viewport the stage covers (0..1). */
  coverage: number;
}

export type SlotStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'disposed';

export interface HostEvents {
  /** First frame can be drawn: the DOM may hide the still. */
  onReady?(slotId: string): void;
  /** The slot must show its still from now on. */
  onFail?(slotId: string, reason: string, error?: unknown): void;
  /** The slot's scene was freed (out of range). The DOM shows its still again. */
  onRelease?(slotId: string): void;
}

export interface HostOptions {
  /**
   * Optional GPU warm-up after create() and before the slot is marked ready, e.g.
   * renderer.compileAsync(scene.object3d, scene.camera), so shaders never compile mid-scroll.
   */
  prepare?: (scene: RenderableScene) => Promise<void>;
  /** A build (chunk load + create + prepare) that takes longer fails the slot. Default 15000 ms. */
  buildTimeoutMs?: number;
  /** Build a scene when its slot is this close (viewport heights). structure-v1 §3.5: 0.35. */
  buildAheadVh?: number;
  /** Free a scene once its slot is this far away. Must be > buildAheadVh (hysteresis). §3.5: 0.4. */
  releaseAfterVh?: number;
  /** At most this many scenes hold GPU memory at once (loading + ready). §3.5: 2. */
  maxLive?: number;
  createContext: (slotId: string) => SceneContext;
  events?: HostEvents;
  log?: Logger;
}

interface Slot {
  id: string;
  sceneId: string;
  loader: SceneLoader;
  status: SlotStatus;
  scene: RenderableScene | null;
  scroll: SlotScrollState;
  /** Incremented to cancel an in-flight build when the slot is released mid-build. */
  generation: number;
  /** Permanently failed: never rebuilt this visit. */
  dead: boolean;
}

export interface DrawItem {
  slotId: string;
  scene: RenderableScene;
  progress: number;
  coverage: number;
}

export class SceneHost {
  private readonly slots = new Map<string, Slot>();
  private readonly order: string[] = [];
  private readonly buildAheadVh: number;
  private readonly releaseAfterVh: number;
  private readonly maxLive: number;
  private readonly buildTimeoutMs: number;
  private readonly log: Logger;
  private building = false;
  private suspended = false;
  private frozen: { slotId: string; progress: number } | null = null;

  constructor(private readonly options: HostOptions) {
    this.buildAheadVh = options.buildAheadVh ?? 0.35;
    this.releaseAfterVh = Math.max(options.releaseAfterVh ?? 0.4, this.buildAheadVh + 0.01);
    this.maxLive = Math.max(1, options.maxLive ?? 2);
    this.buildTimeoutMs = options.buildTimeoutMs ?? 15_000;
    this.log = options.log ?? createLogger('3d:host');
  }

  /** Register one slot (one section on the page). Slot ids are unique; scene ids may repeat. */
  register(slotId: string, sceneId: string, loader: SceneLoader): void {
    if (this.slots.has(slotId)) throw new Error(`SceneHost: duplicate slot id "${slotId}"`);
    this.slots.set(slotId, {
      id: slotId,
      sceneId,
      loader,
      status: 'idle',
      scene: null,
      scroll: { progress: 0, distanceVh: Number.POSITIVE_INFINITY, coverage: 0 },
      generation: 0,
      dead: false,
    });
    this.order.push(slotId);
  }

  setScroll(slotId: string, scroll: SlotScrollState): void {
    const slot = this.slots.get(slotId);
    if (slot) slot.scroll = scroll;
  }

  /** ?scene=<id>&p=<n>: freeze one slot (matched by slot id or scene id) at one progress. */
  freeze(idOrSceneId: string, progress: number): boolean {
    const slot = this.slots.get(idOrSceneId) ?? [...this.slots.values()].find((s) => s.sceneId === idOrSceneId);
    if (!slot) return false;
    this.frozen = { slotId: slot.id, progress: clamp01(progress) };
    return true;
  }

  /** Lifecycle step: start builds and releases based on the latest scroll state. Call once per tick. */
  step(): void {
    if (this.suspended) return;

    // 1. Release slots that are far away (hysteresis prevents thrash at the boundary).
    for (const slot of this.slots.values()) {
      if ((slot.status === 'ready' || slot.status === 'loading') && this.distance(slot) > this.releaseAfterVh) {
        this.release(slot, 'out of range');
      }
    }

    // 2. Build the nearest wanted slot, one build at a time.
    if (this.building) return;
    const wanted = this.candidates();
    const next = wanted[0];
    if (!next) return;

    if (this.liveCount() >= this.maxLive) {
      // Evict the farthest live slot, only if it is farther than the candidate.
      const farthest = this.liveSlots().sort((a, b) => this.distance(b) - this.distance(a))[0];
      if (!farthest || this.distance(farthest) <= this.distance(next)) return;
      this.release(farthest, 'evicted for a nearer scene');
    }
    void this.build(next);
  }

  /** Ready slots on screen, most visible first. The presenter draws these. */
  drawList(): DrawItem[] {
    const items: DrawItem[] = [];
    for (const slot of this.slots.values()) {
      if (slot.status !== 'ready' || slot.scene === null) continue;
      const isFrozen = this.frozen?.slotId === slot.id;
      if (!isFrozen && slot.scroll.coverage <= 0) continue;
      items.push({
        slotId: slot.id,
        scene: slot.scene,
        progress: isFrozen && this.frozen ? this.frozen.progress : clamp01(slot.scroll.progress),
        coverage: slot.scroll.coverage,
      });
    }
    return items.sort((a, b) => b.coverage - a.coverage).slice(0, this.maxLive);
  }

  /** Run one scene's update inside the error boundary. Returns false if the scene failed. */
  safeUpdate(item: DrawItem, timeMs: number): boolean {
    const slot = this.slots.get(item.slotId);
    if (!slot || !slot.scene) return false;
    try {
      slot.scene.update(item.progress, timeMs);
      return true;
    } catch (error) {
      this.fail(slot, 'update threw', error);
      return false;
    }
  }

  /** Resize one scene inside the error boundary. */
  safeResize(slotId: string, view: Viewport): void {
    const slot = this.slots.get(slotId);
    if (!slot || !slot.scene) return;
    try {
      slot.scene.resize(view);
    } catch (error) {
      this.fail(slot, 'resize threw', error);
    }
  }

  /** Report a failure found outside the host (e.g. a draw error). */
  reportFailure(slotId: string, reason: string, error?: unknown): void {
    const slot = this.slots.get(slotId);
    if (slot) this.fail(slot, reason, error);
  }

  applyQuality(level: QualityLevel): void {
    for (const slot of this.slots.values()) {
      if (slot.status !== 'ready' || !slot.scene?.applyQuality) continue;
      try {
        slot.scene.applyQuality(level);
      } catch (error) {
        this.fail(slot, 'applyQuality threw', error);
      }
    }
  }

  /** WebGL context lost: free everything, show stills, stop building until resume(). */
  suspend(reason: string): void {
    this.suspended = true;
    for (const slot of this.slots.values()) {
      if (slot.status === 'ready' || slot.status === 'loading') this.release(slot, reason);
      this.options.events?.onFail?.(slot.id, reason);
    }
  }

  resume(): void {
    this.suspended = false;
  }

  /** Permanent stop (second context loss, or page teardown). */
  shutdown(reason: string): void {
    this.suspend(reason);
    for (const slot of this.slots.values()) slot.dead = true;
  }

  statusOf(slotId: string): SlotStatus | undefined {
    return this.slots.get(slotId)?.status;
  }

  /** Snapshot for the HUD and window.__qdt.dumpInfo(). */
  describe(): Array<{ slotId: string; sceneId: string; status: SlotStatus; progress: number; distanceVh: number; coverage: number }> {
    return this.order.map((id) => {
      const slot = this.slots.get(id)!;
      return {
        slotId: slot.id,
        sceneId: slot.sceneId,
        status: slot.status,
        progress: round3(slot.scroll.progress),
        distanceVh: round3(slot.scroll.distanceVh),
        coverage: round3(slot.scroll.coverage),
      };
    });
  }

  // ---- internals ----

  private distance(slot: Slot): number {
    return this.frozen?.slotId === slot.id ? 0 : slot.scroll.distanceVh;
  }

  private liveSlots(): Slot[] {
    return [...this.slots.values()].filter((s) => s.status === 'loading' || s.status === 'ready');
  }

  private liveCount(): number {
    return this.liveSlots().length;
  }

  private candidates(): Slot[] {
    return [...this.slots.values()]
      .filter((s) => !s.dead && (s.status === 'idle' || s.status === 'disposed') && this.distance(s) <= this.buildAheadVh)
      .sort((a, b) => this.distance(a) - this.distance(b));
  }

  private async build(slot: Slot): Promise<void> {
    this.building = true;
    slot.status = 'loading';
    const generation = ++slot.generation;
    const started = now();
    let scene: RenderableScene | null = null;
    try {
      const factory = await withTimeout(slot.loader(), this.buildTimeoutMs, `${slot.id}: chunk load`);
      if (generation !== slot.generation) return; // released while the chunk loaded
      scene = factory();
      await withTimeout(scene.create(this.options.createContext(slot.id)), this.buildTimeoutMs, `${slot.id}: create`);
      if (this.options.prepare) await withTimeout(this.options.prepare(scene), this.buildTimeoutMs, `${slot.id}: prepare`);
      if (generation !== slot.generation) {
        safeDispose(scene, this.log);
        return;
      }
      slot.scene = scene;
      slot.status = 'ready';
      this.log.info(`${slot.id} (${slot.sceneId}) create ${Math.round(now() - started)} ms`);
      this.options.events?.onReady?.(slot.id);
    } catch (error) {
      if (scene) safeDispose(scene, this.log);
      slot.scene = null;
      this.fail(slot, 'create failed', error);
    } finally {
      this.building = false;
    }
  }

  private release(slot: Slot, reason: string): void {
    slot.generation++;
    if (slot.scene) {
      safeDispose(slot.scene, this.log);
      slot.scene = null;
    }
    slot.status = 'disposed';
    this.log.debug(`${slot.id} released (${reason})`);
    this.options.events?.onRelease?.(slot.id);
  }

  private fail(slot: Slot, reason: string, error?: unknown): void {
    slot.generation++;
    if (slot.scene) {
      safeDispose(slot.scene, this.log);
      slot.scene = null;
    }
    slot.status = 'failed';
    slot.dead = true;
    this.log.error(`${slot.id} (${slot.sceneId}) ${reason}; showing still`, error);
    this.options.events?.onFail?.(slot.id, reason, error);
  }
}

/** Reject if `promise` does not settle in time, so one hung build cannot block every later scene. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function safeDispose(scene: Scene, log: Logger): void {
  try {
    scene.dispose();
  } catch (error) {
    log.error(`${scene.id} dispose threw`, error);
  }
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function round3(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
