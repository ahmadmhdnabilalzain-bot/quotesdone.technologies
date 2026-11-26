# Scene: rail (Home scenes 2 "Datum" and 3 "The line")

- Shows: the datum, one Rhodamine light line, thickening into a machined Carbon rail with docking
  pads in three-quarter view. QuotesDone (three sealed Alloy plates) and Sonobolt (a wound ribbon
  coil whose edge is a synthetic waveform envelope, seed `coilSeed`, no Sonobolt data) dock solid.
  MubinFlow docks as drafting linework: visible edges, dashed hidden edges, a diameter dimension.
  Six more stations stay empty under chamfered caps. A status light sits on each product pad:
  a dot for live, a ring for in development. Status comes from `home.json`, the same source as
  the DOM labels (`stations()` reports it; unit-tested).
- Copy slot: `ProductIndex.astro` (names, lines, labels) is anchored beside each station.
  `Statements.astro` (scene 2) holds the DOM datum that this scene picks up at progress 0.
- Progress map (`params.ts` `RAIL_BEATS`): 0-0.08 line holds. 0.06-0.38 extrude. 0.08-0.46 camera
  to three-quarter. 0.24-0.50 caps cascade. 0.40-0.78 docks (staggered); light and label at
  contact (`layout.ts` `contactAt`). 0.78-1 hold and push-in. Time drives only a light pulse
  along the datum.
- Stills: `stillAt = [0, 0.3, 1]`.
- Labels without DOM access: `layout.ts` is three-free maths shared with the component. The camera
  keeps a fixed HORIZONTAL field of view, so a label's x is a fixed fraction of the width and its
  y offset is a fixed multiple of half the width (`50cqh - k * 50cqw`). Checked against a real
  three.js camera at 4:3, 16:10 and 21:9 (`tests/unit/rail-layout.test.ts`).
- RTL: `resize({ dir: 'rtl' })` mirrors the root (`scale.x = -1`) and the camera. Labels use
  `inset-inline-start`, so they mirror with it.
- Debug: `/debug/rail?scene=rail&p=0.5&tier=high&debug` (add `&rtl`, `&shot`).
- Known limits: Rhodamine cannot pass AgX unchanged. `RHODAMINE_LIGHT` is the closest linear input
  (about rgb 192, 66, 83 on screen against #E3185B). The DOM datum fades out during the handover,
  so the two never sit side by side.
- Pinning: the stage is sticky. `motion/scroll.ts` must measure a sticky stage's section for
  visibility, otherwise the host disposes the scene one viewport into the pin (see the agent
  report for the 3-line patch).
