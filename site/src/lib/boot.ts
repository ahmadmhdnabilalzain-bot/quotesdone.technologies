/**
 * Page boot (pre-3D path). Must stay small and must NOT import three.js: 3D is a dynamic import.
 * Order: flags -> logging -> error handlers -> tier -> motion -> (after load + idle) 3D.
 * Default state is SAFE: the HTML already shows every word and every still; JS only upgrades.
 */
import { currentFlags } from './flags.ts';
import { createLogger, setVerbose } from './log.ts';
import { allSlotsToStill, installGlobalErrorHandlers } from '../three/runtime/errors.ts';
import { decideTier, detectCapabilities, type TierDecision } from '../three/runtime/tiers.ts';
import { initClock, shouldSmoothScroll } from '../motion/clock.ts';
import { revealOnScroll } from '../motion/reveal.ts';

const log = createLogger('boot');

function whenLoadedAndIdle(run: () => void): void {
  const idle = (): void => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(run, { timeout: 1500 });
    else setTimeout(run, 200); // Safari without requestIdleCallback
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}

export function boot(): void {
  const flags = currentFlags();
  setVerbose(flags.debug);
  installGlobalErrorHandlers();
  const html = document.documentElement;
  html.classList.add('js');

  const caps = detectCapabilities();
  const decision: TierDecision = flags.still ? { tier: 'still', reasons: ['forced by ?still'] } : decideTier(caps, flags.tier);
  html.dataset.tier = decision.tier;
  log.info(`tier ${decision.tier}: ${decision.reasons.join(', ')}`, caps);

  initClock({ smooth: shouldSmoothScroll() });
  if (!caps.reducedMotion) {
    revealOnScroll(document.querySelectorAll<HTMLElement>('[data-reveal="line"]'), 'line');
  }

  if (decision.tier === 'still') {
    allSlotsToStill(decision.reasons.join(', '));
    return;
  }
  // Pages without a scene slot never download three.js.
  if (!document.querySelector('[data-scene-slot]')) {
    log.info('no scene slots; 3D not loaded');
    return;
  }
  const tier = decision.tier;
  whenLoadedAndIdle(() => {
    import('../three/mount.ts')
      .then(({ mount3d }) => mount3d({ decision: { ...decision, tier }, flags, gpuRenderer: caps.gpuRenderer ?? 'unknown' }))
      .catch((error: unknown) => {
        log.error('3D chunk failed to load or mount; stills only', error);
        allSlotsToStill('3d chunk failed');
      });
  });
}
