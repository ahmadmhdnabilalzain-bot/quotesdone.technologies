/**
 * Rail scene: Home scenes 2 and 3 of structure-v1 ("Datum" handing over to "The line").
 *
 * Progress map (see params.ts RAIL_BEATS):
 *   0.00-0.08  the datum holds: one Rhodamine light line across the stage (front view).
 *   0.06-0.38  the line thickens into a machined Carbon rail with its datum groove (extrude).
 *   0.08-0.46  the camera travels to a three-quarter view.
 *   0.24-0.50  empty stations seat their chamfered caps, cascading along the rail.
 *   0.40-0.78  the three products dock one after another, each with a small settle; each
 *              station's status light comes on once seated (dot = live, ring = in development).
 *   0.78-1.00  hold, with a slow push-in.
 * Time only drives a slow light pulse along the datum. update() is pure.
 *
 * Status is read from home.json (the same source as the DOM labels): live products are solid
 * Alloy, products in development are drafting linework, future stations are capped and empty.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  type Object3D,
  Mesh,
  type Material,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene as ThreeScene,
  type ShaderMaterial,
  type MeshBasicMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import type { QualityLevel } from '../../runtime/ladder.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import home from '../../../content/en/home.json';
import { RAIL_PARAMS } from './params.ts';
import {
  buildStations,
  cameraAt,
  capAt,
  datumYZ,
  dockAt,
  extrudeAt,
  lerp,
  verticalFovDeg,
  type ObjectKind,
  type RenderMode,
  type Station,
} from './layout.ts';
import { createChamferedBlock, createCoilGeometry, createDimensionLines, createMonthRing, createRailGeometry } from './geometry.ts';
import {
  createAlloy,
  createCarbon,
  createDatumMaterial,
  createDepthMask,
  createFadeUniforms,
  createLineMaterials,
  createShadowMaterial,
  createStatusMaterial,
  RHODAMINE_LIGHT,
  SOCKET,
} from './materials.ts';

/** Debug handle: what each station renders, so tests (and ?debug) can check honest status. */
export interface StationReport {
  index: number;
  slug: string | null;
  mode: RenderMode | 'empty';
  status: string | null;
}

interface DockedObject {
  station: Station & { product: NonNullable<Station['product']> };
  group: Group;
  light: Mesh<BufferGeometry, MeshBasicMaterial>;
  shadow: Mesh<BufferGeometry, ShaderMaterial> | null;
}

export interface RailScene extends RenderableScene {
  /** Read-only report of every station's render state (tests, debug). */
  stations(): StationReport[];
}

export function createRailScene(): RailScene {
  const params = structuredClone(RAIL_PARAMS);
  const object3d = new ThreeScene();
  const camera = new PerspectiveCamera(30, 1, 0.05, 80);
  const root = new Group(); // scale.x = flow: RTL mirrors the whole line
  root.name = 'rail-root';
  const railGroup = new Group(); // scaled about the datum: the line thickens into the rail
  railGroup.name = 'rail-extrude';
  const railInner = new Group();
  const fade = createFadeUniforms(params);
  const [datumY, datumZ] = datumYZ(params);
  const tmp = new Matrix4();

  let stations: Station[] = [];
  let docked: DockedObject[] = [];
  let caps: InstancedMesh | null = null;
  let emptyStations: Station[] = [];
  let datum: Mesh<BufferGeometry, ShaderMaterial> | null = null;
  let flow: 1 | -1 = 1;
  /** World units per CSS pixel at the datum in the front view (set in resize). */
  let worldPerPx = 0.004;
  let tierAllowsShadow = false;
  let ladderAllowsShadow = true;
  let lastProgress = 0;

  const buildObject = (kind: ObjectKind, mode: RenderMode, detail: number): Group => {
    const group = new Group();
    group.name = `object-${kind}-${mode}`;
    const h = params.objectHeight.value;
    const solids: Array<{ geometry: BufferGeometry; x?: number; y?: number; z?: number; body?: boolean }> = [];
    if (kind === 'plate') {
      // Sealed plates: three identical plates standing in a row, as if lined up to be compared,
      // each with a thin cover plate over its face (nothing engraved): the motif of the
      // QuotesDone scene (structure-v1 scene 4).
      const w = h * 0.3;
      const gap = h * 0.055;
      const plate = new RoundedBoxGeometry(w, h * 0.9, 0.055, 2, 0.008);
      const cover = new RoundedBoxGeometry(w * 0.86, h * 0.84, 0.012, 2, 0.003);
      for (let k = -1; k <= 1; k++) {
        const x = k * (w + gap);
        const y = (h * 0.9) / 2;
        solids.push({ geometry: k === -1 ? plate : plate.clone(), x, y, body: true });
        solids.push({ geometry: k === -1 ? cover : cover.clone(), x, y, z: 0.0275 + 0.007 });
      }
    } else if (kind === 'coil') {
      solids.push({ geometry: createCoilGeometry(params, detail), body: true });
      const hub = new CylinderGeometry(h * 0.1, h * 0.1, 0.2, Math.max(12, Math.round(32 * detail)), 1);
      hub.rotateX(Math.PI / 2);
      solids.push({ geometry: hub, y: h / 2 });
    } else {
      const ring = createMonthRing(params);
      ring.edges.dispose(); // edges are rebuilt below for every kind
      solids.push({ geometry: ring.solid, body: true });
    }

    if (mode === 'solid') {
      // Bodies are bead-blasted; covers and hubs are a finer machined finish, so the seam between
      // body and cover reads under the key light.
      const body = createAlloy(params, fade);
      const finish = createAlloy(params, fade);
      finish.roughness = Math.max(0, params.alloyRoughness.value - 0.12);
      solids.forEach(({ geometry, x = 0, y = 0, z = 0, body: isBody = false }) => {
        const mesh = new Mesh(geometry, isBody ? body : finish);
        mesh.position.set(x, y, z);
        group.add(mesh);
      });
      return group;
    }

    // Linework: an invisible depth mask, visible edges, dashed hidden edges, and drafting marks.
    const lines = createLineMaterials(params);
    const mask = createDepthMask();
    solids.forEach(({ geometry, x = 0, y = 0, z = 0 }) => {
      const maskMesh = new Mesh(geometry, mask);
      maskMesh.position.set(x, y, z);
      maskMesh.renderOrder = 1;
      const edgeGeometry = new EdgesGeometry(geometry, 25);
      const visible = new LineSegments(edgeGeometry, lines.visible);
      visible.renderOrder = 2;
      const hidden = new LineSegments(edgeGeometry.clone(), lines.hidden);
      hidden.computeLineDistances();
      hidden.renderOrder = 3;
      visible.position.copy(maskMesh.position);
      hidden.position.copy(maskMesh.position);
      group.add(maskMesh, visible, hidden);
    });
    const dims = new LineSegments(createDimensionLines(params), lines.visible);
    dims.renderOrder = 2;
    group.add(dims);
    return group;
  };

  const scene: RailScene = {
    id: 'rail',
    params,
    stillAt: [0, 0.3, 1],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = params.envIntensity.value;
      const detail = ctx.tierConfig.detail;
      tierAllowsShadow = ctx.tierConfig.contactShadow;
      stations = buildStations(home.productIndex.items, params);
      emptyStations = stations.filter((s) => s.product === null);

      // Lights: one key, one low rake for the chamfers, a breath of ambient. All neutral white.
      const key = new DirectionalLight(0xffffff, params.keyLight.value);
      key.position.set(-3, 5, 4);
      const rake = new DirectionalLight(0xffffff, params.rakeLight.value);
      rake.position.set(6, 0.35, -2.2); // low and behind: it rims the chamfers, not the top faces
      root.add(key, rake, new AmbientLight(0xffffff, 0.04));

      // Rail body + pads + caps + status lights live in the extruding group.
      railGroup.position.set(0, datumY, datumZ);
      railInner.position.set(0, -datumY, -datumZ);
      railGroup.add(railInner);
      const carbon = createCarbon(params, fade);
      const railBody = new Mesh(createRailGeometry(params), carbon);
      railBody.name = 'rail-body';
      railInner.add(railBody);

      const padGeometry = createChamferedBlock(params.padWidth.value, params.padDepth.value, params.padHeight.value, params.padChamfer.value);
      const pads = new InstancedMesh(padGeometry, carbon, stations.length);
      pads.name = 'pads';
      stations.forEach((s, i) => pads.setMatrixAt(i, tmp.makeTranslation(s.x, 0, 0)));
      pads.instanceMatrix.needsUpdate = true;
      pads.computeBoundingSphere();
      railInner.add(pads);
      await ctx.yieldToMain();

      if (emptyStations.length > 0) {
        const capGeometry = createChamferedBlock(params.padWidth.value * 0.94, params.padDepth.value * 0.94, params.capHeight.value, params.padChamfer.value * 1.6);
        caps = new InstancedMesh(capGeometry, createCarbon(params, fade), emptyStations.length);
        caps.name = 'caps';
        caps.frustumCulled = false; // instances move; the bounding sphere is not recomputed per frame
        railInner.add(caps);
      }

      // The datum: a light line along the whole rail. Thickness is set per frame.
      const datumGeometry = new BoxGeometry(params.railEnd.value - params.railStart.value, 1, 1);
      datumGeometry.translate((params.railEnd.value + params.railStart.value) / 2, 0, 0);
      datum = new Mesh(datumGeometry, createDatumMaterial(params));
      datum.name = 'datum';
      datum.position.set(0, datumY, datumZ);
      datum.frustumCulled = false;
      root.add(railGroup, datum);

      // Products: one docking object per station, its status light and (solid only) a contact shadow.
      const r = params.statusRadius.value;
      for (const station of stations) {
        if (!station.product) continue;
        const product = station.product;
        const group = buildObject(product.kind, product.mode, detail);
        root.add(group);
        const lightGeometry = product.status === 'live' ? new CircleGeometry(r, 24) : new RingGeometry(r * 0.62, r, 32);
        const light = new Mesh(lightGeometry, createStatusMaterial());
        light.name = `status-${product.slug}`;
        light.position.set(station.x, params.padHeight.value * 0.42, params.padDepth.value / 2 + 0.002);
        railInner.add(light);
        let shadow: DockedObject['shadow'] = null;
        if (product.mode === 'solid') {
          const plane = new PlaneGeometry(params.padWidth.value * 0.95, params.padDepth.value * 0.8);
          plane.rotateX(-Math.PI / 2);
          shadow = new Mesh(plane, createShadowMaterial());
          shadow.name = `shadow-${product.slug}`;
          shadow.position.set(station.x, params.padHeight.value + 0.002, 0);
          shadow.renderOrder = 1;
          root.add(shadow);
        }
        docked.push({ station: station as DockedObject['station'], group, light, shadow });
        await ctx.yieldToMain();
      }
      object3d.add(root);
      scene.applyQuality?.({ index: 0, label: 'full', contactShadow: true, renderScale: 1 });
      ctx.log.info(`built ${stations.length} stations (${docked.length} products, ${emptyStations.length} empty)`);
    },

    // Pure: every value below is computed from (progress, timeMs) and the last resize().
    update(progress: number, timeMs: number) {
      lastProgress = progress;
      const m = extrudeAt(progress);
      railGroup.scale.set(1, Math.max(1e-4, m), Math.max(1e-4, m));
      railGroup.visible = m > 1e-3;

      if (datum) {
        // Hairline in the front view (matches the DOM datum), then the light inside the groove.
        const thickness = lerp(params.datumPixels.value * worldPerPx, params.grooveHeight.value * 0.7, m);
        datum.scale.set(1, thickness, lerp(thickness, params.grooveDepth.value * 0.8, m));
        datum.material.uniforms.uTime!.value = timeMs / 1000;
      }

      if (caps) {
        emptyStations.forEach((s, i) => {
          const seat = capAt(progress, i, emptyStations.length);
          const y = params.padHeight.value + (1 - seat) * 0.6;
          const scale = seat > 0 ? 1 : 0; // not drawn before its cascade reaches it
          caps!.setMatrixAt(i, tmp.makeScale(scale, scale, scale).setPosition(s.x, y, 0));
        });
        caps.instanceMatrix.needsUpdate = true;
      }

      for (let i = 0; i < docked.length; i++) {
        const d = docked[i]!;
        const dock = dockAt(progress, i, params);
        d.group.visible = dock.visible;
        d.group.position.set(d.station.x - dock.lead, params.padHeight.value + dock.lift, 0);
        d.light.material.color.copy(SOCKET).lerp(RHODAMINE_LIGHT, dock.light);
        if (d.shadow) {
          const near = 1 - Math.min(1, Math.max(0, dock.lift) / params.dockLift.value);
          d.shadow.material.uniforms.uOpacity!.value = dock.visible ? 0.55 * near * near : 0;
        }
      }

      const pose = cameraAt(progress, params, flow);
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    },

    resize(view: Viewport) {
      flow = view.dir === 'rtl' ? -1 : 1;
      root.scale.x = flow;
      fade.uFlow.value = flow;
      camera.aspect = view.aspect;
      camera.fov = verticalFovDeg(params.hfovDeg.value, view.aspect);
      camera.updateProjectionMatrix();
      worldPerPx = (2 * params.frontDistance.value * Math.tan((params.hfovDeg.value * Math.PI) / 360)) / Math.max(1, view.width);
      scene.update(lastProgress, 0);
    },

    applyQuality(level: QualityLevel) {
      ladderAllowsShadow = level.contactShadow;
      for (const d of docked) if (d.shadow) d.shadow.visible = tierAllowsShadow && ladderAllowsShadow;
    },

    stations(): StationReport[] {
      return stations.map((s) => ({
        index: s.index,
        slug: s.product?.slug ?? null,
        mode: s.product?.mode ?? 'empty',
        status: s.product?.status ?? null,
      }));
    },

    dispose() {
      // The env map belongs to the runtime. disposeObject3D frees each shared geometry/material once.
      object3d.environment = null;
      disposeObject3D(object3d);
      object3d.clear(); // drop references to the freed graph
      docked = [];
      stations = [];
      emptyStations = [];
      caps = null;
      datum = null;
    },
  };
  return scene;
}

/** Materials of every drawable under `root` (tests use this to check the palette rules). */
export function materialsOf(root: Object3D): Material[] {
  const found = new Set<Material>();
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((x) => found.add(x));
  });
  return [...found];
}

export default createRailScene;
