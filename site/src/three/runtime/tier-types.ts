/**
 * Tier names and per-tier render settings. No three.js import: this file is on the pre-3D path.
 * Desktop-first (ledger #36): 'high' is the design target; lower tiers only remove cost.
 */
export type Tier = 'still' | 'low' | 'mid' | 'high';

export interface TierConfig {
  tier: Tier;
  /** Upper bound for devicePixelRatio. */
  maxDpr: number;
  /** MSAA samples on the scene render target (0 = off). */
  msaaSamples: number;
  /** Post pass features. Tone mapping and dithering are always on (8-bit Carbon bands without dither). */
  vignette: boolean;
  /** Soft contact shadow under objects. */
  contactShadow: boolean;
  /** Geometry detail multiplier scenes may apply to segment counts (1 = full). */
  detail: number;
  /**
   * Cap on the shared render target's pixel count. Half-float MSAA x4 costs ~56 B/px, so
   * 3.1 MP is ~175 MB, inside the 192 MB 'high' GPU budget (§4.1). Small stages keep full DPR;
   * a full-bleed 1440x900 stage at DPR 2 (5.2 MP) renders internally at ~DPR 1.55.
   */
  maxTargetPixels: number;
}

export const TIER_CONFIGS: Readonly<Record<Exclude<Tier, 'still'>, TierConfig>> = {
  high: { tier: 'high', maxDpr: 2, msaaSamples: 4, vignette: true, contactShadow: true, detail: 1, maxTargetPixels: 3_100_000 },
  mid: { tier: 'mid', maxDpr: 1.5, msaaSamples: 4, vignette: true, contactShadow: false, detail: 0.6, maxTargetPixels: 1_100_000 },
  low: { tier: 'low', maxDpr: 1, msaaSamples: 0, vignette: false, contactShadow: false, detail: 0.4, maxTargetPixels: 1_000_000 },
};
