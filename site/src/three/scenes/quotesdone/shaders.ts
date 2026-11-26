/** Small GLSL programs for the Sealed scene. No textures: every value is analytic. */

export const CONTACT_SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Soft contact shadow under one plate: a rounded-rectangle signed distance with an exponential
 * falloff, so it is darkest exactly under the footprint and fades to nothing at the plane edge
 * (no square boundary can ever show).
 */
export const CONTACT_SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform vec2 uHalf;      // footprint half-size in UV units (plane is 0..1)
  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  void main() {
    vec2 p = vUv - 0.5;
    float d = sdBox(p, uHalf);
    float core = 1.0 - smoothstep(-0.02, 0.0, d);                // under the plate
    float halo = exp(-max(d, 0.0) * 9.0) * (1.0 - smoothstep(0.0, 0.5 - uHalf.y, max(d, 0.0)));
    float a = max(core * 0.9, halo * 0.55) * uOpacity;
    // Fade near the plane border so the quad itself is invisible.
    vec2 q = abs(p) * 2.0;
    a *= 1.0 - smoothstep(0.82, 1.0, max(q.x, q.y));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

export const FLOOR_DATUM_VERTEX = CONTACT_SHADOW_VERTEX;

/** The floor datum: a hairline of Rhodamine light whose ends fade out (never a hard cut). */
export const FLOOR_DATUM_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float ends = smoothstep(0.0, 0.28, vUv.x) * (1.0 - smoothstep(0.72, 1.0, vUv.x));
    gl_FragColor = vec4(uColor, uOpacity * ends);
  }
`;

export const LIGHT_POOL_VERTEX = CONTACT_SHADOW_VERTEX;

/**
 * The key light's pool on the floor: an elliptical, smooth falloff (roughly cos^4 of a soft
 * spot), premultiplied-friendly. Alpha carries the shape, so the quad's edge is always zero.
 */
export const LIGHT_POOL_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    float r = length((vUv - 0.5) * 2.0);
    float fall = pow(clamp(1.0 - r, 0.0, 1.0), 2.4);
    gl_FragColor = vec4(uColor * uIntensity, fall * 0.9);
  }
`;
