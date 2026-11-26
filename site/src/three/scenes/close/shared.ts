/**
 * Building blocks shared by the Company (scene 7) and Close (scene 8) scenes:
 * palette, materials, the chamfered rail profile, chamfered boxes, the alpha fade pass and
 * the small pure easing helpers. Everything here is procedural: no textures, no downloads.
 *
 * Owned by the company/close agent. Other scenes should not import from here. The palette, the
 * signal colour and the datum height come from three/shared/rail.ts, shared with the rail scene.
 */
import {
  BufferGeometry,
  Color,
  CustomBlending,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  ZeroFactor,
} from 'three';
import { ALLOY_HEX, RAIL_PROFILE, RHODAMINE_HEX, railSignalColor } from '../../shared/rail.ts';

export const ALLOY = new Color(ALLOY_HEX);
/** Brand Rhodamine as authored (for checks such as "the mark is never Rhodamine"). */
export const RHODAMINE = new Color(RHODAMINE_HEX);
/** Rhodamine as it is DRAWN: the rail scene's AgX-compensated signal colour (three/shared/rail.ts). */
export const SIGNAL = railSignalColor();
/**
 * Datum height on the rail's front face, as a fraction of the rail height below the top face.
 * Matches the rail scene (scenes/rail/params.ts: grooveY -0.2 of railHeight 0.34).
 */
export const DATUM_Y = RAIL_PROFILE.datumDepth;

/** Dark anodised metal for the rail and docks: a lifted Carbon so it reads against the page. */
export const ANODISED = new Color('#1c1f24');

/** Bead-blasted Alloy: the products and the Q mark. Neutral, never tinted. */
export function alloyMaterial(roughness: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness });
}

/** Anodised rail metal. */
export function anodisedMaterial(roughness: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: ANODISED, metalness: 0.6, roughness });
}

/**
 * Rhodamine as LIGHT only: an unlit line. It emits nothing into the scene (MeshBasicMaterial
 * does not light other meshes), so it can never tint the Alloy or the mark.
 * `transparent` is fixed at creation so changing opacity never recompiles a program mid-scroll.
 * Colour: SIGNAL, the same drawn Rhodamine as the rail scene's datum (the post pass tone-maps
 * everything, so `toneMapped: false` alone would not keep the hex).
 */
export function datumMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: SIGNAL, transparent: true, depthWrite: false, toneMapped: false });
}

/** A rectangle with 45-degree chamfered corners, centred on the origin. */
function chamferedRect(width: number, height: number, chamfer: number): Shape {
  const w = width / 2;
  const h = height / 2;
  const c = Math.min(chamfer, w * 0.5, h * 0.5);
  const s = new Shape();
  s.moveTo(-w + c, -h);
  s.lineTo(w - c, -h);
  s.lineTo(w, -h + c);
  s.lineTo(w, h - c);
  s.lineTo(w - c, h);
  s.lineTo(-w + c, h);
  s.lineTo(-w, h - c);
  s.lineTo(-w, -h + c);
  s.closePath();
  return s;
}

/**
 * Extrude `shape` to `depth` with a chamfer of `chamfer` on both end faces, WITHOUT growing the
 * silhouette: bevelOffset = -bevelSize keeps the side walls exactly on the outline.
 * The result spans z = 0..depth.
 */
export function extrudeChamfered(shape: Shape | Shape[], depth: number, chamfer: number, curveSegments = 6): ExtrudeGeometry {
  const c = Math.max(0, Math.min(chamfer, depth * 0.45));
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * c),
    curveSegments,
    bevelEnabled: c > 0,
    bevelThickness: c,
    bevelSize: c,
    bevelOffset: -c,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, c);
  return geometry;
}

/** A box with every edge chamfered, centred on the origin. */
export function chamferedBox(width: number, height: number, depth: number, chamfer: number): BufferGeometry {
  const g = extrudeChamfered(chamferedRect(width, height, chamfer), depth, chamfer, 1);
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * A rail bar along +X from x0 to x1. Profile: `height` (Y) by `depth` (Z), chamfered corners
 * and chamfered ends. The TOP face sits at y = 0 (everything stands on the line).
 */
export function railBar(x0: number, x1: number, height: number, depth: number, chamfer: number): BufferGeometry {
  const length = Math.max(1e-3, x1 - x0);
  const g = extrudeChamfered(chamferedRect(depth, height, chamfer), length, chamfer, 1);
  // Extrusion runs along +Z; turn it so it runs along +X (profile x -> -z, extrude z -> x).
  g.rotateY(Math.PI / 2);
  g.translate(x0, -height / 2, 0);
  return g;
}

/**
 * Alpha fade pass: one full-screen triangle drawn last that multiplies the target's colour AND
 * alpha by (1 - uFade). The page's CSS Carbon then shows through exactly, so "fade to Carbon"
 * never draws Carbon-coloured pixels through tone mapping (which left a seam in M0).
 */
export function createFadePass(): { mesh: Mesh; set(amount: number): void } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uFade; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uFade); }`,
    uniforms: { uFade: { value: 0 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    // result = src * 0 + dst * (1 - srcAlpha), for colour and for alpha.
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'fade-pass';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10_000;
  const uniform = material.uniforms.uFade!;
  return {
    mesh,
    set(amount: number) {
      uniform.value = clamp01(amount);
      // Skip the draw call entirely while there is nothing to fade.
      mesh.visible = uniform.value > 0.0005;
    },
  };
}

/** Analytic soft contact shadow (radial falloff), the same idea as the smoke scene. */
export function createContactShadow(width: number, depth: number): { mesh: Mesh; material: ShaderMaterial } {
  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uOpacity;
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d);
        float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.4) * uOpacity;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }`,
    uniforms: { uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(width, depth), material);
  mesh.name = 'contact-shadow';
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, material };
}

// ---- Pure easing helpers (Penner curves matching styles/tokens.css names) ----

export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** Map `p` from [a, b] to [0, 1], clamped. */
export function segment(p: number, a: number, b: number): number {
  return b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a));
}

/** --ease-seat: ease-out-quint, parts settling into a joint. */
export function easeSeat(t: number): number {
  return 1 - (1 - clamp01(t)) ** 5;
}

/** --ease-travel: ease-in-out-cubic, camera travel. */
export function easeTravel(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * World size of one device pixel at `distance` in front of a perspective camera. Lines thinner
 * than this alias into dashes, so hairlines are clamped to it and dimmed by opacity instead.
 */
export function worldPerDevicePixel(distance: number, fovDeg: number, heightCss: number, pixelRatio: number): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, heightCss * pixelRatio);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
