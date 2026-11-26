import { expect, test, type Page } from '@playwright/test';
import company from '../../src/content/en/company.json' with { type: 'json' };
import pages from '../../src/content/en/pages.json' with { type: 'json' };
import ui from '../../src/content/en/ui.json' with { type: 'json' };
import quotesdone from '../../src/content/en/products/quotesdone.json' with { type: 'json' };
import sonobolt from '../../src/content/en/products/sonobolt.json' with { type: 'json' };
import mubinflow from '../../src/content/en/products/mubinflow.json' with { type: 'json' };

/** Every public page, with the H1 it must carry and words that must be in the HTML. */
const PAGES = [
  { path: '/', h1: 'Software, built and run in Dubai.', words: [] as string[] },
  { path: '/products', h1: pages.products.headline, words: [pages.products.intro, pages.products.closing, quotesdone.promise, sonobolt.promise, mubinflow.promise] },
  { path: '/products/quotesdone', h1: quotesdone.headline, words: [quotesdone.promise, ...quotesdone.proof.map((p) => p.title), quotesdone.statusLine, pages.product.productOf] },
  { path: '/products/sonobolt', h1: sonobolt.headline, words: [sonobolt.promise, ...sonobolt.proof.map((p) => p.title), sonobolt.statusLine] },
  { path: '/products/mubinflow', h1: mubinflow.headline, words: [mubinflow.promise, ...mubinflow.proof.map((p) => p.title), mubinflow.statusLine] },
  { path: '/company', h1: company.headline, words: [...company.about, ...company.principles.map((p) => p.title), pages.identity.licence, pages.identity.form] },
  { path: '/contact', h1: pages.contact.headline, words: [pages.identity.licence, pages.identity.form, pages.identity.address, 'support@sonobolt.com', 'quotesdone.com/contact'] },
  { path: '/legal', h1: pages.legal.headline, words: [pages.legal.intro, pages.identity.licence, pages.identity.form] },
  { path: '/privacy', h1: pages.privacy.headline, words: [pages.privacy.intro, pages.privacy.productsIntro] },
  { path: '/terms', h1: pages.terms.headline, words: [pages.terms.intro, pages.terms.productsIntro] },
];

/** Collect console errors and uncaught page errors for the whole test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Astro escapes quotes and ampersands in text nodes. */
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

const FORBIDDEN = /L\.?\s?L\.?\s?C\b|Manar\s*One|\bERP\b|OWNER TO CONFIRM|\bTODO\b/i;

for (const entry of PAGES) {
  test.describe(`page ${entry.path}`, () => {
    test('200, one H1, landmarks, no console errors, no forbidden text', async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(entry.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(entry.h1);
      await expect(page.locator('header')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
      // Pre-launch: noindex, and a canonical on the planned origin.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/quotesdone\.technologies\//);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      // JSON-LD parses, and Organization says Sole Establishment's trade name without a company suffix.
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const parsed = blocks.map((b) => JSON.parse(b) as { '@type': string; legalName?: string });
      expect(parsed.some((b) => b['@type'] === 'Organization' && b.legalName === 'QuotesDone Technologies')).toBe(true);
      expect(errors).toEqual([]);
    });

    test('skip link is first in tab order and jumps to main', async ({ page }) => {
      await page.goto(entry.path);
      await page.keyboard.press('Tab');
      const skip = page.locator('a.skip-link');
      await expect(skip).toBeFocused();
      await expect(skip).toHaveText(ui.skipLink);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });

    test.describe('JavaScript disabled', () => {
      test.use({ javaScriptEnabled: false });
      test('every word is in the HTML', async ({ page }) => {
        const response = await page.goto(entry.path);
        expect(response?.status()).toBe(200);
        const html = await response!.text();
        for (const word of entry.words) expect(html).toContain(escapeHtml(word));
        await expect(page.locator('h1')).toHaveText(entry.h1);
        expect(html).not.toMatch(/L\.L\.C/);
      });
    });
  });
}

test.describe('navigation', () => {
  test('header nav reaches Products, Company and Contact, and marks the current page', async ({ page }) => {
    await page.goto('/');
    for (const item of ui.nav) {
      await page.locator('.site-header__nav').getByRole('link', { name: item.label }).click();
      await expect(page).toHaveURL(new RegExp(`${item.href}/?$`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.site-header__nav a[aria-current="page"]')).toHaveText(item.label);
    }
  });

  test('footer links work, and the identity line is there', async ({ page }) => {
    await page.goto('/company');
    const footer = page.locator('footer');
    await expect(footer).toContainText(ui.footer.identity);
    for (const [name, h1] of [['Legal', pages.legal.headline], ['Privacy', pages.privacy.headline], ['Terms', pages.terms.headline]] as const) {
      await footer.getByRole('link', { name, exact: true }).click();
      await expect(page.locator('h1')).toHaveText(h1);
    }
    await footer.getByRole('link', { name: 'Sonobolt' }).click();
    await expect(page.locator('h1')).toHaveText(sonobolt.headline);
  });

  test('product pages: statuses are truthful, no link for MubinFlow, no app.sonobolt.com anywhere', async ({ page }) => {
    await page.goto('/products/mubinflow');
    await expect(page.locator('main a[href^="http"]')).toHaveCount(0);
    await expect(page.locator('main')).toContainText('In development');
    await expect(page.locator('main')).toContainText(pages.product.noSiteYet);
    for (const entry of PAGES) {
      const html = await (await page.request.get(entry.path)).text();
      expect(html).not.toContain('app.sonobolt.com');
    }
    await page.goto('/products/sonobolt');
    await expect(page.locator('main a[href="https://sonobolt.com"]')).toHaveAttribute('rel', 'noopener');
    await page.goto('/products/quotesdone');
    await expect(page.locator('main')).toContainText('Live');
  });

  test('product pages loop: next product', async ({ page }) => {
    await page.goto('/products/mubinflow');
    await page.getByRole('link', { name: /Next product/ }).click();
    await expect(page.locator('h1')).toHaveText(quotesdone.headline);
  });
});

test.describe('404', () => {
  test('an unknown path returns status 404 and the 404 page', async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText(pages.notFound.headline);
    await expect(page.locator('main')).toContainText(pages.notFound.body);
    await expect(page.getByRole('link', { name: pages.notFound.cta })).toHaveAttribute('href', '/products');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    // The browser logs the 404 itself as a console error for the document request; nothing else may appear.
    expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
  });
});

test.describe('plumbing', () => {
  test('robots.txt blocks everything while pre-launch and sitemap lists every public page', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /');
    expect(robots).not.toContain('Sitemap:');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const entry of PAGES) {
      const expected = entry.path === '/' ? 'https://quotesdone.technologies/' : `https://quotesdone.technologies${entry.path}/`;
      expect(sitemap).toContain(`<loc>${expected}</loc>`);
    }
    expect(sitemap).not.toContain('404');
  });
});
