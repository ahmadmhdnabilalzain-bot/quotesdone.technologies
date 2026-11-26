/**
 * Runtime quality ladder (structure-v1 §4.3, Sonobolt's rule):
 * - it moves ONLY at rest (300 ms after the last scroll), never while scrolling;
 * - it only steps DOWN within a visit, never up;
 * - a steady ~30 Hz (iOS Low Power Mode) is left alone.
 * Pure logic: the caller feeds frame times and scroll activity and applies the returned level.
 */
import { FRAME_BUDGET_MS } from '../../lib/budgets.ts';
import { FrameStats } from './frame-stats.ts';

export interface QualityLevel {
  /** 0 = full quality. */
  index: number;
  label: string;
  contactShadow: boolean;
  /** Render-target scale applied on top of the DPR cap. */
  renderScale: number;
}

export const LADDER: readonly QualityLevel[] = [
  { index: 0, label: 'full', contactShadow: true, renderScale: 1 },
  { index: 1, label: 'no contact shadow', contactShadow: false, renderScale: 1 },
  { index: 2, label: 'scale 0.85', contactShadow: false, renderScale: 0.85 },
  { index: 3, label: 'scale 0.7', contactShadow: false, renderScale: 0.7 },
];

export interface LadderOptions {
  restMs?: number;
  /** Minimum samples before a decision. */
  minSamples?: number;
  p95LimitMs?: number;
  /** Pinned level (?level=n) disables automatic changes. */
  pinned?: number | null;
}

export class QualityLadder {
  private level: number;
  private lastScrollMs = Number.NEGATIVE_INFINITY;
  private readonly stats = new FrameStats(90);
  private readonly restMs: number;
  private readonly minSamples: number;
  private readonly p95LimitMs: number;
  private readonly pinned: boolean;

  constructor(options: LadderOptions = {}) {
    this.restMs = options.restMs ?? 300;
    this.minSamples = options.minSamples ?? 60;
    this.p95LimitMs = options.p95LimitMs ?? FRAME_BUDGET_MS.p95Max;
    this.pinned = options.pinned !== undefined && options.pinned !== null;
    this.level = this.pinned ? clampLevel(options.pinned ?? 0) : 0;
  }

  get current(): QualityLevel {
    return LADDER[this.level] ?? LADDER[0]!;
  }

  noteScroll(nowMs: number): void {
    this.lastScrollMs = nowMs;
  }

  /**
   * Record one frame. Returns the new level when it changed, otherwise null.
   * Frames recorded while scrolling still count; the DECISION waits for rest.
   */
  sample(nowMs: number, frameMs: number): QualityLevel | null {
    this.stats.push(frameMs);
    if (this.pinned) return null;
    if (nowMs - this.lastScrollMs < this.restMs) return null;
    if (this.stats.size < this.minSamples) return null;
    if (this.level >= LADDER.length - 1) return null;

    const p50 = this.stats.p50;
    const p95 = this.stats.p95;
    if (isSteadyThirtyHz(p50, p95)) return null;
    if (p95 <= this.p95LimitMs) return null;

    this.level += 1;
    this.stats.clear();
    return this.current;
  }
}

/** ~33 ms median with little spread = a display/power cap, not a GPU overload. */
export function isSteadyThirtyHz(p50: number, p95: number): boolean {
  return p50 > 30 && p50 < 36 && p95 < 40;
}

function clampLevel(level: number): number {
  return Math.min(LADDER.length - 1, Math.max(0, Math.round(level)));
}
