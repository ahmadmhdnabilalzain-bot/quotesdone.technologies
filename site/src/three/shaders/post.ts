/**
 * GLSL of the runtime's post passes (runtime/presenter.ts, runtime/post.ts). Plain strings, so the
 * passes stay small and reviewable. All passes draw one full-screen triangle.
 *
 * Coordinates: every stage renders into the bottom-left sub-rectangle of grow-only shared targets.
 * `vUv` is the STAGE-local 0..1 coordinate; `uv * uUvScale` addresses the shared texture, and
 * UVs are clamped half a texel inside the stage so taps never read stale texels past its edge.
 */

export const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Screen-space ambient occlusion, SAO-style (McGuire et al. 2012, "Scalable Ambient Obscurance"):
 * one pass at reduced resolution. View-space positions come from the resolved depth through the
 * camera's inverse projection, so it works for perspective AND orthographic cameras. Normals are
 * rebuilt from depth, choosing the nearer neighbour on each axis (no smearing across silhouettes).
 * The radius is screen-relative (a fraction of the stage height), converted to a world radius per
 * pixel, because the scenes' world units differ. Background (depth 1) neither receives nor casts.
 * Output: R = visibility (1 = open, 0 = fully occluded).
 */
export const AO_FRAGMENT = /* glsl */ `
  uniform sampler2D tDepth;
  uniform vec2 uUvScale;      // stage sub-rect of the shared depth texture
  uniform vec2 uUvMax;        // clamp (stage size - 0.5 texel) / texture size
  uniform vec2 uStagePx;      // stage size in render pixels
  uniform mat4 uProjInv;
  uniform float uProjScale;   // pixels per world unit at view depth 1 (or absolute, ortho)
  uniform float uOrtho;
  uniform float uRadiusPx;
  uniform float uIntensity;
  uniform float uBias;        // angle bias: cos of the lowest counted elevation
  uniform float uTurns;
  uniform int uSamples;
  varying vec2 vUv;

  float depthAt(vec2 uv) { return texture2D(tDepth, min(uv * uUvScale, uUvMax)).x; }

  // Snap to the centre of the full-resolution depth texel. The depth fetch is NEAREST, so a
  // position rebuilt from an unsnapped uv is off by up to half a pixel: on slanted faces that
  // error is one-sided and printed as column/row streaks.
  vec2 snapUv(vec2 uv) { return (floor(uv * uStagePx) + 0.5) / uStagePx; }

  vec3 viewPos(vec2 uv, float d) {
    vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }

  // 2x2 interleaved rotation of the tap spiral. The composite's 3x3 blur spans the 2x2 period
  // exactly, so the pattern cancels (white or gradient noise left visible hatching at half res).
  // Each of the 4 cells also shifts the taps along the spiral (radius jitter), so the 2x2 block
  // samples 4N distinct positions and occluder edges do not print as streaks.
  vec2 cellAt(vec2 p) {
    vec2 c = mod(floor(p), 2.0);
    float k = c.x + 2.0 * c.y;                                  // 0..3
    return vec2((c.x * 0.5 + c.y * 0.25) * 6.2831853, (k + 0.5) * 0.25);
  }

  void main() {
    vec2 uv0 = snapUv(vUv);
    float d = depthAt(uv0);
    if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    vec3 P = viewPos(uv0, d);
    vec2 px = 1.0 / uStagePx;

    vec2 uvR = uv0 + vec2(px.x, 0.0), uvL = uv0 - vec2(px.x, 0.0);
    vec2 uvU = uv0 + vec2(0.0, px.y), uvD = uv0 - vec2(0.0, px.y);
    vec3 pR = viewPos(uvR, depthAt(uvR)), pL = viewPos(uvL, depthAt(uvL));
    vec3 pU = viewPos(uvU, depthAt(uvU)), pD = viewPos(uvD, depthAt(uvD));
    vec3 dx = abs(pR.z - P.z) < abs(P.z - pL.z) ? pR - P : P - pL;
    vec3 dy = abs(pU.z - P.z) < abs(P.z - pD.z) ? pU - P : P - pD;
    vec3 N = normalize(cross(dx, dy));
    if (dot(N, P) > 0.0) N = -N; // face the camera

    float depthScale = uOrtho > 0.5 ? 1.0 : max(1e-4, -P.z);
    float worldR = uRadiusPx * depthScale / uProjScale;
    float r2 = worldR * worldR;
    vec2 cell = cellAt(gl_FragCoord.xy);
    float spin = cell.x;

    float sum = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uSamples) break;
      float t = (float(i) + cell.y) / float(uSamples);
      float a = t * uTurns * 6.2831853 + spin;
      vec2 uv = snapUv(uv0 + vec2(cos(a), sin(a)) * (t * uRadiusPx) * px);
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
      float qd = depthAt(uv);
      if (qd >= 0.99999) continue;
      vec3 v = viewPos(uv, qd) - P;
      float vv = dot(v, v);
      if (vv > r2) continue;
      // Horizon term with an angle bias (HBAO-style): depth quantisation tilts rebuilt normals by
      // a few degrees, so only directions clearly above the surface plane count as occluders.
      float cosv = dot(v, N) * inversesqrt(vv + 1e-12);
      float falloff = 1.0 - vv / r2;
      sum += falloff * max(cosv - uBias, 0.0) / (1.0 - uBias);
    }
    float ao = clamp(1.0 - sum * uIntensity * 4.0 / float(uSamples), 0.0, 1.0);
    gl_FragColor = vec4(ao, ao, ao, 1.0);
  }
`;

/**
 * The composite: one pass per stage, from the shared linear HDR target to the canvas.
 *   base   = straight colour x AO x vignette  -> AgX -> (display linear)
 *   signal = straight colour, hue-preserving limit  (no AgX, no AO, no vignette)
 *   out    = mix(base, signal, mask) -> sRGB -> x alpha (premultiplied) -> + dither
 * Dither is added to the PREMULTIPLIED value (and to alpha in partial coverage): adding it before
 * the alpha multiply scales the noise down with alpha, which is why low-alpha falloffs banded.
 */
export const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D tInput;
  uniform sampler2D tMask;
  uniform sampler2D tAo;
  uniform sampler2D tDepth;
  uniform vec2 uUvScale;
  uniform vec2 uUvMax;
  uniform vec2 uAoUvScale;
  uniform vec2 uAoUvMax;
  uniform vec2 uAoTexel;      // 1 / AO texture size
  uniform float uAoOn;
  uniform float uAoStrength;
  uniform float uMaskOn;
  uniform float uMaskGain;
  uniform float uSignalLimit;
  uniform float uVignette;
  uniform vec2 uVignetteRange;
  uniform float uDither;
  uniform int uView;          // 0 = image, 1 = AO buffer, 2 = signal mask (?look=ao | mask)
  uniform float uBloom;       // signal-only bloom strength (0 = off; runtime/README.md "Bloom decision")
  uniform vec2 uBloomPx;      // bloom radius in shared-texture uv
  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Depth-aware tent blur of the reduced-resolution AO: four bilinear taps at +-0.5 texel make a
  // [1 2 1] x [1 2 1] filter, which weights both parities of the AO pass's 2x2 rotation equally,
  // so the rotation pattern cancels. Taps across a depth edge are down-weighted.
  float aoAt(vec2 uv) {
    float d0 = texture2D(tDepth, min(uv * uUvScale, uUvMax)).x;
    vec2 base = uv * uAoUvScale;
    float sum = 0.0, wsum = 0.0;
    for (int k = 0; k < 4; k++) {
      vec2 o = (vec2(float(k - (k / 2) * 2), float(k / 2)) - 0.5) * uAoTexel;
      vec2 suv = min(max(base + o, vec2(0.0)), uAoUvMax);
      float a = texture2D(tAo, suv).r;
      float dd = texture2D(tDepth, min((suv / uAoUvScale) * uUvScale, uUvMax)).x;
      float w = 1.0 / (1e-3 + abs(dd - d0) * 2000.0);
      sum += a * w;
      wsum += w;
    }
    return sum / max(wsum, 1e-4);
  }

  void main() {
    vec2 uv = min(vUv * uUvScale, uUvMax);
    vec4 color = texture2D(tInput, uv);   // linear, premultiplied (NormalBlending into a cleared target)
    float alpha = clamp(color.a, 0.0, 1.0);
    vec3 straight = alpha > 0.0 ? color.rgb / alpha : vec3(0.0);

    float mask = uMaskOn > 0.5 ? clamp(texture2D(tMask, uv).a * uMaskGain, 0.0, 1.0) : 0.0;

    vec3 base = straight;
    if (uAoOn > 0.5) base *= mix(1.0, aoAt(vUv), uAoStrength * (1.0 - mask));
    vec2 centered = vUv - 0.5;
    base *= 1.0 - uVignette * smoothstep(uVignetteRange.x, uVignetteRange.y, length(centered));
    #ifdef TONE_MAPPING
      base = toneMapping(base);
    #endif

    float peak = max(straight.r, max(straight.g, straight.b));
    vec3 signal = straight * (peak > uSignalLimit ? uSignalLimit / peak : 1.0);

    vec3 display = mix(base, signal, mask);
    // Signal-only bloom: a 12-tap ring blur of the signal mask's own colour (the mask target holds
    // only signal meshes), added in display-linear space. Never samples non-signal pixels.
    if (uBloom > 0.0 && uMaskOn > 0.5) {
      vec3 glow = vec3(0.0);
      for (int k = 0; k < 12; k++) {
        float a = float(k) * 0.5235988;
        float r = (k - (k / 2) * 2 == 0) ? 1.0 : 0.5;
        vec2 o = vec2(cos(a), sin(a)) * uBloomPx * r;
        vec4 s = texture2D(tMask, min(max(uv + o, vec2(0.0)), uUvMax));
        glow += s.rgb * s.a;
      }
      display += glow * (uBloom / 12.0);
    }
    if (uView == 1) { float a = uAoOn > 0.5 ? aoAt(vUv) : 1.0; display = vec3(a * a); alpha = 1.0; }
    if (uView == 2) { display = mix(vec3(0.02), vec3(1.0, 0.0, 0.25), mask); alpha = 1.0; }
    vec3 encoded = linearToOutputTexel(vec4(display, 1.0)).rgb;

    // Triangular-PDF dither, +-uDither LSB at 8 bits, on the premultiplied output.
    float n1 = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 17.17) - 1.0;
    float n2 = hash12(gl_FragCoord.xy + 41.3) + hash12(gl_FragCoord.xy + 73.9) - 1.0;
    float outA = (alpha > 0.002 && alpha < 0.998) ? clamp(alpha + n2 * uDither / 255.0, 0.0, 1.0) : alpha;
    vec3 premul = clamp(encoded * alpha + n1 * uDither / 255.0, 0.0, outA);
    gl_FragColor = vec4(premul, outA);   // canvas is premultipliedAlpha: true
  }
`;
