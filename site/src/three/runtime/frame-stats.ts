/** Rolling frame-time statistics (ring buffer). Pure; used by the HUD and the quality ladder. */
export class FrameStats {
  private readonly samples: Float64Array;
  private count = 0;
  private cursor = 0;

  constructor(readonly capacity = 120) {
    this.samples = new Float64Array(capacity);
  }

  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.samples[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.count = 0;
    this.cursor = 0;
  }

  /** q in 0..1; returns 0 when empty. */
  quantile(q: number): number {
    if (this.count === 0) return 0;
    const sorted = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[index] ?? 0;
  }

  get p50(): number {
    return this.quantile(0.5);
  }

  get p95(): number {
    return this.quantile(0.95);
  }

  get fps(): number {
    const p50 = this.p50;
    return p50 > 0 ? 1000 / p50 : 0;
  }
}
