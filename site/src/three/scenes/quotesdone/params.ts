/**
 * Every tunable number of the QuotesDone "Sealed" scene, named and bounded (structure-v1 §6.5).
 * Units: scene metres-ish; one plate is 1.0 wide. Angles in degrees unless stated.
 * Progress beats (0..1) are listed in README.md and must stay ordered:
 *   splitStart < splitEnd <= alignStart < alignEnd <= sweepStart < sweepEnd
 *   <= advanceStart < advanceEnd, coverStart < coverEnd, datumStart < datumEnd.
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const SEALED_PARAMS = {
  // ---- Plate geometry ----
  plateWidth: { value: 1.0, min: 0.6, max: 1.6, step: 0.01, description: 'Plate width (x)' },
  plateHeight: { value: 1.24, min: 0.8, max: 2.2, step: 0.01, description: 'Plate height (y)' },
  plateDepth: { value: 0.28, min: 0.05, max: 0.4, step: 0.005, description: 'Plate thickness (z)' },
  plateBevel: { value: 0.028, min: 0.002, max: 0.05, step: 0.001, description: 'Edge radius of plates (machined edge that catches the key light)' },
  lipWidth: { value: 0.07, min: 0.015, max: 0.16, step: 0.005, description: 'Width of the machined track lips (both sides and the bottom of each face)' },
  trackDepth: { value: 0.018, min: 0.006, max: 0.06, step: 0.001, description: 'How far the lips stand off the face (the cover runs in this track)' },
  coverClearance: { value: 0.004, min: 0, max: 0.03, step: 0.001, description: 'Gap between cover and lips' },
  jointGap: { value: 0.005, min: 0, max: 0.06, step: 0.001, description: 'Seam between plates while they are one block' },
  engraveLength: { value: 0.62, min: 0.2, max: 0.95, step: 0.01, description: 'Engraved datum line length, fraction of plate width' },
  engraveWidth: { value: 0.013, min: 0.003, max: 0.03, step: 0.001, description: 'Engraved datum line width' },
  notchRadius: { value: 0.055, min: 0, max: 0.2, step: 0.005, description: 'Thumb notch radius at the top edge of each cover' },
  tickLength: { value: 0.07, min: 0, max: 0.2, step: 0.005, description: 'Origin tick through the centre of the datum line' },

  // ---- Layout ----
  rowSpacing: { value: 1.36, min: 1.05, max: 2, step: 0.01, description: 'Plate centre spacing in the comparison row' },
  explodeGap: { value: 0.16, min: 0, max: 0.6, step: 0.01, description: 'Extra joint opening while the block splits' },
  liftHeight: { value: 0.05, min: 0, max: 0.3, step: 0.005, description: 'Plates lift this much while travelling, then seat' },
  chosenIndex: { value: 3, min: 0, max: 4, step: 1, description: 'Which plate advances (LTR order; mirrored in RTL)' },
  advanceDepth: { value: 0.62, min: 0, max: 2, step: 0.01, description: 'How far the chosen plate comes forward' },
  fallbackDepth: { value: 0.4, min: 0, max: 2, step: 0.01, description: 'How far the other plates recede' },
  coverTravel: { value: 0.6, min: 0.3, max: 0.98, step: 0.01, description: 'Cover lift along the side tracks, fraction of cover height (it stays engaged)' },

  // ---- Beats (progress 0..1) ----
  splitStart: { value: 0.07, min: 0, max: 1, step: 0.005, description: 'Block joints start to open' },
  splitEnd: { value: 0.2, min: 0, max: 1, step: 0.005, description: 'Joints fully open' },
  alignStart: { value: 0.16, min: 0, max: 1, step: 0.005, description: 'Plates start travelling into the row' },
  alignEnd: { value: 0.36, min: 0, max: 1, step: 0.005, description: 'Row seated' },
  alignStagger: { value: 0.035, min: 0, max: 0.1, step: 0.005, description: 'Progress offset between neighbouring plates' },
  sweepStart: { value: 0.4, min: 0, max: 1, step: 0.005, description: 'Key light starts its pass along the row' },
  sweepEnd: { value: 0.58, min: 0, max: 1, step: 0.005, description: 'Key light pass ends' },
  advanceStart: { value: 0.58, min: 0, max: 1, step: 0.005, description: 'Chosen plate starts forward, others start back' },
  advanceEnd: { value: 0.72, min: 0, max: 1, step: 0.005, description: 'Advance complete' },
  coverStart: { value: 0.68, min: 0, max: 1, step: 0.005, description: 'Cover starts sliding along the track' },
  coverEnd: { value: 0.84, min: 0, max: 1, step: 0.005, description: 'Cover at the end of its travel' },
  datumStart: { value: 0.78, min: 0, max: 1, step: 0.005, description: 'Datum light starts to draw out from the origin tick' },
  datumEnd: { value: 0.9, min: 0, max: 1, step: 0.005, description: 'Datum light fully drawn' },

  // ---- Light and material ----
  keyIntensity: { value: 120, min: 0, max: 300, step: 1, description: 'Key spot intensity (candela, physically based falloff)' },
  keyAngleWide: { value: 30, min: 5, max: 60, step: 0.5, description: 'Key cone half-angle while lighting the row, degrees' },
  keyAngleNarrow: { value: 13, min: 3, max: 40, step: 0.5, description: 'Key cone half-angle on the chosen plate, degrees' },
  keyPenumbra: { value: 0.85, min: 0, max: 1, step: 0.01, description: 'Key cone softness' },
  keyColorKelvin: { value: 5200, min: 3000, max: 7500, step: 50, description: 'Key colour temperature (neutral-warm studio light)' },
  envIntensity: { value: 1, min: 0, max: 3, step: 0.01, description: 'Studio reflection strength (multiplies studio.ts radiance)' },
  alloyRoughness: { value: 0.5, min: 0, max: 1, step: 0.01, description: 'Alloy roughness (bead-blasted)' },
  coverRoughness: { value: 0.52, min: 0, max: 1, step: 0.01, description: 'Cover roughness (dark anodised)' },
  dimFactor: { value: 0.32, min: 0, max: 1, step: 0.01, description: 'Albedo of the plates left sealed, relative to rest' },
  dimFalloff: { value: 0.6, min: 0.2, max: 1, step: 0.01, description: 'Extra dimming per plate of distance from the opened one' },
  datumGlow: { value: 2.6, min: 0, max: 6, step: 0.05, description: 'Datum filament radiance multiplier (before AgX)' },
  floorDatumOpacity: { value: 0.45, min: 0, max: 1, step: 0.01, description: 'Hairline datum under the row (light only, ends fade out)' },
  poolIntensity: { value: 0.09, min: 0, max: 1, step: 0.005, description: 'Light pool radiance on the floor (keep it a whisper)' },
  poolThrow: { value: 4.2, min: 1, max: 15, step: 0.1, description: 'Key throw distance used to size the pool from the cone angle' },
  shadowOpacity: { value: 0.6, min: 0, max: 1, step: 0.01, description: 'Contact shadow strength (high tier only)' },

  // ---- Studio reflections (studio.ts) ----
  studioSize: { value: 48, min: 16, max: 128, step: 8, description: 'Cube face size of the procedural studio (texels)' },
  softboxAzimuth: { value: -48, min: -180, max: 180, step: 1, description: 'Softbox direction around the row, degrees (negative = leading side)' },
  softboxElevation: { value: 34, min: 0, max: 85, step: 1, description: 'Softbox elevation, degrees' },
  softboxWidth: { value: 0.8, min: 0.1, max: 2, step: 0.01, description: 'Softbox half width (tangent units)' },
  softboxHeight: { value: 0.42, min: 0.05, max: 2, step: 0.01, description: 'Softbox half height (tangent units)' },
  softboxRadiance: { value: 5.5, min: 0, max: 20, step: 0.1, description: 'Softbox radiance (linear, before AgX)' },
  kickerRadiance: { value: 0.9, min: 0, max: 10, step: 0.05, description: 'Narrow bounce card behind on the trailing side: separates edges from Carbon' },
  studioAmbient: { value: 0.025, min: 0, max: 0.3, step: 0.005, description: 'Radiance of the dark studio walls' },
  sweepDegrees: { value: 38, min: 0, max: 120, step: 1, description: 'How far the studio turns during the comparison pass (reflection sweep)' },

  // ---- Camera ----
  fov: { value: 26, min: 15, max: 50, step: 0.5, description: 'Vertical field of view, degrees' },
  blockDistance: { value: 6.2, min: 2, max: 12, step: 0.05, description: 'Camera distance on the block' },
  rowDistance: { value: 10.5, min: 4, max: 20, step: 0.05, description: 'Camera distance on the full row (aspect >= 1)' },
  revealDistance: { value: 6.6, min: 2, max: 12, step: 0.05, description: 'Camera distance on the opened plate' },
  blockAzimuth: { value: 34, min: -80, max: 80, step: 0.5, description: 'Camera azimuth on the block, degrees (mirrored in RTL)' },
  rowAzimuth: { value: 24, min: -80, max: 80, step: 0.5, description: 'Camera azimuth on the row, degrees' },
  revealAzimuth: { value: 12, min: -80, max: 80, step: 0.5, description: 'Camera azimuth on the opened plate, degrees' },
  blockElevation: { value: 13, min: -10, max: 60, step: 0.5, description: 'Camera elevation on the block, degrees' },
  rowElevation: { value: 15, min: -10, max: 60, step: 0.5, description: 'Camera elevation on the row, degrees' },
  revealElevation: { value: 7, min: -10, max: 60, step: 0.5, description: 'Camera elevation on the opened plate, degrees' },
  breathDegrees: { value: 0.6, min: 0, max: 3, step: 0.05, description: 'Idle camera drift amplitude (time-driven, pure)' },
  breathPeriodSec: { value: 14, min: 4, max: 60, step: 0.5, description: 'Idle camera drift period' },
  portraitExponent: { value: 0.9, min: 0, max: 1.5, step: 0.05, description: 'Pull-back for narrow stages: distance / aspect^k below aspect 1' },
} satisfies SceneParams;

export type SealedParams = typeof SEALED_PARAMS;

/** Number of plates. Fixed by the brief ("five identical sealed plates"), so not a param. */
export const PLATE_COUNT = 5;
