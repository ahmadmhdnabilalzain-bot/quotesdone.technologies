import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import home from '../../src/content/en/home.json' with { type: 'json' };
import ui from '../../src/content/en/ui.json' with { type: 'json' };

const ARTIFACTS = 'tests/artifacts';
mkdirSync(ARTIFACTS, { recursive: true });

/** Collect console errors and uncaught page errors for the whole test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

interface DebugInfo {
  tier: string;
  geometries: number;
  textures: number;
  estimatedBytes: number;
  drawCalls: number;
  triangles: number;
  framesDrawn: number;
  dpr: number;
  gpu: string;
  slots: Array<{ slotId: string; status: string }>;
}

const dumpInfo = (page: Page) => page.evaluate(() => (window as unknown as { __qdt: { dumpInfo(): DebugInfo } }).__qdt.dumpInfo());

test.describe('home, JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('every word is in the HTML', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    const html = await response!.text();
    expect(html).toContain(home.hero.headline);
    expect(html).toContain(home.hero.subline);
    for (const s of home.statements) expect(html).toContain(s.title);
    for (const p of home.productIndex.items) expect(html).toContain(p.line);
    expect(html).toContain(ui.footer.identity.replace(/·/g, '·'));
    expect(html).not.toMatch(/L\.L\.C/);
    await expect(page.locator('h1')).toHaveText(home.hero.headline);
    // No JS: the still is the visible state.
    await expect(page.locator('[data-scene-slot="hero"]')).toHaveAttribute('data-scene-state', 'still');
    await expect(page.locator('.scene-fallback')).toBeVisible();
    // The CSS wordmark intro (placeholder for scene 1a) must END fully drawn, with no JS.
    await page.waitForTimeout(1800);
    await expect(page.locator('.hero__wordmark')).toHaveCSS('clip-path', /^(none|inset\(0(px|%)?( 0(px|%)?){0,3}\))$/);
    // The datum under the wordmark is Rhodamine light.
    await expect(page.locator('.hero__datum')).toHaveCSS('background-color', 'rgb(227, 24, 91)');
    await page.screenshot({ path: `${ARTIFACTS}/${test.info().project.name}-nojs.png`, fullPage: false });
  });
});

test.describe('home, 3D smoke scene', () => {
  test('renders through WebGL with no console errors', async ({ page }, info) => {
    const errors = watchErrors(page);
    // SwiftShader is a software GPU, which auto-detection maps to 'still' on purpose.
    // Pin the tier this project represents: desktop = 'high' (design target), iPhone 13 = 'mid'.
    const tier = info.project.name === 'iphone13' ? 'mid' : 'high';
    await page.goto(`/?tier=${tier}&debug`);
    await expect(page.locator('h1')).toHaveText(home.hero.headline);
    await page.waitForSelector('html[data-3d="live"]', { timeout: 30_000 });
    await expect(page.locator('[data-scene-slot="hero"]')).toHaveAttribute('data-scene-state', 'live');
    await page.waitForFunction(() => (window as unknown as { __qdt?: { dumpInfo(): DebugInfo } }).__qdt!.dumpInfo().framesDrawn > 10);

    const dump = await dumpInfo(page);
    expect(dump.tier).toBe(tier);
    expect(dump.drawCalls).toBeGreaterThan(0);
    expect(dump.triangles).toBeGreaterThan(0);
    // Desktop runs at deviceScaleFactor 2: the 'high' design target must really render at DPR 2.
    expect(dump.dpr).toBe(tier === 'mid' ? 1.5 : 2);
    expect(dump.estimatedBytes).toBeLessThan(tier === 'mid' ? 64 * 1048576 : 192 * 1048576);
    expect(dump.slots.find((s) => s.slotId === 'hero')?.status).toBe('ready');
    console.log(`[${info.project.name}] ${JSON.stringify(dump)}`);

    await page.screenshot({ path: `${ARTIFACTS}/${info.project.name}-smoke.png` });
    // Prove the canvas is live (not blank, not frozen): the box spins with time, so two stage
    // screenshots 400 ms apart must differ. (Reading a WebGL canvas from JS is not reliable:
    // without preserveDrawingBuffer it reads back empty after compositing.)
    const stage = page.locator('[data-scene-stage]');
    const a = await stage.screenshot();
    await page.waitForTimeout(400);
    const b = await stage.screenshot({ path: `${ARTIFACTS}/${info.project.name}-smoke-stage.png` });
    expect(a.equals(b)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('context loss falls back to the still; the words do not move', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?tier=high&debug');
    await page.waitForSelector('html[data-3d="live"]', { timeout: 30_000 });
    const before = await page.locator('h1').boundingBox();
    const lost = await page.evaluate(() => (window as unknown as { __qdt: { loseContext(): boolean } }).__qdt.loseContext());
    expect(lost).toBe(true);
    await expect(page.locator('[data-scene-slot="hero"]')).toHaveAttribute('data-scene-state', 'failed');
    await expect(page.locator('.scene-still')).toHaveCSS('opacity', '1');
    await expect(page.locator('h1')).toHaveText(home.hero.headline);
    expect(await page.locator('h1').boundingBox()).toEqual(before);
    expect(errors).toEqual([]);
  });
});

test.describe('home, scene lifecycle', () => {
  test('scroll away frees the scene (memory back to baseline); scroll back rebuilds it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?tier=high&debug');
    await page.waitForSelector('html[data-3d="live"]', { timeout: 30_000 });
    const live = await dumpInfo(page);
    const slot = page.locator('[data-scene-slot="hero"]');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(slot).toHaveAttribute('data-scene-state', 'still', { timeout: 10_000 });
    const away = await dumpInfo(page);
    expect(away.slots.find((s) => s.slotId === 'hero')?.status).toBe('disposed');
    // Only the runtime's own resources remain (post-pass triangle; env map + shared target).
    expect(away.geometries).toBeLessThan(live.geometries);
    expect(away.geometries).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(slot).toHaveAttribute('data-scene-state', 'live', { timeout: 15_000 });
    const back = await dumpInfo(page);
    expect(back.geometries).toBe(live.geometries);
    expect(errors).toEqual([]);
  });

  test('after one context loss, a restore brings the scene back', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?tier=high&debug');
    await page.waitForSelector('html[data-3d="live"]', { timeout: 30_000 });
    const slot = page.locator('[data-scene-slot="hero"]');
    await page.evaluate(() => (window as unknown as { __qdt: { loseContext(): boolean } }).__qdt.loseContext());
    await expect(slot).toHaveAttribute('data-scene-state', 'failed');
    await page.evaluate(() => (window as unknown as { __qdt: { restoreContext(): boolean } }).__qdt.restoreContext());
    await expect(slot).toHaveAttribute('data-scene-state', 'live', { timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('home, fallbacks', () => {
  test('reduced motion never requests the 3D chunk', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = watchErrors(page);
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500); // past the idle window in which 3D would load
    expect(await page.locator('html').getAttribute('data-tier')).toBe('still');
    expect(requested.filter((u) => /\/_astro\/(mount|smoke)\.|three/.test(u))).toEqual([]);
    expect(await page.locator('canvas').count()).toBe(0);
    await expect(page.locator('h1')).toHaveText(home.hero.headline);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('a software GPU (auto-detected) gets stills, not a stuttering scene', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.waitForTimeout(2500);
    expect(await page.locator('html').getAttribute('data-tier')).toBe('still');
    await expect(page.locator('[data-scene-slot="hero"]')).toHaveAttribute('data-scene-state', 'still');
    expect(errors).toEqual([]);
  });

  test('?still forces the fallback', async ({ page }) => {
    await page.goto('/?still');
    await page.waitForTimeout(1500);
    expect(await page.locator('html').getAttribute('data-tier')).toBe('still');
    expect(await page.locator('canvas').count()).toBe(0);
  });
});
