/**
 * Neutral procedural environment for reflections (structure-v1 §3.3): three's RoomEnvironment
 * through PMREM. No HDR download, and no colour in it, so nothing tints the Alloy.
 */
import { PMREMGenerator, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createNeutralEnvironment(renderer: WebGLRenderer): { texture: Texture; dispose(): void } {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}
