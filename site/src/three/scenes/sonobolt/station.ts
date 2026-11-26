/**
 * Station 2's static parts: the rail with its datum line, the beat ruler (ticks on the rail top,
 * never a floor grid), the guide roller, the slot plate with three product slots (Mix with a hub
 * and a status ring; Studio and Visuals capped), and a soft contact shadow under the coil.
 * Everything is procedural (lathe and extrude profiles), no textures.
 *
 * Rhodamine appears only as light: the datum line, the Mix status ring. The capped slots have none.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Shape,
  ShaderMaterial,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const ALLOY = new Color('#ECEAE4');
export const CARBON = new Color('#0E1013');
export const RHODAMINE = new Color('#E3185B');

export interface StationLayout {
  /** Coil centre (the Mix slot), ground plane. */
  coilX: number;
  coilZ: number;
  guideX: number;
  socketRadius: number;
  socketSpacing: number;
  hubRadius: number;
  /** Rail extent along x. */
  railFrom: number;
  railTo: number;
  /** Segments multiplier from the tier. */
  detail: number;
}

export interface Station {
  group: Group;
  /** Beat ruler: tick spacing, scroll offset and opacity. */
  setRuler(shift: number, beatLength: number, opacity: number, visibleTo: number): void;
  setStatus(level: number): void;
  setShadow(opacity: number, radius: number): void;
  setShadowEnabled(enabled: boolean): void;
}

const RAIL_HALF_WIDTH = 0.18;
const RAIL_HEIGHT = 0.2;
const RAIL_CHAMFER = 0.026;

const RULER_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying float vX;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vX = world.x;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Ticks at every beat of the mix, a longer tick every bar (4 beats). The ticks ride with the
// ribbon's head (uShift) and exist only behind it (phase >= 0) and before the guide (uVisibleTo).
const RULER_FRAGMENT = /* glsl */ `
  uniform float uShift;
  uniform float uBeat;
  uniform float uOpacity;
  uniform float uVisibleTo;
  uniform float uFadeFrom;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vX;
  void main() {
    if (uOpacity <= 0.0) discard;
    float phase = (uShift - vX) / uBeat;
    float nearest = floor(phase + 0.5);
    float distUnits = abs(phase - nearest) * uBeat;
    float aa = fwidth(vX) * 0.75;
    float line = 1.0 - smoothstep(0.0045, 0.0045 + aa, distUnits);
    bool isBar = mod(nearest, 4.0) < 0.5;
    float reach = isBar ? 1.0 : 0.42;
    float len = 1.0 - smoothstep(reach - 0.04, reach, vUv.y);
    float behindHead = step(0.0, nearest);
    float beforeGuide = 1.0 - smoothstep(uVisibleTo - 0.15, uVisibleTo, vX);
    float far = smoothstep(uFadeFrom, uFadeFrom + 6.0, vX);
    float a = line * len * behindHead * beforeGuide * far * uOpacity * (isBar ? 0.62 : 0.34);
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

export function createStation(layout: StationLayout, datumGlow: number): Station {
  const group = new Group();
  group.name = 'sonobolt-station';
  const seg = (n: number): number => Math.max(8, Math.round(n * layout.detail));

  // ---- Materials ----
  const carbonMetal = new MeshPhysicalMaterial({ color: new Color('#1b1d22'), metalness: 0.75, roughness: 0.42 });
  carbonMetal.name = 'sonobolt-carbon';
  const plateMetal = new MeshPhysicalMaterial({ color: new Color('#15171b'), metalness: 0.6, roughness: 0.55 });
  plateMetal.name = 'sonobolt-plate';
  const machinedAlloy = new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness: 0.3 });
  machinedAlloy.name = 'sonobolt-machined';
  const capAlloy = new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness: 0.56 });
  capAlloy.name = 'sonobolt-cap';
  const datumMat = new MeshBasicMaterial({ color: RHODAMINE.clone().multiplyScalar(datumGlow) });
  datumMat.name = 'sonobolt-datum';
  const statusMat = new MeshBasicMaterial({ color: RHODAMINE.clone() });
  statusMat.name = 'sonobolt-status';

  // ---- Rail: a chamfered profile extruded along x ----
  const profile = new Shape();
  const w = RAIL_HALF_WIDTH;
  const c = RAIL_CHAMFER;
  profile.moveTo(-w, -RAIL_HEIGHT);
  profile.lineTo(w, -RAIL_HEIGHT);
  profile.lineTo(w, -c);
  profile.lineTo(w - c, 0);
  profile.lineTo(-w + c, 0);
  profile.lineTo(-w, -c);
  profile.closePath();
  const railLength = layout.railTo - layout.railFrom;
  const railGeo = new ExtrudeGeometry(profile, { depth: railLength, bevelEnabled: false, steps: 1 });
  railGeo.rotateY(Math.PI / 2); // extrusion (+z) -> +x
  railGeo.translate(layout.railFrom, 0, 0);
  const rail = new Mesh(railGeo, carbonMetal);
  rail.name = 'sonobolt-rail';
  group.add(rail);

  // The datum: a hairline of Rhodamine light in the rail's front face.
  const datum = new Mesh(new BoxGeometry(railLength, 0.0045, 0.0045), datumMat);
  datum.name = 'sonobolt-datum';
  datum.position.set(layout.railFrom + railLength / 2, -0.07, w + 0.0015);
  group.add(datum);

  // ---- Beat ruler on the rail top, in front of the band ----
  const rulerUniforms = {
    uShift: { value: 0 },
    uBeat: { value: 0.2 },
    uOpacity: { value: 0 },
    uVisibleTo: { value: layout.guideX },
    uFadeFrom: { value: layout.railFrom },
    uColor: { value: ALLOY.clone() },
  };
  const rulerMat = new ShaderMaterial({
    vertexShader: RULER_VERTEX,
    fragmentShader: RULER_FRAGMENT,
    uniforms: rulerUniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide, // the plane is mirrored (scale.y = -1) to orient its uv
  });
  rulerMat.name = 'sonobolt-ruler';
  const rulerDepth = w - c - 0.04;
  const ruler = new Mesh(new PlaneGeometry(railLength, rulerDepth), rulerMat);
  ruler.name = 'sonobolt-ruler';
  ruler.rotation.x = -Math.PI / 2;
  // uv.y runs 0 (rail centre side) -> 1 (front edge) after the rotation flip below.
  ruler.scale.y = -1;
  ruler.position.set(layout.railFrom + railLength / 2, 0.0012, 0.03 + rulerDepth / 2);
  group.add(ruler);

  // ---- Guide roller: where the tape leaves the rail for the coil ----
  const roller = new Mesh(new CylinderGeometry(0.05, 0.05, 0.5, seg(32), 1), machinedAlloy);
  roller.name = 'sonobolt-roller';
  roller.position.set(layout.guideX, 0.22, 0.058);
  group.add(roller);
  const rollerFoot = new Mesh(new CylinderGeometry(0.075, 0.085, 0.03, seg(32), 1), carbonMetal);
  rollerFoot.name = 'sonobolt-roller-foot';
  rollerFoot.position.set(layout.guideX, 0.015, 0.058);
  group.add(rollerFoot);

  // ---- Slot plate with three product slots ----
  const plateMargin = layout.socketRadius + 0.34;
  const plateLen = layout.socketSpacing * 2 + plateMargin * 2;
  const plateDepth = plateMargin * 2;
  const plate = new Mesh(new RoundedBoxGeometry(plateLen, 0.16, plateDepth, 3, 0.03), plateMetal);
  plate.name = 'sonobolt-plate';
  plate.position.set(layout.coilX + layout.socketSpacing, -0.08, layout.coilZ);
  group.add(plate);

  const R = layout.socketRadius;
  // Lathe profiles run outer-bottom -> up -> over -> inward, so normals face out of the solid.
  const rimProfile = [
    new Vector2(R + 0.05, 0),
    new Vector2(R + 0.05, 0.016),
    new Vector2(R + 0.032, 0.034),
    new Vector2(R - 0.032, 0.034),
    new Vector2(R - 0.05, 0.016),
    new Vector2(R - 0.05, 0),
  ];
  const rimGeo = new LatheGeometry(rimProfile, seg(160));
  const capR = R - 0.075;
  const capGeo = new LatheGeometry(
    [new Vector2(0, 0.058), new Vector2(capR - 0.028, 0.058), new Vector2(capR, 0.03), new Vector2(capR, 0), new Vector2(0.0001, 0)].reverse(),
    seg(128),
  );
  // The cap's machined edge: a fine Alloy chamfer line on a Carbon lid.
  const capEdgeGeo = new TorusGeometry(capR - 0.03, 0.005, 6, seg(128));
  for (let i = 0; i < 3; i++) {
    const x = layout.coilX + i * layout.socketSpacing;
    const rim = new Mesh(rimGeo, machinedAlloy);
    rim.name = `sonobolt-slot-rim-${i}`;
    rim.position.set(x, 0, layout.coilZ);
    group.add(rim);
    if (i > 0) {
      // Studio and Visuals: capped, unlit. "Coming soon" is said in the DOM, never in 3D.
      const cap = new Mesh(capGeo, carbonMetal);
      cap.name = `sonobolt-slot-cap-${i}`;
      cap.position.set(x, 0, layout.coilZ);
      group.add(cap);
      const capEdge = new Mesh(capEdgeGeo, capAlloy);
      capEdge.name = `sonobolt-slot-cap-edge-${i}`;
      capEdge.rotation.x = -Math.PI / 2;
      capEdge.position.set(x, 0.058, layout.coilZ);
      group.add(capEdge);
    }
  }

  // Mix: the hub the coil winds on, and the status ring around the slot.
  const hr = layout.hubRadius - 0.025;
  const hubGeo = new LatheGeometry(
    [new Vector2(0.0001, 0.44), new Vector2(hr - 0.03, 0.44), new Vector2(hr, 0.41), new Vector2(hr, 0.02), new Vector2(hr + 0.03, 0), new Vector2(0.0001, 0)].reverse(),
    seg(96),
  );
  const hub = new Mesh(hubGeo, carbonMetal);
  hub.name = 'sonobolt-hub';
  hub.position.set(layout.coilX, 0, layout.coilZ);
  group.add(hub);
  const hubCap = new Mesh(new TorusGeometry(hr - 0.035, 0.006, 6, seg(96)), machinedAlloy);
  hubCap.name = 'sonobolt-hub-chamfer';
  hubCap.rotation.x = -Math.PI / 2;
  hubCap.position.set(layout.coilX, 0.441, layout.coilZ);
  group.add(hubCap);

  const status = new Mesh(new TorusGeometry(R + 0.12, 0.0065, 8, seg(192)), statusMat);
  status.name = 'sonobolt-status';
  status.rotation.x = -Math.PI / 2;
  status.position.set(layout.coilX, 0.004, layout.coilZ);
  group.add(status);

  // ---- Contact shadow under the coil (high tier, ladder level 0) ----
  const shadowUniforms = { uOpacity: { value: 0 } };
  const shadow = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({ vertexShader: SHADOW_VERTEX, fragmentShader: SHADOW_FRAGMENT, uniforms: shadowUniforms, transparent: true, depthWrite: false }),
  );
  shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(layout.coilX, 0.002, layout.coilZ);
  group.add(shadow);
  let shadowEnabled = true;

  return {
    group,
    setRuler(shift, beatLength, opacity, visibleTo) {
      rulerUniforms.uShift.value = shift;
      rulerUniforms.uBeat.value = beatLength;
      rulerUniforms.uOpacity.value = opacity;
      rulerUniforms.uVisibleTo.value = visibleTo;
      ruler.visible = opacity > 0;
    },
    setStatus(level) {
      statusMat.color.copy(RHODAMINE).multiplyScalar(level);
    },
    setShadow(opacity, radius) {
      shadowUniforms.uOpacity.value = opacity;
      shadow.scale.set(radius * 2, radius * 2, 1);
      shadow.visible = shadowEnabled && opacity > 0;
    },
    setShadowEnabled(enabled) {
      shadowEnabled = enabled;
      if (!enabled) shadow.visible = false;
    },
  };
}
