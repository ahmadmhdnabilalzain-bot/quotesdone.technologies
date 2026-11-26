import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user/9b064cfb-83e8-5dcc-93ba-031f00f7f77b/scratchpad/rail';
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const [tag, opts, q] of [['nojs', { javaScriptEnabled: false }, ''], ['still', { reducedMotion: 'reduce' }, '']]) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  await page.goto('http://127.0.0.1:4371/' + q);
  await page.waitForTimeout(1500);
  const y = await page.evaluate(() => document.getElementById('products').getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo(0, y - 200), y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-products.png` });
  const tier = await page.evaluate(() => document.documentElement.dataset.tier);
  const h = await page.evaluate(() => document.getElementById('products').getBoundingClientRect().height);
  console.log(tag, 'tier', tier, 'products height', h);
  await page.close();
}
await b.close();
