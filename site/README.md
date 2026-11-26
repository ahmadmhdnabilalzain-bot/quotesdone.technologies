# QuotesDone Technologies hub site

Astro static site with a plain three.js runtime. Milestone **M0: foundation**. The plan lives in
`../docs/website/structure-v1.md`; the words come from `../docs/website/copy-v1.md`.
Build order is **desktop-first**: the 'high' tier is the design target (ledger #36), and phones
are adapted afterwards. The tiers, the stills fallback and the iPhone 13 test stay in place.

## Known limits (phone phase)
- The fixed canvas follows each stage's rectangle on the main thread. During native touch
  scrolling on iOS it can lag a frame behind the DOM. Measure this on a real iPhone. The fix
  options are a canvas per pinned scene, or sticky stages.
- All fps and p95 figures from the e2e runs come from SwiftShader (a CPU rasteriser) and say
  nothing about real devices.

## Run

Requires Node >= 22.23.4 (Astro 7). Chromium for e2e is the preinstalled Playwright build (1.63.0).

```bash
cd site
npm install            # exact versions; package-lock.json included
npm run dev            # http://localhost:4321
npm run build          # -> dist/
npm run preview        # serve dist/ on :4321 (Astro 7 also has `astro preview --background` / `stop`)
```

## Scripts

| Script | What it does |
|---|---|
| `dev` | Copies decoders, then starts the Astro dev server |
| `build` | Copies decoders, then builds the static site to `dist/` |
| `preview` | Serves `dist/` on port 4321 |
| `test` | Vitest unit tests (`tests/unit`) |
| `test:watch` | Vitest in watch mode |
| `test:e2e` | Builds, then runs Playwright (`tests/e2e`) at desktop 1440x900 @2x and iPhone 13 390x844 @3x (Chromium + SwiftShader; emulation only). Screenshots go to `tests/artifacts/` |
| `check` | Content rules on `dist/` (`scripts/check-content.mjs`), then transfer budgets (`scripts/check-budgets.mjs`). Run after `build` |
| `lint` | `astro check` (TypeScript strict, .astro and .ts), then `scripts/lint-source.mjs` (project rules, below) |
| `decoders` | Copies the meshopt decoder from `three` into `public/decoders/` |

Full local gate: `npm run lint && npm test && npm run build && npm run check && npx playwright test`.

## URL flags

All flags are parsed in one place: `src/lib/flags.ts`.

| Flag | Effect |
|---|---|
| `?debug` | Verbose `qdt:*` logs, shader error checks, the HUD, and `window.__qdt` |
| `?hud` | The HUD only: fps, p95 frame ms, draw calls, triangles, geometries/textures, estimated MB, tier and reasons, ladder level, DPR, GPU string, each slot's status and progress, last error |
| `?tier=still\|low\|mid\|high` | Force a tier. Numeric aliases: `0`=still, `1`=low, `2`=mid, `3`=high |
| `?still` | Force the fallback (no 3D is fetched) |
| `?level=<n>` | Pin the quality ladder (0 = full, 3 = lowest) |
| `?scene=<slot or scene id>&p=<0..1>` | Freeze one slot at one progress, with time frozen at 0. For bug reports |

`window.__qdt` (only with `?debug` or `?hud`) provides `dumpInfo()`, `setProgress(id, p)`,
`loseContext()`, `restoreContext()`, `renderer` and `host`.

Planned and not built yet: `?gui`, `?nointro`, `?rtl`, `?seed`, and the `/debug` gallery.

## Folder map

```
src/
  pages/index.astro        thin route: composes components, runs lib/boot.ts
  layouts/Base.astro       <html lang dir>, head/meta, skip link, header, <main>, footer
  components/              Header, Footer, Hero, Statements, ProductIndex, Closing, SceneSlot
  content/en/              home.json, ui.json: every visible string (no copy in components)
  styles/                  tokens.css (palette, 2.4-unit grid, type, named easing), base.css, motion.css
  assets/logo/             copies of brand/logo/final masters (see "Logo assets")
  lib/                     boot.ts (pre-3D entry), flags.ts, log.ts, budgets.ts, svg.ts
  motion/                  clock.ts (gsap.ticker + Lenis), scroll.ts (ScrollTrigger -> slot state),
                           reveal.ts (line/word reveals), easing.ts
  three/
    mount.ts               3D chunk entry (dynamic import): wires everything below
    runtime/               renderer, presenter (post pass), environment, loop, tiers, tier-types,
                           ladder, frame-stats, scene (contract + SceneHost), loader, disposal,
                           hud, errors
    scenes/registry.ts     scene id -> lazy loader
    scenes/smoke/          the pipeline-proof scene (index.ts, params.ts, README.md)
public/decoders/           meshopt decoder (copied at dev/build, git-ignored)
scripts/                   check-budgets, check-content, content-rules, lint-source, copy-decoders
tests/unit, tests/e2e      Vitest, Playwright; tests/artifacts/ = screenshots (git-ignored)
```

### Logo assets
`src/assets/logo/` holds unmodified copies of `brand/logo/final/wordmark-compact.svg`,
`wordmark-dark.svg`, `wordmark-light.svg` and `mark-small.svg`. `public/favicon.svg` is a copy of
`mark-small.svg`. They are inlined at build time (`?raw` plus `lib/svg.ts`). Only width, height,
title and the ARIA attributes are changed, never a path. Colour comes from CSS `fill`. When the
masters change, copy them again. **Never edit the copies.**

## How the page works

1. The HTML carries every word plus a **still** in each scene slot. This is the default state for
   no-JS, reduced motion, no WebGL2, Save-Data, a software GPU, and any failure.
2. `lib/boot.ts` (pre-3D, about 55 KB gzipped, mostly GSAP, ScrollTrigger, SplitText and Lenis)
   works out the tier, starts the clock and runs the line reveals.
3. After `load` and idle, and only if the tier is not `still`, `three/mount.ts` is imported. It
   creates **one** fixed full-viewport canvas behind the content. Each scene draws into its slot's
   **stage rectangle** ("one canvas, many views"), so stages scroll with the page.
4. A slot changes `still -> loading -> live` only after a real frame. The still fades out
   (opacity only), and the words never move.

### Tiers (`three/runtime/tiers.ts`, `tier-types.ts`)

| Tier | When | Render |
|---|---|---|
| still | no WebGL2, reduced motion, Save-Data, software GPU (SwiftShader, llvmpipe) | stills; three.js never fetched |
| low | deviceMemory < 4 GB, phone with 2 cores or fewer | DPR 1, no MSAA, no vignette, no contact shadow |
| mid | phones (an iPhone 13 lands here without deviceMemory or a GPU string), tablets, desktops with fewer than 4 cores | DPR 1.5, MSAA 4, vignette |
| high | capable desktop (**design target**) | DPR 2, MSAA 4, vignette, soft contact shadow |

All tiers get AgX tone mapping, sRGB output and dithering in the post pass. Missing signals
count as neutral. The ladder (`ladder.ts`) steps down only at rest (300 ms after the last
scroll), never steps up, and leaves a steady 30 Hz alone. Its steps are: contact shadow off,
then render scale 0.85, then 0.7.

## Adding a scene (the next step: home scenes 1 to 8)

1. Create `src/three/scenes/<id>/index.ts` with a default export that returns a `RenderableScene`
   (contract in `runtime/scene.ts`, unchanged from structure-v1 §6.2, plus the `object3d` and
   `camera` handles and an optional `applyQuality`). Copy `scenes/smoke/` as the template.
2. Put every tunable number in `params.ts` (value, min, max, description), and write a 20-line
   `README.md` covering what the scene shows, its copy slot, its progress map and its stills.
3. Follow the rules:
   - `update(progress, timeMs)` must be **pure**. Compute from the inputs and never accumulate.
   - Never touch the DOM, the scroll position or the clock.
   - Never call `requestAnimationFrame` or `setAnimationLoop`.
   - `dispose()` frees everything the scene created.
   - Use `ctx.envMap` (owned by the runtime, never disposed by a scene) and `ctx.tierConfig.detail`.
   - Long builds yield with `await ctx.yieldToMain()`.
   - Rhodamine is for light and status only. Never put it on or near the wordmark material.
4. Register it with one line in `scenes/registry.ts`, for example
   `logo: () => import('./logo/index.ts').then((m) => m.default)`.
5. Place it on a page:
   `<SceneSlot slot="logo" scene="logo" start="top top" end="bottom top">...DOM copy...</SceneSlot>`.
   Slot ids must be unique on the page. `start` and `end` (ScrollTrigger syntax) map scroll to
   progress 0..1. A pinned or full-bleed scene sizes its own stage (for example a sticky
   100svh stage) through the page CSS.
6. Add a unit test like `tests/unit/smoke-scene.test.ts` (determinism and dispose), and check the
   budget with `npm run build && npm run check`. Each scene is its own chunk, budget 120 KB gz.

**SceneHost rules for a long page with 8 scenes:**
- A scene builds when its stage is within 0.35 viewport heights.
- It is freed beyond 0.4 (hysteresis).
- At most **two** scenes are live (loading or ready), the nearest first, and the farthest is evicted.
- One build runs at a time.
- At most two visible scenes draw per frame.
- An error in `create`, `update`, `resize`, `applyQuality` or a draw turns **that** slot into its
  still for the rest of the visit. The other slots keep running.

## Debugging a 3D problem, step by step

1. **Blank or missing 3D?** Open `?debug`. Read the HUD tier line: it shows the tier and *why*
   (for example "software renderer" or "prefers-reduced-motion"). Check the console for
   `[qdt:*]` lines. Errors always print, and info prints with `?debug`.
2. **Force the path.** Try `?tier=high&debug`. If it is still blank, look at the slot's
   `data-scene-state` and `data-scene-reason` in the Elements panel (`still`, `loading`, `live`
   or `failed`, plus the reason).
3. **Isolate the scene.** Use `?scene=<id>&p=0.5&debug` to freeze it. In the console run
   `__qdt.dumpInfo()` (slots, calls, triangles, tier, DPR, GPU) and `__qdt.setProgress('<id>', 0.2)`.
4. **Wrong frame at one scroll position?** Because `update` is pure, the same `?scene=&p=` link
   reproduces it on any machine. Send that link.
5. **Slow?** Read `p95` and `ladder` in the HUD. Pin with `?level=0` against `?level=3` to see
   whether the cost is fill rate (the scale steps help) or geometry and draw calls (they do not).
   Compare `calls` and `tris` with `GPU_BUDGETS` in `lib/budgets.ts`.
6. **Context loss.** `__qdt.loseContext()` simulates one. The slot must go to its still and the
   H1 must not move (an e2e test covers this). One restore is attempted, and a second loss means
   stills for the rest of the visit.
7. **Build fails on a check?** The message names the file and the rule (`check-content`), or the
   chunk and its budget (`check-budgets`).

## Project lint rules (`scripts/lint-source.mjs`)

- `requestAnimationFrame` and `setAnimationLoop` are allowed only in `three/runtime/loop.ts`
  (one clock). A unit test also enforces this.
- Logical CSS properties only: no `left`, `right`, `margin-left` and the like.
- No `any` in `src/three` or `src/motion`.
- No three.js import on the pre-3D path (boot, flags, log, tiers, errors, motion).

## Decisions made in M0

- **Versions (exact):**
  - astro 7.4.13, three 0.187.0, @types/three 0.187.0, gsap 3.15.1, lenis 1.3.29 and vitest 5.1.2,
    as planned.
  - **typescript 6.0.3, not 7.0.2.** `@astrojs/check` 0.9.12 declares a peer dependency of
    `typescript ^5 || ^6` (this resolves structure-v1 §3.9 item 2).
  - **@playwright/test 1.63.0, not 1.65.1,** to match the preinstalled Chromium build. Set
    `QDT_CHROMIUM_PATH` to use another browser binary.
- **Astro 7 preview has a background mode and a lock file** (`astro preview --background` / `stop`
  / `status`). On the first e2e run, Playwright's server exited at once, reporting another
  preview "already running". The cause was not pinned down. The e2e server now starts with
  `--ignore-lock`, so Playwright owns its own process.
- **Software GPUs get stills.** A CPU rasteriser cannot hold a scroll scene. The e2e tests pin
  `?tier=high` (desktop) and `?tier=mid` (iPhone 13) to exercise the real paths on SwiftShader.
- **One canvas, many stages,** with transparent output and premultiplied alpha, so the page's CSS
  Carbon shows through. Clearing to Carbon put it through tone mapping and left a visible seam.
- **One shared render target** (grow-only) for all scenes, capped by `TierConfig.maxTargetPixels`
  (high 3.1 MP, mid 1.1 MP, low 1.0 MP).
  - A half-float MSAA x4 target costs about 56 B per pixel. Without the cap, a full-bleed
    1440x900 stage at DPR 2 would need about 290 MB, against the 192 MB 'high' budget.
  - With the cap, such a stage renders internally at about DPR 1.55. Smaller stages keep the full
    DPR 2: the hero stage measures about 47 MB in e2e.
  - Revisit this if full-bleed scenes look soft. The options are MSAA 2 for large stages, or
    a budget raise recorded in structure-v1 §4.1.
- **GPU warm-up:** the host awaits `renderer.compileAsync()` before a slot goes live, so
  shaders never compile mid-scroll. A build (chunk, create, prepare) that takes longer than 15 s
  fails its slot, so one hung build cannot block the other scenes.
- **Boot runs from `Base.astro` on every page.** Pages without a `[data-scene-slot]` never load
  three.js.
- **The canvas is `position: fixed; inset: 0; inline-size/block-size: 100%`,** and its buffer is
  sized from its own client box, not from `innerWidth` and `innerHeight` (a replaced element
  ignores `inset` stretching without explicit sizes).
- **The post pass** is a custom full-screen triangle: AgX tone mapping, sRGB, an optional vignette,
  then dither after the sRGB step. There is no `postprocessing` library and no bloom.
- **The contact shadow** in the smoke scene is an analytic radial falloff plane. It is cheap and a
  placeholder for the "render once" depth contact shadow in §3.3.
- **The meshopt decoder** is copied from `three` into `public/decoders/`. It embeds its wasm as
  base64, so the CSP will need `'wasm-unsafe-eval'` once a .glb loads. `loader.ts` is type-checked
  but not exercised in M0, because no .glb exists yet.
- **No font is downloaded.** It is a system stack until the owner picks the Latin and Arabic
  family (Q7).
- **Every build is `noindex`** until launch (M5).
- **Nav lists Products only.** Company and Contact pages do not exist yet, so there are no dead links.

## Inner pages and plumbing (Company, Products, Contact, Legal)

Pages: `/company`, `/products`, `/products/<slug>` (one template in `src/pages/products/[slug].astro`, driven
by `src/content/en/products/*.json`), `/contact`, `/legal`, `/privacy`, `/terms`, `404`. Shared layout:
`src/layouts/Inner.astro` (breadcrumb, the one H1, lede) and `src/components/inner/`. Styles: `src/styles/inner.css`
(`.page-*`). Words: `src/content/en/company.json` and `pages.json` (no copy in templates).

- **Launch switch (one place):** `INDEXING_ENABLED` in `src/lib/site.ts`. While `false`, every page has `noindex`
  and `/robots.txt` (generated by `src/pages/robots.txt.ts`) disallows everything. `SITE_ORIGIN` there is the planned
  domain (not purchased yet) and feeds canonical URLs, the sitemap and JSON-LD.
- **Arabic:** add `'ar'` to `BUILT_LOCALES` in `site.ts` and hreflang pairs plus sitemap alternates switch on.
- **Dev-only notes:** `<DevNote>` renders only in `npm run dev`. Owner-confirm items (company email and phone,
  founder line, the Sonobolt `ownerToConfirm` text) show there and never in a build.
- Product pages: no link for MubinFlow; `app.sonobolt.com` is never linked.

### Before launch (blocking)
1. **Lawyer-written text is required** for `/legal`, `/privacy` and `/terms`. They are short factual pages
   (who operates the site, and links to each product's own legal pages, URLs checked 2026-11-26). Each page
   source carries an HTML comment `LAWYER-WRITTEN TEXT REQUIRED`. The privacy statement ("no accounts, forms,
   cookies or analytics") describes this build; re-check it against the final hosting and analytics decision.
2. Owner confirms the licence wording (quotesdone.com and sonobolt.com print it differently), the company email
   and phone (`pages.json` `contact`), and Sonobolt "Mix: available" (`products/sonobolt.json`).
3. No `og:image` yet (no approved share image). Add one in `Base.astro` when it exists.
4. Set `INDEXING_ENABLED = true` and the real `SITE_ORIGIN`.

E2E for these pages: `tests/e2e/pages.spec.ts` (all pages 200, one H1, landmarks, skip link, no console errors,
no "L.L.C.", nav and footer links, 404 status, JS-disabled words, robots and sitemap).
