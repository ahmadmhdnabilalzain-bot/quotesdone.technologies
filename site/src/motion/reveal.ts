/**
 * Text reveals by LINE or WORD only. There is deliberately no character mode: splitting by
 * character breaks Arabic letter joining (structure-v1 §5.6).
 * Text is visible without JS; it is hidden only by the animation itself, right before it runs.
 * Never called under prefers-reduced-motion (boot.ts), and it checks again here.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DURATION, EASE } from './easing.ts';
import { createLogger } from '../lib/log.ts';

const log = createLogger('motion:reveal');

export type RevealUnit = 'line' | 'word';

export function revealOnScroll(elements: Iterable<HTMLElement>, unit: RevealUnit = 'line'): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const type = unit === 'line' ? 'lines' : 'words';
  for (const element of elements) {
    try {
      SplitText.create(element, {
        type,
        mask: type,
        autoSplit: true,
        onSplit(self) {
          const parts = unit === 'line' ? self.lines : self.words;
          return gsap.from(parts, {
            yPercent: 100,
            duration: DURATION.reveal,
            ease: EASE.enter,
            stagger: 0.08,
            scrollTrigger: { trigger: element, start: 'top 88%', once: true },
          });
        },
      });
    } catch (error) {
      // A failed reveal must never leave text hidden.
      gsap.set(element, { clearProps: 'all' });
      log.error('reveal failed; text left static', error);
    }
  }
}
