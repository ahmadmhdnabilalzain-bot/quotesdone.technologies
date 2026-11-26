/**
 * The single clock (structure-v1 §3.4): gsap.ticker drives Lenis, ScrollTrigger and the
 * three.js render loop (src/three/runtime/loop.ts adds the render callback to the same ticker).
 * Lenis runs only for (pointer: fine) without reduced motion; touch keeps native scroll.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createLogger } from '../lib/log.ts';

const log = createLogger('motion:clock');

export interface Clock {
  /** Null on touch devices and under reduced motion. */
  readonly lenis: Lenis | null;
  /** Called on every scroll movement (native or Lenis). Returns an unsubscribe function. */
  onScroll(listener: (nowMs: number) => void): () => void;
}

let clock: Clock | null = null;

export function shouldSmoothScroll(win: Window = window): boolean {
  return win.matchMedia('(pointer: fine)').matches && !win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initClock(options: { smooth: boolean }): Clock {
  if (clock) return clock;
  gsap.registerPlugin(ScrollTrigger);
  // iOS address-bar show/hide must not re-layout pinned scenes (structure-v1 §4.4).
  ScrollTrigger.config({ ignoreMobileResize: true });

  const listeners = new Set<(nowMs: number) => void>();
  const emit = (): void => {
    const now = performance.now();
    listeners.forEach((listener) => listener(now));
  };

  let lenis: Lenis | null = null;
  if (options.smooth) {
    lenis = new Lenis({ autoRaf: false, anchors: true });
    lenis.on('scroll', () => {
      ScrollTrigger.update();
      emit();
    });
    gsap.ticker.add((timeSeconds) => lenis?.raf(timeSeconds * 1000));
    // Lenis owns smoothing; GSAP must not "catch up" after a long frame or scroll and 3D drift.
    gsap.ticker.lagSmoothing(0);
    log.info('Lenis on (pointer: fine)');
  } else {
    window.addEventListener('scroll', emit, { passive: true });
    log.info('native scroll');
  }

  clock = {
    lenis,
    onScroll(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return clock;
}
