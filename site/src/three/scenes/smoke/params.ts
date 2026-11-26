/** Every tunable number of the smoke scene, named and bounded (structure-v1 §6.5). */
import type { SceneParams } from '../../runtime/scene.ts';

export const SMOKE_PARAMS = {
  spinRadPerSec: { value: 0.35, min: 0, max: 3, step: 0.01, description: 'Idle spin around Y, radians per second' },
  scrollTurns: { value: 0.5, min: 0, max: 4, step: 0.05, description: 'Extra turns across scroll progress 0..1' },
  tilt: { value: 0.42, min: -1.2, max: 1.2, step: 0.01, description: 'Fixed tilt around X, radians' },
  yaw: { value: 0.6, min: -3.2, max: 3.2, step: 0.01, description: 'Base yaw, radians' },
  bevel: { value: 0.08, min: 0.01, max: 0.2, step: 0.005, description: 'Bevel radius, box units' },
  roughness: { value: 0.34, min: 0, max: 1, step: 0.01, description: 'Alloy roughness (bead-blasted)' },
  keyLight: { value: 2.4, min: 0, max: 8, step: 0.1, description: 'Key light intensity' },
  envIntensity: { value: 0.9, min: 0, max: 3, step: 0.05, description: 'Environment reflection intensity' },
  cameraDistance: { value: 4.6, min: 2, max: 12, step: 0.1, description: 'Camera distance at aspect >= 1' },
} satisfies SceneParams;
