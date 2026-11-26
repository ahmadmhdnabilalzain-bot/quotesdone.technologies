/**
 * THE render loop. This is the only file allowed to schedule frames for rendering
 * (tests/unit/raf-ban.test.ts and scripts/lint-source.mjs fail on requestAnimationFrame or
 * setAnimationLoop anywhere else). It rides gsap.ticker, the single clock that also drives
 * Lenis and ScrollTrigger (src/motion/clock.ts), so scroll, motion and 3D share one frame.
 */
import { gsap } from 'gsap';

export type FrameCallback = (timeMs: number, deltaMs: number) => void;

export interface RenderLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createRenderLoop(onFrame: FrameCallback): RenderLoop {
  let running = false;
  const tick = (timeSeconds: number, deltaMs: number): void => {
    onFrame(timeSeconds * 1000, deltaMs);
  };
  return {
    start() {
      if (running) return;
      running = true;
      gsap.ticker.add(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    },
    get running() {
      return running;
    },
  };
}
