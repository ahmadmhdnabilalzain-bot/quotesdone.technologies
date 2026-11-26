/**
 * Central error handling (structure-v1 §6.6). Any failure turns a section into its still;
 * the words never move, because stills and stages are fixed-size boxes in the layout.
 * No three.js import: this file is on the pre-3D path.
 */
import { createLogger } from '../../lib/log.ts';

const log = createLogger('errors');

export type SlotDomState = 'still' | 'loading' | 'live' | 'failed';

/** Set a scene slot's visual state. CSS (motion.css) fades the still out only for 'live'. */
export function setSlotState(slot: HTMLElement, state: SlotDomState, reason?: string): void {
  slot.dataset.sceneState = state;
  if (reason) slot.dataset.sceneReason = reason;
  else delete slot.dataset.sceneReason;
}

/** Every slot on the page to its still (3D off for this visit, or never loaded). */
export function allSlotsToStill(reason: string, doc: Document = document): void {
  doc.querySelectorAll<HTMLElement>('[data-scene-slot]').forEach((slot) => setSlotState(slot, 'still', reason));
  doc.documentElement.dataset['3d'] = 'off';
}

let installed = false;
/** window.onerror + unhandledrejection, logged once with the qdt namespace. */
export function installGlobalErrorHandlers(win: Window = window): void {
  if (installed) return;
  installed = true;
  win.addEventListener('error', (event) => {
    log.error(`uncaught: ${event.message}`, event.error);
  });
  win.addEventListener('unhandledrejection', (event) => {
    log.error('unhandled rejection', event.reason);
  });
}
