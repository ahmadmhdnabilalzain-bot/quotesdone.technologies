/**
 * Rail layout maths (three-free, shared with ProductIndex.astro). The key check: the DOM label
 * anchors computed without three.js agree with a real three.js camera at several aspects, which
 * proves the CSS formula (x = fraction of width, y = 50cqh - k * 50cqw).
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  buildStations,
  cameraAt,
  capAt,
  contactAt,
  datumYZ,
  dockAt,
  extrudeAt,
  labelAnchors,
  renderModeFor,
  verticalFovDeg,
} from '../../src/three/scenes/rail/layout.ts';
import { createCoilGeometry, createRailGeometry, syntheticEnvelope } from '../../src/three/scenes/rail/geometry.ts';
import type { BufferGeometry } from 'three';
import { RAIL_BEATS, RAIL_PARAMS } from '../../src/three/scenes/rail/params.ts';
import home from '../../src/content/en/home.json';

const P = RAIL_PARAMS;

describe('label anchors', () => {
  it('match a real three.js camera at aspects 4:3, 16:10 and 21:9', () => {
    const anchors = labelAnchors(home.productIndex.items, P);
    expect(anchors.map((a) => a.slug)).toEqual(home.productIndex.items.map((p) => p.slug));
    const pose = cameraAt(1, P, 1);
    const [, dz] = datumYZ(P);
    const stations = buildStations(home.productIndex.items, P);
    for (const aspect of [4 / 3, 1.6, 21 / 9]) {
      const cam = new PerspectiveCamera(verticalFovDeg(P.hfovDeg.value, aspect), aspect, 0.05, 80);
      cam.position.set(...pose.position);
      cam.lookAt(...pose.target);
      cam.updateMatrixWorld(true);
      anchors.forEach((a, i) => {
        const ndc = new Vector3(stations[i]!.x, -P.railHeight.value - 0.08, dz).project(cam);
        const width = 1000;
        const height = width / aspect;
        // CSS: inline-start = fraction * width; top = 50cqh - k * 50cqw.
        expect(a.inlineFraction * width).toBeCloseTo(((ndc.x + 1) / 2) * width, 3);
        expect(height / 2 - a.k * (width / 2)).toBeCloseTo(((1 - ndc.y) / 2) * height, 3);
      });
    }
  });

  it('every product label lands inside the stage at 16:10', () => {
    for (const a of labelAnchors(home.productIndex.items, P)) {
      expect(a.inlineFraction).toBeGreaterThan(0.05);
      expect(a.inlineFraction).toBeLessThan(0.85);
      const top = 0.5 - a.k * 1.6 * 0.5; // fraction of height
      expect(top).toBeGreaterThan(0.4);
      expect(top).toBeLessThan(0.85);
    }
  });
});

describe('choreography', () => {
  it('the line holds at 0 and the rail is complete after its beat', () => {
    expect(extrudeAt(0)).toBe(0);
    expect(extrudeAt(RAIL_BEATS.extrude[0])).toBe(0);
    expect(extrudeAt(RAIL_BEATS.extrude[1])).toBe(1);
  });

  it('a dock is hidden before its beat, comes down, and rests exactly on the seat with its light on', () => {
    RAIL_BEATS.docks.forEach((beat, i) => {
      expect(dockAt(beat[0] - 0.01, i, P).visible).toBe(false);
      const start = dockAt(beat[0] + 1e-4, i, P);
      expect(start.visible).toBe(true);
      expect(start.lift).toBeGreaterThan(P.dockLift.value * 0.95);
      const end = dockAt(beat[1], i, P);
      expect(end.lift).toBe(0);
      expect(end.lead).toBe(0);
      expect(dockAt(beat[1] + 0.05, i, P).light).toBe(1);
      expect(dockAt(contactAt(i) - 1e-4, i, P).light).toBe(0);
      expect(dockAt(contactAt(i) + 0.03, i, P).light).toBe(1);
      expect(dockAt(contactAt(i), i, P).lift).toBeLessThan(0.002); // it really is on the pad
      expect(dockAt(beat[0] + 0.05, i, P).light).toBe(0);
      // The settle dips below the seat, but only a little.
      let minLift = 0;
      for (let t = beat[0]; t <= beat[1]; t += 0.001) minLift = Math.min(minLift, dockAt(t, i, P).lift);
      expect(minLift).toBeLessThan(0);
      expect(minLift).toBeGreaterThan(-0.05 * P.objectHeight.value);
    });
  });

  it('docks are staggered: product i seats before product i + 1', () => {
    for (let i = 0; i < RAIL_BEATS.docks.length - 1; i++) expect(RAIL_BEATS.docks[i]![1]).toBeLessThan(RAIL_BEATS.docks[i + 1]![1]);
  });

  it('caps cascade along the rail and all seat inside their beat', () => {
    const n = P.emptyStations.value;
    const mid = (RAIL_BEATS.caps[0] + RAIL_BEATS.caps[1]) / 2;
    for (let i = 0; i < n - 1; i++) expect(capAt(mid, i, n)).toBeGreaterThanOrEqual(capAt(mid, i + 1, n));
    for (let i = 0; i < n; i++) expect(capAt(RAIL_BEATS.caps[1], i, n)).toBe(1);
  });

  it('the camera starts square to the datum and is mirrored for RTL', () => {
    const front = cameraAt(0, P, 1);
    const [dy, dz] = datumYZ(P);
    expect(front.position[1]).toBeCloseTo(dy, 9);
    expect(front.target[1]).toBeCloseTo(dy, 9);
    expect(front.target[2]).toBeCloseTo(dz, 9);
    const ltr = cameraAt(0.7, P, 1);
    const rtl = cameraAt(0.7, P, -1);
    expect(rtl.position[0]).toBeCloseTo(-ltr.position[0], 9);
    expect(rtl.target[0]).toBeCloseTo(-ltr.target[0], 9);
  });
});

describe('stations and status', () => {
  it('maps status to render state and keeps unknown products neutral', () => {
    expect(renderModeFor('live')).toBe('solid');
    expect(renderModeFor('in-development')).toBe('linework');
    expect(renderModeFor('coming-soon')).toBe('linework'); // anything not live is never drawn as finished
    const s = buildStations([{ slug: 'future-product', status: 'live' }], P);
    expect(s[0]!.product).toMatchObject({ kind: 'plate', mode: 'solid' });
    expect(s.filter((x) => x.product === null).length).toBe(P.emptyStations.value);
  });

  it('the synthetic waveform envelope is deterministic and bounded', () => {
    const a = syntheticEnvelope(400, 7);
    const b = syntheticEnvelope(400, 7);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(syntheticEnvelope(400, 8))).not.toEqual(Array.from(a));
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

/** Fraction of triangles whose winding (counter-clockwise = front) agrees with their vertex normals. */
function windingAgreement(g: BufferGeometry): number {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  let ok = 0;
  let total = 0;
  for (let i = 0; i < pos.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(pos, i);
    const b = new Vector3().fromBufferAttribute(pos, i + 1);
    const c = new Vector3().fromBufferAttribute(pos, i + 2);
    const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (face.lengthSq() < 1e-18) continue;
    const n = new Vector3().fromBufferAttribute(nrm, i).add(new Vector3().fromBufferAttribute(nrm, i + 1)).add(new Vector3().fromBufferAttribute(nrm, i + 2));
    total++;
    if (face.dot(n) > 0) ok++;
  }
  return ok / total;
}

describe('geometry', () => {
  it('coil and rail triangles face their normals (front faces are not culled)', () => {
    const coil = createCoilGeometry(P, 1);
    expect(windingAgreement(coil)).toBe(1);
    // The rail's faces must point AWAY from its long axis (an inside-out extrusion would be
    // culled). Small groove walls may face inward by construction, so allow a few.
    const rail = createRailGeometry(P);
    const pos = rail.getAttribute('position');
    const axis = new Vector3(0, -P.railHeight.value / 2, 0);
    let outward = 0;
    let sides = 0;
    for (let i = 0; i < pos.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(pos, i);
      const b = new Vector3().fromBufferAttribute(pos, i + 1);
      const c = new Vector3().fromBufferAttribute(pos, i + 2);
      const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
      if (Math.abs(face.x) > 0.9) continue; // end caps
      const centroid = a.add(b).add(c).divideScalar(3);
      const out = new Vector3(0, centroid.y - axis.y, centroid.z - axis.z);
      sides++;
      if (face.dot(out) > 0) outward++;
    }
    expect(outward / sides).toBeGreaterThan(0.9);
    coil.dispose();
    rail.dispose();
  });
});
