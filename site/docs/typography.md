# Typography

The type system for the QuotesDone Technologies hub. Owner of the files: `src/styles/fonts.css`,
`tokens.css`, `base.css`, `motion.css`. Specimen: `/debug/type` (dev only, noindex).
Decided 2026-11-26 (structure-v1 §4.6, Q7).

## The faces and why

| Role | Face | Version | Licence | Source |
|---|---|---|---|---|
| Display and text (Latin) | **Archivo** (variable, wght + wdth) by Omnibus-Type | @fontsource-variable/archivo 5.3.0 | SIL OFL 1.1, no Reserved Font Name | https://github.com/Omnibus-Type/Archivo |
| Technical labels | **Fragment Mono** by Wei Huang | @fontsource/fragment-mono 5.3.0 | SIL OFL 1.1, no Reserved Font Name | https://github.com/weiweihuanghuang/fragment-mono |
| Arabic display (planned) | **Noto Kufi Arabic** (variable, wght 100 to 900) | @fontsource-variable/noto-kufi-arabic 5.3.0 | SIL OFL 1.1 | https://github.com/notofonts/arabic |
| Arabic text (planned) | **Noto Sans Arabic** (variable, wght 100 to 900, wdth 62.5 to 100) | @fontsource-variable/noto-sans-arabic 5.3.0 | SIL OFL 1.1 | https://github.com/notofonts/arabic |

Licence text: OFL 1.1 at https://openfontlicense.org. I read the `LICENSE` file in each package
(all four are the full OFL 1.1 text). Archivo and Fragment Mono declare no Reserved Font Name,
so a subset may keep its name. The licences are copied to `public/fonts/LICENSE-*.txt`, and the
name table (copyright and licence notice) is kept in every subset.

**Why Archivo.**
- The logo is a wide, geometric, monoline wordmark (about 10.7:1). Archivo has a real width axis
  (62 to 125). At 125% its round letters (o, e, c, d) have the same open, wide proportions as the
  wordmark's O, C and D. So the headlines continue the logo instead of sitting next to it.
- At 100% it is a plain, readable grotesque for paragraphs. One family covers everything, and
  width does the work that a second display face would do. That is calmer and more "large
  company" than a pairing.
- It is not Inter, Roboto or a system face. It is not used by Sonobolt (Host Grotesk and Martian
  Mono, checked in `djai-engine/site-v3/src/css/site.css`) or by QuotesDone (Geist, Geist Mono and
  Readex Pro, checked in `quotesdone/src/app/globals.css`).
- Rejected after a side-by-side test against the logo: Hubot Sans and Mona Sans (they are GitHub's
  brand faces, and they reserve the font names, so a subset could not keep the name), and
  Instrument Sans (no expanded width).

**Why Fragment Mono.** A monospace cut drawn from a neo-grotesque, so its labels sit beside
Archivo without the "code editor" look of JetBrains Mono or IBM Plex Mono. One weight is enough
for small labels. Use it only for real technical data (coordinates, versions, units, file
sizes), in sentence case. It is not a decorative label style.

**Why the Noto Arabic pair.** Both are variable from 100 to 900, so every Latin weight has an
Arabic match. Noto Kufi Arabic is geometric and low-contrast, with a monoline feel, so it matches
expanded Archivo and the logo in headlines. Noto Sans Arabic is the readable face for running
text. The specimen shows both next to Archivo at the same size. **Finding:** Kufi at 500 looks
lighter than expanded Archivo at 500, so Arabic display uses 600 (`:lang(ar) --w-display`). Not
chosen: Readex Pro (QuotesDone's face) and IBM Plex Sans Arabic (static files only, no 800+).
The Arabic files are **not shipped** on public pages yet. Only `/debug/type` loads them, to test
the metrics. Arabic subsets are large (Kufi 124 KB, Naskh 166 KB). Subset them to the real
Arabic copy when it exists.

## Files and bytes (measured 2026-11-26)

| File | Contents | Bytes (woff2) | Preloaded |
|---|---|---|---|
| `src/assets/fonts/archivo-latin-var.woff2` | Archivo, wght 400 to 600, wdth 100 to 125, Latin | 39,892 | yes (the only one) |
| `src/assets/fonts/fragment-mono-latin-400.woff2` | Fragment Mono Regular, Latin | 14,152 | no |
| **Total Latin** | | **54,044 (52.8 KB)** | budget: 2 or fewer files preloaded, 90 KB or less |

The upstream Archivo Latin file (all axes) is 90,104 bytes. Cutting the axes to the ranges in use
(`fontTools.varLib.instancer`) and dropping hinting took it to 39.9 KB. Vite fingerprints both
files, so they can be cached `immutable`. `Base.astro` preloads the same hashed URL through
`?url`.

**Rebuild:** `python3 scripts/fonts/build_fonts.py` from `site/`. It needs `pip install
fonttools brotli`, and `FONTS_VERBOSE=1` turns on logging. The outputs are committed, so a normal
`npm run build` does not need Python. The script uses the pinned packages in `node_modules`.

## Loading and fallbacks (CLS)

- `font-display: swap` on both faces. Each `unicode-range` is the Google "latin" range plus
  arrows, and it matches `LATIN_RANGE` in the script.
- Metric-matched local fallbacks (Arial, Helvetica or Liberation Sans; Menlo, Courier New or
  Liberation Mono), one per role, because width changes the metrics:

| Fallback | For | size-adjust | ascent / descent override |
|---|---|---|---|
| Archivo Fallback | text, wdth 100, 400 | 98.6% | 89.05% / 21.3% |
| Archivo Heading Fallback | h3 and h4, wdth 112.5, 600 | 117.4% | 74.79% / 17.89% |
| Archivo Display Fallback | h1 and h2, wdth 125, 600 | 132.3% | 66.36% / 15.87% |
| Fragment Mono Fallback | mono | 103% | 92.23% / 24.27% |

- **Method.** Take the mean advance of English text, weighted by letter frequency with spaces
  included, measured with fontTools on each Archivo instance (0.4409 / 0.5250 / 0.5913 em) and on
  Liberation Sans (0.4471 em). Then size-adjust = Archivo / Arial, and override = Archivo metric
  (ascender 878, descender 210, UPM 1000) / size-adjust. Each fallback declares `font-weight:
  100 900` so the browser never fakes a bold (`font-synthesis-weight: none` too).
- **Measured CLS** (Chromium, every woff2 delayed 1.5 s, then the swap; the pages were still
  changing while other agents built them, so re-measure at release):

| Viewport | Home | Products | Company | Specimen |
|---|---|---|---|---|
| 1440 px | 0.0000 | 0.0195 | 0.0000 | 0.0000 |
| 390 px | 0.0084 | 0.0003 | 0.0003 | 0.0003 |

  All are under the 0.02 budget (structure-v1 §4.1), but Products at 1440 px sits right at the edge.
  The cause: `.page-title` ("Two products live. One in development.") breaks into 3 lines under
  the fallback and 2 with Archivo. The text widths match within 1%, because size-adjust works. I
  tried replacing the title's `16ch` with `12.1em` and with `12.6em`: neither changed the result,
  so the fix is **not** known yet. Next suspect: SplitText's line split (`autoSplit`) running
  before the font arrives. A general note: `ch` is the width of "0" in whichever font is showing,
  so a `ch` measure cannot match across a swap. Prefer `em` or `rem` for heading measures.
- Arabic subtrees: `[lang="ar"]` re-resolves `font-family` and `line-height`, because the values
  inherited from `<html>` were computed from the Latin tokens. Verified on `/debug/type`: Noto
  Kufi Arabic and Noto Sans Arabic both load, and Arabic body line height is 28.8 px (1.8rem).

## Scale

Fixed sizes for reading text, fluid sizes for headings (360 px to 1600 px viewport). Each clamp
has rem bounds, so zoom and the browser's text-size setting still apply.

| Token | Size | Role | Family / width / weight | Line height | Tracking |
|---|---|---|---|---|---|
| `--t-3xl` | 52 to 136 px | one hero line per page (`.type-hero`) | display / 125 / 500 | 1.1 | -0.03em |
| `--t-2xl` | 44 to 96 px | section display (`.type-display`) | display / 125 / 500 | 1.1 | -0.03em |
| `--t-xl` | 36 to 72 px | page titles, h1 and h2 (`.type-title`) | display / 125 / 500 | 1.1 | -0.02em |
| `--t-lg` | 24 to 36 px | statements, h3 (`.type-heading`) | heading / 112.5 / 500 or 600 | 1.2 | -0.02em |
| `--t-md` | 18 to 22 px | lead paragraph (`.type-lead`) | text / 100 / 400 | 1.45 | 0 |
| `--t-base` | 16 px | body (`.type-body`) | text / 100 / 400 | 1.5rem (10 baselines) | 0 |
| `--t-sm` | 14 px | secondary, navigation (`.type-small`) | text / 100 / 400 or 500 | 1.35rem (9) | 0.005em |
| `--t-xs` | 12 px, the floor | meta, mono labels (`.type-meta`, `.type-mono`) | text or mono / 400 | 1.05rem (7) | 0.005em / 0 |

**Optical size = width.** Archivo has no `opsz` axis, so width and tracking do that job: expanded
and tight at display sizes, 112.5 for small headings, normal and untracked for text.
`font-optical-sizing: auto` is set, so any face with an `opsz` axis uses it.

## Rules

1. **Three weights only:** 400 for text, 500 for labels and display, 600 for small headings and
   `strong`. The font file holds nothing outside 400 to 600, and bold is never faked.
2. **Line height falls as size grows.** Display is 1.1. Reading text sits on the **2.4 px
   baseline**: `--baseline` = joint / 4 = 0.15rem, so the 2.4-unit logo joint is the type grid
   too. Spacing between blocks uses joint multiples (`--s-*`, 0.6rem). Fluid headings are not
   forced onto the grid, but `.trim` (`text-box: trim-both cap alphabetic`, progressive) measures
   their spacing from the ink.
3. **Measure:** `--measure` 31.2rem (52 joints, about 70 characters of body text),
   `--measure-wide` 40.8rem for lead text, `--measure-narrow` 24rem.
4. **No all-caps labels and no tracked eyebrows.** The only spaced caps are in the logo.
5. **Numbers:** `.num` gives tabular, lining figures for prices, tables and counters. Running
   text keeps proportional figures.
6. **Links:** a hairline underline at 45% of the text colour, 0.24em offset. On hover the
   underline turns Rhodamine (light, not text). **Focus:** a 2 px outline in `--focus` (Alloy on
   Carbon, Carbon on Alloy) with a 3 px offset, keyboard only (`:focus-visible`), and `Highlight`
   in forced-colours mode. **Selection:** inverted (Alloy ground with Carbon text on dark, and the
   reverse on light).
7. **Light surfaces:** `data-surface="alloy"` swaps the semantic tokens (muted text becomes
   Graphite, because Mist fails on Alloy).
8. **Arabic** (`:lang(ar)`): families switch to the Noto pair, line heights grow (1.35 for
   display, 1.8 for text, 1.8rem = 12 baselines), all tracking is 0 (tracking breaks joined
   script), and display weight is 600. Latin words inside Arabic stay in Archivo
   (unicode-range). Split text by word or line, never by character (structure-v1 §5.6).

## Contrast (WCAG 2.2, computed by `tests/unit/contrast.test.ts` from `tokens.css`)

Pairs checked against actual use (grep of `color`, `background` and `color-mix` across `src`,
26 Nov 2026): text uses only `--fg` and `--fg-muted` on `--bg`, inverted buttons (`--bg` on
`--fg`), and the button hover mix. Breadcrumb separators use `--rule` (decorative).

| Text | Ground | Ratio | Use | Level |
|---|---|---|---|---|
| Alloy #ECEAE4 | Carbon #0E1013 | **15.84** | body and headings on dark; focus ring | AAA |
| Mist #8A8F97 | Carbon #0E1013 | **5.86** | muted text on dark | AA |
| Carbon #0E1013 | Alloy #ECEAE4 | **15.84** | body and headings on light; skip link; selection | AAA |
| Graphite #5E636B | Alloy #ECEAE4 | **5.03** | muted text on light | AA |
| Rhodamine #E3185B | Carbon #0E1013 | **4.13** | light and status only: 24 px+ text or non-text (3:1) | AA large / 1.4.11 |
| Rhodamine #E3185B | Alloy #ECEAE4 | 3.84 | non-text only | 1.4.11 only |
| Graphite #5E636B | Carbon #0E1013 | 3.15 | decorative only, never text | fails AA text |
| Mist #8A8F97 | Alloy #ECEAE4 | 2.70 | not allowed | fails |
| Carbon #0E1013 | Alloy 86% over Carbon (#CDCBC7) | 11.76 | primary button hover (QuotesDone section) | AAA |
| `--rule` (Alloy 14%) | Carbon | 1.42 | hairlines are decorative, never the only boundary of a control | n/a |

## How to change

- **Another weight or width:** widen `ARCHIVO_AXES` in `scripts/fonts/build_fonts.py`, rerun it,
  and update the `font-weight` / `font-stretch` ranges in `fonts.css`. Check the byte budget.
- **Another face:** add the pinned `@fontsource` package, extend the script, measure its metrics
  (the method above) for a new fallback, and update the `--font-*` tokens. Keep every token
  name: other components read them.
- **Ship Arabic:** subset Noto Kufi Arabic and Noto Sans Arabic to the Arabic copy in the script,
  add `@font-face` rules named "Noto Kufi Arabic" and "Noto Sans Arabic" with the Arabic
  unicode-range (the tokens already name them), and preload the Arabic text face on `/ar/` pages
  only.
- **Palette:** edit `tokens.css`. `npm test` fails if a text pair drops below AA or a documented
  ratio drifts.

## Known risks

- `/debug/type` is built in every build. It must be excluded from the production build (M5),
  along with the Arabic font files it pulls in.
- The fallback numbers come from Liberation Sans, a metric clone of Arial. Windows, macOS and iOS
  ship Arial, which matches first. Most Android devices have none of the `local()` names (Roboto
  only), so they fall through to `system-ui` with no metric override, and CLS there is
  unmeasured. Option: add a Roboto-tuned fallback after measuring Roboto.
- Arabic glyphs look larger than Latin at the same font size (Kufi has a tall body). If the
  Arabic pages look loud, add an Arabic size factor token, and test it on real copy.
- Components that hard-code `font-weight: 600` on display headings get expanded 600, which is
  heavier than the intended 500 (`--w-display`).
