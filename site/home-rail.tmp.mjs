import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user/9b064cfb-83e8-5dcc-93ba-031f00f7f77b/scratchpad/rail';
const port = process.argv[2] || '4371'; const tag = process.argv[3] || 'home';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?tier=high&debug`);
await page.waitForSelector('html[data-3d="live"]', { timeout: 40000 });
const geo = await page.evaluate(() => { const s = document.querySelector('.statements').getBoundingClientRect(); const p = document.getElementById('products').getBoundingClientRect(); return { sTop: s.top + scrollY, sBot: s.bottom + scrollY, pTop: p.top + scrollY, pBot: p.bottom + scrollY }; });
console.log(JSON.stringify(geo));
const vh = 900;
const stops = { 'statement2': geo.sTop + 1.0*vh + 0, 'handover-start': geo.pTop, 'handover-mid': geo.pTop + 0.25*vh, 'rail-0.3': geo.pTop + 0.45*vh + 0.3*(geo.pBot - geo.pTop - vh - 0.45*vh), 'rail-0.7': geo.pTop + 0.45*vh + 0.7*(geo.pBot - geo.pTop - vh - 0.45*vh), 'rail-1': geo.pBot - vh };
for (const [name, y] of Object.entries(stops)) {
  await page.evaluate(y => window.scrollTo(0, y), Math.round(y));
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('.qdt-hud, [data-qdt-hud]')?.remove());
  const s = await page.evaluate(() => window.__qdt.dumpInfo().slots.find(s => s.slotId === 'rail'));
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  console.log(name, Math.round(y), JSON.stringify(s));
}
if (errs.length) console.log('ERRORS', errs.join('\n'));
await b.close();
