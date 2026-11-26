/**
 * Scroll -> per-slot state for the SceneHost (structure-v1 §3.4).
 * Progress uses the section's own ScrollTrigger range (data-scene-start / data-scene-end,
 * ScrollTrigger syntax, default "top top" -> "bottom top"). Distance and coverage use a second
 * trigger on the section (see below: never on a sticky stage) ("top bottom" -> "bottom top") and cached positions, so no layout is
 * read per frame for slots that are not drawn.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SlotScrollState } from '../three/runtime/scene.ts';

export interface TrackedSlot {
  id: string;
  section: HTMLElement;
  stage: HTMLElement;
}

export interface SlotTracker {
  read(slotId: string): SlotScrollState | null;
  dispose(): void;
}

interface Entry {
  progress: ScrollTrigger;
  visibility: ScrollTrigger;
}

export function trackSlots(slots: TrackedSlot[]): SlotTracker {
  const entries = new Map<string, Entry>();
  for (const slot of slots) {
    entries.set(slot.id, {
      progress: ScrollTrigger.create({
        trigger: slot.section,
        start: slot.section.dataset.sceneStart ?? 'top top',
        end: slot.section.dataset.sceneEnd ?? 'bottom top',
      }),
      // A sticky stage keeps its natural top while pinned, so a trigger on it would report the scene off-screen
      // after about one viewport and free it mid-scroll. For sticky stages the SECTION (which spans the whole
      // pinned range) is the true on-screen window; in-flow stages are measured directly.
      visibility: ScrollTrigger.create({
        trigger: getComputedStyle(slot.stage).position === 'sticky' ? slot.section : slot.stage,
        start: 'top bottom',
        end: 'bottom top',
      }),
    });
  }

  return {
    read(slotId) {
      const entry = entries.get(slotId);
      if (!entry) return null;
      return computeSlotState({
        scroll: entry.visibility.scroll(),
        viewportHeight: window.innerHeight,
        visibilityStart: entry.visibility.start,
        visibilityEnd: entry.visibility.end,
        progress: entry.progress.progress,
      });
    },
    dispose() {
      entries.forEach((entry) => {
        entry.progress.kill();
        entry.visibility.kill();
      });
      entries.clear();
    },
  };
}

/** Pure geometry, unit-tested. visibilityStart = stageTop - vh, visibilityEnd = stageBottom. */
export function computeSlotState(input: {
  scroll: number;
  viewportHeight: number;
  visibilityStart: number;
  visibilityEnd: number;
  progress: number;
}): SlotScrollState {
  const vh = Math.max(1, input.viewportHeight);
  const stageTop = input.visibilityStart + vh;
  const stageBottom = input.visibilityEnd;
  const viewTop = input.scroll;
  const viewBottom = input.scroll + vh;
  let distanceVh = 0;
  if (stageTop > viewBottom) distanceVh = (stageTop - viewBottom) / vh;
  else if (stageBottom < viewTop) distanceVh = (viewTop - stageBottom) / vh;
  const overlap = Math.max(0, Math.min(viewBottom, stageBottom) - Math.max(viewTop, stageTop));
  return { progress: input.progress, distanceVh, coverage: Math.min(1, overlap / vh) };
}
