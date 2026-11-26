/**
 * Materials for the rail scene. The palette is the logo's (brand/logo/README.md):
 * Alloy (bead-blasted metal), Carbon (anodised dark metal), Rhodamine (LIGHT and STATUS only:
 * it is never a surface colour and never lights a surface).
 *
 * Far fade: the rail is long, so its far end fades into the void. Solid materials get a small
 * shader patch that scales the (premultiplied) output by a fade along the rail's local x. The
 * presenter treats the target as premultiplied, so a faded fragment shows the page's Carbon,
 * not a black streak.
 */
import {
  Color,
  LineBasicMaterial,
  LineDashedMaterial,
  LinearSRGBColorSpace,
  Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  ShaderMaterial,
  GreaterDepth,
  type IUniform,
} from 'three';
import type { RailParams } from './params.ts';
import { ALLOY_HEX, railSignalColor } from '../../shared/rail.ts';

export const ALLOY = new Color(ALLOY_HEX);
export const CARBON_METAL = new Color('#16181c');

/**
 * Rhodamine #E3185B cannot survive the AgX tone mapping in the post pass unchanged (AgX
 * desaturates). This linear value was solved numerically (a grid search over three's exact AgX
 * forward transform) to land as close as AgX allows: about rgb(192, 66, 83) on screen, versus
 * rgb(206, 88, 111) for the plain hex. See the scene README for the limitation.
 */
export const RHODAMINE_LIGHT = railSignalColor(); // shared with company and close (three/shared/rail.ts)
/** Unlit status socket colour (a dark recess on the pad face). */
export const SOCKET = new Color().setRGB(0.004, 0.0045, 0.005, LinearSRGBColorSpace);

/** Shared uniforms for the far fade. `uFlow` is +1 (LTR) or -1 (RTL): rail x = world x * uFlow. */
export interface FadeUniforms {
  uFadeStart: IUniform<number>;
  uFadeEnd: IUniform<number>;
  uFlow: IUniform<number>;
}

export function createFadeUniforms(params: RailParams): FadeUniforms {
  return { uFadeStart: { value: params.fadeStart.value }, uFadeEnd: { value: params.fadeEnd.value }, uFlow: { value: 1 } };
}

/** Patch a built-in material so its output fades along the rail's x (mirroring-safe via uFlow). */
export function withFarFade<T extends Material>(material: T, fade: FadeUniforms): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFadeStart = fade.uFadeStart;
    shader.uniforms.uFadeEnd = fade.uFadeEnd;
    shader.uniforms.uFlow = fade.uFlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRailX;\nuniform float uFlow;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 railWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          railWorld = instanceMatrix * railWorld;
        #endif
        vRailX = (modelMatrix * railWorld).x * uFlow;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRailX;\nuniform float uFadeStart;\nuniform float uFadeEnd;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float railFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vRailX);
        gl_FragColor *= railFade;`,
      );
  };
  material.customProgramCacheKey = () => 'rail-far-fade';
  return material;
}

export function createAlloy(params: RailParams, fade: FadeUniforms): MeshPhysicalMaterial {
  return withFarFade(new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness: params.alloyRoughness.value }), fade);
}

export function createCarbon(params: RailParams, fade: FadeUniforms): MeshPhysicalMaterial {
  return withFarFade(
    new MeshPhysicalMaterial({ color: CARBON_METAL, metalness: 0.9, roughness: params.carbonRoughness.value, clearcoat: 0.15, clearcoatRoughness: 0.35, envMapIntensity: params.carbonEnv.value }),
    fade,
  );
}

const DATUM_VERTEX = /* glsl */ `
  varying float vX;
  void main() {
    vX = position.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The datum: an unlit light line. A slow pulse travels along it (a pure function of time), and
 * its far end fades with the rail. Output is premultiplied (the target is premultiplied).
 */
const DATUM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uScanSpeed;
  uniform float uScanStrength;
  uniform float uStart;
  uniform float uLength;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying float vX;
  void main() {
    float head = uStart + mod(uTime * uScanSpeed, uLength);
    float d = (vX - head) / 0.9;
    float pulse = exp(-d * d) * uScanStrength;
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vX);
    gl_FragColor = vec4(uColor * uIntensity * (1.0 + pulse) * fade, fade);
  }
`;

export function createDatumMaterial(params: RailParams): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DATUM_VERTEX,
    fragmentShader: DATUM_FRAGMENT,
    uniforms: {
      uColor: { value: RHODAMINE_LIGHT.clone() },
      uIntensity: { value: params.datumIntensity.value },
      uTime: { value: 0 },
      uScanSpeed: { value: params.scanSpeed.value },
      uScanStrength: { value: params.scanStrength.value },
      uStart: { value: params.railStart.value },
      uLength: { value: params.railEnd.value - params.railStart.value },
      uFadeStart: { value: params.fadeStart.value },
      uFadeEnd: { value: params.fadeEnd.value },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    userData: { signal: true }, // runtime signal opt-in: shown 1:1 (runtime/README.md)
  });
}

/** Status light: unlit, on the pad face. Live = a dot, in development = an outline ring. */
export function createStatusMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: SOCKET.clone(), userData: { signal: true } });
}

/** Drafting linework: visible edges (solid) and hidden edges (dashed, drawn only behind the mask). */
export function createLineMaterials(params: RailParams): { visible: LineBasicMaterial; hidden: LineDashedMaterial } {
  const visible = new LineBasicMaterial({ color: ALLOY, transparent: true, opacity: params.lineOpacity.value, depthWrite: false });
  const hidden = new LineDashedMaterial({
    color: ALLOY,
    transparent: true,
    opacity: params.hiddenOpacity.value,
    dashSize: 0.028,
    gapSize: 0.022,
    depthWrite: false,
    depthFunc: GreaterDepth,
  });
  return { visible, hidden };
}

/** Invisible depth-only mask so linework can tell visible edges from hidden ones. */
export function createDepthMask(): MeshBasicMaterial {
  return new MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
}

const SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
/** Analytic soft contact shadow (an elliptical falloff), cheap and stable. */
const SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

export function createShadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    uniforms: { uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
}
