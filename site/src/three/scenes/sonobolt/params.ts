/**
 * Every tunable number of scene 5 "One continuous line", named and bounded (structure-v1 §6.5).
 * Units: scene units (1 unit is about the rail's width x 2.8). Progress values are 0..1 of the
 * section's scroll range. Change a value here, reload /debug/sonobolt?p=<n>, compare.
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const SONOBOLT_PARAMS = {
  // ---- Songs (synthetic envelopes; never Sonobolt's measured data) ----
  songCount: { value: 6, min: 2, max: 7, step: 1, description: 'Separate songs (ribbons) that fuse into one mix' },
  beatsPerSong: { value: 24, min: 16, max: 64, step: 4, description: 'Beats per song (a multiple of 4: whole bars)' },
  beatLength: { value: 0.16, min: 0.08, max: 0.5, step: 0.01, description: 'Grid beat length once aligned, units' },
  rowsPerBeat: { value: 14, min: 4, max: 24, step: 1, description: 'Cross-sections per beat at detail 1 (scaled by tier detail)' },
  seedOffset: { value: 2611, min: 0, max: 99999, step: 1, description: 'Added to ctx.seed for the envelope generator' },
  tempoSpread: { value: 0.12, min: 0, max: 0.3, step: 0.01, description: 'Pre-alignment tempo spread: song length x (1 +- spread)' },
  songGap: { value: 1.1, min: 0, max: 3, step: 0.05, description: 'Gap between songs before they fuse, units' },
  songLift: { value: 0.07, min: 0, max: 0.3, step: 0.005, description: 'Max vertical offset of a song before alignment, units' },
  songRoll: { value: 0.14, min: 0, max: 0.6, step: 0.01, description: 'Max roll of a song around its own length before alignment, radians' },
  songBob: { value: 0.012, min: 0, max: 0.06, step: 0.001, description: 'Idle float of unaligned songs (time-driven), units' },
  bobHz: { value: 0.35, min: 0, max: 2, step: 0.01, description: 'Idle float frequency, Hz' },

  // ---- Ribbon section ----
  bandHalfHeight: { value: 0.13, min: 0.04, max: 0.4, step: 0.005, description: 'Half the band height at full amplitude, units' },
  bandThickness: { value: 0.014, min: 0.004, max: 0.05, step: 0.001, description: 'Band thickness, units' },
  bandCenterY: { value: 0.2, min: 0.1, max: 0.6, step: 0.005, description: 'Band centre line above the rail top, units' },
  ampFloor: { value: 0.12, min: 0, max: 0.5, step: 0.01, description: 'Lowest amplitude inside a song (0..1)' },
  endTaper: { value: 0.9, min: 0.1, max: 3, step: 0.05, description: 'Length of the pinched end of a separate song, beats' },
  crossfadeBeats: { value: 2.5, min: 0.5, max: 8, step: 0.25, description: 'Half-width of the seam blend once fused, beats' },
  crown: { value: 0.32, min: 0, max: 1, step: 0.01, description: 'Face normal tilt toward the band edges (a slightly crowned strip catches a gradient of light)' },
  roughness: { value: 0.27, min: 0, max: 1, step: 0.01, description: 'Ribbon Alloy roughness' },

  // ---- Coil (the one continuous file) ----
  hubRadius: { value: 0.36, min: 0.15, max: 0.8, step: 0.01, description: 'Inner radius of the coil (hub), units' },
  coilPitch: { value: 0.06, min: 0.03, max: 0.2, step: 0.005, description: 'Radial distance between coil turns, units' },
  coilOffsetZ: { value: 1.45, min: 0.9, max: 3, step: 0.05, description: 'Coil centre distance from the rail centre line, units' },
  guideOffsetX: { value: -1.35, min: -3, max: -0.5, step: 0.05, description: 'Guide roller x relative to the coil centre, units' },
  windOvershoot: { value: 0.6, min: 0, max: 3, step: 0.05, description: 'Extra wound length after the tail is in (the reel turns on), units' },

  // ---- Station: three product slots ----
  socketRadius: { value: 0.98, min: 0.8, max: 1.6, step: 0.01, description: 'Product slot radius, units' },
  socketSpacing: { value: 2.3, min: 2, max: 4, step: 0.05, description: 'Distance between product slot centres, units' },
  statusGlow: { value: 1.6, min: 0, max: 4, step: 0.05, description: 'Mix status ring brightness when fully lit (linear)' },
  statusIdle: { value: 0.35, min: 0, max: 1, step: 0.01, description: 'Mix status ring level before the coil seats (fraction of statusGlow)' },
  datumGlow: { value: 0.9, min: 0, max: 3, step: 0.05, description: 'Rail datum line brightness (linear)' },

  // ---- Seam weld (light only) ----
  weldGlow: { value: 3.2, min: 0, max: 8, step: 0.1, description: 'Peak Rhodamine weld light at the seams (linear)' },
  weldWidth: { value: 0.035, min: 0.005, max: 0.2, step: 0.005, description: 'Weld light half-width along the ribbon, units' },

  // ---- Timeline (progress breakpoints) ----
  gridIn: { value: 0.06, min: 0, max: 0.5, step: 0.01, description: 'Beat grid starts to appear' },
  gridFull: { value: 0.2, min: 0, max: 0.6, step: 0.01, description: 'Beat grid fully visible' },
  alignStart: { value: 0.1, min: 0, max: 0.6, step: 0.01, description: 'Songs start to slow and align to the grid' },
  alignEnd: { value: 0.34, min: 0.05, max: 0.7, step: 0.01, description: 'Songs aligned to the grid' },
  fuseStart: { value: 0.33, min: 0.05, max: 0.8, step: 0.01, description: 'Gaps start to close' },
  fuseEnd: { value: 0.52, min: 0.1, max: 0.9, step: 0.01, description: 'One unbroken ribbon' },
  weldFade: { value: 0.09, min: 0.01, max: 0.3, step: 0.01, description: 'Weld light cools to zero over this much progress after fuseEnd' },
  windStart: { value: 0.54, min: 0.1, max: 0.9, step: 0.01, description: 'Coil starts to wind' },
  windEnd: { value: 0.93, min: 0.2, max: 1, step: 0.01, description: 'Whole ribbon wound' },
  statusStart: { value: 0.86, min: 0, max: 1, step: 0.01, description: 'Mix status ring starts to light fully' },
  gridOut: { value: 0.66, min: 0.2, max: 1, step: 0.01, description: 'Beat grid has faded out (it fades from windStart)' },
  approachStart: { value: -9, min: -30, max: -1, step: 0.1, description: 'Head of the first song at progress 0: distance past the guide roller (negative = before it), units' },
  approachSlow: { value: 0.7, min: 0, max: 1, step: 0.01, description: 'How much the songs slow before the coil (ease-out strength 0..1)' },

  // ---- Camera and light ----
  fov: { value: 27, min: 15, max: 60, step: 0.5, description: 'Vertical field of view, degrees' },
  keyLight: { value: 2.7, min: 0, max: 8, step: 0.1, description: 'Key light intensity' },
  rimLight: { value: 0.55, min: 0, max: 4, step: 0.05, description: 'Back rim light intensity' },
  envIntensity: { value: 0.85, min: 0, max: 3, step: 0.05, description: 'Environment reflection intensity' },
  portraitPullback: { value: 0.85, min: 0, max: 2, step: 0.05, description: 'Extra camera distance per unit of aspect below 1' },
} satisfies SceneParams;

export type SonoboltParams = typeof SONOBOLT_PARAMS;
