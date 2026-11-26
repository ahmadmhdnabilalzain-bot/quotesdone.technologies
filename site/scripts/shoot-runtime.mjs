// Dev helper (not a test): render every debug harness at fixed progress values and save the
// stage as PNG, plus the HUD numbers. Run it against two builds and compare with --compare.
//
//   node scripts/shoot-runtime.mjs shoot   <baseUrl> <outDir> [WxH] [dpr] [tier]
//   node scripts/shoot-runtime.mjs compare <beforeDir> <afterDir> <outDir>
//
// shoot:   writes <outDir>/<shot>.png and <outDir>/stats.json (draw calls, triangles, est. MB,
//          fps and p95 over ~2.5 s of live frames; SwiftShader = relative numbers only).
// compare: writes <outDir>/<shot>-compare.png (before | after, labelled) and prints a table.
//
// Chromium runs SwiftShader (a CPU rasteriser). Absolute fps means nothing; use it only to compare
// two builds on the same machine. Frames are frozen (?scene=..&p=..), so time is 0.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SHOTS = [
  { id: 'logo', path: '/debug/logo/', scene: 'hero', ps: [0, 0.3, 0.6] },
  { id: 'rail', path: '/debug/rail/', scene: 'rail', ps: [0.3, 0.6, 1], extra: '&shot' },
  { id: 'quotesdone', path: '/debug/quotesdone/', scene: 'quotesdone', ps: [0.3, 0.6, 0.9] },
  { id: 'sonobolt', path: '/debug/sonobolt/', scene: 'sonobolt', ps: [0.22, 0.5, 0.95] },
  { id: 'mubinflow', path: '/debug/mubinflow/', scene: 'mubinflow', ps: [0.3, 0.62, 0.95] },
  { id: 'company', path: '/debug/close/', scene: 'company', ps: [0.55] },
  { id: 'close', path: '/debug/close/', scene: 'close', ps: [0.3, 0.5, 0.75] },
];

const LAUNCH = { args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

async function shoot(base, out, size = '1440x900', dpr = '2', tier = 'high') {
  const [width, height] = size.split('x').map(Number);
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(dpr) });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const stats = {};
  for (const shot of SHOTS) {
    for (const p of shot.ps) {
      const name = `${shot.id}-p${p.toFixed(2)}`;
      try {
        // Pass 1: the picture, without ?debug/?hud (the HUD would be baked into the image).
        const url = `${base}${shot.path}?tier=${tier}&level=0&scene=${shot.scene}&p=${p}${shot.extra ?? ''}`;
        await page.goto(url);
        await page.waitForSelector(`[data-scene-slot="${shot.scene}"][data-scene-state="live"]`, { timeout: 60000 });
        // Bring the stage into view (pinned sections are tall), then let the frame settle.
        await page.evaluate((s) => document.querySelector(`[data-scene-slot="${s}"] [data-scene-stage]`)?.scrollIntoView({ block: 'center' }), shot.scene);
        await page.waitForTimeout(2500);
        const stage = page.locator(`[data-scene-slot="${shot.scene}"] [data-scene-stage]`).first();
        // Screenshot the viewport area the stage covers (the canvas is fixed behind the DOM).
        const box = await stage.boundingBox();
        const clip = box ? { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(width - Math.max(0, box.x), box.width), height: Math.min(height - Math.max(0, box.y), box.height) } : undefined;
        await page.screenshot({ path: join(out, `${name}.png`), clip });
        // Pass 2: the numbers, with ?hud (window.__qdt). ~2.5 s of live frames.
        await page.goto(`${url}&hud`);
        await page.waitForFunction(() => window.__qdt && window.__qdt.dumpInfo().framesDrawn > 3, null, { timeout: 60000 });
        await page.evaluate((s) => document.querySelector(`[data-scene-slot="${s}"] [data-scene-stage]`)?.scrollIntoView({ block: 'center' }), shot.scene);
        await page.waitForTimeout(2500);
        stats[name] = await page.evaluate(() => {
          const d = window.__qdt.dumpInfo();
          return { calls: d.drawCalls, tris: d.triangles, mb: +(d.estimatedBytes / 1048576).toFixed(1), fps: +d.fps.toFixed(1), p95: +d.p95Ms.toFixed(1), level: d.ladderLevel, look: d.look ?? null };
        });
        console.log(name, JSON.stringify(stats[name]));
      } catch (error) {
        console.log(name, 'FAILED', String(error).split('\n')[0]);
        stats[name] = { failed: String(error).split('\n')[0] };
      }
    }
  }
  writeFileSync(join(out, 'stats.json'), JSON.stringify(stats, null, 2));
  console.log('errors:', errors.slice(0, 10));
  await browser.close();
}

async function compare(beforeDir, afterDir, out) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const before = existsSync(join(beforeDir, 'stats.json')) ? JSON.parse(readFileSync(join(beforeDir, 'stats.json'), 'utf8')) : {};
  const after = existsSync(join(afterDir, 'stats.json')) ? JSON.parse(readFileSync(join(afterDir, 'stats.json'), 'utf8')) : {};
  for (const file of readdirSync(afterDir).filter((f) => f.endsWith('.png'))) {
    const name = file.replace(/\.png$/, '');
    if (!existsSync(join(beforeDir, file))) continue;
    const a = readFileSync(join(beforeDir, file)).toString('base64');
    const b = readFileSync(join(afterDir, file)).toString('base64');
    const png = await page.evaluate(async ({ a, b, name }) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${src}`; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const scale = Math.min(1, 1400 / (ia.width * 2));
      const w = Math.round(ia.width * scale);
      const h = Math.round(ia.height * scale);
      const c = document.createElement('canvas');
      c.width = w * 2 + 8;
      c.height = h + 28;
      const g = c.getContext('2d');
      g.fillStyle = '#0E1013';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(ia, 0, 28, w, h);
      g.drawImage(ib, w + 8, 28, w, h);
      g.fillStyle = '#ECEAE4';
      g.font = '14px sans-serif';
      g.fillText(`${name}  BEFORE`, 8, 19);
      g.fillText(`${name}  AFTER`, w + 16, 19);
      return c.toDataURL('image/png').split(',')[1];
    }, { a, b, name });
    writeFileSync(join(out, `${name}-compare.png`), Buffer.from(png, 'base64'));
    const s0 = before[name] ?? {};
    const s1 = after[name] ?? {};
    console.log(`${name.padEnd(18)} calls ${s0.calls}->${s1.calls}  tris ${s0.tris}->${s1.tris}  MB ${s0.mb}->${s1.mb}  fps ${s0.fps}->${s1.fps}  p95 ${s0.p95}->${s1.p95}`);
  }
  await browser.close();
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'shoot') await shoot(...rest);
else if (mode === 'compare') await compare(...rest);
else console.log('usage: shoot <baseUrl> <outDir> [WxH] [dpr] [tier] | compare <beforeDir> <afterDir> <outDir>');
