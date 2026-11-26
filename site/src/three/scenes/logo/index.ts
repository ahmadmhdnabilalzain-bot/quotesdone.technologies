/**
 * Scene 1 'Assembly' (structure-v1 §2.2 scene 1, §2.2.2): the 43 stroke parts of the official
 * wordmark as machined Alloy bars on the Carbon void. Progress map and rules: README.md.
 *
 * World units: CSS px of the stage at the z = 0 plane (y up, stage top-left at the origin), so the
 * rest frame lands exactly on the DOM SVG box and the end frame exactly on the header logo box.
 * Wordmark-local units: SVG px of the viewBox (y up), scaled by the group.
 *
 * Rhodamine rule (§2.2.2) by construction: the scene has ONE light, neutral white, and a neutral
 * PMREM environment; no material here is Rhodamine. The Rhodamine datum is the DOM line (AgX cannot
 * display Rhodamine exactly, see agx.ts), so nothing pink can light or reflect on the wordmark.
 * Wordmark meshes are also put on LAYER_WORDMARK so a future pass can isolate them; three.js does
 * not filter lights per object layer, so the guarantee is the construction above (unit-tested).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene as ThreeScene,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { LOGO_PARAMS, type LogoParams } from './params.ts';
import { explodeAt, hash01, lerp, poseAt, sealForWidth, type Pose } from './choreography.ts';
import { logoLayoutVersion, resolveLogoLayout, WORDMARK_VIEWBOX, type LogoLayout } from './layout.ts';
import { inverseAgx } from './agx.ts';
import type { LogoAsset, LogoPart } from './parts.ts';

export const LAYER_WORDMARK = 1;
/** Brand colours as LINEAR scene values that the AgX post pass displays as the brand sRGB. */
export const BRAND = { alloy: '#ECEAE4', mist: '#8A8F97' } as const;
/** Line-1 cap height in SVG px (strokes.json: 100 units x 4 px). */
const CAP_PX = 400;
/** The presenter's vignette strength when the tier has one (presenter.ts uVignette). */
const PRESENTER_VIGNETTE = 0.22;

export interface LogoSceneOptions {
  /** Where the parts come from. Default: fetch /3d/logo.glb and decode with the self-hosted meshopt decoder. */
  loadAsset?: (ctx: SceneContext) => Promise<LogoAsset>;
}

async function fetchAsset(ctx: SceneContext): Promise<LogoAsset> {
  const [{ meshoptDecoder }, { parseLogoGlb }] = await Promise.all([import('../../runtime/loader.ts'), import('./parts.ts')]);
  const url = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/3d/logo.glb`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const [buffer, decoder] = await Promise.all([response.arrayBuffer(), meshoptDecoder()]);
  const asset = await parseLogoGlb(buffer, decoder);
  ctx.log.info(`logo.glb ${(buffer.byteLength / 1024).toFixed(1)} KB, ${asset.parts.length} parts, source ${asset.sourceHash.slice(0, 8)}`);
  return asset;
}

/** Per-part motion, derived once from the glb data (pure function of the part and the params). */
interface PartRig {
  part: LogoPart;
  group: Group;
  mesh: Mesh;
  /** Seated position, wordmark-local (SVG px, y up). */
  seat: Vector3;
  /** Full explode offset, wordmark-local. */
  offset: Vector3;
  /** Tether anchors (wordmark-local, seated): joints, or the pivot for parts without joints. */
  anchors: Vector3[];
}

interface Rig {
  parts: PartRig[];
  leaders: LineSegments;
  leaderPositions: BufferAttribute;
  /** Unique joint seats for the tick crosses (wordmark-local). */
  ticks: Vector3[];
  wordmarkMaterial: MeshStandardMaterial;
  leaderMaterial: LineBasicMaterial;
  uniforms: {
    uSeal: { value: number };
    uFlat: { value: number };
    uFlatColor: { value: Color };
    uTargetPx: { value: [number, number] };
    uVignette: { value: number };
  };
}

export function createLogoScene(options: LogoSceneOptions = {}): RenderableScene {
  const params: LogoParams = structuredClone(LOGO_PARAMS);
  const object3d = new ThreeScene();
  const camera = new PerspectiveCamera(params.fovDeg.value, 1, 1, 20000);
  camera.layers.enable(LAYER_WORDMARK);
  const wordmark = new Group();
  wordmark.name = 'wordmark';
  const key = new DirectionalLight(0xffffff, params.keyIntensity.value);
  key.name = 'key';
  const keyTarget = new Object3D();
  key.target = keyTarget;

  let rig: Rig | null = null;
  let view: Viewport = { width: 1440, height: 900, aspect: 1.6, dir: 'ltr', pixelRatio: 1 };
  let layout: LogoLayout = resolveLogoLayout(view.width, view.height);
  let layoutVersion = -1;
  let log: SceneContext['log'] | null = null;
  // Scratch objects (reused every frame; values are always fully recomputed, never accumulated).
  const tmp = new Vector3();
  const centre = new Vector3();
  const restPos = new Vector3();
  const restTarget = new Vector3();
  const q = new Quaternion();
  const qPitch = new Quaternion();
  const axisX = new Vector3(1, 0, 0);
  const axisY = new Vector3(0, 1, 0);

  const refreshLayout = (): void => {
    const next = logoLayoutVersion();
    if (next === layoutVersion && layout.stageWidth === view.width && layout.stageHeight === view.height) return;
    layoutVersion = next;
    layout = resolveLogoLayout(view.width, view.height);
    log?.debug(`layout (${layout.source}) hero ${fmtBox(layout.hero)} dock ${fmtBox(layout.dock)}`);
  };

  const scene: RenderableScene = {
    id: 'logo',
    params,
    stillAt: [0, 0.35, 0.6, 0.9],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      log = ctx.log;
      const asset = await (options.loadAsset ?? fetchAsset)(ctx);
      await ctx.yieldToMain();
      if (asset.parts.length !== 43) throw new Error(`logo: expected 43 parts, got ${asset.parts.length}`);

      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = params.envIntensity.value;
      object3d.add(key, keyTarget, wordmark);

      const alloy = inverseAgx(BRAND.alloy);
      const mist = inverseAgx(BRAND.mist);
      const uniforms: Rig['uniforms'] = {
        uSeal: { value: 0 },
        uFlat: { value: 1 },
        uFlatColor: { value: new Color().setRGB(...alloy.linear) },
        uTargetPx: { value: [1, 1] },
        uVignette: { value: ctx.tierConfig.vignette ? PRESENTER_VIGNETTE : 0 },
      };
      // Bead-blasted Alloy. Base colour = Alloy's linear value capped to albedo range.
      const wordmarkMaterial = new MeshStandardMaterial({
        color: new Color(BRAND.alloy),
        metalness: 1,
        roughness: params.roughness.value,
      });
      wordmarkMaterial.name = 'logo-alloy';
      wordmarkMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => patchWordmarkShader(shader, uniforms);
      wordmarkMaterial.customProgramCacheKey = () => 'logo-alloy-v1';

      const parts: PartRig[] = [];
      const tickKeys = new Set<string>();
      const ticks: Vector3[] = [];
      for (const part of asset.parts) {
        const mesh = new Mesh(part.geometry, wordmarkMaterial);
        mesh.name = part.id;
        mesh.layers.set(LAYER_WORDMARK);
        const group = new Group();
        group.name = `part:${part.id}`;
        group.add(mesh);
        wordmark.add(group);
        const seat = new Vector3(part.pivot[0], -part.pivot[1], 0);
        const offset = explodeOffset(part, params);
        const anchors = part.joints.length > 0 ? part.joints.map((j) => new Vector3(j.x, -j.y, 0)) : part.line === 'QUOTESDONE' ? [seat.clone()] : [];
        for (const j of part.joints) {
          const keyId = [part.id, j.with].sort().join('|');
          if (tickKeys.has(keyId)) continue;
          tickKeys.add(keyId);
          ticks.push(new Vector3(j.x, -j.y, 0));
        }
        parts.push({ part, group, mesh, seat, offset, anchors });
      }

      // Hairline leaders (2 vertices per tether) + tick crosses (4 vertices per joint).
      const tetherCount = parts.reduce((n, p) => n + p.anchors.length, 0);
      const leaderPositions = new BufferAttribute(new Float32Array((tetherCount * 2 + ticks.length * 4) * 3), 3);
      leaderPositions.setUsage(DynamicDrawUsage);
      const leaderGeometry = new BufferGeometry();
      leaderGeometry.setAttribute('position', leaderPositions);
      const leaderMaterial = new LineBasicMaterial({
        color: new Color().setRGB(...mist.linear),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      leaderMaterial.name = 'logo-leaders';
      const leaders = new LineSegments(leaderGeometry, leaderMaterial);
      leaders.name = 'leaders';
      leaders.frustumCulled = false;
      wordmark.add(leaders);

      rig = { parts, leaders, leaderPositions, ticks, wordmarkMaterial, leaderMaterial, uniforms };
      ctx.log.info(`logo rig: ${parts.length} parts, ${tetherCount} leaders, ${ticks.length} joints; alloy AgX error ${alloy.error255.toFixed(2)}/255`);
    },

    update(progress: number, timeMs: number) {
      if (!rig) return;
      refreshLayout();
      const pose = poseAt(progress, params);
      applyPose(rig, pose, progress, timeMs);
    },

    resize(next: Viewport) {
      view = next;
      camera.aspect = next.aspect;
      camera.fov = params.fovDeg.value;
      camera.updateProjectionMatrix();
      if (rig) rig.uniforms.uTargetPx.value = [Math.max(1, Math.round(next.width * next.pixelRatio)), Math.max(1, Math.round(next.height * next.pixelRatio))];
      layoutVersion = -1;
      refreshLayout();
    },

    dispose() {
      object3d.environment = null; // owned by the runtime
      disposeObject3D(object3d);
      rig = null;
    },
  };

  /** Everything in one frame, recomputed from (pose, progress, time). */
  function applyPose(r: Rig, pose: Pose, progress: number, timeMs: number): void {
    wordmark.visible = pose.visible;
    if (!pose.visible) return;

    // ---- Wordmark box: hero -> dock (centre linear, scale geometric: a constant-feeling zoom) ----
    const heroScale = layout.hero.width / WORDMARK_VIEWBOX.width;
    const dockScale = layout.dock.width / WORDMARK_VIEWBOX.width;
    const scale = heroScale * Math.pow(dockScale / heroScale, pose.dock);
    const cx = lerp(layout.hero.x + layout.hero.width / 2, layout.dock.x + layout.dock.width / 2, pose.dock);
    const cy = lerp(layout.hero.y + layout.hero.height / 2, layout.dock.y + layout.dock.height / 2, pose.dock);
    const renderedWidth = scale * WORDMARK_VIEWBOX.width;
    wordmark.scale.set(scale, scale, scale);
    wordmark.position.set(cx - renderedWidth / 2, -(cy - (scale * WORDMARK_VIEWBOX.height) / 2), 0);

    // ---- Parts ----
    const depth = Math.max(1e-3, pose.depth);
    for (const rp of r.parts) {
      const e = explodeAt(progress, rp.part.order, r.parts.length, params);
      rp.group.position.copy(rp.seat).addScaledVector(rp.offset, e);
      rp.mesh.scale.set(1, 1, depth);
    }

    // ---- Material: flat Alloy (= the SVG) <-> lit metal; joints close below sealWidthPx ----
    r.uniforms.uFlat.value = 1 - pose.lit;
    r.uniforms.uSeal.value = sealForWidth(renderedWidth, params);

    // ---- Leaders and ticks ----
    const opacity = params.leaderOpacity.value * pose.leaders;
    r.leaderMaterial.opacity = opacity;
    r.leaders.visible = opacity > 0.002;
    if (r.leaders.visible) writeLeaders(r, progress, params.tickSizePx.value / scale);

    // ---- Camera: rest frame = the stage, front-on; rake = orbit around the wordmark centre ----
    const halfFov = (params.fovDeg.value * Math.PI) / 360;
    const distance = view.height / 2 / Math.tan(halfFov);
    restPos.set(view.width / 2, -view.height / 2, distance);
    restTarget.set(view.width / 2, -view.height / 2, 0);
    // Orbit centre: line 1's centre (the heavy line carries the 3D), in world units.
    centre.set(cx, -(cy - (scale * WORDMARK_VIEWBOX.height) * 0.18), 0);
    const yaw = pose.rake * (params.rakeYaw.value + params.explodeYaw.value * smoothDrift(pose.drift));
    const pitch = pose.rake * params.rakePitch.value;
    q.setFromAxisAngle(axisY, yaw);
    qPitch.setFromAxisAngle(axisX, -pitch);
    q.multiply(qPitch);
    tmp.copy(restPos).sub(centre).applyQuaternion(q).multiplyScalar(1 - params.rakeDolly.value * pose.rake);
    camera.position.copy(centre).add(tmp);
    // The target offset rotates with the orbit (not shrunk), so the wordmark keeps its place on
    // screen and never swings over the H1 below it.
    tmp.copy(restTarget).sub(centre).applyQuaternion(q).multiplyScalar(1 - params.rakeDolly.value * pose.rake);
    camera.up.set(0, 1, 0);
    camera.lookAt(tmp.add(centre));
    camera.updateMatrixWorld();

    // ---- Key light: neutral, raking; sweeps with progress plus a slow time drift ----
    const sweep = params.sweepAmplitude.value * Math.sin((timeMs / 1000 / params.sweepPeriodS.value) * Math.PI * 2) * pose.lit;
    const azimuth = lerp(params.keyAzimuthFrom.value, params.keyAzimuthTo.value, smoothDrift(pose.drift)) + sweep;
    const elevation = params.keyElevation.value;
    keyTarget.position.copy(centre);
    key.position.set(
      centre.x + Math.sin(azimuth) * Math.cos(elevation) * 4000,
      centre.y + Math.sin(elevation) * 4000,
      Math.cos(azimuth) * Math.cos(elevation) * 4000,
    );
    key.intensity = params.keyIntensity.value * pose.lit;
    key.updateMatrixWorld();
    keyTarget.updateMatrixWorld();
  }

  function writeLeaders(r: Rig, progress: number, tick: number): void {
    const arr = r.leaderPositions.array as Float32Array;
    let i = 0;
    const put = (v: Vector3): void => {
      arr[i++] = v.x;
      arr[i++] = v.y;
      arr[i++] = v.z;
    };
    for (const rp of r.parts) {
      const e = explodeAt(progress, rp.part.order, r.parts.length, params);
      for (const a of rp.anchors) {
        put(a);
        tmp.copy(a).addScaledVector(rp.offset, e);
        put(tmp);
      }
    }
    for (const t of r.ticks) {
      put(tmp.set(t.x - tick, t.y, 0));
      put(tmp.set(t.x + tick, t.y, 0));
      put(tmp.set(t.x, t.y - tick, 0));
      put(tmp.set(t.x, t.y + tick, 0));
    }
    r.leaderPositions.needsUpdate = true;
  }

  return scene;
}

/** Slow in-out drift for camera and light across the exploded view. */
function smoothDrift(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Full explode offset of one part, wordmark-local (SVG px, y up). Engineering-drawing rules:
 * translate only, never rotate; out of the joint along the joint normal, then forward in depth.
 * Parts without joints (Q, U, O) lift; line 2 is fused (no joints) and recedes behind line 1.
 */
export function explodeOffset(part: Pick<LogoPart, 'order' | 'line' | 'explode' | 'joints'>, params: LogoParams): Vector3 {
  const h = hash01(7, part.order);
  if (part.line === 'TECHNOLOGIES') {
    return new Vector3(0, 0, -params.line2Recede.value * CAP_PX * (0.45 + 0.55 * h));
  }
  const z = lerp(params.explodeDepthMin.value, params.explodeDepthMax.value, h) * CAP_PX;
  if (part.joints.length === 0) return new Vector3(0, params.jointlessLift.value * CAP_PX * (0.6 + 0.4 * h), z);
  const spread = params.explodeSpread.value * CAP_PX;
  return new Vector3(part.explode[0] * spread, -part.explode[1] * spread, z);
}

/**
 * Shader additions to the Alloy material:
 * - vertex: `_seal` (SVG px) * uSeal closes the joints (seal 1 = compact cut overlap).
 * - fragment: mix to the flat Alloy fill by uFlat. The flat colour is pre-divided by the
 *   presenter's vignette at this pixel, so the post pass gives back exactly Alloy everywhere
 *   (the dock target sits in the stage corner, where the vignette is strongest).
 */
function patchWordmarkShader(shader: WebGLProgramParametersWithUniforms, uniforms: Rig['uniforms']): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 _seal;\nuniform float uSeal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xy += _seal * uSeal;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uFlat;\nuniform vec3 uFlatColor;\nuniform vec2 uTargetPx;\nuniform float uVignette;')
    .replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      vec2 qdtUv = gl_FragCoord.xy / uTargetPx - 0.5;
      float qdtVignette = 1.0 - uVignette * smoothstep(0.35, 0.85, length(qdtUv));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlatColor / max(qdtVignette, 0.05), uFlat);`,
    );
}

function fmtBox(b: { x: number; y: number; width: number; height: number }): string {
  return `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`;
}

export default createLogoScene;
