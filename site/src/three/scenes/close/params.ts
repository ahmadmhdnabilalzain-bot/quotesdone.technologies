/**
 * Every tunable number of the Close scene (scene 8), named and bounded (structure-v1 §6.5).
 * Progress map (0..1 across the closing section; see README.md):
 *   seatStart..seatEnd   the Q end cap lowers onto the rail end and seats (ease-seat)
 *   lightStart..lightEnd the key light swings from a raking angle to its resting angle
 *   datumOutStart..End   the Rhodamine datum dims to a hairline, then out, as the mark seats
 *   fadeStart..1         the canvas fades to the page's Carbon before the footer
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const CLOSE_PARAMS = {
  // ---- Rail profile (keep equal to company/params.ts so the line is one object) ----
  railHeight: { value: 0.14, min: 0.04, max: 0.4, step: 0.005, description: 'Rail profile height (Y), world units. Also the Q tail thickness' },
  railDepth: { value: 0.22, min: 0.06, max: 0.6, step: 0.005, description: 'Rail profile depth (Z), world units' },
  railChamfer: { value: 0.012, min: 0, max: 0.05, step: 0.001, description: 'Chamfer on the rail edges and ends' },
  railRoughness: { value: 0.55, min: 0, max: 1, step: 0.01, description: 'Anodised rail roughness (satin, so the top face does not read as a tube light)' },
  railLength: { value: 14, min: 2, max: 40, step: 0.5, description: 'Rail length behind the end cap (runs out of frame)' },
  jointGap: { value: 0.014, min: 0, max: 0.06, step: 0.001, description: 'Open joint between rail and end-cap block (the logo joint, scaled)' },
  endCapExtra: { value: 0.06, min: 0, max: 0.4, step: 0.005, description: 'End-cap block length beyond the Q tail run, toward the bowl' },

  // ---- The Q mark ----
  markDepth: { value: 0.14, min: 0.02, max: 0.5, step: 0.005, description: 'Q extrusion depth, world units' },
  markChamfer: { value: 0.009, min: 0, max: 0.04, step: 0.001, description: 'Q chamfer on front and back faces' },
  markCurveSegments: { value: 10, min: 2, max: 24, step: 1, description: 'Bezier subdivisions at detail 1 (scaled by tier detail)' },
  markRoughness: { value: 0.42, min: 0, max: 1, step: 0.01, description: 'Alloy roughness of the Q' },

  // ---- Seat motion ----
  seatStart: { value: 0.0, min: 0, max: 1, step: 0.01, description: 'Progress where the Q starts to lower' },
  seatEnd: { value: 0.5, min: 0, max: 1, step: 0.01, description: 'Progress where the Q is seated' },
  seatSplit: { value: 0.78, min: 0.1, max: 0.95, step: 0.01, description: 'Fraction of the seat range spent approaching; the rest is the seat itself' },
  seatGap: { value: 0.06, min: 0, max: 0.3, step: 0.005, description: 'Lift fraction left when the approach ends (the last travel into the joint)' },
  liftHeight: { value: 0.38, min: 0, max: 2, step: 0.01, description: 'Height above the seat at progress 0' },
  liftYaw: { value: -0.26, min: -1.5, max: 1.5, step: 0.01, description: 'Yaw of the Q at progress 0, radians (unwinds to 0)' },

  // ---- Light ----
  keyIntensity: { value: 16, min: 0, max: 60, step: 0.5, description: 'Key point light intensity (candela, decay 2)' },
  keyRadius: { value: 2.4, min: 0.5, max: 10, step: 0.05, description: 'Key light distance from the mark centre' },
  keyAzimuthStart: { value: -1.25, min: -3.2, max: 3.2, step: 0.01, description: 'Key azimuth at lightStart (raking, from inline-start)' },
  keyAzimuthEnd: { value: 0.42, min: -3.2, max: 3.2, step: 0.01, description: 'Key azimuth at rest' },
  keyElevationStart: { value: 0.18, min: 0, max: 1.5, step: 0.01, description: 'Key elevation at lightStart, radians' },
  keyElevationEnd: { value: 0.34, min: 0, max: 1.5, step: 0.01, description: 'Key elevation at rest, radians' },
  lightStart: { value: 0.2, min: 0, max: 1, step: 0.01, description: 'Progress where the light starts to settle' },
  lightEnd: { value: 0.7, min: 0, max: 1, step: 0.01, description: 'Progress where the light is at rest' },
  envIntensity: { value: 0.3, min: 0, max: 3, step: 0.05, description: 'Neutral environment reflection intensity' },
  rimIntensity: { value: 0.9, min: 0, max: 5, step: 0.05, description: 'Cool back light that separates the Q from the void' },

  // ---- Datum ----
  datumThickness: { value: 0.006, min: 0.001, max: 0.03, step: 0.0005, description: 'Datum line thickness at full strength' },
  datumHairline: { value: 0.0018, min: 0.0005, max: 0.01, step: 0.0001, description: 'Datum thickness at hairline' },
  datumClearance: { value: 0.5, min: 0.1, max: 3, step: 0.05, description: 'The datum stops this far before the Q footprint (Rhodamine never beside the mark)' },
  datumOutStart: { value: 0.3, min: 0, max: 1, step: 0.01, description: 'Progress where the datum starts to dim' },
  datumOutEnd: { value: 0.62, min: 0, max: 1, step: 0.01, description: 'Progress where the datum is out' },

  // ---- Fade to Carbon ----
  fadeStart: { value: 0.82, min: 0, max: 1, step: 0.01, description: 'Progress where the canvas starts fading to Carbon' },
  shadowOpacity: { value: 0.6, min: 0, max: 1, step: 0.01, description: 'Contact shadow under the seated Q (high tier)' },

  // ---- Camera ----
  fov: { value: 22, min: 10, max: 60, step: 0.5, description: 'Vertical field of view, degrees (long lens = quiet)' },
  cameraDistance: { value: 6.4, min: 2, max: 20, step: 0.1, description: 'Camera distance from the Q at aspect >= 1' },
  cameraAzimuth: { value: -0.3, min: -1.5, max: 1.5, step: 0.01, description: 'Camera azimuth around the Q (negative = from the rail side)' },
  cameraElevation: { value: 0.07, min: -0.3, max: 1.2, step: 0.01, description: 'Camera elevation, radians' },
  cameraDrift: { value: 0.08, min: 0, max: 0.6, step: 0.01, description: 'Azimuth the camera gives back across the seat (slow push)' },
  frameLift: { value: -0.2, min: -0.5, max: 0.5, step: 0.01, description: 'Vertical film offset as a fraction of height: negative lowers the line under the words' },
  frameShift: { value: 0.2, min: -0.5, max: 0.5, step: 0.01, description: 'Horizontal film offset as a fraction of width: the Q sits inline-end, words inline-start' },
} satisfies SceneParams;

export type CloseParams = typeof CLOSE_PARAMS;
