/**
 * Every tunable number of the rail scene (structure-v1 Home scenes 2 and 3), named and bounded.
 * NO three.js import: ProductIndex.astro reads the beats and layout at build time and in its
 * small scroll script, so the DOM labels and the 3D share one source of truth.
 *
 * Units: one world unit = one rail "module". The rail runs along +x (the flow direction; mirrored
 * for RTL), its top face is y = 0, its front face looks toward +z (the camera side).
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const RAIL_PARAMS = {
  // ---- Rail cross-section ----
  railHeight: { value: 0.34, min: 0.1, max: 1, step: 0.01, description: 'Rail body height (y)' },
  railDepth: { value: 0.56, min: 0.2, max: 1.2, step: 0.01, description: 'Rail body depth (z)' },
  railChamfer: { value: 0.045, min: 0, max: 0.15, step: 0.005, description: 'Machined chamfer on the four long edges' },
  grooveHeight: { value: 0.016, min: 0.005, max: 0.1, step: 0.001, description: 'Height of the datum groove cut into the front face' },
  grooveDepth: { value: 0.014, min: 0.005, max: 0.08, step: 0.001, description: 'How deep the datum groove is cut' },
  grooveY: { value: -0.2, min: -0.9, max: -0.05, step: 0.005, description: 'Groove centre height (below the top face)' },
  railStart: { value: -14, min: -40, max: -2, step: 0.5, description: 'Near rail end x (must sit off screen at every progress)' },
  railEnd: { value: 22, min: 4, max: 60, step: 0.5, description: 'Far rail end x (faded out well before it)' },
  fadeStart: { value: 6.5, min: 0, max: 40, step: 0.1, description: 'x where the far rail starts to fade into the void' },
  fadeEnd: { value: 13, min: 1, max: 60, step: 0.1, description: 'x where the far rail is fully faded' },

  // ---- Stations ----
  stationSpacing: { value: 1.55, min: 0.8, max: 3, step: 0.01, description: 'Distance between docking stations' },
  stationFirstX: { value: -1.55, min: -6, max: 4, step: 0.01, description: 'x of the first station (QuotesDone)' },
  emptyStations: { value: 6, min: 0, max: 12, step: 1, description: 'Capped, empty stations after the products (room for more, no claim)' },
  padWidth: { value: 0.92, min: 0.3, max: 1.5, step: 0.01, description: 'Docking pad width (x)' },
  padHeight: { value: 0.1, min: 0.04, max: 0.3, step: 0.005, description: 'Docking pad height above the rail top (holds the status light on its face)' },
  padChamfer: { value: 0.018, min: 0, max: 0.08, step: 0.001, description: 'Chamfer on pad and cap edges' },
  padDepth: { value: 0.46, min: 0.2, max: 1.1, step: 0.01, description: 'Docking pad depth (z)' },
  capHeight: { value: 0.05, min: 0.02, max: 0.3, step: 0.005, description: 'Chamfered cap height on an empty station' },
  statusRadius: { value: 0.024, min: 0.008, max: 0.06, step: 0.001, description: 'Status light radius on the pad front face' },

  // ---- Product stand-ins (low detail, structure-v1 §2.2.1) ----
  objectHeight: { value: 0.86, min: 0.3, max: 1.6, step: 0.01, description: 'Height of each docked object' },
  dockLift: { value: 1.35, min: 0.2, max: 4, step: 0.05, description: 'How high above the pad an object starts its dock' },
  dockLead: { value: 0.9, min: 0, max: 4, step: 0.05, description: 'How far upstream (against the flow) an object starts its dock' },
  settleOvershoot: { value: 0.018, min: 0, max: 0.08, step: 0.001, description: 'Tiny settle below the seat before it rests (fraction of objectHeight)' },
  coilTurns: { value: 7, min: 1, max: 10, step: 0.05, description: 'Sonobolt coil turns' },
  coilSeed: { value: 7, min: 1, max: 999, step: 1, description: 'Seed of the synthetic waveform envelope (no Sonobolt data used, Q4)' },

  // ---- Light and material ----
  keyLight: { value: 3.4, min: 0, max: 8, step: 0.1, description: 'Key light intensity (upper left front)' },
  rakeLight: { value: 0.9, min: 0, max: 4, step: 0.05, description: 'Low raking light from behind right, catches the chamfers' },
  envIntensity: { value: 0.55, min: 0, max: 3, step: 0.05, description: 'Neutral environment reflection intensity' },
  alloyRoughness: { value: 0.32, min: 0, max: 1, step: 0.01, description: 'Bead-blasted Alloy roughness' },
  carbonEnv: { value: 0.32, min: 0, max: 2, step: 0.01, description: 'Environment reflection on Carbon (keeps the anodised rail dark)' },
  carbonRoughness: { value: 0.56, min: 0, max: 1, step: 0.01, description: 'Anodised Carbon roughness' },
  datumIntensity: { value: 1, min: 0, max: 4, step: 0.05, description: 'Datum light multiplier on the pre-compensated Rhodamine' },
  datumPixels: { value: 1.25, min: 0.5, max: 4, step: 0.05, description: 'Datum thickness at progress 0, in CSS pixels (matches the DOM hairline)' },
  scanSpeed: { value: 0.9, min: 0, max: 6, step: 0.05, description: 'Speed of the light pulse along the datum, units per second' },
  scanStrength: { value: 0.55, min: 0, max: 2, step: 0.05, description: 'Brightness of the pulse travelling along the datum' },
  lineOpacity: { value: 0.92, min: 0.1, max: 1, step: 0.01, description: 'Drafting linework opacity (visible edges)' },
  hiddenOpacity: { value: 0.38, min: 0, max: 1, step: 0.01, description: 'Drafting linework opacity (dashed hidden edges)' },

  // ---- Camera: fixed HORIZONTAL field of view, so label x positions do not depend on aspect ----
  hfovDeg: { value: 38, min: 15, max: 80, step: 0.5, description: 'Horizontal field of view, degrees' },
  frontDistance: { value: 6.2, min: 2, max: 20, step: 0.1, description: 'Camera distance in the front (datum) view' },
  finalYawDeg: { value: 38, min: 0, max: 70, step: 0.5, description: 'Three-quarter view: yaw toward the upstream side, degrees' },
  finalPitchDeg: { value: 15, min: 0, max: 60, step: 0.5, description: 'Three-quarter view: pitch above the rail, degrees' },
  finalDistance: { value: 9.2, min: 2, max: 20, step: 0.1, description: 'Three-quarter view: camera distance to the target' },
  finalTargetX: { value: 0.2, min: -4, max: 6, step: 0.05, description: 'Three-quarter view: look-at x' },
  finalTargetY: { value: 0.35, min: -1, max: 1.5, step: 0.01, description: 'Three-quarter view: look-at y' },
  finalPush: { value: 0.35, min: 0, max: 2, step: 0.01, description: 'Slow push-in during the closing hold' },
} satisfies SceneParams;

export type RailParams = typeof RAIL_PARAMS;

/**
 * The progress map (0..1 over the pinned scroll). Beats are [start, end] windows.
 * `docks[i]` is product i in home.json order. The DOM labels reveal at each dock's end.
 */
export const RAIL_BEATS = {
  /** The datum holds as a single line while the DOM hairline above hands over to it. */
  hold: [0, 0.08] as const,
  /** The line thickens into the machined rail. */
  extrude: [0.06, 0.38] as const,
  /** The camera travels from the front view to three-quarter view. */
  camera: [0.08, 0.46] as const,
  /** Empty-station caps seat in a cascade along the rail. */
  caps: [0.24, 0.5] as const,
  /** Products dock one after another. */
  docks: [
    [0.4, 0.58],
    [0.5, 0.68],
    [0.6, 0.78],
  ] as const,
  /** Closing hold with a slow push-in. */
  push: [0.78, 1] as const,
} as const;

/** Fraction of a dock window spent travelling; the rest is the seat and settle. */
export const DOCK_TRAVEL_FRACTION = 0.72;
