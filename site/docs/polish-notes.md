# Polish notes: home page pacing and composition

Polish pass of 2026-11-26. Scope: the page experience (components, styles, section lengths).
The 3D runtime and every scene's rendering code were NOT touched (another agent owns them);
no scene `params.ts` needed a change either (the section lengths live in the page CSS).

## 1. Result in numbers

Page height in viewport heights (vh). Desktop with live 3D (`?tier=high`), phones on `?tier=mid`.
Measured on the built site with the same jump-scroll stepper before and after
(`tests/artifacts/polish/{before,after}/<w>x<h>/walk.json`); the 1440 and 1920 figures are confirmed
by the real-wheel walk (`npm run test:walk`, section 4).

| Viewport | Before | After | Change |
|---|---|---|---|
| 1280x720 | 26.89 | 21.35 | -21% |
| **1440x900** | **26.16** | **20.54** | **-21%** |
| 1920x1080 | 25.69 | 20.21 | -21% |
| 2560x1440 | 24.68 | 19.61 | -21% |
| 390x844 (phone, not pinned) | 22.14 | 19.21 | -13% |
| 820x1180 (tablet, not pinned) | 19.71 | 16.82 | -15% |

Per section at 1440x900 (vh; scrub = scroll over which the scene's progress runs 0 -> 1, from the
real-wheel walk at 0.25 vh resolution):

| Section | Before | After | Scrub before | Scrub after | How |
|---|---|---|---|---|---|
| Hero (logo) | 2.80 | 2.80 | 1.75 | 1.75 | unchanged (logo choreography is the opener) |
| Statements | 5.00 (1.00 shared with the rail) | 2.75 (0.55 shared) | DOM | DOM | 4 x 55svh (`--statement-step`) + 55svh beat (`--home-datum-beat`) |
| Rail (products) | 4.20 | 3.00 | 2.50 | 1.75 (range 1.95; the walk quantises to 0.25) | `--home-rail-length` 300svh; start `top -45%` -> `top -5%` |
| QuotesDone | 4.50 | 2.95 | 3.25 | 2.00 (range 1.95) | beats 100/80/80/80/100 -> 75/55/55/55/55 svh; the hidden fallback row (+0.10) removed while 3D runs |
| Sonobolt | 2.88 | 2.58 | 2.50 | 2.25 | `--sono-length` 280 -> 250svh, top padding 14 -> 6svh |
| MubinFlow | 4.00 | 3.23 | 2.75 | 2.25 | slot 320 -> 250svh, section padding one step less |
| Company | 2.02 | 2.02 | 2.00 | 1.75 | unchanged |
| Close + footer | 1.58 | 1.58 | 1.41 | 1.39 | unchanged |

Target was "about 18 to 20". **The page is still slightly over it at 1280 (21.35) and 1440 (20.54)**;
1920 (20.2) and 2560 (19.6) are inside. Other viewport rows in the first table were measured before
the last 0.10 vh QuotesDone fix. I stopped there on purpose: the next
cuts would be the hero (owned by the logo scene) or the rail scrub, which is already the shortest
pinned scene at 1.75 viewports for extrude + camera + caps + three docks + push-in. Going lower
would read as rushed. If the owner wants 19, cut the MubinFlow slot to 230svh and the company band
(`clamp(30rem, 92svh, 64rem)`) to about 80svh: together about 0.5 vh.

## 2. What changed and why

### Statements: one statement per screen, on the datum (`components/Statements.astro`)
Before: 52px-ish headings in a 7/5 split beside tiny muted body copy, each in a full viewport,
with the line passing through the words as they scrolled. Huge empty black around timid text.

Now:
- **Scale with conviction.** Titles use a new `--t-statement` token (44 -> 112px, still growing to
  about 1900px wide), expanded Archivo at the display weight (500), hero tracking. At 1440 that is
  90px; every title is 2 lines at 1280 to 2560 and 3 lines on a phone (checked at all six sizes).
- **The datum organises the figure.** Each statement is a two-row grid split at its exact middle:
  the title stands on the line (baseline three joints above it), the body hangs from it (cap line
  three joints below it) in the second half of a 12-column grid. `text-box: trim-both cap
  alphabetic` makes those distances exact (measured: title bottom = line = body top at 1280, 1440,
  1920 and 2560). Both rows are `1fr`, so a 3-line title still keeps the split on the line.
- **The line is a slot, not a strike-through.** JS + motion only: a title is printed upward out of
  the line as it arrives and a body is taken back into it as it leaves (`clip-path`, measured from
  the line so descenders are cut by the line too). Risen titles fade out with distance (gone 0.4 viewport above the line, so no residue peeks under the header), and an
  arriving body waits for its title (opacity follows how much of the title is printed). Result: one
  statement on screen at a time, and words never cross the line. Paint-only properties; one read
  pass then one write pass per scroll update.
- **Pacing.** 55svh per statement (was 100svh).
- Titles are sized `min(var(--t-statement), 11.5svh)`: width drives the size, height caps it, so a
  short wide window keeps the first line clear of the header (1920x640: title top 160px, header 77px).
- No `data-reveal` here any more: the slot is this section's single motion idea.
- No JS / reduced motion / still tier without motion: CSS default is unclipped and opaque, the line
  is static and full width; every word reads (`tests/artifacts/polish/fallbacks/`).

### Statements -> rail handover (fixes a visible double line)
The old walk showed two Rhodamine lines at 6.5-6.75 vh: the DOM datum at mid-screen and the
canvas datum riding in with the unpinned rail stage at products-top + 50svh. Now the quiet beat
(55svh, overlapped by the products section by the same amount) is **opaque Carbon** and covers the
canvas line until the stage pins; at that moment both lines coincide, and the DOM line and the beat
fade together over 3% of the viewport (range computed from the beat's real height, applied on
update AND on refresh, so a reload restored mid-handover never leaves the opaque beat up; checked),
then the rail starts (`top -5%`). Checked frame by frame in the real-wheel walk (steps 15 to 22 at 1440): one line
throughout. Beat height must stay above 50svh (comment in `tokens.css`).

### Product sections: headlines and proofs at feature scale
- New tokens `--t-feature` (36 -> 84px) for product headlines and the closing line, `--t-proof`
  (26 -> 52px) for one proof per pinned QuotesDone beat, `--t-lead-lg` (20 -> 28px) for statement
  bodies and product promises. Headlines use the display weight (500) instead of a hard-coded 600
  (typography.md "known risks"), measures in `em` not `ch`.
- QuotesDone: beats 75/55/55/55/55svh. Text beat centres now cross the viewport centre at progress
  0 / 0.27 / 0.55 / 0.83 / end, measured on the build (scene: rows seated 0.27, sweep 0.40-0.58, cover 0.68-0.84, datum
  0.78-0.90), so each proof still lands on its scene beat. The intro starts below the header. The end
  beat is 55svh, and Sonobolt's top padding went from 14 to 6svh: the ~0.4-viewport empty band
  between the CTAs and the Sonobolt eyebrow is gone.
- Rail labels: product names set in the display width at `--t-lg` beside their stations (wide
  screens only; on a phone the label column is a quarter of the width).
- MubinFlow, Company, Closing, Hero H1: display weight, wider `em` measures so they break in 2
  lines instead of 3; Company headline at `--t-2xl` over its band.

### Wide screens (2560x1440): two shared values retuned (not new tokens)
- `--page-max` is now `clamp(96rem, 72vw, 112rem)`: unchanged up to a 2133px viewport, then 72vw.
  One value for header, content and footer, so all left edges still agree (inner pages included;
  their text columns keep their own measures).
- `html { font-size: 112.5% }` from 137.5em (2200px): every rem size, space and container steps up
  once, so type keeps its proportion to the screen. Still a percentage, so the reader's text-size
  setting multiplies it.
- MubinFlow's stage cap is now `1168px` instead of `73rem`, so the bigger root does not push its
  16:9 stage past the 3.1 MP target cap at DPR 2.
- Checked at 2560: `/company/`, `/products/quotesdone/`, the hero and the statements; header,
  content and footer edges agree.
- 3D stage caps are untouched (runtime-owned). At 2560x1440 a full-bleed stage exceeds the 'high'
  tier's 3.1 MP target cap even at DPR 1, so it renders below native resolution; see section 5.

## 3. Checks

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings (1 pre-existing hint) |
| `npm test` | 187 / 187 |
| Build to `/tmp/qdt-polish-dist` | 18 pages |
| `npm run check` (content + budgets) | ok / ok |
| Copy rules | only copy-deck strings; no "L.L.C.", ERP, app.sonobolt.com or owner-to-confirm text in `index.html` |
| HUD | absent on `/`, `/?tier=high`, no-JS, reduced motion and `?still` (no `[data-qdt-hud]`, no `window.__qdt`) |
| Header overlap | statement titles start 183px (1280x720) to 463px (2560x1440) below the top; header bar ends at 77 to 86px |
| Horizontal scroll | none at 390, 820, 1280, 1440, 1920, 2560 (one regression found and fixed: bigger rail label names overflowed a phone; now wide-only) |
| Real-wheel walk (1440, 1920) | see section 4 |
| e2e desktop + iPhone 13 (`QDT_DIST=/tmp/qdt-polish-dist QDT_E2E_PORT=4420`) | **101 passed, 9 skipped** (the opt-in walks), 2.8 min, final build |

## 4. Walk and e2e
Real-wheel scroll walk (`QDT_WALK=1`, SwiftShader, `?tier=high&hud`), on the final build except
two small DOM-only statement tweaks made after it (arriving bodies wait for their titles; risen
titles fade to 0 instead of 0.22). Neither changes any length or scene trigger: **2 passed** (1440x900 in 8.3
min, 80 steps; 1920x1080 in 10.8 min, 78 steps); 0 console errors, 0 horizontal scroll, 0 visible
scenes not ready. Every scene was `ready` across its whole pin. Raw data:
`tests/artifacts/walk/<w>x<h>.json` (the pre-polish walk is kept in
`tests/artifacts/polish/walk-before/`).

The walk overwrote the shared `tests/artifacts/walk/`, so the walk tables in
`docs/integration-notes.md` section 3 describe the pre-polish page; this file supersedes them.

## 5. Artifacts
- `tests/artifacts/polish/before/<w>x<h>/` and `after/<w>x<h>/`: one frame per half viewport
  (desktop; before at 1280/1920/2560 is one per viewport) or per viewport (phone, tablet), HUD
  hidden, plus `walk.json`. The `after/` set predates the "risen titles fade to 0" tweak.
- `after-statement-rest-{1440,2560,390}.png`: a statement at rest on the datum (final build).
- The stepper script used for before/after lives outside the repo (jump-scroll with
  `scrollTo`, waiting for visible slots to be `ready`); its progress readings matched the
  wheel walk to 0.01 at every step compared.
- `tests/artifacts/polish/compare-*.png`: matched before/after pairs.
- `tests/artifacts/polish/fallbacks/`: no-JS, reduced motion, `?still`, default and `?tier=high`.

## 6. Known limits (not fixed here)
- Rail labels on a phone already overflow their own 24cqw column and crowd each other
  (pre-existing; phone phase). Phone and tablet were viewed frame by frame: nothing overflows the
  page, every section is readable.
- Touch scrolling (iOS momentum): the slot's clip edge is set from a scroll callback while the line
  is sticky, so a word may show below the line for a frame. Not testable here; check on an iPhone.
- `text-box` (the exact three-joint distances) was measured in Chromium only. Where a browser does
  not support it, the distances grow by the half-leading (a few px); nothing else changes.
- Sonobolt's stage still cuts its lit plate along a hard edge when the section leaves (scene side).
- The statement bodies under the line leave the lower half of the screen quiet. Intentional
  (one figure per screen), but it is the obvious place for a future still or 3D echo of the line.
- Hero untouched: 2.8 vh with a 1.75 scrub, the largest remaining single block.
- QuotesDone end -> Sonobolt: the gap is smaller (end beat 55svh, Sonobolt top 6svh) but about a
  third of a viewport of Carbon still passes after the CTAs; closing it fully means the end beat
  and the Sonobolt intro overlapping, which needs the Sonobolt stage to start earlier (scene work).
- 2560x1440 at DPR 1 is 3.7 MP, over the 'high' tier's 3.1 MP target cap, so full-bleed stages
  render slightly below native there (HUD estimate about 180 MB of 192 MB at the rail). A 5K / DPR 2
  wide display will be capped much harder. Runtime decision, not changed here.
