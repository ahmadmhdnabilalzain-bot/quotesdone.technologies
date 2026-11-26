# Scene 5: Sonobolt, "One continuous line"

structure-v1 §2.2 row 5. Station 2 on the rail.

- **Shows:** separate Alloy ribbons (songs) ride the rail. Each ribbon's height follows a synthetic
  amplitude envelope. A beat grid appears as ticks on the rail top. The songs slow down, settle to
  the grid (tempo, height, roll), close their gaps and fuse at the seams. A thin Rhodamine weld light
  shows at each seam and then cools to exactly zero. The one ribbon then runs past a guide roller and
  winds onto the hub in the Mix slot as a flat coil: one continuous file. Studio and Visuals sit
  beside it, capped with Carbon lids. The Mix status ring is lit. There is no text in 3D.
- **Data:** `envelope.ts` generates the envelopes from a seed (`ctx.seed`, `seedOffset`). It does
  not use Sonobolt's measured waveform data (owner question Q4), and it shows nothing about how a mix is made.
- **Copy slot:** `components/home/SonoboltSection.astro`. The headline, promise, three proof
  points, family list, status line and CTA all come from `content/en/products/sonobolt.json`.
- **Progress map:** see the header of `timeline.ts`. In short: 0 to 0.54 approach; 0.10 to 0.34 align;
  0.33 to 0.52 fuse, with the weld peaking at 0.52 and dark again by 0.61; 0.54 to 0.93 wind; 0.86 to 1 the status light comes fully on.
- **Files:** `params.ts` (every number), `envelope.ts`, `path.ts` (the tape and reel maths: one
  CPU copy, tested), `timeline.ts` (progress to values, camera keys), `ribbon.ts` (one geometry and
  one draw call, positions written per frame, a weld emissive patch), `station.ts` (rail, ruler,
  roller, slots), `scene.ts` (assembly).
- **Cost (SwiftShader, 'high'):** 13 to 15 draw calls, about 16k to 30k triangles, a chunk of 8.7 KB gz.
- **Stills:** `stillAt = [0.22, 0.5, 1]`. The real stills are not rendered yet (scripts/stills.mjs, M1).
- **Debug:** `/debug/sonobolt?tier=high&debug&scene=sonobolt&p=0.5` gives a frozen frame.
  `?tier=high&hud` gives live time with a scrubber.
- **Tests:** `tests/unit/sonobolt-scene.test.ts`.
