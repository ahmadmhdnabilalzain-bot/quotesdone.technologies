import { chromium } from '@playwright/test';
const ps = (process.argv[2] ?? '0,0.15,0.3,0.5,0.66,0.78,0.9,1').split(',');
const tag = process.argv[3] ?? 'v1';
const extra = process.argv[4] ?? '';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type()==='error' || m.type()==='warning') console.log(m.type(), m.text().slice(0,300)); });
page.on('pageerror', e => console.log('pageerror', e.message));
for (const p of ps) {
  await page.goto(`http://127.0.0.1:4344/debug/quotesdone/?tier=high&scene=quotesdone&p=${p}${extra}`);
  await page.waitForSelector('[data-scene-slot="quotesdone"][data-scene-state="live"]', { timeout: 40000 });
  await page.waitForTimeout(600);
  const el = await page.$('[data-scene-stage]');
  await el.screenshot({ path: `/tmp/claude-0/qd/${tag}-p${p}.png` });
  console.log('shot', p);
}
await b.close();
