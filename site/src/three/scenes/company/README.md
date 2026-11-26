# Scene 7: Company (`company`)

**Shows:** one long, quiet pull-back along the rail. It starts close on station 3 (MubinFlow,
where scene 6 leaves off) and ends on the whole line: 3 product docks, then 6 empty docks with
chamfered caps that run out of frame (room for more, no claim). The datum dims to a hairline, then
the frame steps back (alpha) so the About text takes over in the DOM.

**Status is drawn, never written:** live = solid Alloy plus a Rhodamine status dot (QuotesDone:
five sealed plates; Sonobolt: a flat coil, one continuous line). In development = linework only
plus an outline status ring (MubinFlow: a ring of 12 month segments as edges). Empty = cap.
Objects are low detail on purpose: this is the distance shot.

**Copy slot:** `components/home/CompanySection.astro` (company.json: headline, about, principles).

**Progress map** (`start="top bottom"`, `end="bottom top"` on the stage band):
| p | beat |
|---|---|
| 0.12 to 0.5 | pull-back: focus slides from station 3 to the line; distance grows geometrically |
| 0.3 to 0.55 | datum goes from full to a hairline (opacity 0.45, never under 1 device px) |
| 0.6 to 1 | frame fades by `yieldAmount` (0.6) for the text |

The stage fills the viewport at p ~0.5, so the wide shot lands there (an unpinned stage keeps the shot short; see the agent report).

**Stills:** `stillAt = [0, 0.55, 1]`. **Harness:** `/debug/close?scene=company&p=0.6&tier=high&debug`.
Shares `../close/shared.ts`. The rail ratios (height to depth, chamfer, datum height) follow
`scenes/rail/params.ts`, scaled down. Absolute sizes and the dock pitch differ (see the agent report).
