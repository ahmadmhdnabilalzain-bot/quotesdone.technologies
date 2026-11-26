# three/runtime: how the look is built

The runtime owns ONE renderer, ONE reflection environment and ONE post pipeline. Every scene gets
the same look without writing post-processing code. All tunables live in `look.ts`. The GLSL lives
in `../shaders/post.ts`.

## Files

| File | Role |
|---|---|
| `renderer.ts` | the single `WebGLRenderer`, AgX tone mapping, sRGB output, context-loss policy |
| `environment.ts` | the procedural **studio**: a pure radiance function baked into a half-float cube on the CPU, then prefiltered once by PMREM (`ctx.envMap`) |
| `look.ts` | **every tunable** of the look: `STUDIO`, `AO`, `SIGNAL`, `POST`, `BLOOM`, plus `resolveLook(tier, level)` |
| `signal.ts` | the signal API: material classification, `SIGNAL_LAYER`, per-scene AO override, and the composite colour rule in TS (tested) |
| `presenter.ts` | the per-stage passes: main, signal mask, AO, composite |
| `ladder.ts` | the quality ladder; each level also carries an AO step (`ao`, optional) |
| `tier-types.ts` | per-tier settings, including the pixel cap that keeps the aux buffers inside the GPU budget |

## The pipeline (per stage, per frame)

```
scene ──main pass──► shared MSAA half-float target (linear HDR, premultiplied)
                     └─ depth resolved into a shared DepthTexture
signal meshes ─────► RGBA8 mask target (same resolved depth: occluded exactly)    [only if the scene has signals]
resolved depth ────► SAO at half resolution ─► AO buffer                          [only if AO is on]
composite ─────────► canvas stage rect:
   base   = colour × AO × vignette ─► AgX           (everything that is not light)
   signal = colour, hue-preserving limit at 1        (Rhodamine light: no AgX, no AO, no vignette)
   out    = mix(base, signal, mask) ─► sRGB ─► ×alpha (premultiplied) ─► + dither
```

1. **Studio environment** (`environment.ts`, `look.ts STUDIO`). The old `RoomEnvironment` was evenly
   bright, so metal read as grey plastic. The studio is dark with a few analytic softboxes:
   - a long **key strip** high on the leading side, which draws the chamfer highlight;
   - a broad soft **overhead** with a vertical gradient;
   - a narrow **rim strip** behind, which separates silhouettes from Carbon;
   - a faint **front card**, which keeps faces looking at the camera from going black;
   - a thin **kicker**;
   - a dark floor with a soft bounce band under the horizon.

   It is neutral (R = G = B, unit-tested), deterministic (the same spec gives the same bytes,
   unit-tested) and has no download. It is baked at mount and on context restore (about 100k
   texel evaluations at size 128). `scenes/quotesdone` keeps its own studio cube, so this change
   does not reach it.
2. **Ambient occlusion** (`shaders/post.ts AO_FRAGMENT`). This is SAO/HBAO-style screen-space AO,
   in one pass at half resolution:
   - View positions come from the resolved depth through `camera.projectionMatrixInverse`, so it
     works for perspective and orthographic cameras.
   - Normals are rebuilt from depth, taking the nearer neighbour on each axis.
   - The radius is a fraction of the stage height, because the scenes use unrelated world units.
   - An angle bias stops depth quantisation from darkening flat faces.
   - Taps are snapped to depth-texel centres. Without the snap, one-sided half-pixel errors print
     as column streaks.
   - A 2×2 interleaved rotation plus radius jitter is cancelled by a depth-aware [1 2 1] tent in
     the composite.
   - AO multiplies only the non-signal part of the image.
3. **Signal pass** (`signal.ts`). AgX cannot display Rhodamine #E3185B: the closest it reaches is
   about rgb(197, 78, 102). Signal meshes are re-drawn after the main pass into a small RGBA8 mask
   target that shares the main pass's resolved depth, so occlusion is exact. Only signal meshes
   draw again. The mask's alpha marks the pixels whose colour is written straight to sRGB. The
   colour itself still comes from the main buffer, so fades, contact shadows and additive glows
   keep working.
4. **Composite** (`shaders/post.ts COMPOSITE_FRAGMENT`). This pass applies:
   - AgX (three's own `toneMapping()`);
   - the vignette, unchanged in shape: it is not aspect-corrected, because the logo's wordmark
     spans the stage width;
   - dither, which is now added to the **premultiplied** output and to alpha in partial coverage.
     Before, the noise was added before the alpha multiply, so it shrank with alpha and low-alpha
     falloffs banded.

## Signal API (for scene authors)

Set these before `create()` resolves. They are re-read every frame, so toggling them later works
too.

```ts
material.userData.signal = true;    // this material IS light: bypasses AgX, never gets AO
material.userData.wordmark = true;  // wordmark material: can never be signal; scene gets no signal bloom
object3d.userData.ao = false;       // whole scene opts out of AO (linework)
object3d.userData.ao = { strength: 0.5, radius: 0.02 };  // per-scene override (look.ts units)
```

Rules:
- A signal is displayed **1:1**, as linear sRGB to sRGB. To show exactly #E3185B, write exactly
  the linear brand colour (`new Color('#E3185B')`) at intensity **1**. A multiplier k > 1 is not
  clamped per channel: the whole colour is scaled down so its peak is 1 (the hue holds), and it
  shows brighter than the brand hex. Example: Sonobolt `statusGlow` 1.15 shows (242, 26, 97).
- Colours that were pre-compensated for AgX (`shared/rail.ts RAIL_SIGNAL_LINEAR`, mubinflow's
  inverse-AgX ramps) must go back to the true colour when they opt in. Otherwise they show the
  compensated value raw.
- The mask is per **material**. A lit material with a Rhodamine emissive term (the Sonobolt weld)
  cannot opt in, or its whole surface would skip AgX, so the weld stays tone-mapped.
- A `wordmark` material that also says `signal` is refused and logged (structure-v1 §2.2.2).

## Tunables (`look.ts`)

| Group | Key | Value | Meaning |
|---|---|---|---|
| STUDIO | `size` | 128 | cube face texels before PMREM |
| | `wallLow` / `wallHigh` | 0.08 / 0.03 | wall radiance near the horizon / high up |
| | `floor` / `floorBounce` | 0.012 / 0.09 | floor far below / bounce band under the horizon |
| | `panels[]` | key 10, overhead 2.4, rim 4.5, front 2.5, kicker 1.6 | radiance per softbox (dir, half extents as tangents, softness, gradient) |
| AO | `radius` | 0.028 | fraction of the stage height |
| | `intensity` / `strength` | 1.3 / 0.85 | SAO gain / final mix |
| | `samplesFull` / `samplesCheap` | 14 / 7 | taps per pixel |
| | `bias` | 0.3 | angle bias (sine of the lowest counted elevation) |
| | `turns` / `scale` | 7 / 0.5 | spiral turns / buffer resolution |
| SIGNAL | `maskGain` | 4 | coverage to mask gain (a 25 % opaque signal still skips AgX) |
| | `limit` | 1 | hue-preserving peak |
| POST | `vignetteStrength` / `Inner` / `Outer` | 0.22 / 0.35 / 0.85 | as before |
| | `ditherLsb` | 1 | triangular dither amplitude, 8-bit steps |
| BLOOM | `enabled` | false | see "Bloom decision" |

### Tier × ladder (`resolveLook`)

| | high | mid | low |
|---|---|---|---|
| AO at ladder 0 | full (14 taps) | cheap (7) | off |
| ladder 1, 2 | cheap | cheap | off |
| ladder 3 | off | off | off |
| signal pass | on | on | on (no MSAA) |
| vignette | 0.22 | 0.22 | 0 |
| pixel cap | 2.9 MP (~180 MB) | 0.95 MP (~59 MB) | 1 MP (~20 MB) |

Memory per pixel of the shared size: about 56 B for half-float MSAA ×4, plus 4 B resolved depth,
4 B mask and about 1 B for AO at half resolution. `Presenter.estimateTargetBytes()` counts all of
them.

## Bloom decision

Bloom was prototyped as a signal-only pass: a 12-tap ring blur of the mask's own colour, never
sampling non-signal pixels, and disabled in any scene with a wordmark material. It is **off**.
On the Sonobolt status ring at DPR 2 it made the hairline read as neon tubing. It also printed a
faint ghost ring and softened the "thin, exact datum" that structure-v1 §2.2 asks for. Both
"bloom on everything" and "cyberpunk neon" are on the §2.2.3 list of clichés we do not use.
`?look=bloom` previews it, and `BLOOM.enabled` switches it on for 'high' at ladder 0.

## Shadowing decision (why AO, not a shadow map)

| Option | Scene edits | Extra cost per stage | Result |
|---|---|---|---|
| Analytic contact shadow (existing) | already in each scene | 1 draw | soft blob under objects; no crevices, no self-occlusion |
| PCFSoft/VSM directional shadow map | every scene: a shadow light, a fitted frustum, castShadow and receiveShadow per mesh | a depth re-render of every caster (doubles the draw calls) and a shadow lookup in every lit shader (programs recompile) | true cast shadows; most scenes have one area-like key light, so the shadows would be hard to fit well |
| **SAO at half resolution (chosen)** | none (opt-out only) | 1 half-res pass (14 taps) plus the composite tent (8 fetches) | contact darkening in every crease and under every object, for all eight scenes at once |

Measured on SwiftShader at 1440×900 @2x ('high', a 2.9 MP cap). These numbers are **relative
only**: SwiftShader is a CPU rasteriser, and on a real GPU these passes cost a small fraction of
this.

| | before | after, AO and signal off | after, full |
|---|---|---|---|
| logo p=0.3 | 3.77 fps | 3.51 fps | 2.22 fps |
| sonobolt p=0.95 | 2.31 fps | 2.21 fps | 1.67 fps |
| sonobolt p=0.95, mid tier | 4.85 fps | n/a | 3.70 fps |

The depth resolve plus the signal pass cost about 2 to 7 %. AO is the bulk. The ladder steps AO
to cheap at level 1 and off at level 3.

## How to debug

- `?hud` adds a `look` line: AO quality, signal objects and how many signal and AO passes ran.
  `window.__qdt.dumpInfo().look` gives the same data.
- `?look=noao`, `?look=nosignal` and `?look=bloom` switch one piece. `?look=ao` shows the blurred
  AO buffer. `?look=mask` shows the signal mask in pink on black.
- `?level=n` now reaches the presenter from the first frame (render scale and AO step). Before
  this change, a pinned level was never applied.
- Before/after images: `node scripts/shoot-runtime.mjs shoot <baseUrl> <outDir>` for each build,
  then `node scripts/shoot-runtime.mjs compare <before> <after> tests/artifacts/runtime`.
- Unit tests: `tests/unit/runtime-look.test.ts` covers studio determinism, neutrality and
  contrast, signal classification, the composite colour rule, and the ladder and tier resolution.
