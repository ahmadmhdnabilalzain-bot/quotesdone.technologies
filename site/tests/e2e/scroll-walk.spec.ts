/**
 * Full-page scroll walk of the home page (integration phase, site/docs/integration-notes.md).
 *
 * Desktop only (the design target), SwiftShader Chromium, ?tier=high&hud. Opt-in because it is
 * slow (several minutes): `npm run test:walk` (sets QDT_WALK=1). It scrolls the WHOLE page with
 * real wheel input (Lenis smooths it, like a visitor's mouse) in half-viewport steps and asserts:
 *   - no console errors or page errors;
 *   - no horizontal scroll at any step;
 *   - no scene stuck not-ready while its slot clearly covers the viewport (the HUD/dump API);
 * and records the page height, each section's height, each slot's pinned length and the scroll
 * range over which its progress runs 0 -> 1, all in viewport heights. Results:
 * tests/artifacts/walk/<w>x<h>.json, plus a screenshot per step (walk/<w>x<h>/step-NN.png).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'tests/artifacts/walk';
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
/** A slot covering at least this much of the viewport must be drawing. */
const VISIBLE_COVERAGE = 0.3;
/** How long a visible slot may take to become ready (SwiftShader builds and compiles are slow). */
const READY_WAIT_MS = 30_000;

interface SlotDump {
  slotId: string;
  sceneId: string;
  status: string;
  progress: number;
  distanceVh: number;
  coverage: number;
}

const dump = (page: Page): Promise<SlotDump[] | null> =>
  page.evaluate(() => (window.__qdt ? (window.__qdt.dumpInfo().slots as SlotDump[]) : null));

/** Wheel until scrollY has moved and then stays put (Lenis eases in over several frames). */
async function wheelStep(page: Page, delta: number): Promise<number> {
  await page.mouse.wheel(0, delta);
  let last = -1;
  let still = 0;
  for (let i = 0; i < 160 && still < 4; i++) {
    await page.waitForTimeout(150);
    const y = await page.evaluate(() => window.scrollY);
    still = y === last ? still + 1 : 0;
    last = y;
  }
  return last;
}

test.describe('home page full scroll walk', () => {
  test.skip(!process.env.QDT_WALK, 'opt-in: npm run test:walk');

  for (const vp of VIEWPORTS) {
    test(`walk ${vp.width}x${vp.height}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop design target only');
      test.setTimeout(20 * 60_000);
      await page.setViewportSize(vp);
      const dir = `${OUT}/${vp.width}x${vp.height}`;
      mkdirSync(dir, { recursive: true });

      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto('/?tier=high&hud');
      await page.waitForFunction(() => Boolean(window.__qdt), null, { timeout: 60_000 });
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.waitForTimeout(1500);

      // ---- Geometry from the DOM (after the 3D layout classes apply) ----
      const geometry = await page.evaluate(() => {
        const vh = window.innerHeight;
        const top = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;
        const main = document.querySelector('main')!;
        const sections = [...main.children].map((el) => ({
          name: (el as HTMLElement).dataset.section ?? el.id ?? el.className.toString().split(' ')[0] ?? el.tagName,
          topVh: top(el) / vh,
          heightVh: el.getBoundingClientRect().height / vh,
        }));
        const slots = [...document.querySelectorAll<HTMLElement>('[data-scene-slot]')].map((slot) => {
          const stage = slot.querySelector<HTMLElement>('[data-scene-stage]')!;
          const sticky = getComputedStyle(stage).position === 'sticky';
          const slotH = slot.getBoundingClientRect().height;
          const stageH = stage.getBoundingClientRect().height;
          return {
            slotId: slot.dataset.sceneSlot!,
            sticky,
            slotTopVh: top(slot) / vh,
            slotHeightVh: slotH / vh,
            stageHeightVh: stageH / vh,
            // Scroll distance over which a sticky stage is held in place.
            pinnedVh: sticky ? (slotH - stageH) / vh : 0,
            start: slot.dataset.sceneStart ?? 'top top',
            end: slot.dataset.sceneEnd ?? 'bottom top',
          };
        });
        const footer = document.querySelector('footer');
        return {
          vh,
          pageHeightVh: document.documentElement.scrollHeight / vh,
          footerTopVh: footer ? top(footer) / vh : null,
          sections,
          slots,
        };
      });

      // ---- The walk ----
      const steps: Array<{ step: number; scrollVh: number; hScroll: boolean; slots: SlotDump[] }> = [];
      const stuck: string[] = [];
      const progressSeen = new Map<string, { firstMoveVh: number | null; fullVh: number | null }>();
      const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      let y = 0;
      for (let step = 0; step < 400; step++) {
        // Wait for visible slots to be drawing; record any that never get there.
        const deadline = Date.now() + READY_WAIT_MS;
        let slots = (await dump(page)) ?? [];
        while (Date.now() < deadline && slots.some((s) => s.coverage >= VISIBLE_COVERAGE && s.status !== 'ready' && s.status !== 'failed')) {
          await page.waitForTimeout(500);
          slots = (await dump(page)) ?? [];
        }
        for (const s of slots) {
          if (s.coverage >= VISIBLE_COVERAGE && s.status !== 'ready') stuck.push(`step ${step} y=${(y / vp.height).toFixed(2)}vh: ${s.slotId} is ${s.status} at coverage ${s.coverage.toFixed(2)}`);
          const seen = progressSeen.get(s.slotId) ?? { firstMoveVh: null, fullVh: null };
          if (seen.firstMoveVh === null && s.progress > 0.001) seen.firstMoveVh = y / vp.height;
          if (seen.fullVh === null && s.progress >= 0.999) seen.fullVh = y / vp.height;
          progressSeen.set(s.slotId, seen);
        }
        const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        steps.push({ step, scrollVh: y / vp.height, hScroll, slots });
        await page.screenshot({ path: `${dir}/step-${String(step).padStart(2, '0')}.png` });
        if (y >= maxScroll - 1) break;
        y = await wheelStep(page, vp.height / 2);
      }

      const result = {
        viewport: vp,
        ...geometry,
        progressRanges: Object.fromEntries(
          [...progressSeen].map(([id, s]) => [id, { ...s, scrubVh: s.firstMoveVh !== null && s.fullVh !== null ? s.fullVh - s.firstMoveVh : null }]),
        ),
        stuck,
        errors,
        horizontalScrollSteps: steps.filter((s) => s.hScroll).map((s) => s.step),
        steps,
      };
      writeFileSync(`${OUT}/${vp.width}x${vp.height}.json`, JSON.stringify(result, null, 2));

      expect(errors, 'console errors').toEqual([]);
      expect(result.horizontalScrollSteps, 'horizontal scroll').toEqual([]);
      expect(stuck, 'scenes not drawing while visible').toEqual([]);
    });
  }
});
