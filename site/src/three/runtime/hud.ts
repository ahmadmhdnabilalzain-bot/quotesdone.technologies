/**
 * ?hud / ?debug overlay: fps, p95 frame ms, draw calls, triangles, memory, tier, ladder level,
 * DPR, GPU string, per-slot status and progress, last error. Text only; updated at ~4 Hz.
 */
import { lastError } from '../../lib/log.ts';

export interface HudInfo {
  fps: number;
  p95Ms: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  estimatedMb: number;
  tier: string;
  tierReasons: string[];
  ladder: string;
  /** Look summary (runtime/look.ts): AO quality, signal objects, aux passes. Optional. */
  look?: { ao: string; signalObjects: number; signalPasses: number; aoPasses: number } | null;
  dpr: number;
  gpu: string;
  slots: Array<{ slotId: string; sceneId: string; status: string; progress: number }>;
}

export interface Hud {
  update(info: HudInfo): void;
  dispose(): void;
}

const UPDATE_EVERY_MS = 250;

export function createHud(doc: Document = document): Hud {
  const panel = doc.createElement('pre');
  panel.setAttribute('aria-hidden', 'true');
  panel.dataset.qdtHud = '';
  Object.assign(panel.style, {
    position: 'fixed',
    insetBlockStart: '8px',
    insetInlineEnd: '8px',
    zIndex: '100',
    margin: '0',
    padding: '8px 10px',
    maxInlineSize: 'min(92vw, 360px)',
    font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace',
    color: '#ECEAE4',
    background: 'rgba(14,16,19,0.86)',
    border: '1px solid rgba(236,234,228,0.2)',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
  } satisfies Partial<CSSStyleDeclaration>);
  doc.body.append(panel);

  let lastUpdate = 0;
  return {
    update(info) {
      const now = performance.now();
      if (now - lastUpdate < UPDATE_EVERY_MS) return;
      lastUpdate = now;
      const error = lastError();
      const lines = [
        `fps ${info.fps.toFixed(0)}  p95 ${info.p95Ms.toFixed(1)} ms`,
        `calls ${info.drawCalls}  tris ${info.triangles.toLocaleString('en')}`,
        `geo ${info.geometries}  tex ${info.textures}  ~${info.estimatedMb.toFixed(1)} MB`,
        `tier ${info.tier} (${info.tierReasons.join(', ')})`,
        `ladder ${info.ladder}  dpr ${info.dpr}`,
        ...(info.look ? [`look ao ${info.look.ao}  signal objs ${info.look.signalObjects}  passes sig ${info.look.signalPasses} ao ${info.look.aoPasses}`] : []),
        `gpu ${info.gpu}`,
        ...info.slots.map((s) => `${s.slotId}[${s.sceneId}] ${s.status} p=${s.progress.toFixed(3)}`),
        error ? `last error: ${error.ns} ${error.message}` : 'last error: none',
      ];
      panel.textContent = lines.join('\n');
    },
    dispose() {
      panel.remove();
    },
  };
}
