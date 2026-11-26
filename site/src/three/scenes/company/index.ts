/**
 * Scene 7, Company (structure-v1 §2.2 row 7): the camera pulls back along the rail in one long,
 * quiet shot until every dock is in frame, the empty ones included. The datum dims to a hairline,
 * then the frame steps back (alpha) and the About text takes over in the DOM.
 *
 * The dock contents follow the site's status rule, drawn and never written:
 *   live = solid Alloy + a Rhodamine status light; in development = drafting linework + an
 *   outline status mark; future = an empty dock with a chamfered cap.
 * Objects are deliberately low detail: this is the distance shot; scenes 4 to 6 carry the detail.
 *
 * Pure: update(progress, timeMs) derives every transform from its inputs. Time is not used.
 */
import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Curve,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene as ThreeScene,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { COMPANY_PARAMS, DOCK_ORDER, type DockKind } from './params.ts';
import {
  ALLOY,
  RHODAMINE,
  alloyMaterial,
  anodisedMaterial,
  chamferedBox,
  createFadePass,
  DATUM_Y,
  datumMaterial,
  easeTravel,
  lerp,
  railBar,
  segment,
  worldPerDevicePixel,
} from '../close/shared.ts';

export const COMPANY_NAMES = {
  rail: 'company-rail',
  datum: 'company-datum',
  dock: (i: number) => `company-dock-${i}`,
} as const;

/** Flat Archimedean spiral in the XZ plane: one continuous line wound into a coil. */
class FlatSpiral extends Curve<Vector3> {
  constructor(
    private readonly r0: number,
    private readonly r1: number,
    private readonly turns: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    const r = lerp(this.r0, this.r1, t);
    return target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
}

/** Annulus sectors (the 12 months), as one set of shapes. */
function ringSectors(segments: number, rIn: number, rOut: number, gapRad: number): Shape[] {
  const shapes: Shape[] = [];
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const a0 = i * step + gapRad / 2;
    const a1 = (i + 1) * step - gapRad / 2;
    const s = new Shape();
    s.moveTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    s.absarc(0, 0, rOut, a0, a1, false);
    s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    s.absarc(0, 0, rIn, a1, a0, true);
    s.closePath();
    shapes.push(s);
  }
  return shapes;
}

export function createCompanyScene(): RenderableScene {
  const params = structuredClone(COMPANY_PARAMS);
  const object3d = new ThreeScene();
  object3d.name = 'company';
  const camera = new PerspectiveCamera(params.fov.value, 1, 0.1, 200);
  const world = new Group();
  const key = new DirectionalLight(0xffffff, params.keyIntensity.value);
  const rim = new DirectionalLight(0xdfe6ee, 0.7);
  const fade = createFadePass();
  let datum: Mesh | null = null;
  let datumMat: MeshBasicMaterial | null = null;
  let dirSign = 1;
  let aspect = 1;
  let viewHeight = 1;
  let pixelRatio = 1;
  let runLength = 1;

  const stationX = (i: number): number => i * params.stationPitch.value;

  const scene: RenderableScene = {
    id: 'company',
    params,
    stillAt: [0, 0.55, 1],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = params.envIntensity.value;
      object3d.add(world);
      const detail = ctx.tierConfig.detail;
      const H = params.railHeight.value;
      const D = params.railDepth.value;
      const n = Math.round(params.stationCount.value);
      runLength = stationX(n - 1);

      // Shared materials (disposeObject3D frees each once).
      const alloy = alloyMaterial(params.roughness.value);
      const dockMat = anodisedMaterial(0.4);
      const railMat = anodisedMaterial(0.44);
      const capMat = anodisedMaterial(0.72); // satin cap: no glint, an empty dock stays quiet
      const line = new LineBasicMaterial({ color: ALLOY, transparent: true, opacity: params.linework.value, depthWrite: false });
      const liveLight = new MeshBasicMaterial({ color: RHODAMINE, toneMapped: false });

      const rail = new Mesh(railBar(-params.railLead.value, runLength + params.railTail.value, H, D, params.railChamfer.value), railMat);
      rail.name = COMPANY_NAMES.rail;
      world.add(rail);

      datumMat = datumMaterial();
      const dx0 = -params.railLead.value;
      const dx1 = runLength + params.railTail.value;
      datum = new Mesh(new BoxGeometry(dx1 - dx0, 1, 1), datumMat);
      datum.name = COMPANY_NAMES.datum;
      datum.position.set((dx0 + dx1) / 2, -H * DATUM_Y, D / 2 + 0.002);
      world.add(datum);

      const dw = params.dockWidth.value;
      const dh = params.dockHeight.value;
      const dd = params.dockDepth.value;
      const below = 0.012; // the saddle wraps a little below the rail
      const dockGeo = chamferedBox(dw, H + dh + below, dd, 0.012);
      dockGeo.translate(0, (dh - H - below) / 2, 0);
      const capGeo = chamferedBox(dw - 2 * params.capInset.value, 0.02, dd - 2 * params.capInset.value, 0.006);
      capGeo.translate(0, dh + 0.01, 0);
      const statusR = params.statusSize.value / 2;

      for (let i = 0; i < n; i++) {
        const kind: DockKind = DOCK_ORDER[i] ?? 'empty';
        const dock = new Group();
        dock.name = COMPANY_NAMES.dock(i);
        dock.position.x = stationX(i);
        dock.userData.kind = kind;
        dock.add(new Mesh(dockGeo, dockMat));
        const statusPos = new Vector3(-dw / 2 + 0.07, dh - 0.035, dd / 2 + 0.001);

        if (kind === 'empty') {
          dock.add(new Mesh(capGeo, capMat));
        } else if (kind === 'quotesdone') {
          // Sealed plates, identical and nameless, standing in a row.
          const count = Math.round(params.plateCount.value);
          const plate = chamferedBox(0.05, 0.24, 0.28, 0.008);
          const pitch = 0.085;
          for (let k = 0; k < count; k++) {
            const m = new Mesh(plate, alloy);
            m.position.set((k - (count - 1) / 2) * pitch, dh + 0.12, 0);
            dock.add(m);
          }
        } else if (kind === 'sonobolt') {
          // One continuous line, wound flat.
          const segs = Math.max(60, Math.round(360 * detail));
          const coil = new Mesh(new TubeGeometry(new FlatSpiral(0.035, 0.21, params.coilTurns.value), segs, 0.0105, 6, false), alloy);
          coil.position.y = dh + 0.0105;
          dock.add(coil);
        } else {
          // MubinFlow: drafting linework only, no surfaces (in development).
          const sectors = new ExtrudeGeometry(ringSectors(Math.round(params.ringSegments.value), 0.12, 0.215, 0.05), {
            depth: 0.05,
            bevelEnabled: false,
            curveSegments: 3,
          });
          const edges = new EdgesGeometry(sectors, 20);
          sectors.dispose(); // only the edges are kept
          const ring = new LineSegments(edges, line);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = dh + 0.002;
          dock.add(ring);
        }

        if (kind === 'quotesdone' || kind === 'sonobolt') {
          const dot = new Mesh(new CircleGeometry(statusR, 20), liveLight);
          dot.position.copy(statusPos);
          dock.add(dot);
        } else if (kind === 'mubinflow') {
          const outline = new Mesh(new RingGeometry(statusR * 0.72, statusR, 24), new MeshBasicMaterial({ color: ALLOY, transparent: true, opacity: params.linework.value, toneMapped: false }));
          outline.position.copy(statusPos);
          dock.add(outline);
        }
        world.add(dock);
        if (i % 3 === 2) await ctx.yieldToMain();
      }

      world.add(key, key.target, rim);
      object3d.add(new AmbientLight(0xffffff, 0.03), fade.mesh);
    },

    update(progress: number) {
      const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
      const raw = segment(p, params.dollyStart.value, params.dollyEnd.value);
      const t = lerp(raw, easeTravel(raw), params.dollyEase.value);

      // Camera: focus slides from station 3 to the middle of the line; distance grows
      // geometrically so the pull-back reads at an even pace.
      const fx = lerp(stationX(params.focusStation.value), params.farFocus.value * runLength, t) * dirSign;
      const fy = lerp(0.1, 0, t);
      const dist = params.nearDistance.value * (params.farDistance.value / params.nearDistance.value) ** t / Math.min(1, aspect);
      const az = lerp(params.nearAzimuth.value, params.farAzimuth.value, t) * dirSign;
      const el = lerp(params.nearElevation.value, params.farElevation.value, t);
      camera.position.set(fx + Math.sin(az) * Math.cos(el) * dist, fy + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(fx, fy, 0);

      // One key light, fixed relative to the line (it does not chase the camera).
      key.position.set(-4 * dirSign, 5, 6);
      key.target.position.set(runLength * 0.4, 0, 0);
      rim.position.set(runLength * 0.6, 3, -6);

      // Datum: full strength -> hairline.
      if (datum && datumMat) {
        const d = easeTravel(segment(p, params.datumDimStart.value, params.datumDimEnd.value));
        const wanted = lerp(params.datumThickness.value, params.datumHairline.value, d);
        // Never thinner than ~1 device pixel (it would alias into dashes): thin by opacity instead.
        const floor = worldPerDevicePixel(dist, params.fov.value, viewHeight, pixelRatio);
        const th = Math.max(wanted, floor);
        datum.scale.set(1, th, th);
        datumMat.opacity = lerp(1, params.datumHairlineOpacity.value, d) * Math.min(1, wanted / th);
      }

      // Hand over to the words.
      fade.set(params.yieldAmount.value * easeTravel(segment(p, params.yieldStart.value, 1)));
    },

    resize(view: Viewport) {
      aspect = view.aspect;
      viewHeight = view.height;
      pixelRatio = view.pixelRatio;
      dirSign = view.dir === 'rtl' ? -1 : 1;
      world.scale.x = dirSign;
      camera.aspect = view.aspect;
      camera.fov = params.fov.value;
      const w = Math.max(1, view.width);
      const h = Math.max(1, view.height);
      camera.setViewOffset(w, h, -params.frameShift.value * w * dirSign, params.frameLift.value * h, w, h);
      camera.updateProjectionMatrix();
    },

    dispose() {
      object3d.environment = null;
      disposeObject3D(object3d);
    },
  };
  return scene;
}

export default createCompanyScene;
