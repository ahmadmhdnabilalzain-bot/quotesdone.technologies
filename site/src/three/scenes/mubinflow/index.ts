/**
 * Scene 6, MubinFlow: "Shows its working" (structure-v1 §2.2, row 6).
 *
 * A drafting sheet on Carbon. A ring of 12 month segments indexes round to one month; that
 * segment slides out and opens into three layered strips (people, payslips, the salary file).
 * Dimension lines measure the work, and a traced leader runs from ONE figure on a payslip to the
 * rule behind it and on to the source that rule cites. A small linework plate says "in
 * development" without text. Everything is edges: visible edges solid, hidden edges dashed.
 *
 * Hidden lines are real: every body has a depth-only solid (no colour written), visible edges
 * test LESS-EQUAL against it and the dashed pass tests GREATER. `maturity` (params.ts) fades the
 * same solids in as Alloy for the launch: one number, no second scene.
 *
 * Contract: update(progress, time) is pure (time is unused on purpose: slow sub-pixel drift on
 * fine lines is what makes linework shimmer). The camera is orthographic (draft-line.ts needs it).
 * Progress map: timeline.ts. Tunables: params.ts. Geometry: geometry.ts, sheet.ts.
 */
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene as ThreeScene,
  Shape,
  Vector2,
  Vector3,
  type BufferGeometry,
  type InstancedBufferGeometry,
  type Object3D,
  type ShaderMaterial,
} from 'three';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import { createLogger, type Logger } from '../../../lib/log.ts';
import { DEBUG_OVERRIDES, MUBINFLOW_PARAMS, type MubinFlowParams } from './params.ts';
import { createLineGeometry, createLineMesh, createSharedLineUniforms, type DepthMode, type Polyline, type SharedLineUniforms } from './draft-line.ts';
import {
  MONTHS,
  SEGMENT_ANGLE,
  calloutAnchors,
  centreLines,
  compositionBounds,
  dialLines,
  dimension,
  layerY,
  leaderDot,
  payslipContent,
  peopleContent,
  ringBounds,
  ringRestEdges,
  ruleCard,
  segmentOutline2D,
  selectedEdges,
  sifContent,
  sourceDoc,
  stripEdges,
  stripStartX,
  traceLeaders,
  cellX,
  type Layout,
} from './geometry.ts';
import { buildRamp, sampleRamp, type Rgb } from './color-ramp.ts';
import { plateLines, plateStatusRing, sheetFrame, type SheetSpec } from './sheet.ts';
import { TIMELINE, easeEnter, easeTravel, indexTurn, phase, stripPhases } from './timeline.ts';

/** Palette (brand/logo/README.md). Lines get AgX-corrected colours from color-ramp.ts. */
const HEX = { alloy: '#ECEAE4', carbon: '#0E1013', rhodamine: '#E3185B' } as const;
const ALLOY = new Color(HEX.alloy);
type Hue = 'alloy' | 'rhodamine';

/** How a line's brightness responds to `maturity`. */
type LineKind = 'edge' | 'hidden' | 'detail' | 'sheet' | 'trace';

interface LineEntry {
  mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  kind: LineKind;
  base: number;
  hue: Hue;
  /** World lines get CSS px per world unit; sheet lines are already in CSS px. */
  space: 'world' | 'sheet';
}

const STRIP_NAMES = ['people', 'payslips', 'sif'] as const;
const STRIP_WINDOWS = [TIMELINE.people, TIMELINE.payslips, TIMELINE.sif] as const;

export function createMubinFlowScene(): RenderableScene {
  const params: MubinFlowParams = structuredClone(MUBINFLOW_PARAMS);
  for (const [key, value] of Object.entries(DEBUG_OVERRIDES)) {
    const p = params[key as keyof MubinFlowParams];
    if (p && typeof value === 'number') p.value = Math.min(p.max, Math.max(p.min, value));
  }

  const object3d = new ThreeScene();
  object3d.name = 'mubinflow';
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  object3d.add(camera);
  const root = new Group(); // mirrored for RTL
  root.name = 'mubinflow-root';
  object3d.add(root);
  const sheetGroup = new Group(); // child of the camera, in CSS px
  sheetGroup.name = 'sheet';
  camera.add(sheetGroup);

  const shared: SharedLineUniforms = createSharedLineUniforms();
  const ramps: Record<Hue, Rgb[]> = { alloy: [], rhodamine: [] };
  const rgb: Rgb = [0, 0, 0];
  const lines: LineEntry[] = [];
  const draws = new Map<string, Mesh<InstancedBufferGeometry, ShaderMaterial>[]>();
  const solids: Mesh[] = [];
  let solidMaterial: MeshStandardMaterial | null = null;
  let key: DirectionalLight | null = null;
  let log: Logger = createLogger('3d:scene:mubinflow');

  // Groups that move.
  const ringPivot = new Group();
  ringPivot.name = 'ring';
  const segGroup = new Group();
  segGroup.name = 'month';
  const strips = STRIP_NAMES.map((n) => {
    const g = new Group();
    g.name = `strip-${n}`;
    return g;
  });

  // Camera fitting state (recomputed in resize, read in update).
  const view = { width: 1, height: 1, aspect: 1, pixelRatio: 1, dirSign: 1 as 1 | -1 };
  let boundsRing = { cx: 0, cy: 0, hx: 1, hy: 1 };
  let boundsAll = { cx: 0, cy: 0, hx: 1, hy: 1 };
  let layout: Layout | null = null;
  let anchorsWorld: number[][] = [];
  let ringWorld: number[][] = [];

  const value = (k: keyof MubinFlowParams): number => params[k].value;

  function addLines(
    parent: Object3D,
    name: string,
    polylines: Polyline[],
    opts: { kind: LineKind; width: number; intensity: number; depth: DepthMode; hue?: Hue; dash?: [number, number, number, number]; space?: 'world' | 'sheet'; draw?: string; geometry?: InstancedBufferGeometry },
  ): Mesh<InstancedBufferGeometry, ShaderMaterial> {
    const mesh = createLineMesh(
      polylines,
      shared,
      { name, color: ALLOY, width: opts.width, depth: opts.depth, dash: opts.dash },
      opts.geometry,
    );
    parent.add(mesh);
    const hue = opts.hue ?? 'alloy';
    mesh.userData.hue = hue;
    lines.push({ mesh, kind: opts.kind, base: opts.intensity, hue, space: opts.space ?? 'world' });
    const drawKey = opts.draw ?? name;
    const list = draws.get(drawKey) ?? [];
    list.push(mesh);
    draws.set(drawKey, list);
    return mesh;
  }

  /** Visible edges plus their dashed hidden pass, sharing one geometry. */
  function addEdges(parent: Object3D, name: string, polylines: Polyline[], draw: string): void {
    const geometry = createLineGeometry(polylines);
    addLines(parent, `${name}:visible`, polylines, { kind: 'edge', width: value('widthEdge'), intensity: value('intensityEdge'), depth: 'visible', draw, geometry });
    addLines(parent, `${name}:hidden`, polylines, {
      kind: 'hidden',
      width: value('widthHidden'),
      intensity: value('intensityHidden'),
      depth: 'hidden',
      dash: [value('hiddenDash'), value('hiddenGap'), 0, 0],
      draw: `${draw}:hidden`,
      geometry,
    });
  }

  function addSolid(parent: Object3D, name: string, geometry: BufferGeometry): void {
    if (!solidMaterial) throw new Error('solid material missing');
    const mesh = new Mesh(geometry, solidMaterial);
    mesh.name = `${name}:solid`;
    mesh.renderOrder = -1;
    parent.add(mesh);
    solids.push(mesh);
  }

  function setDraw(key: string, t: number): void {
    for (const mesh of draws.get(key) ?? []) mesh.material.uniforms.uDraw!.value = t;
  }

  function buildSheet(): void {
    for (const child of [...sheetGroup.children]) disposeObject3D(child);
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i]!.space === 'sheet') lines.splice(i, 1);
    for (const k of ['sheet', 'plate', 'plate-ring']) draws.delete(k);
    const spec: SheetSpec = { width: view.width, height: view.height, dirSign: view.dirSign };
    const fine = value('widthFine');
    addLines(sheetGroup, 'sheet-frame', sheetFrame(spec), { kind: 'sheet', width: fine, intensity: value('intensitySheet'), depth: 'overlay', space: 'sheet', draw: 'sheet' });
    addLines(sheetGroup, 'plate', plateLines(spec), { kind: 'sheet', width: fine, intensity: value('intensityFine') + 0.1, depth: 'overlay', space: 'sheet', draw: 'plate' });
    addLines(sheetGroup, 'plate-ring', plateStatusRing(spec), { kind: 'sheet', width: value('widthTrace'), intensity: 1, depth: 'overlay', space: 'sheet', hue: 'rhodamine', draw: 'plate' });
  }

  /** Camera-space bounds (centre and half sizes) of world points, for the fixed view direction. */
  function cameraBounds(points: number[][]): { cx: number; cy: number; hx: number; hy: number } {
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const v = new Vector3();
    for (const p of points) {
      v.set(p[0]! * view.dirSign, p[1]!, p[2]!).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2 };
  }

  function placeCamera(): void {
    const e = (value('elevationDeg') * Math.PI) / 180;
    const a = ((value('azimuthDeg') * Math.PI) / 180) * view.dirSign;
    camera.position.set(Math.sin(a) * Math.cos(e) * 30, Math.sin(e) * 30, Math.cos(a) * Math.cos(e) * 30);
    camera.lookAt(0, 0, 0);
  }

  const scene: RenderableScene = {
    id: 'mubinflow',
    params,
    stillAt: [0.3, 0.62, 0.95],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      log = ctx.log;
      ramps.alloy = buildRamp(HEX.carbon, HEX.alloy);
      ramps.rhodamine = buildRamp(HEX.carbon, HEX.rhodamine);
      object3d.environment = ctx.envMap;
      object3d.userData.ao = false; // runtime look opt-out: linework gets no ambient occlusion (runtime/README.md)
      object3d.environmentIntensity = value('envIntensity');
      const l: Layout = {
        ringOuter: value('ringOuter'),
        ringInner: Math.min(value('ringInner'), value('ringOuter') - 0.05),
        ringHeight: value('ringHeight'),
        ringJoint: value('ringJoint'),
        extractDistance: value('extractDistance'),
        stripLength: value('stripLength'),
        stripDepth: value('stripDepth'),
        stripThickness: value('stripThickness'),
        stripGap: value('stripGap'),
        stripOffset: value('stripOffset'),
        rows: Math.round(value('rows')),
        tracedRow: Math.min(Math.round(value('tracedRow')), Math.round(value('rows')) - 1),
        arcSteps: Math.max(6, Math.round(18 * ctx.tierConfig.detail)),
      };
      layout = l;

      solidMaterial = new MeshStandardMaterial({
        name: 'mubinflow-alloy',
        color: ALLOY,
        metalness: 1,
        roughness: value('solidRoughness'),
        side: DoubleSide, // RTL mirrors the root (negative scale); depth must not depend on winding
        polygonOffset: true,
        polygonOffsetFactor: value('depthOffset'),
        polygonOffsetUnits: value('depthOffset'),
      });
      key = new DirectionalLight(0xffffff, 0);
      key.position.set(-3, 5, 4);
      object3d.add(key);

      // ---- Ring (11 that stay) and the month that comes out ----
      root.add(ringPivot, segGroup);
      const restShapes: Shape[] = [];
      for (let k = 1; k < MONTHS; k++) restShapes.push(new Shape(segmentOutline2D(l, k * SEGMENT_ANGLE).map(([x, y]) => new Vector2(x, y))));
      const extrude = (shapes: Shape[]) =>
        new ExtrudeGeometry(shapes, { depth: l.ringHeight, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, -l.ringHeight / 2, 0);
      addSolid(ringPivot, 'ring', extrude(restShapes));
      addEdges(ringPivot, 'ring', ringRestEdges(l), 'ring');
      addSolid(segGroup, 'month', extrude([new Shape(segmentOutline2D(l, 0).map(([x, y]) => new Vector2(x, y)))]));
      addEdges(segGroup, 'month', selectedEdges(l), 'ring');
      await ctx.yieldToMain();

      // ---- Dial and centre lines (fixed, on the base plane) ----
      addLines(root, 'dial', dialLines(l), { kind: 'detail', width: value('widthFine'), intensity: value('intensityFine'), depth: 'visible', draw: 'dial' });
      addLines(root, 'centre-lines', centreLines(l), {
        kind: 'sheet',
        width: value('widthFine'),
        intensity: value('intensitySheet'),
        depth: 'visible',
        dash: [16, 4, 3, 4],
        draw: 'dial',
      });

      // ---- Strips ----
      const sx = stripStartX(l);
      const pay = payslipContent(l);
      const contents: Polyline[][] = [peopleContent(l), [...pay.cards, ...pay.rows.rows], sifContent(l)];
      strips.forEach((g, i) => {
        g.position.set(sx, i * l.stripGap, 0);
        root.add(g);
        addSolid(g, STRIP_NAMES[i]!, new BoxGeometry(l.stripLength, l.stripThickness, l.stripDepth).translate(l.stripLength / 2, 0, 0));
        addEdges(g, STRIP_NAMES[i]!, stripEdges(l), `strip-${i}`);
        addLines(g, `${STRIP_NAMES[i]}-content`, contents[i]!, { kind: 'detail', width: value('widthFine'), intensity: value('intensityFine'), depth: 'visible', draw: `content-${i}` });
      });
      addLines(strips[1]!, 'not-computed', pay.rows.notComputed, {
        kind: 'detail',
        width: value('widthFine'),
        intensity: value('intensityFine'),
        depth: 'visible',
        dash: [3, 2.5, 0, 0],
        draw: 'content-1',
      });
      await ctx.yieldToMain();

      // ---- Projection lines: person -> payslip -> salary record, for the traced person ----
      const cx = cellX(l, l.tracedRow);
      const y0 = layerY(l, 0);
      const y1 = layerY(l, 1) - l.stripThickness;
      const y1t = layerY(l, 1);
      const y2 = layerY(l, 2) - l.stripThickness;
      addLines(root, 'projection', [{ points: [sx + cx, y0, 0, sx + cx, y1, 0], reveal: [0, 0.5] }, { points: [sx + cx, y1t, 0, sx + cx, y2, 0], reveal: [0.5, 1] }], {
        kind: 'detail',
        width: value('widthFine'),
        intensity: value('intensityFine') + 0.1,
        depth: 'visible',
        dash: [value('hiddenDash'), value('hiddenGap'), 0, 0],
        draw: 'connectors',
      });

      // ---- The figure, its dimension, and the trace to its rule and source ----
      const anchors = calloutAnchors(l, pay.rows.figure);
      const fig = pay.rows.figure;
      const yF = layerY(l, 1) + 0.0005;
      addLines(root, 'figure', [{ points: [sx + fig.x0, yF, fig.z, sx + fig.x1, yF, fig.z] }], { kind: 'trace', width: value('widthFigure'), intensity: 1, depth: 'visible', draw: 'figure' });
      addLines(root, 'figure-dim', dimension([sx + fig.x0, yF, fig.z], [sx + fig.x1, yF, fig.z], [0, 0, 1], 0.07, 0.016), {
        kind: 'detail',
        width: value('widthFine'),
        intensity: value('intensityFine') + 0.25,
        depth: 'overlay',
        draw: 'figure-dim',
      });
      const leaders = traceLeaders(anchors);
      addLines(root, 'trace-rule', [leaderDot(anchors.figureEnd, 0.012), ...leaders.toRule], { kind: 'trace', width: value('widthTrace'), intensity: 1, depth: 'overlay', hue: 'rhodamine', draw: 'trace-rule' });
      addLines(root, 'rule', ruleCard(anchors), { kind: 'edge', width: value('widthEdge'), intensity: value('intensityEdge'), depth: 'visible', draw: 'rule' });
      addLines(root, 'trace-source', leaders.toSource, { kind: 'trace', width: value('widthTrace'), intensity: 1, depth: 'overlay', hue: 'rhodamine', draw: 'trace-source' });
      addLines(root, 'source', sourceDoc(anchors), { kind: 'edge', width: value('widthEdge'), intensity: value('intensityEdge'), depth: 'visible', draw: 'source' });

      // ---- Dimensions: how far the month came out; the height of the stack ----
      const yb = -l.ringHeight / 2;
      addLines(root, 'dim-extract', dimension([l.ringOuter, yb, 0], [l.ringOuter + l.extractDistance, yb, 0], [0, 0, 1], l.stripDepth / 2 + 0.16), {
        kind: 'detail',
        width: value('widthFine'),
        intensity: value('intensityFine') + 0.15,
        depth: 'overlay',
        draw: 'dim-extract',
      });
      const d = l.stripDepth / 2;
      addLines(root, 'dim-stack', dimension([sx, layerY(l, 0), d], [sx, layerY(l, 2), d], [-1, 0, 0], 0.14), {
        kind: 'detail',
        width: value('widthFine'),
        intensity: value('intensityFine') + 0.15,
        depth: 'overlay',
        draw: 'dim-stack',
      });

      anchorsWorld = compositionBounds(l, anchors);
      ringWorld = ringBounds(l);
      log.debug(`built: ${lines.length} line sets, ${solids.length} solids`);
    },

    update(progress: number, _timeMs: number) {
      if (!layout || !solidMaterial || !key) return;
      const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
      const m = Math.min(1, Math.max(0, value('maturity')));
      const l = layout;

      // Ring: draw on, then index through detents to the month at θ = 0.
      setDraw('ring', easeEnter(phase(p, TIMELINE.ring)));
      setDraw('ring:hidden', phase(p, TIMELINE.ringHidden) > 0 ? 1 : 0);
      const hiddenFade = phase(p, TIMELINE.ringHidden);
      setDraw('dial', easeEnter(phase(p, TIMELINE.dial)));
      const steps = Math.round(value('indexSteps'));
      const phi = (indexTurn(p, steps) - steps) * SEGMENT_ANGLE;
      ringPivot.rotation.set(0, phi, 0);
      segGroup.rotation.set(0, phi, 0);
      segGroup.position.set(easeTravel(phase(p, TIMELINE.extract)) * l.extractDistance, 0, 0);
      setDraw('dim-extract', easeEnter(phase(p, TIMELINE.dimExtract)));

      // Strips grow out of the month, rise to their layer, then draw their contents.
      strips.forEach((g, i) => {
        const ph = stripPhases(p, STRIP_WINDOWS[i]!);
        g.visible = ph.grow > 0;
        g.scale.set(Math.max(1e-3, ph.grow), 1, 1);
        // Each strip comes out of the month's outer face, then travels to its station and layer.
        const fromX = l.ringOuter + l.extractDistance;
        g.position.x = fromX + (stripStartX(l) - fromX) * ph.grow;
        g.position.y = i * l.stripGap * ph.grow;
        setDraw(`strip-${i}`, 1);
        setDraw(`strip-${i}:hidden`, 1);
        setDraw(`content-${i}`, ph.contents);
      });
      setDraw('connectors', easeEnter(phase(p, TIMELINE.connectors)));
      setDraw('dim-stack', easeEnter(phase(p, TIMELINE.dimStack)));
      setDraw('figure', easeEnter(phase(p, TIMELINE.figure)));
      setDraw('figure-dim', easeEnter(phase(p, TIMELINE.figure)));
      setDraw('trace-rule', phase(p, TIMELINE.traceToRule));
      setDraw('rule', easeEnter(phase(p, TIMELINE.rule)));
      setDraw('trace-source', phase(p, TIMELINE.traceToSource));
      setDraw('source', easeEnter(phase(p, TIMELINE.source)));
      setDraw('sheet', easeEnter(phase(p, TIMELINE.sheet)));
      setDraw('plate', easeEnter(phase(p, TIMELINE.plate)));

      // Camera: from the ring alone to the whole sheet.
      const k = easeTravel(phase(p, TIMELINE.camera));
      const cxv = boundsRing.cx + (boundsAll.cx - boundsRing.cx) * k;
      const cyv = boundsRing.cy + (boundsAll.cy - boundsRing.cy) * k;
      const hx = boundsRing.hx + (boundsAll.hx - boundsRing.hx) * k;
      const hy = boundsRing.hy + (boundsAll.hy - boundsRing.hy) * k;
      const margin = 1 + value('framingMargin') * 2;
      const halfH = Math.max(hy, hx / view.aspect) * margin;
      const halfW = halfH * view.aspect;
      camera.left = cxv - halfW;
      camera.right = cxv + halfW;
      camera.top = cyv + halfH;
      camera.bottom = cyv - halfH;
      camera.updateProjectionMatrix();
      const pxPerWorld = view.height / (2 * halfH);
      sheetGroup.position.set(cxv, cyv, -1);
      sheetGroup.scale.setScalar(1 / pxPerWorld);

      // Brightness by kind, then maturity: linework fades to solid Alloy.
      for (const entry of lines) {
        const u = entry.mesh.material.uniforms;
        let intensity = entry.base;
        if (entry.kind === 'edge') intensity = entry.base + (value('edgesAtMaturity') - entry.base) * m;
        else if (entry.kind === 'hidden') intensity = entry.base * (1 - m) * (entry.mesh.name.startsWith('ring') || entry.mesh.name.startsWith('month') ? hiddenFade : 1);
        else if (entry.kind === 'sheet') intensity = entry.base * (1 - m);
        else if (entry.kind === 'detail') intensity = entry.base * (1 - 0.4 * m);
        sampleRamp(ramps[entry.hue], intensity, rgb);
        (u.uColor!.value as Color).setRGB(rgb[0], rgb[1], rgb[2]);
        entry.mesh.userData.intensity = intensity;
        u.uDistScale!.value = entry.space === 'world' ? pxPerWorld : 1;
        entry.mesh.visible = intensity > 0.001 && (u.uDraw!.value as number) > 0;
      }

      // Solids: depth only at maturity 0; Alloy, fading in, above it.
      solidMaterial.colorWrite = m > 0;
      solidMaterial.transparent = m > 0 && m < 1;
      solidMaterial.opacity = m;
      solidMaterial.depthWrite = true;
      key.intensity = value('keyLight') * m;
      object3d.environmentIntensity = value('envIntensity') * m;
    },

    resize(next: Viewport) {
      view.width = Math.max(1, next.width);
      view.height = Math.max(1, next.height);
      view.aspect = view.width / view.height;
      view.pixelRatio = next.pixelRatio;
      const dirSign: 1 | -1 = next.dir === 'rtl' ? -1 : 1;
      const dirChanged = dirSign !== view.dirSign;
      view.dirSign = dirSign;
      root.scale.set(dirSign, 1, 1);
      // Target pixels exactly as the presenter rounds them.
      shared.uResolution.value.set(Math.max(1, Math.round(view.width * view.pixelRatio)), Math.max(1, Math.round(view.height * view.pixelRatio)));
      shared.uPixelRatio.value = shared.uResolution.value.y / view.height;
      placeCamera();
      if (layout) {
        const ring = cameraBounds(ringWorld);
        const f = value('ringFraming');
        boundsRing = { cx: ring.cx, cy: ring.cy, hx: ring.hx * f, hy: ring.hy * f };
        boundsAll = cameraBounds(anchorsWorld);
      }
      buildSheet();
      if (dirChanged) log.debug(`direction ${next.dir}`);
    },

    dispose() {
      object3d.environment = null;
      for (const child of [...sheetGroup.children]) disposeObject3D(child);
      disposeObject3D(object3d);
      lines.length = 0;
      draws.clear();
      solids.length = 0;
      solidMaterial = null;
      key = null;
      layout = null;
    },
  };
  return scene;
}

export default createMubinFlowScene;
