# QUOTESDONE TECHNOLOGIES: concept R2-3 "Engineered"

**The idea.** The letters are built the way a machine is built. Every letter is put together from separate members: stems, beams, bowls, rings and one brace. Where one member butts into another, a hairline **joint** keeps them apart. Two shared beams lock the middle of the word together: T and E share the top beam, and E and S share the baseline beam. The logo looks the way the website will animate: parts arrive and seat into a finished whole.

## Files

| File | Use |
|---|---|
| `build.py` | Generator. All geometry, the SVGs, `strokes.json`, the XML and hygiene checks, and the preview render. Run `python3 build.py` (add `--no-png` to skip Playwright). |
| `wordmark-light.svg` / `wordmark-dark.svg` / `wordmark-onecolour.svg` | Primary two-line wordmark in Carbon (for light grounds), Alloy (for dark grounds) and pure black. The backgrounds are transparent. |
| `wordmark-compact.svg` | Small-size cut with the joints closed. Use it below 480 px wide on screen or 120 mm in print. |
| `wordmark-line1-light.svg` / `-dark.svg` | QUOTESDONE on its own, for fascia signage and tight spaces. |
| `lockup-horizontal.svg` / `lockup-horizontal-dark.svg` | Q tile + wordmark. The tile is the height of line 1 (QUOTESDONE). |
| `lockup-stacked.svg` | Q centred above the wordmark. |
| `mark.svg` (800×800), `mark-small.svg`, `mark-dark.svg`, `mark-onecolour-carbon.svg` | Companion mark: the wordmark's Q, re-weighted for its secondary role. `mark-small` closes the joint for 32 px and below. |
| `strokes.json` | 43 strokes ready for animation (see below). |
| `preview.png` / `preview.html` | Contact sheet: light, dark, one-colour, lockups, small-size test, the mark at 512/32/16 px, app tiles, a signage band and a letterhead corner. |

## Palette

| Name | Hex | Role |
|---|---|---|
| Carbon | `#0E1013` | Primary ink. A near-black with no hue cast, the colour of anodised hardware. |
| Alloy | `#ECEAE4` | Light ground and reversed ink. A warm, machined-aluminium white. |
| Rhodamine | `#E3185B` | The single accent: a red-violet named after the fluorescent dye used in laser metrology. It never goes inside the wordmark. Use it for app tiles, focus states and one highlight per web screen. |
| Graphite | `#5E636B` | Neutral for secondary information (addresses, captions). |

**Why these colours.** The wordmark is monochrome on purpose, as Emaar and DAMAC are: the confidence comes from the drawing, not the colour. Carbon and Alloy suit a dark 3D website, where the letters can be lit like real metal. Rhodamine avoids everything off limits or already used: it is not teal, gold, navy or a blue SaaS gradient; it is not the ember or coral of Round 1; and it is not the pure red of Tesla or Netflix. It has range too: it can shine on Carbon and still read on Alloy. One colour: everything is designed in black first, so nothing is lost.

## Construction (design units, cap height H = 100)

- **Weights:** stems 15.0, beams 13.6 (horizontals are drawn lighter so they look equal), diagonal 14.0 measured perpendicular. Rounds are modulated, moving from 15 on the sides to 13.6 at top and bottom with the same weight function (`weight()`), so curves and beams meet with no step.
- **Joint:** 2.4 units, always a uniform-width slot and always orthogonal. The `gap` parameter sets it; zero or below fuses the members, which is how the compact cut is made.
- **Cuts:** every cut is horizontal or vertical, with no angled terminals and no rounded ends. The free end of the Q's bowl is cut parallel to its tail, so the Q has its own joint.
- **Rounds:** true circles on the centre line. They overshoot the baseline and cap line by 1.6. The O is 104 wide, so the face is broad and calm.
- **Mid height:** the E arm and S spine sit at 52, just above centre. The S's lower bowl is therefore larger than its upper bowl.
- **Assembly rule:** beams run through and stems drop in between them (T, E, D, L); in N and H the stems run full height and the brace or bar drops in. U, O and S are drawn as one continuous stroke each. The Q is one motion: the bowl sweeps about 315 degrees and leaves along the baseline as its tail.
- **Ligatures:** `TE.beam_shared` (T bar plus E top arm) and `ES.base_and_S` (E base arm runs straight into the S). They sit at the centre of the word, QUO-**TES**-DONE, and act as its keystone.
- **Spacing:** each glyph has its own side bearings (straight side 9–10, round side 5, open side 2–3), plus +6 tracking and a short kerning table (`KERN`). Line-1 pairs (Q-U, O-T, S-D, N-E) and the T-E and E-S distances inside the ligature were adjusted over two visual passes on full-line renders at 1900–2000 px. It has not had a finished foundry-grade spacing pass.
- **Line 2:** TECHNOLOGIES is drawn in the same system with C, H, L, G and I added. Its cap height is 36% of line 1, with joints closed and slightly bolder relative weights for its size. It is tracked to the optical width of line 1, starting 1.4 units inside the Q's overshoot so the round hangs out past the T. Tracking is calculated, not chosen by eye.
- **Parameters** live in `Params` (`H, wv, wh, wd, gap, over, mid, track, q_tail`) together with the presets `MASTER`, `COMPACT`, `LINE2`, `MARK` and `MARK_SMALL`.

## strokes.json (for the website)

- **Coordinates:** SVG user units of `wordmark-light.svg` (x right, y down). The viewBox, the params and the units-per-cap are recorded in the file.
- **Fields per stroke:** `id` (matches the path id in the SVG), `line`, `glyph`, `name`, `role`, `order` (writing order), `weight`, `centerline` (path for draw-on), `outline` (filled path), `bbox` [x, y, w, h] taken from the sampled geometry, and `butt_reproducible`.
- **How to use `butt_reproducible`:**
  - Where it is true, stroking `centerline` at `weight` with butt caps reproduces the shape: animate `stroke-dashoffset`, then swap to `outline`. Rounds are modulated, so the stroke is up to 1.4 units heavier at their tops.
  - Four kinds of stroke are flagged false: the Q, the N brace, and the line-2 C and G. Their cut ends are not perpendicular, so reveal them by masking `outline` with the animated centre line.
- **Assembly animation:** move each member in from its joint, in `order`.
- **3D extrusion:** every `outline` is a closed shape, and the rings carry an inner subpath. It loads directly into THREE.SVGLoader and ExtrudeGeometry.

## Clear space and minimum size

- **Clear space:** one O width (≈ 1.04 H, the height of QUOTESDONE) on every side of the wordmark or lockup. For the mark alone: 25% of its size.
- **Two-line wordmark:** at least 240 px or 60 mm wide, compact cut. Below that, TECHNOLOGIES falls under 6 px cap height; use `wordmark-line1` instead (minimum 96 px or 25 mm).
- **Master cut with visible joints:** 480 px or 120 mm wide and up, where the joint is at least 1 px. Signage, the website hero and print covers should always use the master.
- **Mark:** 16 px minimum with `mark-small.svg`, 48 px and up for `mark.svg`.

## What is custom and what is borrowed

- **Custom:** every outline. Letterforms, modulation, joints, ligatures, spacing and line 2 are all generated by `build.py` from circles, lines and parameters. No font was opened, traced or used as an outline source.
- **Borrowed:** only general conventions of geometric sans lettering (circular O, monoline construction, overshoot and lighter horizontals as optical corrections). The Inter font appears only in the HTML captions of the preview sheet, never in a logo file.
- **Not checked:** similarity to existing marks and trademark clearance were **not** researched. Before adoption, run a search in the UAE and in the classes the business will trade in. Compare especially against wordmarks with a joined "TE/ES" run and stencil-cut tech logos.

## Honest weaknesses

1. **The joints disappear at small sizes.** Below about 480 px wide they read as grey seams, which is why a compact cut exists. The signature detail only belongs at large sizes (hero, signage, print), so at favicon or email-signature size the logo is a clean geometric wordmark with ligatures, and nothing more.
2. **Stencil association.** Gapped letters can recall stencil or military marking. The joints are kept to a hairline, uniform in width and orthogonal, but some viewers will still see "stencil".
3. **"TES" invites comparison.** Tesla is the obvious one, as T-E-S in a tech wordmark. Here the E has a real stem and the beams are joined, so the forms differ, but the letter run is the same. An Avant-Garde-style feel is also possible because of the shared beams.
4. **Q tile next to a Q wordmark reads twice.** In the lockups you see "Q | QUOTESDONE". The tile helps separate them, but the mark is best used apart from the wordmark (app icon, favicon, social avatar, 3D object). The Q is also a circle with a line, so it is not maximally distinctive on its own. It does steer clear of the banned ring-with-check motif: it is monochrome, has no check and no accent, and its tail is horizontal.
5. **The secondary line is very widely tracked** (about 0.68 H between letters) because it must span a 10.7:1 wordmark. It looks luxurious large, and it is the first thing to break small.
6. **The N brace** ends in two fine points at the cap line and baseline. They are sharp at billboard size, and in fabricated signage they would need a minimum flat of about 1 mm.
7. **Extreme width (10.7:1).** On square or portrait formats the wordmark gets small, so the stacked lockup or the mark has to do the work there.
