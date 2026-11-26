# R2-1 "Monolith": QUOTESDONE TECHNOLOGIES (refined, round 2)

## The idea
Extended architectural capitals built from one radius. Every round is a stadium end of radius H/2, so the O reads like the plan of a tower. Two letter changes make it ours:
- **The Sill.** The Q has no diagonal tail. Instead, a flat bar starts under the counter, cuts through the bottom-right of the bowl, hangs slightly below the baseline and runs on under the round foot of the U, like a foundation sill.
- **The Lintel.** The T's crossbar carries straight on into the E's top arm, so the two letters share one beam.

## What changed after owner feedback
1. **Mark.** The earlier mark (a squared, speech-bubble corner with a flush sill) read as a lowercase "a". The bowl is now a full stadium, the same as the O, and the tail visibly crosses the stroke and drops below the bowl. It reads as a Q at 512, 32 and 16 px. `preview.png` shows before and after at 256/32/16 px, plus pixel enlargements.
2. **Wordmark Q uses the same construction**, so the mark and the wordmark Q are the same letter. The QU tuck is now real: the tail runs about 100 units under the U's round foot without touching it.
3. **Weight.** QUOTESDONE is heavier (S 168→190, h 142→160), which is properly heavy-medium. TECHNOLOGIES is heavier too: its stem went from 60 to 84 units in line-1 terms, about 0.44 of the main stem. Its letters are wider and larger (cap 0.40→0.45 of line 1), so tracking dropped from about 2.3 to about 1.6 caps. It still justifies to the wordmark's optical width.
4. **Spacing re-checked at 6000 px.** Changes: N-E −30. E-S +70 stays, because the open E needs it. T-E is bridged by the lintel. S-D, D-O and O-N are unchanged and even. QU is now −270, and the bowl-to-stem gap is about 225 units, the same as other round-to-straight pairs.
5. **Palette.** Changed from plum to Oxblood (see below).
6. **New file:** `app-icon.svg` (1024×1024, glyph centred exactly on both axes).
7. **Preview fixes.** The signage glow is now on the letters. The letterhead uses the stacked lockup above its minimum size. A one-colour mark tile replaces the duplicate icon.

## Palette (3 colours; the tint is a lighter value of the accent, not a fourth colour)
| Role | Name | Hex |
|---|---|---|
| Primary ink | Basalt | `#1D1C1A` |
| Paper / ink on dark | Limestone | `#ECE8E0` |
| Accent | Oxblood | `#6E2230` |
| Accent tint, only for the mark on Basalt | Oxblood tint | `#D6A0A6` |
| Caption neutral | Stone grey | `#7A746C` |

Why: Basalt and Limestone are the materials of a Gulf tower (dark stone and pale cladding), and they carry almost all the weight. Oxblood is the red of the UAE flag deepened to a stone-dark wine. It reads as institutional and permanent (the colour of a bank or a law firm, not a start-up). It sits a long way from the QuotesDone app (teal, gold, navy) and from round 1's bright ember and coral. Plum was rejected because it reads as lifestyle and beauty; copper, sand and ochre were rejected because they read as gold. The letters are only ever one colour, and the accent appears on the mark, rules and icon only, so every logo works in one colour. One-colour files use `#000000`; recolour freely.

## Construction (all in `build.py`, cap height H = 1000 units, every value a named parameter)
- **Line 1:** stem S = 190, bar h = 160.
- **Counters** are concentric ellipses (rx = R−S, ry = R−h), so each curve thins from S at the sides to h at the top and bottom.
- **Overshoot:** stadium rounds go 8 units past the cap line and baseline.
- **Middle bars** of E, H and S sit at 0.515–0.522 H, a little above centre.
- **Q tail:** thickness 160, drop 96 (0.6 h), starts 0.75 R in from the right, runs 330 past the bowl. A code assertion stops the tail from ever cutting into the counter.
- **S:** two stacked half-stadiums with stretched arcs (`s_rx`) and one shared spine. Each half is trimmed so the spine is continuous.
- **N:** stems are 0.94 S. Apexes are cut flat.
- **Spacing:** a straight side adds 150 units, a round side 0.52 of that, an open side 0.10 of that. Kerning pairs are in `KERN`.
- **Line 2** has its own drawing (S = 186 at its own scale). Its cap height is 0.45 of line 1, and the gap below line 1 is 0.32 H, measured from the baseline. One tracking value is solved in code, and each gap is weighted by the facing sides (`JUSTIFY_SIDE`: straight 1.0, round 0.8, open 0.62).
- **Mark:** the same Q, bowl 1380 wide, drawn heavier (S 230, h 200) because it lives small. In the horizontal lockup it is used at scale 1, so its bowl sits exactly on the wordmark's cap height and baseline.
- **Commands:** `python3 build.py` rebuilds everything, runs the XML and hygiene checks, and renders the preview. `python3 build.py --crops DIR` also writes large crops for spacing review.

## Custom vs borrowed
Every letterform is drawn in code from rectangles and quarter-ellipses and merged with skia-pathops booleans: Q U O T E S D N, plus C H L G I for line 2. **No font is used anywhere, not even as a skeleton.** The only things borrowed are the genre (extended, flat-sided capitals in the Eurostile / Microgramma tradition) and standard optical corrections.

## Files
- `wordmark-{light,dark,onecolour}.svg`: the primary logo.
- `lockup-stacked-{light,dark,onecolour}.svg`: QUOTESDONE over TECHNOLOGIES.
- `lockup-horizontal-{light,dark,onecolour}.svg`: mark, then the stacked lockup.
- `mark.svg` (800×800, Limestone on Oxblood) and `mark-onecolour.svg`.
- `app-icon.svg`: 1024×1024 square artwork, glyph centred. The platform applies its own corner mask.
- `preview.png`
- SVG hygiene: only `<path>` elements, a `<title>` in each file, prefixed unique ids, and backgrounds drawn as paths. There is no text, no font and no external reference. `build.py` checks this.

## Clear space and minimum size
- **Clear space:** half the cap height of QUOTESDONE on every side (the artboard padding).
- **Wordmark:** 120 px / 25 mm wide minimum.
- **Stacked lockup:** 200 px / 45 mm. **Horizontal lockup:** 260 px / 55 mm. Below these sizes the TECHNOLOGIES stem falls under 1 px, so use the wordmark alone.
- **Mark:** 16 px minimum. Use one colour at 32 px and below.

## Honest weaknesses
- **Genre risk.** Extended, flat-sided capitals are an established style. The Sill and the Lintel carry the ownability. No trademark or visual search has been run, and I have not compared against the real Emaar or Damac files. That check is still needed.
- **The Q tail goes below the baseline** (about 10% of H). It is fine in lockups, but on a tower fascia, signage fabricators need to allow for the descent.
- **Aspect ratio** is about 14:1. That is excellent for a crown or fascia but small in square placements.
- **TECHNOLOGIES is still generously tracked** (about 1.6 caps). This is unavoidable when 12 letters must span 10 extended capitals without growing into a second headline.
- **The mark is still a closed round with a bar.** It is not a ring with a check, but it is the same kind of shape as the app's ring. Keep it secondary and in Oxblood or Basalt, never in teal or gold.
- **C and G terminals** are horizontal cuts through the arc. They are clean at TECHNOLOGIES sizes, but they would want hand finishing if C or G were ever used large.
