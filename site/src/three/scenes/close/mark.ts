/**
 * The Q end cap, extruded from the companion mark's own outline (`mark.svg`, an unmodified copy of
 * brand/logo/final/mark.svg; a unit test checks the bytes match). This is the mark's own cut
 * (heavier strokes, gap 4.2, tail 16), NOT stroke part 0 of the wordmark.
 *
 * Coordinates: the SVG is y-down in an 800-unit viewBox. The geometry is flipped to y-up and
 * normalised so that, in world units:
 *   - the bottom of the mark (its baseline, where the tail runs) is y = 0,
 *   - the tip of the tail (its inline-end edge) is x = 0,
 *   - the extrusion is centred on z = 0.
 * Scale comes from the tail: its thickness (SVG units) maps to `tailThickness` world units.
 */
import { ShapePath, type BufferGeometry, type Shape } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import markSvg from './mark.svg?raw';
import { extrudeChamfered } from './shared.ts';

/** Tail thickness in mark.svg units: the tail is the bar from y 557.61 to 625.91. */
export const MARK_TAIL_SVG = 625.91 - 557.61;

/** Parses SVG text into fillable paths. Injected in unit tests (Node has no DOMParser). */
export type SvgPathParser = (svgText: string) => ShapePath[];

/** Browser default: three's SVGLoader (needs DOMParser). */
export const svgLoaderParser: SvgPathParser = (text) => new SVGLoader().parse(text).paths;

export const MARK_SVG_TEXT: string = markSvg;

export function markShapes(parse: SvgPathParser, text: string = MARK_SVG_TEXT): Shape[] {
  const shapes: Shape[] = [];
  for (const path of parse(text)) {
    const style = (path.userData as { style?: { fill?: string; fillRule?: string } } | undefined)?.style;
    if (style && style.fill === 'none') continue;
    // r187: ShapePath.toShapes() handles the fill rule (SVGLoader.createShapes is deprecated).
    shapes.push(...path.toShapes());
  }
  if (shapes.length === 0) throw new Error('mark.svg produced no fillable shapes');
  return shapes;
}

export interface MarkGeometryOptions {
  /** World thickness of the tail; sets the scale of the whole mark. */
  tailThickness: number;
  /** Extrusion depth, world units. */
  depth: number;
  /** Chamfer on the front and back faces, world units. */
  chamfer: number;
  /** Bezier subdivisions per curve segment (the outline has ~120 of them). */
  curveSegments: number;
}

export function buildMarkGeometry(shapes: Shape[], o: MarkGeometryOptions): { geometry: BufferGeometry; width: number; height: number } {
  const s = o.tailThickness / MARK_TAIL_SVG;
  // Extrude in SVG units (chamfer converted), then scale. Flipping Y alone would mirror the
  // winding and turn the faces inside out, so Z is flipped too: det(s, -s, -1) > 0 keeps
  // the winding, and the extrusion is centred on z afterwards anyway.
  const geometry = extrudeChamfered(shapes, o.depth / s, o.chamfer / s, Math.max(2, Math.round(o.curveSegments)));
  geometry.scale(s, -s, -s);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-box.max.x, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const b = geometry.boundingBox!;
  return { geometry, width: b.max.x - b.min.x, height: b.max.y - b.min.y };
}

/** World x where the tail meets the bowl (SVG x 377.23 -> 676.26 is the tail's flat run). */
export function tailStartX(tailThickness: number): number {
  return -((676.26 - 377.23) * tailThickness) / MARK_TAIL_SVG;
}
