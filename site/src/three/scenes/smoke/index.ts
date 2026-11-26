/**
 * Smoke scene: a lit, rotating, bevelled Alloy box on Carbon with a Rhodamine datum line
 * and a soft contact shadow. It exists to prove the pipeline (renderer, post pass, host,
 * ladder, HUD, stills fallback). It is replaced by the logo scene in the next milestone.
 * Progress map: 0..1 adds `scrollTurns` turns of yaw; time adds idle spin.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene as ThreeScene,
  ShaderMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import type { QualityLevel } from '../../runtime/ladder.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { SMOKE_PARAMS } from './params.ts';

const ALLOY = new Color('#ECEAE4');
const RHODAMINE = new Color('#E3185B');
const TAU = Math.PI * 2;

const CONTACT_SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.2) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;
const CONTACT_SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function createSmokeScene(): RenderableScene {
  const params = structuredClone(SMOKE_PARAMS);
  const object3d = new ThreeScene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  const pivot = new Group();
  let shadow: Mesh | null = null;
  let tierAllowsShadow = false;
  let dirSign = 1;

  const scene: RenderableScene = {
    id: 'smoke',
    params,
    stillAt: [0, 0.5],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = params.envIntensity.value;
      const segments = Math.max(2, Math.round(6 * ctx.tierConfig.detail));
      const box = new Mesh(
        new RoundedBoxGeometry(1, 1, 1, segments, params.bevel.value),
        new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness: params.roughness.value }),
      );
      box.name = 'smoke-box';
      pivot.add(box);
      object3d.add(pivot);

      const key = new DirectionalLight(0xffffff, params.keyLight.value);
      key.position.set(-2.5, 3.5, 3);
      object3d.add(key, new AmbientLight(0xffffff, 0.05));

      // The datum: Rhodamine as LIGHT only, a thin unlit bar below the object.
      const datum = new Mesh(new BoxGeometry(6, 0.006, 0.006), new MeshBasicMaterial({ color: RHODAMINE }));
      datum.name = 'datum';
      datum.position.y = -0.95;
      object3d.add(datum);

      tierAllowsShadow = ctx.tierConfig.contactShadow;
      shadow = new Mesh(
        new PlaneGeometry(2.4, 2.4),
        new ShaderMaterial({
          vertexShader: CONTACT_SHADOW_VERTEX,
          fragmentShader: CONTACT_SHADOW_FRAGMENT,
          uniforms: { uOpacity: { value: 0.55 } },
          transparent: true,
          depthWrite: false,
        }),
      );
      shadow.name = 'contact-shadow';
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.94;
      shadow.visible = tierAllowsShadow;
      object3d.add(shadow);
      await ctx.yieldToMain();
    },

    // Pure: rotation is computed from inputs, never accumulated.
    update(progress: number, timeMs: number) {
      const yaw = params.yaw.value + progress * params.scrollTurns.value * TAU + dirSign * (timeMs / 1000) * params.spinRadPerSec.value;
      pivot.rotation.set(params.tilt.value, yaw, 0, 'YXZ');
    },

    resize(view: Viewport) {
      camera.aspect = view.aspect;
      // Portrait staging: pull back so the box fits the narrower width.
      const distance = params.cameraDistance.value / Math.min(1, view.aspect);
      camera.position.set(0, 0.55, distance);
      camera.lookAt(0, -0.1, 0);
      camera.updateProjectionMatrix();
      dirSign = view.dir === 'rtl' ? -1 : 1;
    },

    applyQuality(level: QualityLevel) {
      if (shadow) shadow.visible = tierAllowsShadow && level.contactShadow;
    },

    dispose() {
      // The env map belongs to the runtime, not this scene.
      object3d.environment = null;
      disposeObject3D(object3d);
    },
  };
  return scene;
}

export default createSmokeScene;
