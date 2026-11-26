# R2-1 "Monolith": QUOTESDONE TECHNOLOGIES

## The idea
Extended architectural capitals built from one radius: every round is a stadium end of radius H/2, so the O reads like the plan of a tower. Two letter changes make it ours. **The Sill:** the Q has no diagonal tail. Its bottom-right corner is squared, so the bowl turns into a speech-bubble shape (a nod to "quotes"), and its floor runs on as a flat foundation bar that tucks under the U's round foot. **The Lintel:** the T's crossbar carries straight on into the E's top arm, so the two letters share one beam.

## Palette
| Role | Name | Hex |
|---|---|---|
| Primary ink | Basalt | `#1D1C1A` |
| Paper / ink on dark | Limestone | `#ECE8E0` |
| Accent (mark tile, rules, app icon only) | Aubergine | `#5A2F4E` |
| Accent tint for use on Basalt | Aubergine light | `#B98AA8` |
| Neutral for captions | Stone grey | `#7A746C` |

Why these colours: Basalt and Limestone are the materials of a Gulf tower (dark stone and pale cladding). They are warm, quiet and expensive-looking, not SaaS blue. Aubergine is a deep red-violet. I chose it because it is clearly different from the QuotesDone app (teal, gold, navy), from both round-1 concepts (ember coral, and ink green with coral), and from the common UAE developer colours (black and gold, blue). Copper, sand and ochre were rejected because they read as gold. The wordmark itself is always a single colour, and the accent never touches the letters, so the logo works in one colour by design. One-colour files use pure `#000000`; recolour freely.

## Construction (all in `build.py`, cap height H = 1000 units)
- Stem S = 168, bar h = 142 (horizontals are thinner, for optical balance). Counters are concentric ellipses (rx = R−S, ry = R−h), so each curve thins smoothly from S at the sides to h at top and bottom.
- Stadium rounds overshoot the cap line and baseline by 8 units. E, H and the middle bar of the S sit at 0.515–0.522 H, a little above centre. E arms run bottom > top > middle.
- The S is two stacked half-stadiums with stretched arcs (`s_rx = 1.30`) joined by one spine. The upper bowl is narrower and smaller.
- N stems are 0.94 S and the diagonal is about 0.98 S measured across its width. Apexes are cut flat to the cap line and baseline.
- Spacing: a straight side adds 150 units, a round side 0.52 × that, an open side 0.10 × that. Kerning pairs are in `KERN`: QU −110 (the sill tuck), TE −30 (lintel), ES +70.
- TECHNOLOGIES has its own lighter drawing (S = 150 at its own scale). Its cap height is 0.40 × line 1. It is justified in code to the optical width of QUOTESDONE, with less air next to round and open sides (`JUSTIFY_SIDE`).
- Every parameter is at the top of `build.py`. Run `python3 build.py` to rebuild all the SVGs, run the XML and hygiene checks, and render `preview.png`. Run `python3 build.py --crops DIR` to also write large zoom crops for checking spacing.

## Custom vs borrowed
All letterforms (Q U O T E S D N, plus C H L G I for line 2) are drawn in code from rectangles and quarter-ellipses, then merged with skia-pathops booleans. **No font is used, not even as a skeleton.** The only things borrowed are the genre (extended, flat-sided capitals in the Eurostile / Microgramma tradition) and standard type-design corrections.

## Files
- `wordmark-light.svg`, `wordmark-dark.svg`, `wordmark-onecolour.svg`: QUOTESDONE on its own (the primary logo).
- `lockup-stacked-{light,dark,onecolour}.svg`: QUOTESDONE over TECHNOLOGIES.
- `lockup-horizontal-{light,dark,onecolour}.svg`: the mark at the wordmark's cap height, followed by the stacked lockup.
- `mark.svg` (800×800, Limestone on Aubergine) and `mark-onecolour.svg`: the Sill-Q, drawn heavier (S = 220) because it is mostly used small.
- `preview.png`: light, dark and one-colour versions, the mark at 512/32/16 px, a tower signage line, a letterhead corner and app-icon tiles.
- SVG hygiene: only `<path>` elements, with `<title>`, prefixed unique ids, and backgrounds drawn as paths. There is no text, no font and no external reference. `build.py` checks this with an XML parse.

## Clear space and minimum size
- Clear space: half the cap height of QUOTESDONE on every side (the artboard padding already shows this).
- Wordmark: 120 px / 25 mm wide minimum.
- Stacked lockup: 280 px / 60 mm wide minimum. Below that, the TECHNOLOGIES stem drops under 1 px, so use the wordmark alone.
- Mark: 16 px minimum. Use a single colour at 32 px and below.

## Honest weaknesses
- **Genre risk.** Extended, flat-sided capitals are an established style (Eurostile, many automotive and real-estate marks). The Sill and the Lintel are what make it ownable. I have not run a trademark or visual search, and I cannot claim nothing similar exists. That check is still needed.
- **The mark** is a heavy Q bowl with a square corner. At 16–32 px it can read as a lowercase "a" or a speech bubble rather than a Q. It is a stadium-and-bar, not a ring-and-check, but it is still a closed round shape, so it is close in kind to the app's ring. Keep it secondary.
- **Aspect ratio.** The wordmark is about 14:1. That is excellent on a tower crown but awkward for square placements, and the letterhead version gets small.
- **Line 2 tracking** is very wide (about 2.3 caps between letters) because ten extended capitals set a long measure. It looks deliberate, but it is airy. A shorter descriptor would not need this.
- **The Q's squared corner** puts extra weight at the bottom right where the counter curves away. This is accepted as part of the speech-bubble idea, but a type designer might lighten it.
- The square right side of the Q and the long sill make QUOTESDONE start heavier on the left than it ends (N, E).
