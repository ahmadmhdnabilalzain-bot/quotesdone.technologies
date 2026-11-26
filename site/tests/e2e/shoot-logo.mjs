// Dev helper (not a test): render the logo scene at several progress values and save PNGs.
//   node tests/e2e/shoot-logo.mjs <baseUrl> <outDir> [p1,p2,...] [WxH]
import { chromium } from '@playwright/test';
const [base = 'http://127.0.0.1:4361', out = 'tests/artifacts', list = '0,0.05,0.16,0.35,0.6,0.72,0.85,0.95,1', size = '1440x900'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
for (const p of list.split(',').map(Number)) {
  await page.goto(`${base}/debug/logo/?tier=high&debug&scene=hero&p=${p}`);
  await page.waitForSelector('[data-scene-slot="hero"][data-scene-state="live"]', { timeout: 30000 });
  await page.waitForFunction(() => window.__qdt && window.__qdt.dumpInfo().framesDrawn > 3);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/logo-${width}-p${p.toFixed(3)}.png` });
  const info = await page.evaluate(() => { const d = window.__qdt.dumpInfo(); return { calls: d.drawCalls, tris: d.triangles, mb: (d.estimatedBytes / 1048576).toFixed(1), phase: document.querySelector('[data-logo-hero]').dataset.logoPhase }; });
  console.log(p, JSON.stringify(info));
}
console.log('errors:', errors.filter((e) => !/GPU stall|swiftshader/i.test(e)).slice(0, 10));
await browser.close();
