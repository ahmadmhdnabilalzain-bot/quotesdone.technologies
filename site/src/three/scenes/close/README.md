# Scene 8: Close (`close`)

**Shows:** the end of the line. A dark anodised rail runs in from inline-start and stops at an
open joint, then a short end-cap block. The Q mark lowers onto that block and seats with its
tail on the line. The tail tip is flush with the end of the rail. The Rhodamine datum on the rail
face dims, then goes out before the mark arrives (it stops `datumClearance` short of it, with a
small terminator tick). The key light swings from raking to rest, then the canvas fades to Carbon.

**The mark is its own cut:** `mark.svg` is a byte-identical copy of `brand/logo/final/mark.svg`
(a unit test checks this). It is parsed with three's `SVGLoader` and extruded with a chamfer that
keeps the outline exact (`shared.ts: extrudeChamfered`). It is never stroke part 0 of the wordmark.
The tail thickness equals the rail height, so the mark's proportions set the scale.

**Copy slot:** `components/Closing.astro`, with home.json `closing` and company.json `home.contact`.

**Progress map** (`start="top bottom"`, `end="max"`, so p = 1 at the bottom of the page):
| p | beat |
|---|---|
| 0.2 to 0.6 | Q lowers (travel curve), then seats (seat curve, last 22% of the range) |
| 0.3 to 0.72 | key light moves from raking to rest |
| 0.4 to 0.62 | datum goes to a hairline (never under 1 device px), then out |
| 0.84 to 1 | alpha fade to Carbon (`shared.ts: createFadePass`): no Carbon pixels go through tone mapping |

Timed on real scroll at 1440x900: the Q enters the viewport at p ~0.27 and the stage is fully in view at ~0.6. RTL mirrors the line, never the mark: the tail then lies on the cap pointing back along the line.

**Stills:** `stillAt = [0, 0.5, 0.75]`. **Harness:** `/debug/close?scene=close&p=0.5&tier=high&debug`.
**Files:** `index.ts` (scene), `params.ts` (every number), `mark.ts` (SVG to geometry), `shared.ts`
(rail profile, chamfered boxes, fade pass, easing; also used by `scenes/company`).

## Runtime look (runtime/README.md)
Signal opt-in for the datum must happen together with rail and company (see `../rail/README.md`).
The fade pass (CustomBlending) works unchanged: the composite reads colour from the main buffer.
AO is on: the Q now sits on its cap with a contact line.
