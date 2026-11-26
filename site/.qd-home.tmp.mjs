import { chromium } from '@playwright/test';
const tag = process.argv[2] ?? 'home';
const port = process.argv[3] ?? '4345';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type()==='error') console.log('ERR', m.text().slice(0,200)); });
await page.goto(`http://127.0.0.1:${port}/?tier=high`);
await page.waitForTimeout(1500);
const geo = await page.evaluate(() => { const s = document.querySelector('[data-scene-slot="quotesdone"]'); const r = s.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
console.log(geo);
for (const f of [-0.15, 0, 0.26, 0.5, 0.74, 0.92, 1.0]) {
  const y = geo.top + f * (geo.h - 900);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(f === -0.15 ? 6000 : 2500);
  const st = await page.evaluate(() => document.querySelector('[data-scene-slot="quotesdone"]').dataset.sceneState);
  console.log(f, st);
  await page.screenshot({ path: `/tmp/claude-0/qd/${tag}-${f}.png` });
}
await b.close();
