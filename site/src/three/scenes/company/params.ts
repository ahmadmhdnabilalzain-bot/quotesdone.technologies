/**
 * Every tunable number of the Company scene (scene 7), named and bounded (structure-v1 §6.5).
 * Progress map (0..1 while the stage crosses the viewport; see README.md):
 *   dollyStart..dollyEnd     long, quiet pull-back from station 3 to the whole line
 *   datumDimStart..End       the Rhodamine datum dims to a hairline
 *   yieldStart..1            the frame steps back (alpha) so the About text takes over
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const COMPANY_PARAMS = {
  // ---- Rail profile (keep equal to close/params.ts so the line is one object) ----
  railHeight: { value: 0.14, min: 0.04, max: 0.4, step: 0.005, description: 'Rail profile height (Y), world units' },
  railDepth: { value: 0.22, min: 0.06, max: 0.6, step: 0.005, description: 'Rail profile depth (Z), world units' },
  railChamfer: { value: 0.018, min: 0, max: 0.05, step: 0.001, description: 'Chamfer on rail edges' },
  railLead: { value: 8, min: 0, max: 30, step: 0.5, description: 'Rail length before station 1 (runs out of frame)' },
  railTail: { value: 3, min: 0, max: 30, step: 0.5, description: 'Rail length after the last station' },

  // ---- Stations ----
  stationCount: { value: 9, min: 3, max: 16, step: 1, description: 'Docks on the rail: 3 products, the rest empty (room for more, no claim)' },
  stationPitch: { value: 1.5, min: 0.6, max: 4, step: 0.05, description: 'Distance between docks, world units' },
  dockWidth: { value: 0.62, min: 0.2, max: 1.5, step: 0.01, description: 'Dock (saddle) length along the rail' },
  dockHeight: { value: 0.04, min: 0.02, max: 0.3, step: 0.005, description: 'Dock height above the rail top' },
  dockDepth: { value: 0.4, min: 0.2, max: 1.5, step: 0.01, description: 'Dock depth across the rail' },
  capInset: { value: 0.035, min: 0, max: 0.2, step: 0.005, description: 'Inset of the chamfered cap on an empty dock' },
  statusSize: { value: 0.028, min: 0.005, max: 0.1, step: 0.001, description: 'Status light size on a dock front face' },

  // ---- Product objects (low detail; the full scenes 4 to 6 carry the detail) ----
  plateCount: { value: 5, min: 1, max: 9, step: 1, description: 'QuotesDone: sealed plates in a row' },
  coilTurns: { value: 4.5, min: 1, max: 10, step: 0.25, description: 'Sonobolt: turns of the flat coil' },
  ringSegments: { value: 12, min: 6, max: 24, step: 1, description: 'MubinFlow: month segments of the drafted ring' },
  linework: { value: 0.62, min: 0.1, max: 1, step: 0.01, description: 'Opacity of drafting linework (in development)' },
  roughness: { value: 0.32, min: 0, max: 1, step: 0.01, description: 'Alloy roughness' },

  // ---- Camera ----
  fov: { value: 20, min: 8, max: 60, step: 0.5, description: 'Vertical field of view, degrees' },
  dollyEase: { value: 0.45, min: 0, max: 1, step: 0.01, description: 'Blend from linear (0) to ease-travel (1) for the pull-back; scrubbed shots read better near linear' },
  dollyStart: { value: 0.12, min: 0, max: 1, step: 0.01, description: 'Progress where the pull-back starts' },
  dollyEnd: { value: 0.5, min: 0, max: 1, step: 0.01, description: 'Progress where the pull-back ends' },
  nearDistance: { value: 3.2, min: 1, max: 20, step: 0.1, description: 'Camera distance at the start (close on station 3)' },
  farDistance: { value: 14, min: 4, max: 60, step: 0.5, description: 'Camera distance at the end (whole line)' },
  nearAzimuth: { value: 0.55, min: -1.5, max: 1.5, step: 0.01, description: 'Azimuth at the start, radians (three-quarter view)' },
  farAzimuth: { value: -0.56, min: -1.5, max: 1.5, step: 0.01, description: 'Azimuth at the end: looking down the line' },
  nearElevation: { value: 0.32, min: 0, max: 1.4, step: 0.01, description: 'Elevation at the start, radians' },
  farElevation: { value: 0.17, min: 0, max: 1.4, step: 0.01, description: 'Elevation at the end, radians' },
  focusStation: { value: 2, min: 0, max: 15, step: 1, description: 'Station the shot starts on (2 = MubinFlow, the previous scene)' },
  farFocus: { value: 0.3, min: 0, max: 1, step: 0.01, description: 'End focus as a fraction of the station run' },
  frameShift: { value: 0.14, min: -0.5, max: 0.5, step: 0.01, description: 'Horizontal film offset as a fraction of width' },
  frameLift: { value: 0.16, min: -0.5, max: 0.5, step: 0.01, description: 'Vertical film offset: the line sits high, the headline under it' },

  // ---- Light ----
  keyIntensity: { value: 2.8, min: 0, max: 10, step: 0.1, description: 'Key light intensity' },
  envIntensity: { value: 0.5, min: 0, max: 3, step: 0.05, description: 'Neutral environment reflection intensity' },

  // ---- Datum and hand-over to text ----
  datumThickness: { value: 0.006, min: 0.001, max: 0.03, step: 0.0005, description: 'Datum thickness at the start' },
  datumHairline: { value: 0.0016, min: 0.0003, max: 0.01, step: 0.0001, description: 'Datum thickness at hairline' },
  datumDimStart: { value: 0.3, min: 0, max: 1, step: 0.01, description: 'Progress where the datum starts dimming' },
  datumDimEnd: { value: 0.55, min: 0, max: 1, step: 0.01, description: 'Progress where the datum is a hairline' },
  datumHairlineOpacity: { value: 0.45, min: 0, max: 1, step: 0.01, description: 'Datum opacity once it is a hairline' },
  yieldStart: { value: 0.6, min: 0, max: 1, step: 0.01, description: 'Progress where the frame steps back for the text' },
  yieldAmount: { value: 0.6, min: 0, max: 1, step: 0.01, description: 'How far the frame fades at progress 1 (1 = gone)' },
} satisfies SceneParams;

export type CompanyParams = typeof COMPANY_PARAMS;

/** What sits on each dock. Status is drawn, never written: solid = live, linework = in development, cap = empty. */
export type DockKind = 'quotesdone' | 'sonobolt' | 'mubinflow' | 'empty';
export const DOCK_ORDER: readonly DockKind[] = ['quotesdone', 'sonobolt', 'mubinflow'];
