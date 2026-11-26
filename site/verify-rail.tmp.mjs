import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user/9b064cfb-83e8-5dcc-93ba-031f00f7f77b/scratchpad/rail';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4371/?tier=high&debug');
await page.waitForSelector('html[data-3d="live"]', { timeout: 40000 });
const pTop = await page.evaluate(() => document.getElementById('products').getBoundingClientRect().top + scrollY);
for (const f of [0.1, 0.3, 0.55]) {
  await page.evaluate(y => scrollTo(0, y), Math.round(pTop + f * 900));
  await page.waitForTimeout(900);
  const op = await page.evaluate(() => getComputedStyle(document.querySelector('.statements__line')).opacity);
  const lineY = await page.evaluate(() => document.querySelector('.statements__line').getBoundingClientRect().top);
  console.log('handover +' + f + 'vh: DOM line opacity', op, 'at y', Math.round(lineY));
  if (f === 0.55) await page.screenshot({ path: `${OUT}/final-handover-055.png` });
}
const before = await page.evaluate(() => document.getElementById('products').getBoundingClientRect().height);
await page.evaluate(() => window.__qdt.loseContext());
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ h: document.getElementById('products').getBoundingClientRect().height, state: document.querySelector('[data-scene-slot="rail"]').dataset.sceneState, beat: document.querySelector('.statements__beat').getBoundingClientRect().height }));
console.log('products height before', before, 'after context loss', JSON.stringify(after));
await page.screenshot({ path: `${OUT}/final-context-lost.png` });
await page.close();
const hi = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
for (const p of [0, 1]) {
  await hi.goto(`http://127.0.0.1:4371/debug/rail/?scene=rail&p=${p}&tier=high&debug&shot`);
  await hi.waitForSelector('[data-scene-slot="rail"][data-scene-state="live"]', { timeout: 40000 });
  await hi.waitForTimeout(800);
  await hi.evaluate(() => document.querySelector('.qdt-hud, [data-qdt-hud]')?.remove());
  await hi.screenshot({ path: `${OUT}/final-dpr2-p${p}.png` });
  await hi.screenshot({ path: `${OUT}/final-dpr2-p${p}-crop.png`, clip: { x: 820, y: 160, width: 420, height: 320 } });
}
await b.close();
