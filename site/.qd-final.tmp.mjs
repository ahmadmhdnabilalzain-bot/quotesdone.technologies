import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const port of ['4344', '4345']) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/?tier=high&hud`);
  await page.waitForFunction(() => window.__qdt, null, { timeout: 30000 });
  const geo = await page.evaluate(() => { const r = document.querySelector('[data-scene-slot="quotesdone"]').getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  for (const f of [0, 0.5, 0.9]) {
    await page.evaluate((y) => scrollTo(0, y), geo.top + f * (geo.h - 900));
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => window.__qdt.dumpInfo().slots.find(x => x.slotId === 'quotesdone'));
    const rail = await page.evaluate(() => window.__qdt.dumpInfo().slots.find(x => x.slotId === 'rail'));
    const list = f === 0 ? await page.evaluate(() => { const l = document.querySelector('.products__list'); const r = l.getBoundingClientRect(); const items = [...l.querySelectorAll('.product')].map(e => Math.round(e.getBoundingClientRect().top)); return { listTop: Math.round(r.top), listH: Math.round(r.height), labelTops: items, pos: getComputedStyle(l).position, mbe: getComputedStyle(l).marginBlockEnd }; }) : '';
    console.log(port === '4344' ? 'REAL' : 'PATCHED', f, JSON.stringify(s), 'rail', rail.status, JSON.stringify(list));
    if (port === '4345' && f === 0) await page.screenshot({ path: '/tmp/claude-0/qd/final2-patched-p0.png' });
  }
  await page.close();
}
// rail slot mid-pin on the real tree: does it drop like ours?
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4344/?tier=high&hud');
await page.waitForFunction(() => window.__qdt, null, { timeout: 30000 });
const g = await page.evaluate(() => { const r = document.querySelector('[data-scene-slot="rail"]').getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
for (const f of [0.3, 0.6, 0.9]) {
  await page.evaluate((y) => scrollTo(0, y), g.top + f * (g.h - 900));
  await page.waitForTimeout(3000);
  console.log('REAL rail', f, JSON.stringify(await page.evaluate(() => window.__qdt.dumpInfo().slots.find(x => x.slotId === 'rail'))));
}
await b.close();
