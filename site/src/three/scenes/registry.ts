/**
 * Scene registry: scene id -> lazy loader. Each scene is its own chunk, loaded just before it is
 * needed. To add a scene: create scenes/<id>/index.ts exporting a default SceneFactory, add one
 * line here, and put a slot in the page (see site/README.md, "Adding a scene").
 */
import type { SceneLoader } from '../runtime/scene.ts';

export const SCENES: Readonly<Record<string, SceneLoader>> = {
  smoke: () => import('./smoke/index.ts').then((m) => m.default),
  logo: () => import('./logo/index.ts').then((m) => m.default),
  rail: () => import('./rail/index.ts').then((m) => m.default),
  quotesdone: () => import('./quotesdone/index.ts').then((m) => m.default),
  sonobolt: () => import('./sonobolt/index.ts').then((m) => m.default),
  mubinflow: () => import('./mubinflow/index.ts').then((m) => m.default),
  close: () => import('./close/index.ts').then((m) => m.default),
};
