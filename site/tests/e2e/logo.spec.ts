/**
 * Scene 1 'Assembly': the CSS draw-on (no JS, reduced motion) and the DOM <-> canvas hand-off.
 * Pixel alignment of the rest and dock frames is covered by tests/unit/logo-scene.test.ts
 * (projection within 0.5 px) and by tests/e2e/shoot-logo.mjs screenshots (manual review).
 */
import { expect, test, type Page } from '@playwright/test';
import home from '../../src/content/en/home.json' with { type: 'json' };

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const opacities = (page: Page, selector: string) =>
  page.$$eval(selector, (els) => els.map((el) => Number(getComputedStyle(el).opacity)));

test.describe('logo draw-on, JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('draws all 43 parts from strokes.json and ends on the outline fills', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__wordmark [data-part]')).toHaveCount(43);
    // 5 parts are revealed through masks (butt_reproducible = false), 38 are stroked.
    await expect(page.locator('.hero__wordmark mask')).toHaveCount(5);
    await expect(page.locator('.hero__draw--stroke')).toHaveCount(38);
    await expect(page.locator('h1')).toHaveText(home.hero.headline); // in the DOM from first paint
    await page.waitForTimeout(2800); // the intro is ~2.4 s
    expect((await opacities(page, '.hero__fill')).every((o) => o === 1)).toBe(true);
    expect((await opacities(page, '.hero__draw--stroke')).every((o) => o === 0)).toBe(true);
    await expect(page.locator('.hero__datum')).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await expect(page.locator('.hero__datum')).toHaveCSS('background-color', 'rgb(227, 24, 91)');
  });
});

test.describe('logo draw-on, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the finished wordmark at once', async ({ page }) => {
    await page.goto('/');
    expect((await opacities(page, '.hero__fill')).every((o) => o === 1)).toBe(true);
    await expect(page.locator('.hero__draw--stroke').first()).toBeHidden();
  });
});

test.describe('logo hand-off (desktop, tier high)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop-first: the phone pass comes later');

  const at = async (page: Page, p: number) => {
    await page.goto(`/debug/logo/?tier=high&scene=hero&p=${p}`);
    await page.waitForSelector('[data-scene-slot="hero"][data-scene-state="live"]', { timeout: 30_000 });
  };

  test('phases follow progress: rest, flight, docked', async ({ page }) => {
    const errors = watchErrors(page);
    await at(page, 0.004);
    const hero = page.locator('[data-logo-hero]');
    await expect(hero).toHaveAttribute('data-logo-phase', 'rest');
    await expect(page.locator('.hero__wordmark')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-logo-handoff', 'flight');
    await expect(page.locator('.site-header__logo')).toBeHidden();

    await at(page, 0.5);
    await expect(hero).toHaveAttribute('data-logo-phase', 'flight');
    await expect(page.locator('.hero__wordmark')).toBeHidden();
    await expect(page.locator('.hero__datum')).toHaveCSS('opacity', '0'); // never through the parts

    await at(page, 0.99);
    await expect(hero).toHaveAttribute('data-logo-phase', 'docked');
    await expect(page.locator('html')).toHaveAttribute('data-logo-handoff', 'dom');
    await expect(page.locator('.site-header__logo')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('real scroll docks the wordmark into the sticky header', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?tier=high');
    await page.waitForSelector('[data-scene-slot="hero"][data-scene-state="live"]', { timeout: 30_000 });
    const headerTop = async () => (await page.locator('.site-header').boundingBox())!.y;
    const hero = page.locator('[data-logo-hero]');
    const range = await hero.evaluate((el) => el.getBoundingClientRect().height - window.innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), range * 0.4);
    await expect(hero).toHaveAttribute('data-logo-phase', 'flight');
    await page.evaluate((y) => window.scrollTo(0, y), range + 2);
    await expect(hero).toHaveAttribute('data-logo-phase', 'docked');
    await expect(page.locator('.site-header__logo')).toBeVisible();
    expect(await headerTop()).toBe(0); // sticky: the dock target is still on screen
    expect(errors).toEqual([]);
  });
});
