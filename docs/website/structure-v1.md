# QuotesDone Technologies hub site: structure and technical plan v1

Draft for the owner. 26 November 2026. This is a plan, not code. The words come from `docs/website/copy-v1.md` (the copy deck, written in parallel). This document only says where words go, using the copy deck's section numbers. Every decision below is marked:

- **[fixed]**: does not depend on the owner's reference-site video. The video will not change it.
- **[video]**: a starting proposal. It may change once the video arrives.

Sources read for this plan, all on 26 November 2026: `docs/HANDOVER.md`, `docs/LEDGER.md`, `docs/references/website-inspiration.md`, `brand/logo/README.md`, `brand/logo/final/strokes.json` (all 43 parts listed and checked), `brand/logo/final/preview.png`, the live sonobolt.com (scraped), the repo `djai-engine/site-v3` (README, `build.mjs`, `concepts/live.js`, `_headers`, `.github/workflows/site-preview.yml`), and the repo `quotesdone` (`package.json`, `next.config.mjs`, `vercel.json`, `src/components/visual/HeroScene.tsx`). Library versions were checked against the npm registry on the same day (section 3.9).

---

## 1. Goals and non-goals

### Goals
1. **The site is the company's flagship object.** A visitor should know in 5 seconds that this is a serious technology company, and in 60 seconds what each product does and how far along it is. [fixed]
2. **The 3D carries meaning.** Every 3D moment is built from something true: the logo's real 43 stroke parts, a product's real mechanism, its real status. Nothing is decoration for its own sake. This is the main thing that keeps the site from looking AI-made or template-made. [fixed]
3. **Reach well past the 99designs minimum.** The bar is real-time 3D with scroll-driven choreography at 60 fps on desktop and good phones, against award-level live sites. The owner's video will set the exact reference. [video for the reference, fixed for the bar]
4. **Every word is in the HTML.** Search engines, screen readers, no-JS visitors and slow phones get the whole story. The 3D only adds to it. [fixed]
5. **Fast on a UAE phone on 4G.** The first meaningful paint is text, never the canvas. The 3D loads after it, steps down on weaker devices, and turns into still images when it must (section 4). [fixed]
6. **Room for many products.** Adding product number 4 means adding one content file and one scene module. No redesign. [fixed]
7. **Arabic later without a rewrite.** RTL is built into the layout, the type and the scene parameters from the first commit (section 5). [fixed]
8. **Organised, easy to debug.** One scene contract, one render loop, one logger, a `?debug` HUD and a `/debug` gallery, plus documented scripts (section 6). [fixed]

### Non-goals (v1)
- Not a product app. No sign-in, no accounts, no payments. Each product keeps its own site and its own brand. The hub links out.
- No ERP ("Manar One"). It is excluded until it is renamed (LEDGER #18).
- No contact form backend in v1 (section 2.6). Email and phone links, like Sonobolt.
- No blog, careers, investor or press pages in v1. The sitemap leaves room for them.
- No sound. The scenes are silent. Autoplay audio is hostile, and Sonobolt's scenes are silent too.
- No made-up facts: no user counts, partners, awards, "trusted by" logo rows or counters (copy deck §1, rules 5 to 7).
- No third-party tracking at launch unless the owner asks for it (open question Q9).
- No WebGPU-only features in v1 (section 3.3).

---

## 2. Sitemap and pages

### 2.1 Sitemap

```
/                          Home                     (indexed)
/company                   Company                  (indexed)
/products                  Products index           (indexed)
/products/quotesdone       QuotesDone               (indexed)
/products/sonobolt         Sonobolt                 (indexed)
/products/mubinflow        MubinFlow                (indexed; status "In development")
/contact                   Contact                  (indexed)
/legal                     Legal notice: entity, licence, address   (indexed)
/privacy                   Privacy policy           (indexed)
/terms                     Website terms of use     (indexed)
/404                       Not found                (served with status 404; noindex)
/debug                     3D scene gallery         (preview/staging builds only; never built for production)
/ar/...                    Arabic mirror of every page above   (phase 2; section 5)
```

URL rules [fixed]: lower case, no trailing `.html`, a trailing slash policy chosen once in config and enforced by redirect. Products live under `/products/<slug>` so product 4 is just one more slug. `/privacy` and `/terms` are top-level, as on sonobolt.com and quotesdone.com. The owner's existing sites already use those addresses, so people expect them.

Global chrome on every page:
- **Header**: the wordmark, always as the **compact cut** (`wordmark-compact.svg`). `brand/logo/README.md` requires the compact cut whenever the wordmark is *rendered* under about 480 px wide, and a header logo is under that on every screen. Below about 360 px viewport width the header shows the mark alone. Then the navigation from copy deck §6: Products (a dropdown listing each product with its status), Company (About, Principles), Contact. Later: the language switch ("العربية / English").
- **Footer**: product list with statuses, company links, legal links, and the legal identity line (copy deck §5). It names "Sole Establishment" and never "L.L.C.".
- **Skip link**, a visible focus ring and a `<main>` landmark.

### 2.2 Home `/`

**Purpose:** the company in one scroll. Show the brand, then the products as objects, then the company, then contact.
**Content needs:** copy deck §2 (hero headline pick "Software, built and run in Dubai.", sub-line, the four statements, the product index, the closing). Product facts and statuses come from copy deck §4 and the claims register §7 only.

#### The scroll narrative

The whole Home page shares one visual idea: **the datum line**. The logo is built from separate parts with exact 2.4-unit joints (`strokes.json`: "Joints are 2.4 units"). The site treats the logo as an engineered assembly. The seam between parts becomes a thin horizontal line, the datum. It runs through the page, becomes the rail the products sit on, and ends at the Q mark. Every scene is either on that line or seen from it. [fixed: the idea. video: pacing, camera and lengths]

The materials come from the logo palette:
- **Carbon** `#0E1013`: the void and dark anodised parts.
- **Alloy** `#ECEAE4`: bead-blasted metal with machined chamfers that catch one key light.
- **Rhodamine** `#E3185B`: used only as light. It is a thin datum or laser line and a status indicator. It never colours, lights or reflects on the wordmark (section 2.2.2).

Scene lengths below are in viewport heights (vh) of scroll on desktop. Phones use the same order with shorter pins (section 4.4).

| # | Scene | What the visitor sees | What they feel | What moves | What is 3D | Copy slot |
|---|---|---|---|---|---|---|
| 1 | **Assembly** (logo reveal) | **1a, 0 to 2.4 s, autoplay:** Carbon screen. The wordmark draws itself stroke by stroke in Alloy, in the `order` from `strokes.json`. This is a 2D SVG and CSS animation, so it needs no JavaScript bundle and starts on first paint. A Rhodamine datum line then draws under the wordmark, never through it. **1b, when WebGL is ready:** the canvas renders the same frame through an orthographic camera matched to the SVG's viewBox. The SVG and canvas swap invisibly. The flat strokes then gain depth: each of the 43 parts extrudes to a machined bar with a 0.6-unit chamfer, and the camera tilts to a low raking angle. **1c, scroll 0 to 120 vh:** an *exploded view*. The 43 parts separate along their joint directions and in depth, like an engineering drawing, with hairline leader lines to the joints. **1d, scroll 120 to 180 vh:** the parts re-seat, the camera returns to the front, and the wordmark travels up and shrinks into the header logo's exact position. As its rendered width passes below 480 px, the 2.4-unit joints close to zero, which is exactly the compact cut. "The seams seal" is the last beat on every screen size. Then the canvas hands off to the DOM SVG (`wordmark-compact.svg`). | Precision, weight, intent. "These people engineer things." | Strokes (dash offset), parts (translate and rotate per part), camera, light sweep along the chamfers | The 43 extruded parts (line 1 QUOTESDONE: 18 parts; line 2 TECHNOLOGIES: 25 parts), the datum line, one area key light, a procedural environment | §2 hero headline (H1) and sub-line, in the DOM from first paint, under the logo |
| 2 | **Datum** | The header logo is in place. The datum line now crosses the full viewport. The H1 and sub-line hold, set large in the text face. | Calm after the build. The company states itself. | Line words reveal (by line, never by letter; section 5). The datum line extends to both edges. | The datum line is a thin emissive mesh in the canvas, so it can become the rail. Very light. | §2 headline and sub-line, plus statement 1 ("Two products live. One in development.") |
| 3 | **The line** (portfolio) | The datum thickens into a machined rail seen in three-quarter view. It has docking stations. Three objects slide in and dock: QuotesDone and Sonobolt in finished Alloy, MubinFlow in **drafting linework** (edges, hidden lines and dimension marks, no solid surfaces), because it is in development. Further stations along the rail stay empty with chamfered caps. They show room for more without claiming anything. | Scale and structure: "a company with a line of products." Honest status at a glance. | Rail extrusion, objects docking with a small settle, a status light per station (Rhodamine dot = live; outline only = in development) | Rail plus three product objects at low detail | §2 product index (name, line, label) as DOM text anchored beside each station |
| 4 | **QuotesDone: "Sealed"** | The camera rides the rail to station 1. A single milled Alloy block splits into five identical sealed plates. Each has a thin cover plate over its face: anonymous and nameless, deliberately identical. On scroll they line up in a row to be compared. One plate advances, and its cover slides off along a machined track. The others dim and fall back. No fake data is engraved: the open face shows only the hub's own engraved datum mark. The DOM text says what is revealed and why. | "Open one. Leave the rest sealed." Privacy as a physical object. | Split, align, advance, cover slide, light falloff | One bevelled block that becomes five bevelled plates, each with a thin cover plate. All procedural. No textures. | §4 QuotesDone: headline, promise, 3 proof points, status, CTA |
| 5 | **Sonobolt: "One continuous line"** | Station 2. Several short metal ribbons (separate songs) travel along the rail. Each ribbon's profile is a waveform envelope. A faint beat grid appears. The ribbons slow, align to the grid and fuse at their joints into **one unbroken ribbon**. That ribbon winds into a flat coil: one continuous file. Three product slots sit beside it: Mix (lit, available) and Studio and Visuals (capped, "Coming soon"). | Flow, continuity, craft. Songs in, one mix out. | Ribbons translating, grid fade, seam fusion (shader blend at the joints), coil winding | Ribbons built procedurally from a 1D amplitude array, plus the coil (a parametric spiral sweep) | §4 Sonobolt: headline, promise, proof points, status of Mix / Studio / Visuals, CTA |
| 6 | **MubinFlow: "Shows its working"** | Station 3, all in drafting linework on Carbon, like a CAD sheet. A ring of 12 month segments turns to one month. That month's segment slides out and opens into layered strips: people, then payslips, then the salary file (SIF). Dimension lines and callouts trace one figure back to its rule. A small "In development" plate is drawn, not solid. | Rigour and honesty. "Payroll that shows its working." The drafting style *is* the status. | Ring index, segment extraction, strip layering, dimension lines drawing on | Edge-only geometry (LineSegments with dashed hidden lines). When the product launches, one `maturity` parameter switches it to solid Alloy. | §4 MubinFlow: headline, promise, "built so far" points, status. CTA only if the owner approves (copy deck Q). |
| 7 | **Company** | The camera pulls back along the rail to show all stations, the empty ones included, in a long quiet shot. The datum line dims to a hairline. Text takes over. | Steadiness. The people and the place behind the products. | Slow dolly. Principles revealed one at a time. | The rail at a distance (cheap) | §3 Company: About (short form) and the three principles. Link to /company |
| 8 | **Close** | The rail ends in an end cap: the Q mark, seated on the line. The mark is its own cut (`build.py`: `MARK` uses heavier strokes, gap 4.2 and tail 16, not the wordmark's Q), so the end cap is extruded from `mark.svg`'s outline by `geo-logo.mjs`, not reused from stroke part 0. The contact call sits beside it. The footer follows in plain DOM. | Arrival. A clear next step. | The end cap seats, the light settles, the canvas fades to Carbon before the footer | The Q part plus the rail end | §2 closing ("More is in development." / See the products) and the contact line from §5 |

#### 2.2.1 Why these objects, and why they are feasible

- **All geometry is procedural or generated from data. No modeller is needed for v1.** The logo comes from `strokes.json` outlines. The plates are bevelled boxes. The ribbons come from an amplitude array. The ring and strips are parametric. The rail is one extruded profile. This matches how both of the owner's live sites already build their 3D (Sonobolt's scenes and QuotesDone's `HeroScene.tsx` are procedural). It keeps every scene editable in code and debuggable with parameters. [fixed]
- **Generated at build time, not on the phone.** A build script turns each `outline` path into extruded, bevelled, triangulated geometry. It writes one `logo.glb` with 43 named meshes (names = stroke ids) and meshopt compression (section 3.6). The phone downloads finished geometry and does no triangulation work. Estimated size is under 150 KB. That is an estimate, to be measured in M0. [fixed]
- **The render state tells the truth about status.** Live products are solid. Products in development are linework. Future products are empty stations. This visual rule scales to many products without anyone writing a claim. [fixed]
- **Sonobolt's waveform data.** Sonobolt already ships measured waveform arrays to its own scenes. Its build deliberately limits which measured data leaves the repo (DJAI-272 in `build.mjs`). The hub will **not** copy those arrays without the owner's yes (open question Q4). The default is a synthetic, musically plausible envelope generated from a seed. Either way, nothing about how a mix is made is shown. [fixed]
- **QuotesDone's own hero already uses "sealed slabs"** (teal light, gold reveal; `HeroScene.tsx`). The hub's scene shares the idea, because the copy deck's headline is literally "Open one. Leave the rest sealed." But it is built in the hub's material language (Alloy, Carbon, no teal or gold), so it cannot be mistaken for the product's brand. The hero scene is still live in the QuotesDone repo. However, that repo's `next.config.mjs` records that the founder removed two *other* 3D pieces: the supplier portal's 3D environment and the 3D network map (QuotesDone instruction 525). We need the reason before we commit, because the M1 slice is built on this scene (open question Q3, part of the M0 gate). [video]

#### 2.2.2 The wordmark rules in 3D [fixed]
- Parts and joints come only from `strokes.json`. The logo is never redrawn or retyped. Draw order follows `order` (0 to 42).
- Draw-on uses the `centerline` with `stroke-width = weight` and butt caps where `butt_reproducible` is true. The 5 parts where it is false (Q bowl-tail, both N braces, C bowl, G bowl) are revealed with the centre-line stroke as a **mask** over the `outline` fill, exactly as `how_to_animate` says. Every draw-on ends by swapping to the `outline` fill, because the weights vary along strokes (`modulated: true`).
- **Rhodamine never inside the wordmark.** Wordmark meshes sit on a separate render layer. They are lit only by neutral lights and a neutral environment map, so Rhodamine elements cannot reflect onto them. A unit test checks that the wordmark material list contains no Rhodamine-tinted light or emissive.
- **Small sizes:** the rule follows the wordmark's *rendered* width, not the viewport. While the 3D wordmark renders 480 px wide or more, the open master joints stay. Below that, the joints close (gap animated to 0), which equals the compact cut. The header hand-off (scene 1d) always ends closed, on desktop too, because the header logo is always under 480 px.
- **Line 2 (TECHNOLOGIES)** is about a third the stroke weight of line 1 (weight about 20 vs 60 SVG units). It is extruded shallower, and on phones it is not extruded at all. It stays as the DOM SVG, positioned exactly under the 3D line 1.

#### 2.2.3 Clichés we will not use [fixed]
Floating glowing orbs. Gradient blobs and mesh gradients. Glassmorphism cards. Neon wireframe globes, or an Earth with arcs. Particles swarming into the logo. Bloom on everything. Iridescent or holographic chrome. Synthwave grids. Cyberpunk neon. Circuit boards, "AI brains" and data-stream matrix rain. Spinning phone or laptop mockups. Isometric device stacks. Bento grids of icon plus three words. Cursor-following blobs. Marquee rows of client logos. Animated counters of numbers we cannot prove. The Burj Khalifa or Dubai skyline, dunes, falcons or other UAE postcard imagery. Stock Spline or Sketchfab scenes. Letter-by-letter text scrambles. Noise grain used as a style. Parallax stock photos. Default easing everywhere (each motion gets a named curve; section 6.5).

How we avoid looking AI-made beyond that list:
- real data (the logo's actual parts and joints);
- one exact unit system (the 2.4-unit joint drives the layout gutter and line weights);
- one light, few materials, no colour noise;
- typography doing most of the work;
- copy that states checkable facts.

### 2.3 Company `/company`
- **Purpose:** who the company is, where it is, how it works. It gives trust without claims.
- **Sections:** (1) Headline and About (copy deck §3 About). (2) Principles, the three items (§3 Principles), each with a small linework diagram drawn on scroll: the price before payment, keep less, say what we do not know. (3) Products we run: three compact product rows linking to their pages. (4) The legal identity block: name, form, licence authority and number, address (from §5 and the claims register). (5) Optional founder line (copy deck §3, owner to confirm).
- **3D:** light. A short header scene of the rail seen end-on, so the datum line becomes a single point of light. Most of the page is typographic.
- **Content needs:** the owner confirms the founder line and the exact licence wording (Q6).

### 2.4 Products index `/products`
- **Purpose:** the full product line, now and later.
- **Sections:** (1) Intro line. (2) The rail. Each product is a station with its object at rest (the same modules as Home scenes 4 to 6 in an idle loop), its name, one-line description, status badge (Live / Coming soon / In development) and a link to its page. (3) Empty stations: "More is in development." (copy deck §2 closing).
- **3D:** the rail and objects at rest. The objects can be turned by drag (a small orbit with limits, keyboard arrows too). That is the one place the visitor touches the 3D directly.
- **Fallback:** a list of product cards with still images.

### 2.5 Product pages `/products/<slug>` (one template, three instances)
- **Purpose:** explain one product well enough to send a qualified visitor to its own site.
- **Sections, the same template for all:**
  1. Hero: the product's object at full detail, with its headline and promise (copy deck §4).
  2. How it works: 3 proof points. Each one is a short scroll beat on the object (e.g. QuotesDone: brief, then sealed quotes, then reveal).
  3. Status: available / coming soon / in development, written as it stands. Sonobolt shows Mix / Studio / Visuals.
  4. The product's own logo, from its own brand assets, unaltered, with "A product of QuotesDone Technologies".
  5. CTA to the product site (opens in the same tab, with `rel="noopener"`). MubinFlow has none unless the owner approves (copy deck §4).
  6. Next product (loops to the next slug).
- **Content needs:** each product's logo files (QuotesDone `public/brand/`, Sonobolt `docs/brand/kit/`, MubinFlow `docs/brand/logo/final/`) and the owner's permission to show them side by side (Q5). The two `[OWNER TO CONFIRM]` items in copy deck §4 (Sonobolt "available", and the app link) block those lines.
- **SEO:** `Product` or `SoftwareApplication` JSON-LD only where the facts are true (price and availability for live products only).

### 2.6 Contact `/contact`
- **Purpose:** reach the company.
- **v1 decision: no form.** It has email, phone and address, as sonobolt.com does. Sonobolt dropped its form because a static site has no endpoint to receive messages. A form needs a small serverless function, spam protection and a mailbox. That is a phase-2 option (a Cloudflare Worker plus a transactional email service) (Q8). [fixed]
- **Sections (copy deck §5):** headline "Write to us."; the identity block (name, Sole Establishment, licence line, authority, city); email (deck proposes `management@quotesdone.com`, owner to confirm); phone (`+971 56 791 8605`, owner to confirm); product-support pointers (support@sonobolt.com for Sonobolt, quotesdone.com/contact for QuotesDone), so support mail goes to the product, not the hub. Email has a copy button ("Copied.", copy deck §6).
- **3D:** none, or the datum line as a static hairline. This page must load instantly.

### 2.7 Legal `/legal`, `/privacy`, `/terms`
- **`/legal`:** the identity of the operator:
  - name, written exactly as on the licence;
  - legal form: Sole Establishment;
  - licence type and number, and the issuing authority (Dubai DET);
  - registered address;
  - contact details.

  The copy deck uses quotesdone.com's wording: "QuotesDone Technologies · Sole Establishment · DET Dubai Trader License No. 1633275". sonobolt.com prints "quotesdone technologies, a sole establishment, E Trader (Professional) licence no. 1633275 (Dubai DET)". **These do not agree yet. The owner checks the licence, we print what it says, and the other site is corrected to match** (Q6). Never print "L.L.C.".
- **`/privacy`:** what the hub collects. In v1 that is nothing beyond server logs, and no cookies unless analytics is approved. A short, true policy. Each product's own policy is linked, not copied.
- **`/terms`:** website terms of use (content, links to product sites, liability for the hub only).
- Rendered from Markdown in `src/content/legal/`, the Sonobolt pattern. The build fails if a `TODO` or `[OWNER TO CONFIRM]` marker reaches a built page. A lawyer review is recommended before launch.

### 2.8 404
- **Purpose:** recover the visitor.
- **Content (copy deck §6):** "Nothing here." / "The page you asked for doesn't exist. The products do." / See the products, plus links to Home and Contact. A small scene: one stroke part out of place on the datum line, which seats itself when hovered or focused. It is cheap, on brand and optional. Without WebGL it is a static SVG.
- It is served with HTTP 404 status (the static host's 404 handling), not a soft 200.

---

## 3. Technical architecture

### 3.1 Summary

| Layer | Choice | Version checked on npm, 2026-11-26 |
|---|---|---|
| Site framework | **Astro**, static output (`output: 'static'`), no UI framework islands | astro 7.4.13 (engines: Node >= 22.23.4) |
| Language | TypeScript, strict | see 3.9: pin to what `astro check` supports |
| 3D engine | **three.js**, `WebGLRenderer` (WebGL 2), vanilla, no React Three Fiber | three 0.187.0 (r187) |
| Scroll and timeline | **GSAP** with ScrollTrigger (scroll to progress), SplitText (line and word reveals), DrawSVG (no-WebGL logo fallback, optional) | gsap 3.15.1 |
| Smooth scroll | **Lenis**, desktop pointer devices only; native scroll on touch and with reduced motion | lenis 1.3.29 |
| Page transitions | Native cross-document View Transitions (`@view-transition { navigation: auto }`); a plain navigation where unsupported | browser feature, see 3.9 |
| Geometry and asset pipeline | Build-time generation in Node, glTF binary, meshopt compression via glTF-Transform; KTX2 textures only if authored textures appear | @gltf-transform/cli 4.5.1, meshoptimizer 1.3.0 |
| Images | `astro:assets` with sharp: AVIF plus WebP, responsive `srcset` | sharp 0.35.5 |
| Fonts | Self-hosted, subset WOFF2, at most 2 files preloaded | subset-font 2.9.0 |
| Debug tools (dev and `?debug` only, lazy-loaded) | lil-gui (parameters), stats-gl (GPU/CPU timing) | lil-gui 0.21.0, stats-gl 4.2.3 |
| Unit tests | Vitest | vitest 5.1.2 |
| E2E, visual, a11y | Playwright Test plus @axe-core/playwright | @playwright/test 1.65.1, @axe-core/playwright 4.14.1 |
| Lab performance | Lighthouse CI with budgets | @lhci/cli 0.16.1 |
| Hosting | **Cloudflare Pages** via wrangler, the same pipeline as sonobolt.com. Workers Static Assets is the migration path; a Render static site is the fallback. | wrangler 4.168.0 (Sonobolt pins 4.158.0) |

### 3.2 Framework: Astro, and why not the owner's other two stacks [fixed]

What decides it: the output must be **static HTML with every word in it**. The site needs **two locales** with RTL. It needs **one long-lived WebGL canvas** with an explicit lifecycle. And it must be **easy to debug**.

| | Astro (recommended) | Next.js 16 + R3F (QuotesDone's stack) | No framework + esbuild (Sonobolt's stack) |
|---|---|---|---|
| Words in HTML without JS | Yes, by default; zero JS unless asked | Yes with static export, but ships the React runtime and hydration for a content site | Yes |
| i18n and RTL routing | Built in (`i18n.routing`, `prefixDefaultLocale: false`; checked in the Astro configuration reference) | next-intl (works well in QuotesDone) | Hand-rolled (Sonobolt does it, at a cost) |
| 3D lifecycle control | A plain module owns the canvas, so you see exactly when things build and free | R3F: declarative, but the React reconciler sits on the frame loop, and disposal is implicit | Full control (Sonobolt's `live.js`) |
| JS weight before 3D | about 0 KB plus our scripts | React + Next runtime, tens of KB gzipped before any of our code | about 0 KB |
| Images, sitemap, content collections | Built in or official integrations | Built in | Hand-rolled (Sonobolt's `seo.mjs`, `photos.py`) |
| Hosting | Static files on any host | Best on Vercel; static export loses some features | Static files on any host |

**Decision:** Astro static. The 3D runtime is plain TypeScript modules loaded by an Astro `<script>`. No React. We reuse the patterns Sonobolt proved, ported to TypeScript:
- one renderer;
- scenes built shortly before they are needed and freed after;
- a quality ladder that only changes at rest;
- stills as the fallback;
- `?hud`.

**Trade-offs we accept:**
- Astro majors move fast (7.x today), so we pin exact versions and upgrade on purpose.
- The owner's QuotesDone team knows R3F. Vanilla three.js is a little more code per scene, and it makes disposal and frame timing explicit, which is what we want here.
- Persisting one canvas across page navigations (Astro's client router with `transition:persist`) is **not verified for Astro 7**. v1 does not depend on it: each page builds its own small scene, and native view transitions cross-fade between pages. If the owner's video demands one continuous 3D world across pages, M0 spikes the client router. [video]

### 3.3 3D engine: three.js r187, WebGLRenderer [fixed for v1]
- **three.js** is the reliable standard and is already used in both owner repos at the same version (0.187.0).
- **WebGLRenderer, not WebGPURenderer, for v1.** WebGL 2 runs on effectively every phone our visitors use. Our post pass and seam shaders are short GLSL. A third-party summary says WebGPU is now on by default in all major browsers and that `WebGPURenderer` falls back to WebGL 2 automatically. That is a blog claim, not verified against browser vendor notes. Custom shaders for `WebGPURenderer` must be written in TSL, not GLSL. We write scenes so materials sit behind a small factory. A later move to `WebGPURenderer` and TSL is then a contained change, reviewed at M4.
- **Lighting:** no HDR download. A procedural `RoomEnvironment` (three.js addon) goes through PMREM for reflections, plus one key area light. A third-party summary of r187 says PMREM was rebuilt and environment-lit materials look slightly different from r186. Whether or not that holds, we tune materials on r187 only.
- **Shadows:** no real-time shadow maps on phones. Desktop uses one soft contact shadow under the rail, rendered once per scene and re-rendered only when objects move.
- **Post:** one custom full-screen pass: tone mapping (AgX or ACES, chosen in M1 by eye), a light vignette, and **dithering**. Dithering matters, because large Carbon gradients band visibly on 8-bit phone screens. Desktop adds a cheap depth of field. No bloom, no `postprocessing` library in v1. The `postprocessing` library (6.39.6) is the fallback if we need more passes.

### 3.4 Animation and scroll [fixed]
- **One clock:** `gsap.ticker` drives Lenis, ScrollTrigger and the three.js render. Nothing else may call `requestAnimationFrame`, and a lint rule bans it outside `src/three/runtime/loop.ts`.
- **ScrollTrigger maps scroll to a 0..1 progress per scene.** Each scene exposes `update(progress, time)` as a deterministic function of its inputs. The same progress always gives the same frame. That makes scenes scrubbable in `/debug`, possible to snapshot in tests, and safe to jump to via deep links.
- **SplitText** splits **by line or word, never by character**. Per-character splitting breaks Arabic letter joining (section 5).
- **DrawSVG** (or plain `stroke-dashoffset`) runs the 2D logo draw-on of scene 1a and the no-WebGL fallback.
- GSAP licence, checked at gsap.com/standard-license: free for commercial use, all plugins included. The only prohibited use is building a no-code visual animation tool that competes with Webflow, which does not apply to us.
- **Lenis** runs only for `(pointer: fine)` without reduced motion. Touch devices keep native scroll, which is faster, more accessible and keeps iOS momentum. Sonobolt deliberately uses no smoothing. We smooth only where it improves the feel on desktop. If testing shows otherwise, we turn it off, and that is one flag.
- No Motion/Framer library: there is no React.

### 3.5 Load sequence (Home) [fixed]
1. HTML, critical CSS and fonts. The inline SVG wordmark draws itself with CSS (scene 1a). The H1 and sub-line are visible. **LCP = the H1 text block.**
2. After `load` and idle: the 3D runtime chunk (three.js plus runtime) and `logo.glb` load in parallel. A capability check picks the tier (section 4.3).
3. The scene 1 canvas renders its first frame matched to the SVG, and the two swap (scene 1b). If the visitor has already scrolled past scene 1, the canvas skips to its current progress.
4. Each later scene's code and data load 0.35 of a section ahead and are freed 0.4 of a section after, as in Sonobolt's `live.js`. At most two scenes are held at once.
5. Any failure (chunk error, context loss, shader error) means that section shows its still. The words never move.

### 3.6 Asset pipeline [fixed for procedural, conditional for authored assets]
- **`scripts/geo-logo.mjs`:** reads `brand/logo/final/strokes.json`. For each of the 43 parts it parses `outline` (rings keep their inner subpaths), extrudes it (depth per line), adds a 0.6-unit bevel, centres it on its own joint pivot, and names the mesh by stroke `id`. It also stores `order`, `bbox` and `role` as glTF `extras`. It writes `public/3d/logo.glb`, then compresses it with glTF-Transform (`meshopt` plus quantisation). The file is regenerated only when `strokes.json` changes, and CI checks that it is up to date.
- **Other scenes:** geometry is generated at runtime from parameters, because it is small, or by the same build-script pattern if generation is slow on phones (measured in M1).
- **Compression choice:** meshopt (`EXT_meshopt_compression`) rather than Draco. The decoder is smaller and decoding is faster. **Decoders are self-hosted in `/public/decoders/`**, never fetched from a CDN. That is the rule QuotesDone's `next.config.mjs` already records ("must carry its decoder in /public, never pull www.gstatic.com/draco").
- **Textures:** v1 needs none (materials are procedural). If an artist later supplies textures, they go through KTX2 (UASTC for normal maps, ETC1S for colour) using glTF-Transform's KTX commands. Those need the KTX-Software `ktx` CLI installed. That toolchain is **not verified** in this plan, and is checked only when the first textured asset arrives.
- **Stills:** `scripts/stills.mjs` drives the real scenes in Playwright at fixed progress values. It writes one still per section, phone (750 px) and wide (1920 px), as AVIF and WebP, at most 60 KB each. This is the Sonobolt `stills.mjs` pattern. The stills are the no-WebGL fallback and the first paint for scenes 3 to 8. Because they are rendered from the same code, the swap from still to live happens without a jump.
- **Open Graph images:** one 1200x630 PNG per page, rendered from the same stills plus title text by the same script.
- **Fonts:** see 4.6.

### 3.7 Hosting, domain, CI and environments

**Hosting recommendation: Cloudflare, with Render as the fallback.** This **changes a recorded decision**. HANDOVER says "hosting-agnostic static site, deploy to a temporary Render URL". The site stays hosting-agnostic: plain static files plus a `_headers` and a `_redirects` file. So the choice is reversible in one workflow file. The owner decides (Q2). Reasons for Cloudflare:
1. The owner already runs sonobolt.com on Cloudflare Pages with a working GitHub Actions and wrangler workflow (`site-preview.yml`, `site-production.yml`). We copy a proven pipeline instead of writing a new one.
2. Static asset requests are free on Cloudflare (Cloudflare's migration guide: "requests for static assets on Workers are free").
3. Cloudflare's network is believed to have a Dubai point of presence. That is **not verified here**. Confirm with a `cf-ray` header check from a UAE connection at M0.
4. If the domain's DNS is also on Cloudflare, the hub, its subdomains and redirects are managed in one place.

**Pages or Workers Static Assets:** v1 uses **Cloudflare Pages**, because the point of choosing Cloudflare is reusing Sonobolt's working Pages workflows unchanged. Pages serves `dist/404.html` with status 404, which Sonobolt's README relies on. Cloudflare now publishes a "Migrate from Pages to Workers" guide, and Workers Static Assets supports the same `_headers` and `_redirects` files. That suggests Workers is the direction for new projects. A move is a small, later change to one workflow and one `wrangler.jsonc`. Workers' 404 setting (`not_found_handling`) is **not verified** here: the excerpts I read only showed the single-page-app value. **Pages is not deprecated as far as I could verify.**

**Vercel** works equally well for a static Astro build (`@astrojs/vercel` 11.0.22 exists). It is the right choice if the owner wants all marketing sites next to QuotesDone. It is not recommended as the default, because nothing here needs Vercel's server features.

**Domain plan** (domain not bought yet; nothing is done until it is):

| Name | Serves | Notes |
|---|---|---|
| `quotesdone.technologies` (apex) | The hub | Canonical origin for every hub page |
| `www.quotesdone.technologies` | 301 to apex | |
| `staging.quotesdone.technologies` | Staging build, `noindex`, optional Cloudflare Access | Until the domain exists: the `*.workers.dev` / `*.pages.dev` URL |
| `mubinflow.quotesdone.technologies` | MubinFlow's own site when it has one (Render, per HANDOVER), or nothing until then | Product subdomains are for products **without** their own domain |
| `quotesdone.quotesdone.technologies`, `sonobolt.quotesdone.technologies` | Optional 301 to quotesdone.com / sonobolt.com | **Changes a recorded decision:** LEDGER #12 and HANDOVER say every app lives on a hub subdomain. I recommend that products which already have their own domain keep it as canonical, and their hub subdomain only redirects. Never duplicate product content on the hub domain (bad for SEO, and two places to keep true). Owner decides (Q14). |
| `<app>.quotesdone.technologies` | Future apps on their own stacks (Vercel / Render / Docker), per the owner's decision in HANDOVER | One DNS record per app |

- **Registrar:** whether a given registrar sells the `.technologies` TLD is **not verified**. Check availability and price at purchase. Cloudflare Registrar is preferred if it offers the TLD; otherwise any registrar, with nameservers pointed to Cloudflare.
- **HSTS:** start with `max-age=31536000` **without** `includeSubDomains` and without `preload`. Add `includeSubDomains` only once every subdomain serves HTTPS. QuotesDone's config records the same caution about preload.
- **Email** on the hub domain (e.g. `info@`) needs MX, SPF, DKIM and DMARC records. That is the owner's call (Q8).

**Environments**

| Env | Trigger | URL | Indexing | Debug |
|---|---|---|---|---|
| local | `npm run dev` | localhost:4321 | n/a | all on, `/debug` built |
| preview | every PR | per-branch preview URL | `X-Robots-Tag: noindex` plus `Disallow: /` | `/debug` built, `?debug` works |
| staging | push to `main` | staging subdomain (later) | noindex | `/debug` built |
| production | manual workflow with typed confirmation (Sonobolt pattern) | apex | indexed | `/debug` not built; `?debug` shows the HUD only, read-only |

**CI (GitHub Actions)** on each PR: install (`npm ci --ignore-scripts`), lint, typecheck, unit tests, build (which runs the content checks in 6.4), Playwright e2e plus a11y plus no-JS plus reduced-motion, visual snapshots of the stills, Lighthouse CI against the budgets, asset-weight budget check, a forbidden-files check on `dist/` (no source maps, no `.env`, no keys; copied from Sonobolt), then deploy to preview. Actions are pinned by commit SHA, as Sonobolt does. Production is deployed by a manual workflow only.

### 3.8 Security headers [fixed]
A strict CSP is possible because the site is static and loads nothing from third parties:
- `default-src 'self'`
- `script-src 'self'`, plus a hash for the tiny inline tier or intro script if needed
- `style-src 'self' 'unsafe-inline'` (Astro inlines critical CSS and the logo draw-on keyframes; hashing every inlined style is possible later but brittle)
- `worker-src 'self' blob:` (three.js loaders may create blob workers, as QuotesDone found)
- `img-src 'self' data: blob:`
- `connect-src 'self'`
- `frame-ancestors 'none'`
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`

Add `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that denies everything unused. Fonts, JS and 3D files are cached `immutable` with hashed names.

### 3.9 What I verified, and what I could not

**Verified on 2026-11-26:**
- npm registry latest versions: astro 7.4.13, three 0.187.0, gsap 3.15.1, lenis 1.3.29, @gltf-transform/cli 4.5.1, meshoptimizer 1.3.0, sharp 0.35.5, subset-font 2.9.0, vitest 5.1.2, @playwright/test 1.65.1, @axe-core/playwright 4.14.1, @lhci/cli 0.16.1, lighthouse 13.6.0, wrangler 4.168.0, lil-gui 0.21.0, stats-gl 4.2.3, postprocessing 6.39.6, typescript 7.0.2.
- Also checked, for comparison only: next 16.4.6, react 19.3.1, @react-three/fiber 9.8.2 (peer react `>=19 <19.4`), @react-three/drei 10.7.9, motion 14.14.0, @astrojs/vercel 11.0.22, @astrojs/cloudflare 14.4.9.
- Astro 7's `engines` field: Node >= 22.23.4. The local Node is 22.23.5.
- The GSAP licence terms, from the gsap.com standard licence page.
- Astro's i18n routing options (`prefixDefaultLocale`, `fallbackType`), from the Astro configuration reference.
- Cross-document View Transitions, from MDN compatibility data: Chrome and Edge 126+, Safari and iOS Safari 18.2+, Samsung Internet 28+. Firefox: Nightly only, no support on Android. So they are a progressive enhancement.
- Cloudflare's "Migrate from Pages to Workers" guide and its static-asset compatibility matrix.
- three.js r187 migration notes (`setViewport` / `setScissor` with render targets, WeakRef use), from the three.js wiki. The PMREM rebuild comes from a third-party release summary, not the wiki excerpt.
- The Q mark is a separate cut, not stroke part 0 (`brand/logo/source/build.py`: `MARK` parameters).
- `@theatre/core` was last published in 2024, so it is not used for timeline authoring. GSAP timelines are authored in code instead.

**Not verified. Each is checked in M0 or labelled where it is used:**
1. Astro 7 `transition:persist` behaviour with a WebGL canvas.
2. Whether `astro check` works with TypeScript 7.0.2. TS 7 is the native compiler, and QuotesDone aliases `typescript@5.5.4` for its JS API, which suggests tooling gaps. We pin whichever TS version Astro's checker supports.
3. The claim that WebGPU is on by default in all major browsers (third-party blog only).
4. The KTX2 encoder toolchain (KTX-Software CLI with glTF-Transform).
5. Font licences and Arabic coverage of any candidate face (4.6).
6. Whether a given registrar supports `.technologies`.
7. A Cloudflare Dubai point of presence.
8. The exact gzipped size of a tree-shaken three.js r187 `WebGLRenderer` bundle. The 3D budget in 4.1 is an estimate until M0 measures it.
9. The latest oxlint version. QuotesDone pins 1.92.0; I did not check the registry.
10. The gzipped weight of GSAP core, ScrollTrigger, SplitText and Lenis together, which sets the pre-3D JS budget (4.1).
11. The Cloudflare Workers `not_found_handling` value for a static 404 page (only relevant if we move from Pages to Workers).

---

## 4. Performance and quality budgets

All budgets are **targets until measured on real devices**. Sonobolt's README states plainly that no phone has run its scenes, and that its 60 fps figures come from one desktop GPU. We do not repeat that gap. **Measurement on named physical devices is an acceptance gate for M1** (section 7).

### 4.1 Budgets

| Metric | Target (mobile, 4G, p75) | Target (desktop) | How measured |
|---|---|---|---|
| LCP | <= 2.0 s | <= 1.2 s | Lighthouse CI (lab, mobile preset); field data later if analytics is approved |
| CLS | <= 0.02 | <= 0.02 | Lighthouse CI; Playwright layout-shift observer |
| INP | <= 150 ms | <= 100 ms | Playwright interaction traces; field data later |
| TBT (lab) | <= 200 ms | <= 100 ms | Lighthouse CI |
| Lighthouse Performance / Accessibility / Best Practices / SEO | >= 90 / 100 / 100 / 100 | same | Lighthouse CI asserts; build fails below |
| HTML + CSS + JS before 3D | <= 60 KB gzipped total JS before 3D, CSS <= 25 KB gzipped. **Provisional:** GSAP core, ScrollTrigger, SplitText and Lenis have not been measured yet; M0 measures them and resets this line if needed. | same | budget script on `dist/` |
| 3D runtime chunk (three.js + runtime + scene 1) | <= 190 KB gzipped (estimate, see 3.9 item 8) | same | budget script; fail on +10% |
| Per-scene code + data | <= 60 KB gzipped | <= 120 KB gzipped | budget script |
| `logo.glb` | <= 150 KB | same | budget script |
| Total Home transfer, first 10 s without scrolling | <= 900 KB | <= 1.6 MB | Playwright HAR |
| Total Home transfer, full scroll | <= 1.8 MB | <= 3.5 MB | Playwright HAR |
| Fonts | <= 2 files preloaded, <= 90 KB total (Latin) | same | budget script |
| Each still image | <= 60 KB (AVIF) | <= 60 KB | budget script |
| Frame rate while scrolling | 60 fps on tier-1 phones; a steady 30 fps is accepted under Low Power Mode | 60 fps (16.7 ms), p95 frame <= 20 ms | `?hud` readout on devices; stats-gl |
| Main thread after LCP | no long task > 50 ms while scrolling; scene builds split into chunks that yield between steps | same | Playwright performance trace |
| GPU per frame | tier 1: <= 100k triangles, <= 60 draw calls, DPR <= 1.5 | tier 2: <= 300k triangles, <= 150 draw calls, DPR <= 2 | `renderer.info` in HUD; CI asserts on the SwiftShader run (counts only, not timing) |
| GPU memory | <= 64 MB textures + buffers (tier 1) | <= 192 MB | Estimated by a small accounting helper (texture sizes plus buffer byte lengths), because `renderer.info.memory` only gives *counts* of geometries and textures. The counts are used for the disposal test. |

### 4.2 Fallbacks [fixed]

| Condition | Behaviour |
|---|---|
| **No JavaScript** | The full page in plain flow: the logo SVG still draws itself, because scene 1a is pure CSS and needs no JavaScript (it ends fully drawn), then every heading and paragraph, still images per section, all links. A Playwright test runs with JS disabled and checks every copy slot is present. |
| **`prefers-reduced-motion: reduce`** | three.js is never fetched. No autoplay draw-on: the logo is shown complete. Stills replace scenes, and sections swap with an opacity fade of 150 ms or less. Lenis is off. No parallax, no scroll-scrubbed camera. |
| **No WebGL 2 / context creation fails** | Same as reduced motion, but the 2D logo draw-on still plays (it is cheap and inside the safe motion rules: under 3 s, never repeats). |
| **WebGL context lost mid-session** | The current scene swaps to its still. One restore attempt on `webglcontextrestored`. After a second loss: stills for the rest of the visit. |
| **Save-Data header or `navigator.connection.saveData`** | Stills only. |
| **Chunk load error or scene exception** | That section only shows its still. The error is logged (6.6). Other scenes keep running. |
| **Autoplay longer than 5 s** | None exists. Idle loops on `/products` stop when out of view and have a pause control (WCAG 2.2.2). |

### 4.3 Device tiers and the quality ladder [fixed]
- **Tier 0 (stills):** any condition in 4.2.
- **Tier 1 (phones, tablets, integrated-GPU laptops):**
  - DPR capped at 1.5, MSAA on;
  - no depth of field, no contact shadow;
  - post pass = tone mapping and dither only;
  - line 2 of the wordmark not extruded;
  - simplified exploded view (parts move by glyph group instead of all 43 separately);
  - per-scene geometry at reduced segment counts.
- **Tier 2 (desktop with a capable GPU, Apple Silicon Macs):** everything.
- **Initial pick:** WebGL 2 available, screen size, `devicePixelRatio`, `hardwareConcurrency`, `deviceMemory` where it exists (Chromium only), and the GPU renderer string where exposed. All are heuristics, logged in the HUD.
- **Runtime ladder (Sonobolt's proven rule):** it moves **only at rest**, 300 ms after scrolling stops, and never recompiles shaders while scrolling. Steps down: depth of field off, then contact shadow off, then canvas scale 0.85, then 0.7. It never steps up within a visit. A steady 30 Hz is treated as Low Power Mode and left alone. `?tier=0|1|2` and `?level=n` pin it for testing.
- **Off-screen:** the canvas stops rendering when the page is hidden or the canvas has scrolled out of view. Frames are rendered only when progress or time changes (no idle 60 fps burn on a static frame).

### 4.4 Mobile plan [fixed for the principle, video for staging details]
Many UAE visitors are on phones. The phone experience is designed first, not reduced from desktop:
1. **Portrait staging per scene.** The camera framing, scene lengths (about 60% of the desktop pin length) and text placement are authored separately for aspect ratios under 1.
   - The wordmark is about 10.7:1. On a 390 px screen line 1 is under 480 px wide, so scene 1 frames **close-ups of parts** during the exploded view. That is where phones get spectacle.
   - It then pulls back to the full wordmark, whose **joints close** to the compact cut before the header hand-off (2.2.2).
2. **Text never under the canvas's busiest area.** On phones, words sit in a solid band above or below the object, never over moving metal.
3. **Native scroll, no hijack.** ScrollTrigger pins use `pinType: 'transform'` only where needed, and are tested on iOS Safari for address-bar resize jumps (we set `ScrollTrigger.config({ ignoreMobileResize: true })` and size with `svh` / `lvh` units).
4. **Thermals.** Long scrolls on phones can heat and throttle the device. The ladder handles drops, and scenes free their GPU memory after their cut.
5. **Test devices (owner to confirm what is available, Q10):**
   - an iPhone 13 or 14 (Safari);
   - a recent mid-range Android (e.g. a Samsung Galaxy A5x, Chrome);
   - an older Android with 3 to 4 GB of RAM as the low end;
   - an iPad.

   Lab emulation is not accepted as proof.

### 4.5 SEO and no-JS content [fixed]
- Static HTML per page:
  - a unique `<title>` of 60 characters or fewer and a meta description of 110 to 160 characters (the build refuses others, the Sonobolt rule);
  - canonical URL, Open Graph and Twitter card;
  - `hreflang` once Arabic exists.
- JSON-LD:
  - `Organization` with the legal name, form, address and licence, matching `/legal` exactly;
  - `WebSite`, `BreadcrumbList`;
  - per product, an `SoftwareApplication` or `Product` entry with `isRelatedTo` and `url` pointing to the product site.
- Also: `sitemap.xml`, `robots.txt`, `llms.txt` (QuotesDone serves one), and the 404 status (2.8).
- The canvas is `aria-hidden="true"` and never contains the only copy of any text.

### 4.6 Typography [video for the face, fixed for the rules]
- The wordmark is custom geometry, so the text face must be a **quiet, precise grotesk that does not compete with it**. It must **not** be Sonobolt's faces (Host Grotesk, Martian Mono, in `site-v3/assets/fonts`) or QuotesDone's, so the parent stays distinct from its products.
- **Hard requirement: a Latin and Arabic pairing designed to work together** (same team or explicitly matched metrics). Variable weight axis. A licence that allows self-hosting.
- Candidates to test in M0 (licences and Arabic coverage **not verified**, so check before choosing):
  - a commercial grotesk with a matched Arabic companion (best result, has a cost: Q7);
  - open-licence pairs such as IBM Plex Sans with IBM Plex Sans Arabic, or Noto Sans with Noto Kufi Arabic or Noto Naskh Arabic, or a single family that covers both scripts.
- Rules:
  - self-host subset WOFF2;
  - preload at most 2 files;
  - `font-display: swap` with a metric-matched fallback (`size-adjust`, `ascent-override`) so the swap causes no layout shift;
  - tabular figures for prices.

### 4.7 Accessibility [fixed]
- Target: WCAG 2.2 AA. Axe runs in CI on every page and in every state (JS on and off, reduced motion).
- **Contrast**, computed for the logo palette:

  | Pair | Ratio | Use |
  |---|---|---|
  | Alloy on Carbon | 15.8:1 | any size |
  | Graphite `#5E636B` on Carbon | 3.15:1 | **fails body text**; large text or decorative only |
  | Graphite on Alloy | 5.0:1 | passes body text |
  | Rhodamine on Carbon | 4.1:1 | **fails small text**; passes for large text (18.66 px bold / 24 px) and UI elements (3:1) |
  | Rhodamine on Alloy | 3.8:1 | large text and UI elements only |

  We add a secondary text token for dark grounds: a lighter grey such as `#8A8F97`, at 5.9:1 on Carbon. The exact value is chosen in M1.
- Keyboard: every interactive element is reachable and the focus ring is always visible. The `/products` drag-to-turn also works with arrow keys and has a reset button.
- Motion: reduced motion is respected (4.2), and nothing flashes more than 3 times a second.
- Language: `lang` and `dir` are set on `<html>`, and on any inline foreign-language text.
- Screen readers: the canvas is hidden, and each scene's meaning is in the DOM text beside it.

---

## 5. Bilingual plan (English first, Arabic RTL later)

Arabic ships in a later milestone. These things are built in **now**, so adding it is translation and testing, not a rewrite [fixed]:

1. **Routing:**
   - Astro i18n with `defaultLocale: 'en'`, `locales: ['en','ar']`, `prefixDefaultLocale: false`. English stays at `/` and Arabic will live at `/ar/`.
   - The `ar` pages are simply not built until content exists, so no empty Arabic pages go live.
2. **No hard-coded strings.** Every visible string lives in `src/content/<locale>/*.json` (UI) or Markdown (legal), keyed by the copy deck's slot ids. A unit test fails if any key exists in one locale and not the other, once `ar` is enabled. Templates contain no English text.
3. **CSS logical properties only:** `margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`. Lint (stylelint `liberty/use-logical-spec` or equivalent, chosen at M0) bans `left`, `right`, `margin-left` and the like.
4. **`dir` on `<html>`** drives everything. Components never branch on language. Directional icons (arrows, chevrons) flip with `:dir(rtl)`, and non-directional icons do not.
5. **Type:**
   - The face is chosen with Arabic from day one (4.6).
   - Line height is a per-locale token, because Arabic needs more.
   - Letter-spacing is 0 for Arabic, since tracking breaks joined script. The uppercase eyebrow style is replaced, not mirrored, in Arabic.
6. **Text animation splits by line or word, never by character.** Splitting Arabic into characters breaks contextual letter forms. Enforced in the `reveal()` helper: there is no character mode.
7. **No text in textures or geometry,** except the Latin wordmark, which is the logo and stays Latin and left to right in both languages. Labels near 3D objects are DOM elements positioned from the 3D (projected anchors). They translate and wrap like any other text.
8. **Scenes take a `dir` parameter.** The rail's flow direction, the direction products dock from and the camera travel all read `dir`, so Arabic visitors read the line right to left. Each scene's `/debug` view has a `dir` toggle, and stills are rendered per direction.
9. **Numbers and dates:** formatted with `Intl` per locale. Whether Arabic pages use Western digits (common in UAE business) or Arabic-Indic digits is decided once in a token (Q11).
10. **The company's Arabic name** as printed on sonobolt.com ("كوتس دن للتكنولوجيا") is used only after the owner confirms it against the licence (Q6).
11. **SEO:** `hreflang` pairs both ways, and an Arabic canonical per page. Sonobolt's separate .ae canonical setup is not needed here.
12. **Testing:** a pseudo-RTL build (`?rtl`, English text with `dir=rtl`) runs in visual tests from M2, so RTL layout bugs are caught before any translation exists.

---

## 6. Engineering standards

### 6.1 Repo layout [fixed]
The site lives in `site/` inside this repo, next to `brand/` and `docs/`, so the logo source and the site share one history (the same shape as Sonobolt's `site-v3/`).

```
site/
  README.md                 how to run, every script, every URL flag (kept current; CI fails if a script is undocumented)
  astro.config.mjs
  package.json              exact versions only, no ^ or ~
  wrangler.jsonc
  src/
    pages/                  routes only; thin; no logic
      index.astro, company.astro, products/index.astro, products/[slug].astro,
      contact.astro, legal.astro, privacy.astro, terms.astro, 404.astro, debug.astro (non-prod only)
    layouts/                Base.astro (html lang/dir, head, header, footer), Legal.astro
    components/             Header, Footer, ProductCard, StatusBadge, Section, Still, ... (one component per file)
    content/
      en/                   home.json, company.json, products/*.json, ui.json, legal/*.md
      ar/                   (phase 2, same keys)
      products.ts           the product registry: slug, status, links, scene id, logo asset (one place to add product 4)
    styles/                 tokens.css (palette from brand/logo/README.md, type scale, the 2.4-unit grid), base.css, motion.css
    lib/                    seo.ts, i18n.ts, flags.ts (URL flags), log.ts, budgets.ts
    motion/                 clock.ts (gsap.ticker, Lenis), scroll.ts (ScrollTrigger setup), reveal.ts (line/word reveals)
    three/
      runtime/              renderer.ts, loop.ts, tiers.ts, ladder.ts, loader.ts (glb, meshopt), disposal.ts,
                            anchors.ts (3D to DOM label positions), hud.ts, errors.ts, stills.ts
      scenes/
        logo/               index.ts, params.ts, README.md (what it shows, its params, its progress map)
        rail/  quotesdone/  sonobolt/  mubinflow/  notfound/
      materials/            alloy.ts, carbon.ts, linework.ts, datum.ts (the factory; the one place a move to WebGPU/TSL touches)
      shaders/              post.glsl, seam.glsl (short, commented)
  public/
    3d/logo.glb   decoders/   fonts/   stills/   og/
  scripts/                  geo-logo.mjs, stills.mjs, og.mjs, fonts.mjs, check-content.mjs, check-budgets.mjs
  tests/
    unit/                   vitest: scene progress maps, strokes parsing, tiers, i18n key parity, wordmark-accent rule
    e2e/                    playwright: navigation, no-JS, reduced motion, 404 status, links
    visual/                 playwright screenshots of stills and DOM layouts (en, pseudo-RTL)
    a11y/                   axe on every page and state
    perf/                   lighthouserc.json, HAR weight tests, frame-trace smoke test
```

### 6.2 The scene contract [fixed]
Every scene implements the same small interface, so all scenes are built, debugged and tested the same way:

```ts
export interface Scene {
  id: string;                                   // 'logo', 'quotesdone', ...
  params: SceneParams;                          // every tunable number, named, with min/max (drives /debug GUI)
  create(ctx: SceneContext): Promise<void>;     // build geometry/materials; may yield; no rendering
  update(progress: number, timeMs: number): void; // pure function of inputs: same input, same frame
  resize(view: Viewport): void;                 // includes aspect (portrait staging) and dir ('ltr'|'rtl')
  stillAt: number[];                            // progress values the stills script renders
  dispose(): void;                              // free every geometry, material, texture, render target
}
```

Rules:
- No scene touches the DOM, the scroll position or the clock directly. It receives `progress` and `time`.
- No scene calls `requestAnimationFrame`.
- `dispose()` is tested: after create then dispose, `renderer.info.memory` returns to its baseline.

### 6.3 Tests [fixed]
- **Unit (Vitest):**
  - `strokes.json` parsing: all 43 ids present, `order` 0 to 42 unique, the 5 non-butt parts flagged;
  - every scene's `update()` is deterministic (same input gives the same transforms);
  - the tier picker gives the expected tier for given capability inputs;
  - i18n key parity;
  - the "no Rhodamine on the wordmark" rule;
  - content checks.
- **E2E (Playwright):**
  - every page returns 200 (404 returns 404);
  - every internal link resolves; external product links are checked weekly, not on every PR;
  - no-JS run: every copy slot is present;
  - reduced-motion run: three.js is never requested;
  - WebGL-disabled run: stills are shown;
  - `?scene=…&p=…` deep links render.
- **Visual regression:** screenshots of the stills and of DOM layouts at 390, 768 and 1440 px, in English and pseudo-RTL, compared with a small tolerance. Live WebGL frames are not pixel-compared in CI (GPU output varies). Stills come from the same code, so they cover scene regressions.
- **Accessibility:** axe on every page in every state. Keyboard-path tests for the header, dropdown and products orbit.
- **Performance:**
  - Lighthouse CI budgets (4.1) on every PR;
  - the HAR weight test;
  - a frame-trace smoke test in Chromium (SwiftShader). It checks **counts** (draw calls, triangles, long tasks), not timing.
  - **Real-device timing is a manual, recorded check at each milestone** using `?hud` (section 7).

### 6.4 Build-time content checks [fixed]
These are ported from Sonobolt's build. The build fails on:
- a placeholder or `[OWNER TO CONFIRM]` marker in built output;
- any banned word from copy deck §1 rules 6 to 8;
- "L.L.C."/"LLC";
- a title or description outside its length limits;
- a source map in `dist/`;
- an asset over budget;
- a missing `alt`;
- a product whose status in `products.ts` disagrees with its page.

### 6.5 Code standards [fixed]
- TypeScript strict. Lint and format in CI (oxlint, as QuotesDone uses, plus Prettier or Biome, decided at M0). No `any` in `three/` or `motion/`.
- Exact dependency versions and a lockfile. Dependency upgrades get their own PR, with the stills and Lighthouse diff attached.
- **Named motion curves and durations in `motion.css` / `clock.ts`.** Examples: `--ease-seat` for parts seating, `--ease-travel` for camera travel, `--dur-swap: 150ms`. No inline magic numbers.
- **Every scene parameter is named and documented in its `params.ts`.** Each scene folder has a 20-line README: what it shows, which copy slot it serves, its progress map (e.g. `0.00–0.30 split, 0.30–0.55 align, ...`), and its stills.
- Comments explain *why*, as both owner repos do well.

### 6.6 Debugging and troubleshooting [fixed]

**URL flags**, parsed in one place (`lib/flags.ts`) and listed in `site/README.md`:

| Flag | Effect |
|---|---|
| `?debug` | HUD: fps, frame ms p50/p95, draw calls, triangles, geometries, textures, tier and ladder level, DPR, GPU renderer string, current scene id and progress, last error. Shader compile checks on (`renderer.debug.checkShaderErrors`). Verbose logging. |
| `?gui` | lil-gui panel for the current scene's `params`, with live editing. "Copy params" exports JSON to paste into `params.ts`. |
| `?scene=<id>&p=<0..1>` | Render one scene at one progress, frozen. Used for bug reports and for the stills script. |
| `?tier=0\|1\|2`, `?level=<n>` | Force a tier or ladder level |
| `?still` | Force the fallback page |
| `?nointro` / `?intro` | Skip or force the scene 1a draw-on |
| `?rtl` | Pseudo-RTL |
| `?seed=<n>` | Fix any random value (synthetic waveforms) |

**`/debug` page** (preview and staging builds only): a gallery of every scene in isolation. Each has a progress scrubber, play/pause, tier switch, `dir` toggle, GUI and HUD, plus buttons that copy a `?scene=…&p=…` link. The owner can open it on a phone and send a link to the exact frame that looks wrong.

**Logging:** `log.ts` gives namespaced loggers (`log('3d:scene:sonobolt')`) with levels. They are silent in production unless `?debug` is set. Scene lifecycle events are logged with timings, e.g. `create 84 ms`, `dispose ok`, `ladder 1 -> 2 (p95 23 ms)`.

**Error boundaries:**
- `create`, `update` and `dispose` are wrapped per scene. An exception marks that scene as failed and shows its still for that section. It never blanks the page.
- `window.onerror`, `unhandledrejection` and `webglcontextlost` are handled centrally in `errors.ts`.

**Console handle:** `window.__qdt` (only with `?debug`) exposes:
- the renderer;
- the current scene and its params;
- `setProgress(p)`, `setTier(n)`, `dumpInfo()`.

**Error reporting in production:** off by default (no third parties). If the owner approves (Q9), add a tiny `navigator.sendBeacon` to a Cloudflare Worker that stores errors (message, scene id, tier, GPU string, URL; no personal data), or Sentry (`@sentry/browser` 11.19.0 exists). Either way it is consent-free only if it carries no personal data.

**Troubleshooting guide** in `site/README.md`:
- "page is blank": check `?still`, then `?debug`;
- "frame rate low on phone": open `?debug` and report the tier, p95 and GPU string;
- "scene looks wrong": use `/debug` and copy the link;
- "build fails on content check": the message names the file and rule.

**Documented scripts:**
- `dev`, `build`, `preview`;
- `test` (unit), `test:e2e`, `test:visual`, `test:visual:update`, `test:a11y`;
- `perf` (Lighthouse CI locally);
- `geo:logo`, `stills`, `og`, `fonts`;
- `check` (content and budgets);
- `deploy:preview` (CI only).

---

## 7. Delivery plan

Each milestone ends with something the owner can open on his phone, not a description.

| Milestone | Contents | Shown to the owner | Gate |
|---|---|---|---|
| **M0. Setup and spikes** (about 3 days) | Scaffold `site/`. CI. Preview deploy. Tokens from the logo palette. `geo-logo.mjs` producing `logo.glb`. The 2D SVG draw-on of the wordmark from `strokes.json` (including the 5 masked parts). Resolve the unverified items in 3.9 (TS version, three.js and GSAP/Lenis bundle sizes, view-transition behaviour, font candidates with Arabic). | A preview URL: Carbon page, the wordmark drawing itself in 2D, and a type test page with 2 or 3 font pairings in English and Arabic | Owner picks the font direction (Q7) and hosting (Q2), and answers Q3 (why the QuotesDone 3D pieces were removed), because M1 builds the QuotesDone scene |
| **M1. Vertical slice** (about 2 weeks) | One page: **scene 1 (logo assembly: draw-on, extrude, exploded view, header hand-off) + scene 4 (QuotesDone "Sealed")**, with the real copy-deck lines, all tiers, stills fallback, no-JS, reduced motion, the HUD, `/debug`, and the CI budgets running. QuotesDone is chosen because it carries the company's name and its scene is fully procedural. | Preview URL. A screen recording from a real iPhone and a real mid-range Android. A one-page performance report (Lighthouse, HUD p95 per device, transfer sizes) | **Acceptance:** 60 fps on desktop, and 60 fps (or a steady 30 fps in Low Power Mode) on the named phones. Budgets in 4.1 met or the gap explained. Owner approves the look. **If the reference video has arrived, the slice is checked against it before M2.** |
| **M2. Full Home** (about 2 to 3 weeks) | Scenes 2, 3, 5, 6, 7, 8. The datum and rail system. Portrait staging. Pseudo-RTL visual tests. | Preview URL, device recordings, `/debug` gallery | Owner approves the scroll narrative |
| **M3. Inner pages** (about 2 weeks) | Company, Products index (with the orbit), three product pages, Contact, Legal / Privacy / Terms, 404, OG images, JSON-LD, sitemap | Preview URL of the whole site | Owner signs off copy and facts (all `[OWNER TO CONFIRM]` items resolved, or the lines cut) |
| **M4. Hardening** (about 1 week) | Full a11y pass, real-device performance pass on all 4 devices, cross-browser (Safari, Chrome, Samsung Internet, Firefox), visual baselines, CSP, legal review | Test report | Zero axe violations. Budgets met. |
| **M5. Launch** | Buy the domain. DNS. Production deploy. www redirect. Search Console. Optional product-subdomain redirects. | The live site | Owner's go |
| **M6. Arabic** | Translation (native speaker), the `ar` content set, RTL stills, `hreflang` | Preview, then live | Native-speaker review |

Durations assume one engineer working with agents. They are estimates, not commitments, and they move once the reference video arrives.

### Risks

1. **Phone performance and heat are unproven** (top risk). Neither of the owner's sites has measured 3D on a phone. *Mitigation:* phone-first staging, tiers, the ladder, build-time geometry, stills fallback, and real-device numbers as the M1 gate instead of a late surprise.
2. **The reference video may move the direction** (top risk). *Mitigation:* every decision is tagged [fixed] or [video]. The fixed core (framework, runtime, scene contract, fallbacks, i18n, budgets) survives any visual direction. The M1 slice is small enough to redo.
3. **"Must not look AI-made or template-made" is a taste judgement, and there is no 3D artist.** Procedural geometry can look sterile. *Mitigation:* real data and an exact unit system, a single-light material study in M0 and M1, the cliché list (2.2.3), and the owner reviewing on a phone at every milestone. If the owner wants authored hero models later, budget for a 3D artist; the glTF and KTX2 pipeline is ready for them (Q12).
4. **Logo legibility in motion and at small sizes.** The joints blur below 480 px, and the TES cluster has a known resemblance to Tesla (HANDOVER). *Mitigation:* close the joints at small sizes, keep the exploded view to large screens or close-ups, and never hold the logo mid-explosion as a still. The logo's visual-similarity clearance is still open (`brand/clearance/`). The site launch should not come before the owner's lawyer has seen it.
5. **Facts are not yet confirmed:**
   - the licence wording and casing, and its Arabic name;
   - Sonobolt "available" status and app link;
   - MubinFlow name (no trademark search);
   - founder line.

   *Mitigation:* the content check blocks any `[OWNER TO CONFIRM]` line from shipping.
6. **Domain not bought.** Availability and pricing of `.technologies` names are unchecked. *Mitigation:* everything runs on the preview URL until purchase. DNS work is one milestone.
7. **Framework churn.** Astro 7 and three.js release often, and three.js r187 changed environment lighting. *Mitigation:* exact pins, upgrade PRs with stills diffs.
8. **Firefox has no cross-document view transitions** (MDN: Nightly only). *Mitigation:* plain navigation there. Nothing depends on them.

### Open questions for the owner
1. **The reference video:** when can you share it? M1 can start before it, but M2 should wait for it.
2. **Hosting:** HANDOVER recorded "temporary Render URL". I recommend Cloudflare, the same platform and pipeline as sonobolt.com, with Render as the fallback. Do you agree?
3. **QuotesDone's 3D history:** QuotesDone still has its "sealed slabs" hero scene, but its config notes that you removed the supplier portal's 3D environment and the 3D network map (instruction 525). Why? A performance, taste or brand reason changes how the hub's QuotesDone scene should be built. This is needed before M1.
4. **Sonobolt data:** may the hub's Sonobolt scene use the real measured waveform envelope Sonobolt already ships, or should it use a synthetic one?
5. **Product logos:** may each product's own logo appear on its hub page, unaltered, with "A product of QuotesDone Technologies"?
6. **Legal identity:** please confirm against the licence:
   - the exact name and casing ("quotesdone technologies" on sonobolt.com vs "QuotesDone Technologies" on quotesdone.com and in the copy deck);
   - the licence title ("DET Dubai Trader License" vs "E Trader (Professional)");
   - the number;
   - whether to print the full address (Botanica, JVC) or "Dubai" only;
   - the Arabic name (كوتس دن للتكنولوجيا).
7. **Font budget:** is a paid licence for a premium Latin and Arabic type family acceptable, or open-licence only?
8. **Contact details:** the copy deck proposes `management@quotesdone.com` and `+971 56 791 8605`. Are those right for the hub? After the domain purchase, do you want an address on it (e.g. `info@quotesdone.technologies`)? Do you want a contact form later (phase 2)?
9. **Analytics and error reporting:** none at launch (my default), cookieless page analytics, or the PostHog-with-consent setup Sonobolt has?
10. **Test phones:** which physical devices do you or your team have for the M1 checks?
11. **Arabic:** when should it launch? Formal Modern Standard Arabic (as QuotesDone uses) or lightly Gulf-leaning (as Sonobolt plans)? Western or Arabic-Indic digits, and "AED 99" or "99 درهم"? (copy deck §8)
12. **A 3D artist:** is there budget later for authored hero models or a motion designer, if the reference video calls for something beyond procedural geometry?
13. **MubinFlow:** should the hub offer "Ask about MubinFlow" at all, given that the name has no trademark search yet (copy deck §4)?
14. **Product subdomains:** LEDGER #12 says every app lives on a hub subdomain. For QuotesDone and Sonobolt, which already have their own domains, I recommend the hub subdomain only redirects to the product domain, which stays canonical. Do you agree?
