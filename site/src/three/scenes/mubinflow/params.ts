/**
 * Every tunable number of the MubinFlow scene ("Shows its working"), named and bounded
 * (structure-v1 §6.5). Units: world units (w) unless named; the ring's outer radius is 1 w.
 * Line widths are CSS pixels; the material converts them to device pixels.
 */
import type { SceneParams } from '../../runtime/scene.ts';

export const MUBINFLOW_PARAMS = {
  // ---- Status ----
  maturity: {
    value: 0,
    min: 0,
    max: 1,
    step: 0.01,
    description: '0 = drafting linework (in development). 1 = solid Alloy (launched): hidden lines, sheet and plate off',
  },

  // ---- Camera (orthographic, axonometric) ----
  elevationDeg: { value: 34, min: 15, max: 60, step: 0.5, description: 'Camera elevation above the ring plane, degrees' },
  azimuthDeg: { value: 26, min: -80, max: 80, step: 0.5, description: 'Camera azimuth around Y, degrees' },
  ringFraming: { value: 1.55, min: 1, max: 3, step: 0.01, description: 'Opening frame: the ring alone, with this much room around it (1 = tight)' },
  framingMargin: { value: 0.07, min: 0, max: 0.3, step: 0.005, description: 'Empty margin around the fitted content, fraction of the view' },

  // ---- Ring ----
  ringOuter: { value: 1, min: 0.5, max: 2, step: 0.01, description: 'Outer radius of the month ring, w' },
  ringInner: { value: 0.7, min: 0.3, max: 0.95, step: 0.01, description: 'Inner radius of the month ring, w' },
  ringHeight: { value: 0.09, min: 0.02, max: 0.3, step: 0.005, description: 'Ring thickness, w' },
  ringJoint: { value: 0.024, min: 0.005, max: 0.08, step: 0.001, description: 'Gap between month segments, w (the 2.4-unit joint, scaled)' },
  indexSteps: { value: 7, min: 1, max: 11, step: 1, description: 'Detent steps the ring turns before it stops on the month' },
  extractDistance: { value: 0.42, min: 0.1, max: 1.2, step: 0.01, description: 'How far the month segment slides out, w' },

  // ---- Strips ----
  stripLength: { value: 2.2, min: 1, max: 4, step: 0.05, description: 'Length of each layered strip, w' },
  stripDepth: { value: 0.56, min: 0.2, max: 1.2, step: 0.01, description: 'Depth of each strip, w' },
  stripThickness: { value: 0.03, min: 0.005, max: 0.1, step: 0.001, description: 'Strip slab thickness, w' },
  stripGap: { value: 0.6, min: 0.1, max: 0.8, step: 0.01, description: 'Vertical spacing between layers, w' },
  stripOffset: { value: 0.3, min: 0, max: 1, step: 0.01, description: 'Gap from the extracted segment to the strips, w' },
  rows: { value: 8, min: 3, max: 12, step: 1, description: 'People in the example pay run (cells per strip)' },
  tracedRow: { value: 5, min: 0, max: 11, step: 1, description: 'Which person/payslip the callout traces (0-based)' },

  // ---- Lines ----
  widthEdge: { value: 1.15, min: 0.5, max: 3, step: 0.05, description: 'Visible edge width, CSS px' },
  widthHidden: { value: 1, min: 0.5, max: 3, step: 0.05, description: 'Hidden (dashed) edge width, CSS px' },
  widthFine: { value: 0.85, min: 0.5, max: 2, step: 0.05, description: 'Fine detail and sheet width, CSS px' },
  widthFigure: { value: 2.2, min: 0.5, max: 5, step: 0.05, description: 'The traced figure on the payslip, CSS px' },
  widthTrace: { value: 1.5, min: 0.5, max: 4, step: 0.05, description: 'Traced figure and leader width, CSS px' },
  hiddenDash: { value: 5, min: 1, max: 20, step: 0.5, description: 'Hidden-line dash, CSS px' },
  hiddenGap: { value: 3.5, min: 1, max: 20, step: 0.5, description: 'Hidden-line gap, CSS px' },
  intensityEdge: { value: 0.92, min: 0, max: 1, step: 0.01, description: 'Visible edge brightness (0 = Carbon, 1 = Alloy)' },
  intensityHidden: { value: 0.36, min: 0, max: 1, step: 0.01, description: 'Hidden edge brightness' },
  intensityFine: { value: 0.46, min: 0, max: 1, step: 0.01, description: 'Detail lines brightness' },
  intensitySheet: { value: 0.3, min: 0, max: 1, step: 0.01, description: 'Sheet frame and construction lines brightness' },
  edgesAtMaturity: { value: 0.22, min: 0, max: 1, step: 0.01, description: 'Edge brightness kept over the solid at maturity 1' },
  lineGain: {
    value: 1.32,
    min: 0.5,
    max: 3,
    step: 0.01,
    description: 'Linear gain on line colour so Alloy reads as Alloy after the AgX tone map (measured on screen)',
  },
  depthOffset: { value: 2.5, min: 0, max: 8, step: 0.1, description: 'Polygon offset on the depth-only solids, so edges on a face test visible' },

  // ---- Solid (maturity) ----
  solidRoughness: { value: 0.38, min: 0, max: 1, step: 0.01, description: 'Alloy roughness at maturity 1' },
  keyLight: { value: 2.2, min: 0, max: 8, step: 0.1, description: 'Key light for the solid state' },
  envIntensity: { value: 0.8, min: 0, max: 3, step: 0.05, description: 'Environment reflection for the solid state' },
} satisfies SceneParams;

export type MubinFlowParams = typeof MUBINFLOW_PARAMS;

/**
 * Debug-only override (the harness page sets it from `?maturity=`). A new scene copies the
 * params and then applies these values, so the live page needs no handle into the host.
 */
export const DEBUG_OVERRIDES: Partial<Record<keyof MubinFlowParams, number>> = {};
