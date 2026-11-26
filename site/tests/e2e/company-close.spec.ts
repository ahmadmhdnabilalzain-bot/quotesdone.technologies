/**
 * Home scenes 7 (company) and 8 (close): words without JS, only confirmed contact facts, and
 * the close scene really renders and ends faded to the page's Carbon (alpha, no seam).
 */
import { expect, test } from '@playwright/test';
import company from '../../src/content/en/company.json' with { type: 'json' };
import home from '../../src/content/en/home.json' with { type: 'json' };

test.describe('company and close, JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('every word is in the HTML, and no unconfirmed contact detail', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();
    expect(html).toContain(company.headline);
    for (const para of company.about) expect(html).toContain(para);
    // Bodies hold apostrophes (HTML-escaped in source), so check them as rendered text.
    for (const pr of company.principles) {
      expect(html).toContain(pr.title);
      await expect(page.locator(`#principle-${pr.id}`)).toContainText(pr.body);
    }
    expect(html).toContain(home.closing.headline);
    expect(html).toContain(company.home.contact.headline);
    for (const r of company.home.contact.routing) expect(html).toContain(r.href);
    // Company email, phone and founder line are [OWNER TO CONFIRM] in the copy deck.
    expect(html).not.toMatch(/management@quotesdone\.com|791 8605|Al ?Zain/i);
    await expect(page.locator('[data-scene-slot="company"]')).toHaveAttribute('data-scene-state', 'still');
    await expect(page.locator('[data-scene-slot="close"]')).toHaveAttribute('data-scene-state', 'still');
  });
});

test.describe('close scene harness', () => {
  test('renders the Q end cap, then fades to Carbon at p=1', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop design target only');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/debug/close/?scene=close&p=0.6&tier=high&debug');
    await page.waitForFunction(() => (window as unknown as { __qdt?: { dumpInfo(): { framesDrawn: number } } }).__qdt?.dumpInfo().framesDrawn! > 3, null, { timeout: 30_000 });
    await expect(page.locator('[data-scene-slot="close"]')).toHaveAttribute('data-scene-state', 'live');
    const seated = await page.evaluate(() => (window as unknown as { __qdt: { dumpInfo(): { triangles: number } } }).__qdt.dumpInfo().triangles);
    expect(seated).toBeGreaterThan(1000);

    // On the left arm of the Q's bowl in the 1440x900 harness frame (seen in the review shots).
    const sample = async (): Promise<number[]> => {
      const shot = await page.screenshot({ clip: { x: 850, y: 570, width: 1, height: 1 }, scale: 'css' });
      return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return Array.from(g.getImageData(0, 0, 1, 1).data.slice(0, 3));
      }, shot.toString('base64'));
    };
    const lit = await sample();
    expect(Math.max(...lit), `seated Q pixel ${lit}`).toBeGreaterThan(90);

    await page.evaluate(() => (window as unknown as { __qdt: { setProgress(id: string, p: number): boolean } }).__qdt.setProgress('close', 1));
    await page.waitForTimeout(800);
    // At p=1 the canvas is transparent there: exactly the page's Carbon, no tone-mapped seam.
    expect(await sample()).toEqual([14, 16, 19]);
    expect(errors).toEqual([]);
  });
});
