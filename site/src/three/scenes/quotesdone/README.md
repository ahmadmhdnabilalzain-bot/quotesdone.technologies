# Scene: quotesdone ("Sealed")

Home scene 4 (structure-v1 §2.2 row 4). One milled Alloy block splits into five identical plates.
Each carries a Graphite cover in a machined U-track. The plates line up to be compared, one key
light passes along them, then one plate advances, its cover rises out of the track, the others dim
and fall back. The open face shows only the hub's engraved datum line, lit from inside by a
Rhodamine filament. No text, no data, no textures, no teal or gold.

- Copy slot: `components/home/QuotesDoneSection.astro`, words from `content/en/products/quotesdone.json`.
- Files: `index.ts` (meshes, update), `timeline.ts` (pure choreography, no three.js),
  `params.ts` (every number, bounded), `studio.ts` (procedural reflection cube), `shaders.ts`,
  `color.ts` (Kelvin to RGB). Tests: `tests/unit/quotesdone-scene.test.ts`.
- Progress map (beats are params; text beats in the section line up with them):
  - `0.00-0.12` one block, joints open (`split*`)
  - `0.10-0.27` plates lift, deal out into the row and seat (`align*`, stagger from the outside)
  - `0.40-0.58` the comparison pass: the studio turns and the light pool travels the row (`sweep*`)
  - `0.58-0.72` plate `chosenIndex` advances; the rest dim (falloff by distance) and recede (`advance*`)
  - `0.68-0.84` its cover rises along the side tracks and stays engaged (`cover*`)
  - `0.78-0.90` the datum filament draws out from the origin tick (`datum*`); then hold
- Camera: block, row, opened plate. Each pose's distance is at least what fits it to the stage
  width (`frameMargin`), so narrow stages pull back instead of cropping. Time adds only a slow drift.
- Light: one soft spot key + a procedural studio (one softbox, one faint bounce card). The light
  pool on the floor is the key's visible falloff. Contact shadows: 'high' tier and ladder level 0.
- RTL: plates, camera, key spot, light pool and sweep mirror in x; the opened plate lands on the
  mirrored side (unit-tested). The studio reflection cube is built once and is NOT mirrored, so
  the softbox reflection stays on the same side. RTL has not been rendered yet.
- Stills: `stillAt = [0, 0.3, 0.9]`.
- Debug: `/debug/quotesdone?tier=high&scene=quotesdone&p=0.5` (frozen, for screenshots),
  `/debug/quotesdone?tier=high&hud` (scrubber), `&w=&h=` sets the stage size in px.

## Runtime look (runtime/README.md)
- Applied: the floor datum ShaderMaterial carries `userData: { signal: true }` (one line), so it
  bypasses AgX.
- Owner TODO: the filament. Add `userData: { signal: true }` and set `datumGlow` to 1. At 2.6 it
  would show as (255, 28, 103), brighter than the brand hex. The wash is light falling on a
  surface, so it stays tone-mapped.
- This scene keeps its own studio cube, so the new shared environment does not reach it. AO and
  the dither fix do.
