/**
 * Every tunable number of scene 1 'Assembly' (structure-v1 §2.2 scene 1, §2.2.2), named and
 * bounded. Three-free: the DOM hand-off in Hero.astro imports the progress marks from here, so the
 * DOM and the canvas switch at the same progress.
 *
 * Units: "cap" = line-1 cap height (100 design units = 400 SVG px). Angles in radians.
 * Progress 0..1 = the hero section's scroll from "top top" to "bottom bottom" (180 vh at the
 * desktop hero height of 280 svh). See README.md for the full progress map.
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const LOGO_PARAMS = {
  // ---- Progress map (marks) ----
  pSwap: { value: 0.012, min: 0, max: 0.1, step: 0.001, description: 'DOM SVG hands over to the canvas (both identical below this)' },
  pMachineEnd: { value: 0.16, min: 0.02, max: 0.4, step: 0.005, description: 'Flat strokes have become machined bars; camera at its raking angle' },
  pExplodeStart: { value: 0.1, min: 0.02, max: 0.5, step: 0.005, description: 'Parts start to leave their joints (in draw order)' },
  pExplodeEnd: { value: 0.56, min: 0.2, max: 0.8, step: 0.005, description: 'Last part fully out (120 vh of 180 vh = 0.667 with the hold)' },
  pReseatStart: { value: 0.667, min: 0.4, max: 0.9, step: 0.005, description: 'Parts start to re-seat; camera starts back to the front' },
  pReseatEnd: { value: 0.8, min: 0.5, max: 0.95, step: 0.005, description: 'All parts seated, camera front-on' },
  pDockStart: { value: 0.78, min: 0.5, max: 0.97, step: 0.005, description: 'Wordmark starts to travel into the header logo box' },
  pDockEnd: { value: 0.965, min: 0.7, max: 1, step: 0.005, description: 'Wordmark exactly on the header logo; DOM header logo shows' },
  pHide: { value: 0.985, min: 0.7, max: 1, step: 0.005, description: 'Canvas wordmark hidden (DOM header logo already visible: overlap, never a gap)' },
  explodeStagger: { value: 0.55, min: 0, max: 0.9, step: 0.01, description: 'Share of the explode window spent staggering parts by draw order' },

  // ---- Geometry in motion ----
  explodeSpread: { value: 0.3, min: 0, max: 1.5, step: 0.01, description: 'In-plane travel out of the joint, cap heights' },
  explodeDepthMin: { value: 0.25, min: 0, max: 3, step: 0.01, description: 'Nearest forward travel of a line-1 part, cap heights' },
  explodeDepthMax: { value: 1.05, min: 0, max: 4, step: 0.01, description: 'Farthest forward travel of a line-1 part, cap heights' },
  line2Recede: { value: 0.25, min: 0, max: 3, step: 0.01, description: 'Line 2 (TECHNOLOGIES) recedes this far, cap heights' },
  jointlessLift: { value: 0.22, min: 0, max: 1, step: 0.01, description: 'Lift of parts without joints (Q, U, O), cap heights' },

  // ---- Camera ----
  fovDeg: { value: 22, min: 8, max: 50, step: 0.5, description: 'Vertical field of view, degrees (z = 0 plane is 1 world unit per CSS px)' },
  rakePitch: { value: -0.24, min: -1.2, max: 1.2, step: 0.01, description: 'Camera pitch at the raking angle (negative = from below, so forward travel reads upward)' },
  rakeYaw: { value: -0.26, min: -1.5, max: 1.5, step: 0.01, description: 'Camera yaw at the raking angle (negative = from the left)' },
  explodeYaw: { value: -0.12, min: -1.5, max: 1.5, step: 0.01, description: 'Extra yaw drift across the exploded view' },
  rakeDolly: { value: 0.06, min: 0, max: 0.6, step: 0.01, description: 'Camera moves this share closer at the raking angle' },

  // ---- Light and material ----
  keyIntensity: { value: 6, min: 0, max: 12, step: 0.1, description: 'Key light (neutral white) intensity' },
  keyElevation: { value: 0.9, min: 0, max: 1.5, step: 0.01, description: 'Key light elevation, radians' },
  keyAzimuthFrom: { value: -1.15, min: -3.2, max: 3.2, step: 0.01, description: 'Key light azimuth at the start of the sweep' },
  keyAzimuthTo: { value: -0.35, min: -3.2, max: 3.2, step: 0.01, description: 'Key light azimuth at the end of the exploded view' },
  sweepAmplitude: { value: 0.1, min: 0, max: 0.6, step: 0.01, description: 'Slow time-driven sweep of the key along the chamfers, radians' },
  sweepPeriodS: { value: 11, min: 2, max: 60, step: 0.5, description: 'Period of that sweep, seconds' },
  envIntensity: { value: 0.3, min: 0, max: 3, step: 0.05, description: 'Neutral environment reflection intensity' },
  roughness: { value: 0.34, min: 0, max: 1, step: 0.01, description: 'Alloy roughness (bead-blasted)' },
  leaderOpacity: { value: 0.55, min: 0, max: 1, step: 0.01, description: 'Hairline leader lines at full explode' },
  tickSizePx: { value: 7, min: 0, max: 24, step: 0.5, description: 'Half-size of the joint tick crosses, CSS px' },

  // ---- Small sizes (structure-v1 §2.2.2) ----
  sealWidthPx: { value: 480, min: 200, max: 800, step: 1, description: 'Rendered width at which the joints are half closed' },
  sealBandPx: { value: 60, min: 1, max: 300, step: 1, description: 'Joints close over sealWidthPx +- this, CSS px' },
} satisfies SceneParams;

export type LogoParams = typeof LOGO_PARAMS;
