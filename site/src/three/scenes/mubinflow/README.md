# Scene: mubinflow (Home scene 6, "Shows its working")

- Shows: a drafting sheet on Carbon, all edges. A ring of 12 month segments indexes through
  detents to one month; that segment slides out and three strips grow out of it (people,
  payslips, the salary file). Projection lines link one person to their payslip and salary record;
  dimensions measure the pull-out, the stack and ONE figure; a Rhodamine leader traces that figure
  to its rule card and on to the source the rule cites. A linework plate (open status ring +
  hatched field, no text) marks "in development". No real payroll data: rows are seeded bars.
- Copy slot: `components/home/MubinFlowSection.astro`, words from `content/en/products/mubinflow.json`.
- Progress map: `timeline.ts` (one table). Ring draws 0-0.12, indexes 0.15-0.38, month out
  0.38-0.47, camera widens 0.40-0.62, strips 0.48-0.70, trace 0.72-0.94. Time is unused (no drift).
- Lines: `draft-line.ts`, a custom instanced line shader (orthographic camera only): constant
  pixel width, analytic AA, round joins, pixel dashes anchored to the geometry, draw-on by discard.
- Hidden lines: depth-only solids; visible pass LEQUAL, dashed pass GREATER (`depthOffset` param).
- `maturity` (0..1): 0 = linework; 1 = solids in Alloy, hidden lines, sheet and plate off,
  the traced figure kept. Harness: `/debug/mubinflow?tier=high&debug&scene=mubinflow&p=0.95&maturity=1`.
- Stills: `stillAt = [0.3, 0.62, 0.95]`. Params: `params.ts`. Tests: `tests/unit/mubinflow-scene.test.ts`.
- Stage: 16:9, max 73rem wide, so the 'high' tier renders it at full DPR 2.
- Pinned (integration): on desktop with live 3D the slot is 320svh and the stage is sticky and
  centred; progress runs slot top at 75% of the viewport -> slot bottom at viewport bottom (~295svh).
  `motion/scroll.ts` measures a sticky stage's visibility from its slot, so it stays live.

## Runtime look (runtime/README.md)
- Applied: `object3d.userData.ao = false` (one line). Linework gets no ambient occlusion.
- Owner TODO (signal): the Rhodamine lines use inverse-AgX ramps (`color-ramp.ts`). To opt in,
  give the 'rhodamine' hue line material `userData.signal = true` and feed it the true linear
  colour (#E3185B), not the inverse.
