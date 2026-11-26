/**
 * Performance budgets (structure-v1 §4.1). The single source of truth:
 * scripts/check-budgets.mjs imports this file (Node type stripping), and the runtime HUD reads
 * the GPU limits. Values are gzipped KB unless named otherwise. Keep this file erasable-syntax
 * only (no enums, no namespaces) so Node can strip its types.
 */
export const TRANSFER_BUDGETS_KB = {
  /** All JS the page loads before any 3D code (statically reachable from the HTML). */
  preThreeJs: 60,
  /** All CSS. */
  css: 25,
  /** The 3D runtime chunk closure (three.js + runtime + first scene). Estimate in §3.9 item 8. */
  threeRuntime: 190,
  /** One scene module (code + data), desktop figure. Phones get the 60 KB figure later. */
  perScene: 120,
  /** One HTML page. Not in §4.1; set here at M0 as a guard. Provisional. */
  html: 40,
} as const;

/** How much over budget fails the build for the 3D chunk (§4.1: "fail on +10%"). */
export const THREE_RUNTIME_TOLERANCE = 0.1;

/** GPU-per-frame limits by tier (§4.1). Desktop-first: 'high' is the design target. */
export const GPU_BUDGETS = {
  low: { triangles: 100_000, drawCalls: 60, maxDpr: 1 },
  mid: { triangles: 100_000, drawCalls: 60, maxDpr: 1.5 },
  high: { triangles: 300_000, drawCalls: 150, maxDpr: 2 },
} as const;

/** Frame-time target used by the quality ladder (ms). */
export const FRAME_BUDGET_MS = { target: 16.7, p95Max: 20 } as const;
