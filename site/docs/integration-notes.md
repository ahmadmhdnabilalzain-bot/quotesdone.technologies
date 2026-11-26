# Integration notes (home page, all 8 scenes)

Integration pass of 2026-11-26. Scope: make the full gate green, pin MubinFlow, fix the rail
label overlap, share the AgX maths and the rail palette, and walk the whole page. The 3D runtime
(`src/three/runtime/**`) was being reworked by another agent at the same time and was not edited.

## 1. What changed

| Area | Change | Files |
|---|---|---|
| Rail labels | The label layer and the stage now share one grid cell as tall as the section, each sticky. The old `margin-block-end: -100svh` shrank the list's margin box, so it stayed stuck one viewport past the section and covered the QuotesDone intro. Checked by screenshot at 1440x900 and 1920x1080: the labels leave with the rail. | `components/ProductIndex.astro` |
| MubinFlow pin | At >= 60rem with live 3D: the slot is 320svh and the 16:9 stage is sticky, centred (`cqi` maths, width capped by the viewport height). Progress runs from "slot top at 75% of the viewport" to "slot bottom at viewport bottom" (about 295 viewport-percent). Narrower screens keep the old "top 65%" to "top 5%" scrub, set by a small script before mount. | `components/home/MubinFlowSection.astro`, `scenes/mubinflow/README.md` |
| Landmarks spec | The home product sections use `<header>` inside `<section>`. That is a section header, not a banner landmark, so the markup is correct. The spec now checks the roles: one `banner`, one `contentinfo`, plus `header.site-header` and `footer.site-footer`. | `tests/e2e/pages.spec.ts` |
| Debug harnesses | `/debug/rail` and `/debug/close` failed `check-content` (no H1, short description). They now have a visually hidden H1 and a 136-character description. | `pages/debug/rail.astro`, `pages/debug/close.astro` |
| AgX maths | Moved to `three/shared/agx.ts` (runtime/ was being edited by another agent). `scenes/logo/agx.ts` re-exports it. Logo, mubinflow and both unit tests import the shared path. | `three/shared/agx.ts` |
| Rail palette | New `three/shared/rail.ts`: Alloy, the Rhodamine signal colour, the cross-section ratios. Rail, company and close now draw the same signal colour, so the datum is one colour along the whole page. Unit test `tests/unit/rail-shared.test.ts`. The rail frame is pixel-identical before and after. Company and close changed only in the datum pixels. | `three/shared/rail.ts`, `scenes/rail/materials.ts`, `scenes/close/shared.ts`, `scenes/company/index.ts` |
| Header band | The sticky header paints Carbon as a gradient image instead of a solid colour, which removes a missing band at the bottom of the canvas (section 4). | `components/Header.astro` |
| Parallel builds | `QDT_DIST` (output dir: astro.config, check scripts, preview), `QDT_E2E_PORT` and `QDT_E2E_OUT` (Playwright). Default behaviour is unchanged. | `astro.config.mjs`, `playwright.config.ts`, `scripts/check-*.mjs` |
| Scroll walk | `tests/e2e/scroll-walk.spec.ts`, `npm run test:walk`. Opt-in, about 9 minutes per viewport on SwiftShader. | `tests/e2e/scroll-walk.spec.ts`, `package.json` |

## 2. Rail scenes: rail (2-3) against company (7) and close (8)

| Difference | Rail scene | Company / close | Status |
|---|---|---|---|
| Rhodamine signal (datum, status lights) | AgX-compensated linear value (on screen about rgb 192, 66, 83) | Plain #E3185B with `toneMapped: false`. That flag does nothing here: the presenter tone-maps the whole target, so it showed about rgb 206, 88, 111 | **Unified** (`shared/rail.ts`) |
| Alloy, datum height ratio | #ECEAE4, groove at 0.2/0.34 of the rail height | #ECEAE4, 0.59 | **Unified** (0.588, from the rail params) |
| Rail metal | #16181c, metalness 0.9, clearcoat 0.15 | #1c1f24, metalness 0.6, no clearcoat, lighter | Kept: company is a distance shot and close a dark end cap. They were lifted to read on Carbon. Retune once the runtime's lighting work lands |
| Cross-section | 0.34 x 0.56 module, chamfer 0.045, machined datum groove, far fade shader | 0.14 x 0.22, chamfer 0.018, no groove, no far fade | Ratios match within 5% (depth 1.57 vs 1.65 per unit height). One geometry builder is a follow-up (below) |
| Station pitch / pad | 1.55, pad 0.92 x 0.46 x 0.10 | 1.5, dock 0.62 x 0.40 x 0.045 | Follow-up |
| QuotesDone object | 3 plates | 3 plates (`plateCount`) | Consistent. Scene 4 shows five plates because it is the close-up. Company README corrected |
| Sonobolt object | Wound ribbon disc with a waveform edge | Flat tube spiral | Follow-up: reuse the rail's coil builder |
| MubinFlow object | Ring linework with hidden dashes and a dimension | Ring linework only | Acceptable at company distance |
| Empty stations | 6 caps | 6 caps (9 docks) | Consistent |

**Why there is no shared mesh builder yet.** Company and close frame their shots with camera
distances, film offsets and a fixed dock run tuned to their own bar size. Swapping their geometry
for the rail's builder means retuning those shots and their unit tests (bounding boxes, the datum
gap to the mark). That is scene work, not integration. Follow-up: move `createRailGeometry`
(with optional groove and fade), `createChamferedBlock` and the coil builder into
`shared/rail.ts`, call them from company and close with a scale factor, then retune `farDistance`
and `frameLift` in company and the datum and joint gaps in close.

## 3. Full-page scroll walk (desktop, SwiftShader, `?tier=high&hud`)

Real wheel input, Lenis on, quarter-viewport steps (one wheel of half a viewport moves about a
quarter through Lenis), waiting up to 30 s at each step for visible slots to be ready.
Assertions: no console or page errors, no horizontal scroll, and no slot with coverage >= 0.3
that is not `ready`.

Run of 2026-11-26: **2 passed** (1440x900 in 8.9 min, 1920x1080 in 11.5 min) on the 19:35 build.
The runtime agent then changed the presenter, AO and signal pass, so the 1440x900 walk was re-run on
the 20:02 build (runtime as of 19:55): **1 passed** (9.7 min), with identical numbers (102 steps, 0 errors,
0 horizontal scroll, 0 undrawn visible slots, same scrub lengths). The header workaround came after
both runs; it changes only the header's paint. Raw data: `tests/artifacts/walk/<w>x<h>.json`, plus one screenshot per step.

| | 1440x900 | 1920x1080 |
|---|---|---|
| Steps | 102 | 100 |
| Console or page errors | 0 | 0 |
| Steps with horizontal scroll | 0 | 0 |
| Visible slot not ready | 0 | 0 |
| Page height (vh) | 26.16 (footer at 25.74) | 25.69 (footer at 25.34) |

Per slot (vh = viewport heights; "pin" = slot height minus stage height for a sticky stage;
"scrub" = scroll from first progress movement to progress 1, measured at 0.25 vh resolution):

| Slot | Slot height | Pin | Range | Scrub 1440 | Scrub 1920 |
|---|---|---|---|---|---|
| hero | 2.80 | not sticky | top top -> bottom bottom | 1.75 | 1.75 |
| rail | 4.20 | 3.20 | top -45% -> bottom bottom | 2.50 (7.50 -> 10.00) | 2.50 |
| quotesdone | 4.50 | 3.50 | top top -> bottom bottom | 3.25 | 3.25 |
| sonobolt | 2.88 | 1.96 | top 60% -> bottom bottom | 2.50 | 2.50 |
| mubinflow | 3.20 | 2.47 (2.59 at 1920) | top 75% -> bottom bottom | 2.75 | 3.00 |
| company | 0.95 | not sticky | top bottom -> bottom top | 2.00 | 2.00 |
| close | 0.99 | not sticky | top bottom -> max | 1.41 | 1.44 |

MubinFlow was `ready` at all 14 (or 15) steps where it covered the viewport, from progress
0.08 to 1. It was `disposed` about one viewport after the section (the host's 0.4 vh hysteresis).
That confirms the pin holds the scene live and frees it after.

## 4. Boundary review (screenshots, 1440x900 and 1920x1080)

| Boundary | Finding |
|---|---|
| Statements -> rail | Products overlaps Statements by 1 viewport (by design: the datum handover). Rail progress starts at "top -45%", so after the DOM line hands over there is about 1.2 viewports of a single line on Carbon. Intentional, but it adds to the slow start (pacing). |
| Rail -> QuotesDone | **Fixed.** Labels no longer cover the QuotesDone intro. No double header. |
| QuotesDone -> Sonobolt | The QuotesDone end beat is 100svh with the status and CTAs centred, so about 0.4 of a viewport is empty between them and the Sonobolt eyebrow. A pacing gap, not a bug. |
| Sonobolt -> MubinFlow | Sonobolt's sticky stage leaves with its section and cuts its lit plate along a hard horizontal edge (already listed in ledger #43). Needs a scene-side fade or a shorter final framing (Sonobolt owner). |
| MubinFlow pin | Live for the whole pin, freed after (`disposed` one viewport past the section). The stage is centred. With "top top" the first viewport of the pin showed an empty sheet; the range now starts at "top 75%". |
| MubinFlow -> Company | Clean. Company starts drawing while the MubinFlow proofs are still on screen. |
| Company -> Close | Clean. Close text and Q. |

**Bottom band: worked around in `Header.astro`, not yet checked in a real browser.** On every scene that
reached the bottom of the viewport, the bottom ~77 px of the canvas was missing (exactly
`--header-h`). It showed at 1440x900 and 1920x1080, at DPR 1 and 2, with GPU and with software
compositing. It is also in the Sonobolt agent's own artifact (`tests/artifacts/sonobolt/home-0.3.png`),
and may be what ledger #43 calls "stage edge cuts the lit slot plate". Bisect:
- it goes away when the sticky header is transparent, not sticky, or hidden;
- a plain fixed red DOM layer in place of the canvas is NOT covered, so no element paints over it;
- the canvas draws its full height whenever the header's opaque colour is removed, so
  `presenter.draw` is not the cause. The trigger is the header's solid `background-color`.

Workaround (applied): the header paints the same Carbon as an image,
`background: linear-gradient(var(--bg), var(--bg))`. Same pixels, header still opaque, and the band
is gone on the final build (re-shot). It looks like Chromium's handling of an opaque solid-colour
sticky layer over a WebGL canvas. Whether the band happens in real GPU Chrome or Safari is NOT
verified. Check `/` at 1440x900 there; the workaround is harmless either way.

**Runtime moved during this pass.** The runtime agent added a signal pass, opted in per material
with `material.userData.signal = true` (`runtime/signal.ts`). `toneMapped: false` still does
nothing, so the rail, company and close datum colours were re-measured on the final build: rail
rgb(189, 63, 80), company rgb(192, 66, 83), close rgb(144, 40, 56) (dimmed toward a hairline by
design). All three are the same signal. No rail scene opts in yet; `shared/rail.ts` says how to
switch all three at once.

## 5. Pacing (the owner wants awe, not a slog)

Desktop section lengths in viewport heights (vh) at 1440x900. All of it is scroll distance.

| Section | Length (vh) | Pinned / scrubbed | Verdict |
|---|---|---|---|
| Hero (logo) | 2.8 | scrub 1.75 | OK |
| Statements (datum) | 5.0, of which 1.0 is shared with the rail | DOM only | **Too long.** 4 viewports of text before the next 3D beat. Target about 3 |
| Rail | 4.2 | pin 3.2, scrub 2.5 (starts 0.45 in) | **Long.** The single-line hold plus the 45% offset are slow. Target pin about 2.4 |
| QuotesDone | 4.5 | pin 3.5, scrub 3.25 | **Longest product.** Target about 3.5 in total (proof beats 80svh -> 60svh) |
| Sonobolt | 2.9 | pin about 2.0, scrub 2.5 | Good |
| MubinFlow | 3.9 to 4.0 | pin 2.5 to 2.6, scrub 2.75 to 3.0 | Acceptable. 280svh would match Sonobolt |
| Company | 2.0 | scrub 2.0 | Good |
| Close | 1.2 + footer | scrub 1.4 | Good |
| **Page** | **26.2** | | About 23,500 px at 1440x900. Trimming the four items above would save about 4 viewports (to about 22) |

Pacing numbers are recorded, and no other section's pin was retuned in this pass. Changing beat
heights is a choreography decision for each scene owner, and the rail labels' anchors depend on
the rail range.
