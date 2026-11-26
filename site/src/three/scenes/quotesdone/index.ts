/**
 * Scene 4, QuotesDone "Sealed" (structure-v1 §2.2 row 4, §2.2.1).
 *
 * One milled Alloy block splits into five identical sealed plates. Each plate carries a thin dark
 * cover in a machined track (two rails). The plates deal out into a row to be compared, one key
 * light passes along them, then one plate advances, its cover slides along the track and the
 * others dim and fall back. The open face shows only the hub's engraved datum line, lit from
 * inside by a Rhodamine filament (Rhodamine is light only, structure-v1 §2.2). No text, no data,
 * no textures, no teal or gold.
 *
 * Structure: `timeline.ts` turns (progress, time) into plain numbers (pure, unit-tested);
 * this file builds the meshes once and copies those numbers onto them in update().
 * Every tunable number lives in `params.ts`. Progress map: README.md.
 */
import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene as ThreeScene,
  ShaderMaterial,
  SpotLight,
  type BufferGeometry,
  type CubeTexture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import type { QualityLevel } from '../../runtime/ladder.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { PLATE_COUNT, SEALED_PARAMS, type SealedParams } from './params.ts';
import { sealedPose } from './timeline.ts';
import { kelvinToColor } from './color.ts';
import { createStudioCube, type StudioOptions } from './studio.ts';
import {
  CONTACT_SHADOW_FRAGMENT,
  CONTACT_SHADOW_VERTEX,
  FLOOR_DATUM_FRAGMENT,
  FLOOR_DATUM_VERTEX,
  LIGHT_POOL_FRAGMENT,
  LIGHT_POOL_VERTEX,
} from './shaders.ts';

/** Brand palette (brand/logo/README.md). Rhodamine is used only as emitted light. */
export const ALLOY = new Color('#ECEAE4');
export const RHODAMINE = new Color('#E3185B');
/**
 * Cover: bead-blasted anodised metal in Graphite (brand palette). Deliberately NOT a dark glossy
 * panel: a black face in a thin silver frame reads as a phone or tablet (structure-v1 §2.2.3).
 */
export const COVER = new Color('#5E636B');
const ENGRAVE = new Color('#0E1013');
const DEG = Math.PI / 180;

/** Names used by tests and by `object3d.getObjectByName` while debugging. */
export const NAMES = {
  plate: (i: number) => `plate-${i}`,
  body: (i: number) => `plate-${i}-body`,
  cover: (i: number) => `plate-${i}-cover`,
  engraving: (i: number) => `plate-${i}-engraving`,
  shadow: (i: number) => `plate-${i}-shadow`,
  filament: 'datum-filament',
  floorDatum: 'floor-datum',
  pool: 'light-pool',
  notch: (i: number) => `plate-${i}-notch`,
  key: 'key-light',
} as const;

interface PlateParts {
  group: Group;
  bodyMaterial: MeshPhysicalMaterial;
  coverMaterial: MeshPhysicalMaterial;
  cover: Mesh;
  shadow: Mesh;
  shadowMaterial: ShaderMaterial;
}

/**
 * Plate body = rounded slab + a U-shaped track (left lip, right lip, bottom lip) on the front face,
 * merged into one draw. The cover runs up and out of the open top of the track, so in the block
 * every side the visitor sees is Alloy and the joints read as hairlines.
 */
function buildBodyGeometry(params: SealedParams, segments: number): BufferGeometry {
  const v = (k: keyof SealedParams): number => params[k].value;
  const W = v('plateWidth');
  const H = v('plateHeight');
  const T = v('plateDepth');
  const lip = v('lipWidth');
  const depth = v('trackDepth');
  const slab = new RoundedBoxGeometry(W, H, T, segments, v('plateBevel'));
  const lipBevel = Math.min(depth, lip) * 0.35;
  const lipSegments = Math.max(2, segments - 1);
  // Lips are half buried in the slab (depth * 2, centred on the face) so no back seam can show.
  const left = new RoundedBoxGeometry(lip, H, depth * 2, lipSegments, lipBevel);
  const right = left.clone();
  const bottom = new RoundedBoxGeometry(W, lip, depth * 2, lipSegments, lipBevel);
  left.translate(-W / 2 + lip / 2, 0, T / 2);
  right.translate(W / 2 - lip / 2, 0, T / 2);
  bottom.translate(0, -H / 2 + lip / 2, T / 2);
  const parts = [slab, left, right, bottom];
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error('quotesdone: plate body merge failed');
  return merged;
}

/** The studio the metal reflects: one softbox key, a faint bounce card, dark walls. */
export function studioOptions(params: SealedParams): StudioOptions {
  const v = (k: keyof SealedParams): number => params[k].value;
  const az = v('softboxAzimuth') * DEG;
  const el = v('softboxElevation') * DEG;
  return {
    size: v('studioSize'),
    ambientTop: v('studioAmbient'),
    ambientFloor: v('studioAmbient') * 0.25,
    lights: [
      {
        // x is negated: three samples CubeTextures mirrored in x (flipEnvMap), so this keeps
        // "negative azimuth = leading (-x) side" true in the rendered reflection.
        dir: [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)],
        halfWidth: v('softboxWidth'),
        halfHeight: v('softboxHeight'),
        soft: 0.14,
        radiance: v('softboxRadiance'),
      },
      { dir: [-0.85, 0.25, -0.5], halfWidth: 0.05, halfHeight: 1.2, soft: 0.04, radiance: v('kickerRadiance') },
    ],
  };
}

function coverSize(params: SealedParams): { width: number; height: number; depth: number } {
  const v = (k: keyof SealedParams): number => params[k].value;
  return {
    width: v('plateWidth') - 2 * (v('lipWidth') + v('coverClearance')),
    height: v('plateHeight') - v('lipWidth') - v('coverClearance'),
    depth: v('trackDepth') * 0.8,
  };
}

/** The engraved datum mark: one horizontal groove with a short origin tick through its centre. */
function buildEngravingGeometry(params: SealedParams): BufferGeometry {
  const v = (k: keyof SealedParams): number => params[k].value;
  const W = v('plateWidth');
  const depth = 0.0016;
  const line = new BoxGeometry(W * v('engraveLength'), v('engraveWidth'), depth);
  const tick = new BoxGeometry(v('engraveWidth'), Math.max(v('engraveWidth'), v('tickLength')), depth);
  const merged = mergeGeometries([line.toNonIndexed(), tick.toNonIndexed()], false);
  line.dispose();
  tick.dispose();
  if (!merged) throw new Error('quotesdone: engraving merge failed');
  return merged;
}

/**
 * A thumb notch at the top edge of each cover: a half-disc pocket that says "this slides out",
 * without words. (Parallel grip lines were tried and read as a menu icon, so they were dropped.)
 */
function buildNotchGeometry(params: SealedParams): BufferGeometry {
  const r = params.notchRadius.value;
  const notch = new CircleGeometry(r, 24, Math.PI, Math.PI); // lower half-disc, flat side up
  return notch;
}

export function createQuotesDoneScene(): RenderableScene {
  const params = structuredClone(SEALED_PARAMS);
  const object3d = new ThreeScene();
  const camera = new PerspectiveCamera(params.fov.value, 1, 0.1, 80);
  const plates: PlateParts[] = [];
  let filament: Mesh | null = null;
  let pool: Mesh | null = null;
  let poolMaterial: ShaderMaterial | null = null;
  let filamentMaterial: MeshBasicMaterial | null = null;
  let key: SpotLight | null = null;
  let keyTarget: Object3D | null = null;
  let tierAllowsShadow = false;
  let ladderAllowsShadow = true;
  let dir: 'ltr' | 'rtl' = 'ltr';
  let aspect = 1;
  let envIntensity = params.envIntensity.value;
  let studio: CubeTexture | null = null;
  let coverHeight = 1;
  let coverRestY = 0;
  const tmp = new Color();

  const v = (k: keyof SealedParams): number => params[k].value;

  const applyShadowVisibility = (): void => {
    for (const plate of plates) plate.shadow.visible = tierAllowsShadow && ladderAllowsShadow;
  };

  const scene: RenderableScene = {
    id: 'quotesdone',
    params,
    stillAt: [0, 0.3, 0.9],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      // Reflections come from this scene's own studio (studio.ts); the runtime's neutral room is
      // only the fallback if building the studio fails. Per-material envMapIntensity dims plates.
      try {
        studio = createStudioCube(studioOptions(params));
      } catch (error) {
        ctx.log.warn('studio cube failed; using the neutral room', error);
        studio = null;
      }
      object3d.environment = studio ? null : ctx.envMap;
      envIntensity = v('envIntensity');
      tierAllowsShadow = ctx.tierConfig.contactShadow;
      const segments = Math.max(2, Math.round(5 * ctx.tierConfig.detail));

      // Shared geometry: the five plates are literally the same object, five times.
      const bodyGeometry = buildBodyGeometry(params, segments);
      const { width: cw, height: ch, depth: cd } = coverSize(params);
      coverHeight = ch;
      // Top of the cover is flush with the top of the plate; its foot rests on the bottom lip.
      coverRestY = v('plateHeight') / 2 - ch / 2;
      const coverGeometry = new RoundedBoxGeometry(cw, ch, cd, Math.max(2, segments - 1), Math.min(0.008, cd * 0.4));
      const engravingGeometry = buildEngravingGeometry(params);
      const shadowGeometry = new PlaneGeometry(1, 1);
      const engravingMaterial = new MeshPhysicalMaterial({ color: ENGRAVE, metalness: 0.6, roughness: 0.75 });
      const notchGeometry = buildNotchGeometry(params);
      await ctx.yieldToMain();

      const T = v('plateDepth');
      for (let i = 0; i < PLATE_COUNT; i++) {
        const group = new Group();
        group.name = NAMES.plate(i);

        const bodyMaterial = new MeshPhysicalMaterial({ color: ALLOY, metalness: 1, roughness: v('alloyRoughness'), envMap: studio, envMapIntensity: envIntensity });
        const body = new Mesh(bodyGeometry, bodyMaterial);
        body.name = NAMES.body(i);

        const coverMaterial = new MeshPhysicalMaterial({
          color: COVER,
          metalness: 1,
          roughness: v('coverRoughness'),
          envMap: studio,
          envMapIntensity: envIntensity,
        });
        const cover = new Mesh(coverGeometry, coverMaterial);
        cover.name = NAMES.cover(i);
        cover.position.set(0, coverRestY, T / 2 + cd / 2 + 0.0005);

        const engraving = new Mesh(engravingGeometry, engravingMaterial);
        engraving.name = NAMES.engraving(i);
        engraving.position.z = T / 2 + 0.0008;

        const notch = new Mesh(notchGeometry, engravingMaterial);
        notch.name = NAMES.notch(i);
        notch.position.set(0, ch / 2 - 0.004, cd / 2 + 0.0008);
        cover.add(notch);

        group.add(body, cover, engraving);
        object3d.add(group);

        const shadowMaterial = new ShaderMaterial({
          vertexShader: CONTACT_SHADOW_VERTEX,
          fragmentShader: CONTACT_SHADOW_FRAGMENT,
          uniforms: {
            uOpacity: { value: v('shadowOpacity') },
            // Footprint half-size inside the unit plane (the plane is scaled to footprint + blur).
            uHalf: { value: [0.5 * (v('plateWidth') / (v('plateWidth') + 0.5)), 0.5 * ((T + v('trackDepth')) / (T + 0.5))] },
          },
          transparent: true,
          depthWrite: false,
        });
        const shadow = new Mesh(shadowGeometry, shadowMaterial);
        shadow.name = NAMES.shadow(i);
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set(v('plateWidth') + 0.5, T + 0.5, 1);
        shadow.position.y = 0.002;
        shadow.renderOrder = -1;
        object3d.add(shadow);

        plates.push({ group, bodyMaterial, coverMaterial, cover, shadow, shadowMaterial });
      }
      applyShadowVisibility();
      await ctx.yieldToMain();

      // The datum filament: light inside the opened plate's engraved line. One mesh, re-parented
      // to whichever plate is chosen in update() (it never changes for a given direction).
      filamentMaterial = new MeshBasicMaterial({ color: RHODAMINE.clone().multiplyScalar(v('datumGlow')) });
      filament = new Mesh(new BoxGeometry(v('plateWidth') * v('engraveLength'), v('engraveWidth') * 0.45, 0.001), filamentMaterial);
      filament.name = NAMES.filament;
      filament.position.z = T / 2 + 0.0018;
      filament.visible = false;
      object3d.add(filament);

      // The hairline datum on the floor: the rail the products sit on. Ends fade so it never
      // meets the stage edge as a hard cut.
      const floorDatum = new Mesh(
        new PlaneGeometry(v('rowSpacing') * (PLATE_COUNT + 2.4), 0.008),
        new ShaderMaterial({
          vertexShader: FLOOR_DATUM_VERTEX,
          fragmentShader: FLOOR_DATUM_FRAGMENT,
          uniforms: { uColor: { value: RHODAMINE.clone() }, uOpacity: { value: v('floorDatumOpacity') } },
          transparent: true,
          depthWrite: false,
        }),
      );
      floorDatum.name = NAMES.floorDatum;
      floorDatum.rotation.x = -Math.PI / 2;
      floorDatum.position.set(0, 0.001, T / 2 + 0.32);
      object3d.add(floorDatum);

      // The light pool: where the key lands on the (invisible) Carbon floor. It is the visible
      // falloff of the one light, and it follows the light onto the chosen plate.
      poolMaterial = new ShaderMaterial({
        vertexShader: LIGHT_POOL_VERTEX,
        fragmentShader: LIGHT_POOL_FRAGMENT,
        uniforms: { uColor: { value: kelvinToColor(v('keyColorKelvin')) }, uIntensity: { value: v('poolIntensity') } },
        transparent: true,
        depthWrite: false,
      });
      pool = new Mesh(new PlaneGeometry(1, 1), poolMaterial);
      pool.name = NAMES.pool;
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.0005;
      pool.renderOrder = -2;
      object3d.add(pool);

      // One physically-motivated key: a soft spot, high and to the leading side.
      key = new SpotLight(kelvinToColor(v('keyColorKelvin')), v('keyIntensity'), 0, v('keyAngleWide') * DEG, v('keyPenumbra'), 2);
      key.name = NAMES.key;
      keyTarget = new Object3D();
      key.target = keyTarget;
      object3d.add(key, keyTarget, new AmbientLight(0xffffff, 0.015));
      await ctx.yieldToMain();
    },

    // Pure: every value is recomputed from (progress, timeMs) and the stored viewport.
    update(progress: number, timeMs: number) {
      const pose = sealedPose(progress, timeMs, params, dir, aspect);
      for (let i = 0; i < plates.length; i++) {
        const plate = plates[i]!;
        const pp = pose.plates[i]!;
        plate.group.position.set(pp.x, pp.y, pp.z);
        plate.bodyMaterial.color.copy(tmp.copy(ALLOY).multiplyScalar(0.55 + 0.45 * pp.brightness));
        plate.bodyMaterial.envMapIntensity = envIntensity * pp.brightness;
        plate.coverMaterial.color.copy(tmp.copy(COVER).multiplyScalar(0.55 + 0.45 * pp.brightness));
        plate.coverMaterial.envMapIntensity = envIntensity * pp.brightness;
        plate.bodyMaterial.envMapRotation.y = pose.envYaw;
        plate.coverMaterial.envMapRotation.y = pose.envYaw;
        // The cover rises along the side tracks, out of the open top, and stays engaged.
        plate.cover.position.y = coverRestY + pp.cover * coverHeight * v('coverTravel');
        plate.shadow.position.set(pp.x, 0.002, pp.z);
        plate.shadowMaterial.uniforms.uOpacity!.value = v('shadowOpacity') * pp.shadow * (0.45 + 0.55 * pp.brightness);
      }

      if (filament) {
        const host = plates[pose.chosen]?.group;
        if (host && filament.parent !== host) host.add(filament);
        filament.visible = pose.datum > 0.001;
        filament.scale.set(Math.max(0.001, pose.datum), 1, 1);
      }

      if (pool && poolMaterial) {
        // Pool radius follows the cone: wide over the row, tight under the chosen plate.
        const radius = Math.tan(pose.key.angleDeg * DEG) * v('poolThrow');
        pool.scale.set(radius * 2.6, radius * 1.6, 1);
        pool.position.set(pose.key.target[0], 0.0005, pose.key.target[2] + 0.35);
        poolMaterial.uniforms.uIntensity!.value = v('poolIntensity');
      }

      if (key && keyTarget) {
        const sign = dir === 'rtl' ? -1 : 1;
        key.position.set(-3.6 * sign, 5.4, 5.2);
        key.angle = pose.key.angleDeg * DEG;
        key.intensity = pose.key.intensity;
        keyTarget.position.set(...pose.key.target);
        keyTarget.updateMatrixWorld();
      }

      camera.position.set(...pose.camera.position);
      camera.lookAt(...pose.camera.target);
    },

    resize(view: Viewport) {
      aspect = view.aspect > 0 ? view.aspect : 1;
      dir = view.dir;
      camera.aspect = aspect;
      camera.fov = v('fov');
      camera.updateProjectionMatrix();
    },

    applyQuality(level: QualityLevel) {
      ladderAllowsShadow = level.contactShadow;
      applyShadowVisibility();
    },

    dispose() {
      // The env map belongs to the runtime. Put the filament back in the graph so it is freed too.
      object3d.environment = null;
      if (filament && filament.parent !== object3d) object3d.add(filament);
      disposeObject3D(object3d);
      plates.length = 0;
      studio = null; // freed by disposeObject3D through the materials' envMap
      filament = null;
      pool = null;
      poolMaterial = null;
      filamentMaterial = null;
      key = null;
      keyTarget = null;
    },
  };
  return scene;
}

export default createQuotesDoneScene;
