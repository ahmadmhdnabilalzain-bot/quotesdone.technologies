/**
 * Scene 8, Close (structure-v1 §2.2 row 8): the rail ends in an end cap, the Q mark, seated on
 * the line. The Q lowers onto the end-cap block and seats, the key light swings from a raking
 * angle to rest, the Rhodamine datum dims and goes out before it could ever sit beside the mark,
 * and the canvas fades to Carbon before the footer. The contact call is DOM text beside it.
 *
 * Pure: update(progress, timeMs) derives every transform from its inputs. Time is not used: the
 * close is a still, quiet frame once the visitor stops scrolling.
 */
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  PointLight,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene as ThreeScene,
} from 'three';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import type { QualityLevel } from '../../runtime/ladder.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { CLOSE_PARAMS } from './params.ts';
import { buildMarkGeometry, markShapes, svgLoaderParser, tailStartX, type SvgPathParser } from './mark.ts';
import {
  alloyMaterial,
  anodisedMaterial,
  createContactShadow,
  createFadePass,
  DATUM_Y,
  datumMaterial,
  easeSeat,
  easeTravel,
  lerp,
  railBar,
  segment,
  worldPerDevicePixel,
} from './shared.ts';

export interface CloseSceneOptions {
  /** SVG parser for the mark. Default: three's SVGLoader (browser). Tests inject a Node parser. */
  parseSvg?: SvgPathParser;
}

/** Names of objects other code (tests, debug) looks up. */
export const CLOSE_NAMES = {
  mark: 'close-mark',
  markPivot: 'close-mark-pivot',
  rail: 'close-rail',
  endCap: 'close-end-cap',
  datum: 'close-datum',
  datumTick: 'close-datum-tick',
  key: 'close-key-light',
} as const;

export function createCloseScene(options: CloseSceneOptions = {}): RenderableScene {
  const parseSvg = options.parseSvg ?? svgLoaderParser;
  const params = structuredClone(CLOSE_PARAMS);
  const object3d = new ThreeScene();
  object3d.name = 'close';
  const camera = new PerspectiveCamera(params.fov.value, 1, 0.1, 80);
  const world = new Group(); // mirrored on X for RTL (the rail then runs in from inline-start = right)
  const markPivot = new Group();
  markPivot.name = CLOSE_NAMES.markPivot;
  // Key: a point light close to the mark, so flat faces get a falloff gradient (a photographic
  // key) instead of one flat value. It orbits from raking to rest.
  const key = new PointLight(0xffffff, params.keyIntensity.value, 0, 2);
  key.name = CLOSE_NAMES.key;
  const rim = new DirectionalLight(0xdfe6ee, params.rimIntensity.value);

  let datum: Mesh | null = null;
  let tick: Mesh | null = null;
  let datumMat: ReturnType<typeof datumMaterial> | null = null;
  let shadow: ReturnType<typeof createContactShadow> | null = null;
  const fade = createFadePass();
  let tierAllowsShadow = false;
  let ladderAllowsShadow = true;
  let markCentreY = 0.45;
  let markCentreX = -0.4;
  let markWidth = 0.8;
  /** Length of the end-cap block (tail run + endCapExtra). */
  let capLength = 0.6;
  let dirSign = 1;
  let aspect = 1;
  let viewHeight = 1;
  let pixelRatio = 1;

  /** Where the camera looks, in world space (the seated Q's centre). */
  const target = { x: 0, y: 0, z: 0 };

  /**
   * Seat the mark for the page direction. LTR: the tail tip is flush with the end of the line
   * (x = 0) and the bowl stands over the joint. RTL mirrors the line but never the mark, so the
   * unmirrored tail now points back along the line: it is laid on the end cap with its tip short
   * of the joint, and the bowl stands at the end. `target` is in the (mirrored) world space.
   */
  function placeMark(): void {
    const displayedCentre = dirSign > 0 ? markCentreX : capLength - params.endCapExtra.value / 2 - markWidth / 2;
    markPivot.position.x = dirSign * displayedCentre; // world space (world.scale.x = dirSign)
    if (shadow) shadow.mesh.position.x = dirSign * displayedCentre;
    target.x = dirSign * displayedCentre;
  }

  const scene: RenderableScene = {
    id: 'close',
    params,
    stillAt: [0, 0.5, 0.75],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = params.envIntensity.value;
      object3d.add(world);

      const H = params.railHeight.value;
      const D = params.railDepth.value;
      const C = params.railChamfer.value;

      // The Q, extruded from mark.svg. Its tail tip is x = 0, its baseline y = 0.
      const shapes = markShapes(parseSvg);
      await ctx.yieldToMain();
      const { geometry, width, height } = buildMarkGeometry(shapes, {
        tailThickness: H,
        depth: params.markDepth.value,
        chamfer: params.markChamfer.value,
        curveSegments: params.markCurveSegments.value * ctx.tierConfig.detail,
      });
      await ctx.yieldToMain();
      const mark = new Mesh(geometry, alloyMaterial(params.markRoughness.value));
      mark.name = CLOSE_NAMES.mark;
      markWidth = width;
      markCentreX = -width / 2;
      markCentreY = height / 2;
      // Pivot at the mark's centre of mass (roughly), so the yaw unwinds about its own axis.
      mark.position.set(-markCentreX, 0, 0);
      markPivot.position.set(markCentreX, 0, 0);
      markPivot.add(mark);
      world.add(markPivot);

      // End-cap block under the tail, then the open joint, then the rail running out of frame.
      const capX0 = tailStartX(H) - params.endCapExtra.value;
      capLength = -capX0;
      const endCap = new Mesh(railBar(capX0, 0, H, D, C), anodisedMaterial(params.railRoughness.value - 0.04));
      endCap.name = CLOSE_NAMES.endCap;
      const railX1 = capX0 - params.jointGap.value;
      const rail = new Mesh(railBar(railX1 - params.railLength.value, railX1, H, D, C), anodisedMaterial(params.railRoughness.value));
      rail.name = CLOSE_NAMES.rail;
      world.add(endCap, rail);

      // Datum: a thin unlit Rhodamine line along the rail's front face. It stops `datumClearance`
      // before the Q's footprint, so it never sits beside the mark.
      datumMat = datumMaterial();
      const datumX1 = -width - params.datumClearance.value;
      const datumX0 = railX1 - params.railLength.value;
      datum = new Mesh(new BoxGeometry(datumX1 - datumX0, 1, 1), datumMat);
      datum.name = CLOSE_NAMES.datum;
      datum.position.set((datumX0 + datumX1) / 2, -H * DATUM_Y, D / 2 + 0.002);
      world.add(datum);
      // A short vertical stop at the datum's end, like the terminator on a drawing's datum, so
      // the line ends on purpose rather than just stopping.
      tick = new Mesh(new BoxGeometry(1, 1, 1), datumMat);
      tick.name = CLOSE_NAMES.datumTick;
      tick.position.set(datumX1, -H * DATUM_Y, D / 2 + 0.002);
      world.add(tick);

      tierAllowsShadow = ctx.tierConfig.contactShadow;
      shadow = createContactShadow(width * 1.25, D * 1.6);
      shadow.mesh.position.set(markCentreX, 0.0015, 0);
      world.add(shadow.mesh);

      world.add(key, rim);
      object3d.add(new AmbientLight(0xffffff, 0.03), fade.mesh);
      placeMark();
      target.y = markCentreY * 0.78;
      await ctx.yieldToMain();
    },

    update(progress: number) {
      const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
      // Two stages: an even approach (travel curve) to `seatGap` above the joint, then the seat
      // itself on the seat curve. A scrubbed fall on a front-loaded curve would drop at once.
      const s = segment(p, params.seatStart.value, params.seatEnd.value);
      const approachEnd = params.seatSplit.value;
      const gap = params.seatGap.value;
      const lift = s < approachEnd
        ? lerp(1, gap, easeTravel(s / approachEnd))
        : gap * (1 - easeSeat((s - approachEnd) / (1 - approachEnd)));
      const seat = 1 - lift;

      // 1. The Q lowers and unwinds into its seat. The last 4% of travel is the seat itself.
      markPivot.position.y = lift * params.liftHeight.value;
      markPivot.rotation.set(0, lift * params.liftYaw.value * dirSign, 0);

      // 2. Key light swings from raking to rest (travel curve, it is already on screen).
      const l = easeTravel(segment(p, params.lightStart.value, params.lightEnd.value));
      const az = lerp(params.keyAzimuthStart.value, params.keyAzimuthEnd.value, l);
      const el = lerp(params.keyElevationStart.value, params.keyElevationEnd.value, l);
      const r = params.keyRadius.value;
      key.position.set(target.x + Math.sin(az) * Math.cos(el) * r, target.y + Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
      rim.position.set(target.x + 2.5, 2.2, -5);

      // 3. Datum: full -> hairline -> out.
      if (datum && datumMat) {
        const d = segment(p, params.datumOutStart.value, params.datumOutEnd.value);
        const wanted = lerp(params.datumThickness.value, params.datumHairline.value, easeTravel(Math.min(1, d * 1.6)));
        const floor = worldPerDevicePixel(params.cameraDistance.value / Math.min(1, aspect), params.fov.value, viewHeight, pixelRatio);
        const thickness = Math.max(wanted, floor);
        datum.scale.set(1, thickness, thickness);
        datumMat.opacity = (1 - easeTravel(d)) * Math.min(1, wanted / thickness);
        datum.visible = datumMat.opacity > 0.001;
        if (tick) {
          tick.scale.set(thickness, params.railHeight.value * 0.62, thickness);
          tick.visible = datum.visible;
        }
      }

      // 4. Contact shadow grows as the Q approaches the cap.
      if (shadow) {
        shadow.material.uniforms.uOpacity!.value = params.shadowOpacity.value * seat * seat;
        shadow.mesh.visible = tierAllowsShadow && ladderAllowsShadow && seat > 0.01;
      }

      // 5. Camera: a slow push that gives back a little azimuth as the Q seats.
      const camAz = (params.cameraAzimuth.value + params.cameraDrift.value * seat) * dirSign;
      const dist = params.cameraDistance.value / Math.min(1, aspect);
      const elev = params.cameraElevation.value;
      const tx = target.x * dirSign; // world -> displayed (camera is outside the mirrored group)
      camera.position.set(tx + Math.sin(camAz) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, Math.cos(camAz) * Math.cos(elev) * dist);
      camera.lookAt(tx, target.y, 0);

      // 6. Fade to Carbon (alpha) before the footer.
      fade.set(easeTravel(segment(p, params.fadeStart.value, 1)));
    },

    resize(view: Viewport) {
      aspect = view.aspect;
      viewHeight = view.height;
      pixelRatio = view.pixelRatio;
      dirSign = view.dir === 'rtl' ? -1 : 1;
      // Mirror the line for RTL, but never the mark itself (logos do not mirror).
      world.scale.x = dirSign;
      markPivot.scale.x = dirSign;
      placeMark();
      camera.aspect = view.aspect;
      camera.fov = params.fov.value;
      // Film offset: the Q sits inline-end, the contact call inline-start. Portrait centres it.
      const shift = view.aspect >= 1 ? params.frameShift.value : 0;
      const w = Math.max(1, view.width);
      const h = Math.max(1, view.height);
      camera.setViewOffset(w, h, -shift * w * dirSign, params.frameLift.value * h, w, h);
      camera.updateProjectionMatrix();
    },

    applyQuality(level: QualityLevel) {
      ladderAllowsShadow = level.contactShadow;
      if (shadow) shadow.mesh.visible = tierAllowsShadow && ladderAllowsShadow && shadow.mesh.visible;
    },

    dispose() {
      object3d.environment = null; // owned by the runtime
      disposeObject3D(object3d);
    },
  };
  return scene;
}

export default createCloseScene;
