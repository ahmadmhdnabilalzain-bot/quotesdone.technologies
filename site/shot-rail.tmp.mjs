// Temporary screenshot driver (scratch; deleted after use). Usage: node shot-rail.tmp.mjs <tag> p1 p2 ... [--rtl] [--w=1440 --h=900]
import { chromium } from '@playwright/test';
const args = process.argv.slice(2);
const tag = args.shift();
const rtl = args.includes('--rtl');
const w = Number((args.find(a => a.startsWith('--w=')) || '--w=1440').slice(4));
const h = Number((args.find(a => a.startsWith('--h=')) || '--h=900').slice(4));
const ps = args.filter(a => !a.startsWith('--'));
const OUT = '/tmp/claude-0/-home-user/9b064cfb-83e8-5dcc-93ba-031f00f7f77b/scratchpad/rail';
const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type()==='error' || m.type()==='warning') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
for (const p of ps) {
  await page.goto(`http://127.0.0.1:4371/debug/rail/?scene=rail&p=${p}&tier=high&debug&shot${rtl ? '&rtl' : ''}`);
  await page.waitForSelector('[data-scene-slot="rail"][data-scene-state="live"]', { timeout: 40000 }).catch(() => errs.push('not live at ' + p));
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.qdt-hud, [data-qdt-hud]')?.remove());
  const file = `${OUT}/${tag}-p${p}${rtl ? '-rtl' : ''}.png`;
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => { const d = window.__qdt?.dumpInfo(); return d ? { calls: d.drawCalls, tris: d.triangles, geo: d.geometries } : null; });
  console.log(file, JSON.stringify(info));
}
if (errs.length) console.log('ERRORS:\n' + [...new Set(errs)].join('\n'));
await b.close();
