# Scene 1: Assembly (the logo reveal)

structure-v1 §2.2 scene 1 and §2.2.2. The 43 stroke parts of the official wordmark
(`brand/logo/final/strokes.json`) become machined Alloy bars on the Carbon void, explode like an
engineering drawing, re-seat, then dock into the header logo box and hand off to the DOM SVG.

**Copy slot:** none in 3D (no text in scenes). The H1 and sub-line (`content/en/home.json` hero)
stay in the DOM from first paint, under the wordmark (`components/Hero.astro`).

## Files
| File | Role |
|---|---|
| `index.ts` | the scene (contract in `runtime/scene.ts`) |
| `params.ts` | every tunable number, named and bounded, incl. the progress marks (three-free; Hero.astro imports the marks) |
| `choreography.ts` | pure `poseAt`, `explodeAt`, `sealForWidth`, easing (unit-tested) |
| `layout.ts` | DOM boxes (hero SVG, datum, header logo) published by Hero.astro, with a pure fallback |
| `parts.ts` | `logo.glb` -> 43 parts (float geometry local to each pivot) |
| `agx.ts` | three's AgX in TS + inverse: the flat Alloy that displays exactly as #ECEAE4 |
| `../../../../scripts/geo-logo.mjs` | builds `public/3d/logo.glb` (`npm run geo`, checked by `npm run geo:check` in prebuild) |

## Progress map (0..1 = hero scroll "top top" -> "bottom bottom", 180 vh at 280 svh)
| p | Beat |
|---|---|
| before 0 | 1a, CSS only (Hero.astro): stroke draw-on in `order`, 5 masked parts, outline fills, then the Rhodamine datum. ~2.4 s |
| 0 to 0.012 (`pSwap`) | rest: canvas frame identical to the DOM SVG (flat Alloy, front-on), DOM on top |
| 0.012 to 0.16 | 1b: bars extrude (depth 0 to 1), lighting fades in, camera moves to the raking angle (low, from the left) |
| 0.10 to 0.56 | 1c: parts leave their joints in draw order (translate only: along the joint normal, then forward; line 2 recedes); hairline leaders and joint ticks fade in; the DOM datum steps back |
| 0.56 to 0.667 | hold, with slow camera and key-light drift |
| 0.667 to 0.80 | 1d: parts re-seat (seat curve), camera returns front-on |
| 0.78 to 0.965 | dock: centre moves linearly, scale geometrically, into the header logo box; bars flatten to the flat Alloy fill; joints close as rendered width passes 480 px (`sealForWidth`) |
| 0.965 (`pDockEnd`) | DOM header logo visible again (canvas still drawn under it) |
| 0.985 (`pHide`) | canvas wordmark hidden |

## Rules kept
- Parts, joints and draw order come only from `strokes.json`. Joints are found by geo-logo (outline
  points within one gap of a neighbour) and stored in glb extras; the seal offset is a per-vertex
  `_seal` attribute sized so seal = 1 gives the compact cut's overlap (gap -0.6 units).
- Rhodamine: one neutral light, a neutral environment, no pink material (unit test). The datum is a
  DOM line, because AgX cannot display Rhodamine (best reachable is about rgb(193, 66, 83)).
- `update(progress, time)` is pure; time only drives a slow sweep of the key light while lit.

## Stills
`stillAt = [0, 0.35, 0.6, 0.9]`. The scene's real still is the DOM SVG itself (no image needed).

## Debug
`/debug/logo/?tier=high&hud&scene=hero&p=0.4`, then the scrubber. Screenshots:
`node tests/e2e/shoot-logo.mjs http://127.0.0.1:<port> <outDir> 0,0.1,0.45,0.86,0.97`.
`?debug` logs `layout (dom|fallback)`: `fallback` on the home page means the DOM boxes were not published.

## Runtime look (runtime/README.md)
- Applied: `wordmarkMaterial.userData.wordmark = true` (one line). The runtime then refuses any
  signal flag on it and never blooms signals in this scene.
- The studio environment replaced RoomEnvironment: lit faces are a touch darker (median about -4 %)
  and side walls read darker. Tune `envIntensity` if wanted. The flat rest frame (p < pSwap) is
  untouched: interior pixels match, and only AA edges move with the new pixel cap.
- AO is on (contact darkening between parts). The datum stays a DOM line: no signal needed.
