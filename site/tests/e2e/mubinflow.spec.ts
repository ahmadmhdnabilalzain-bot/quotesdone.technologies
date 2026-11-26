import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import product from '../../src/content/en/products/mubinflow.json' with { type: 'json' };

const ARTIFACTS = 'tests/artifacts';
mkdirSync(ARTIFACTS, { recursive: true });

test.describe('mubinflow section, JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('every MubinFlow word is in the HTML, with no CTA and no owner note', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();
    for (const s of [product.headline, product.promise, product.statusLine, ...product.proof.flatMap((p) => [p.title, p.body])]) {
      expect(html).toContain(s);
    }
    expect(html).not.toContain(product.ownerToConfirm);
    await expect(page.locator('[data-section="mubinflow"] a')).toHaveCount(0);
    await expect(page.locator('[data-scene-slot="mubinflow"]')).toHaveAttribute('data-scene-state', 'still');
  });
});

test.describe('mubinflow harness, 3D', () => {
  test('renders the drafting scene at the end state with no console errors', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop-first: the harness is checked on the high tier');
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/debug/mubinflow?tier=high&debug&scene=mubinflow&p=0.95');
    await expect(page.locator('[data-scene-slot="mubinflow"]')).toHaveAttribute('data-scene-state', 'live', { timeout: 40_000 });
    const stage = page.locator('[data-scene-slot="mubinflow"] [data-scene-stage]');
    await stage.screenshot({ path: `${ARTIFACTS}/${info.project.name}-mubinflow-0.95.png` });
    expect(errors).toEqual([]);
  });
});
