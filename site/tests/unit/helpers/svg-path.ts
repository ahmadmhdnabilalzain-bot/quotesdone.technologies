/**
 * Test-only SVG parser for Node (no DOMParser): reads every <path d="..."> and builds three
 * ShapePaths from absolute M / L / C / Z commands, which is all the brand masters use.
 * The browser uses three's SVGLoader; the e2e harness covers that path.
 */
import { ShapePath } from 'three';

export function parsePathsForTest(svgText: string): ShapePath[] {
  const paths: ShapePath[] = [];
  for (const m of svgText.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    const sp = new ShapePath();
    const tokens = m[1]!.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
    let i = 0;
    let cmd = '';
    const num = (): number => Number(tokens[i++]);
    while (i < tokens.length) {
      if (/^[MLCZ]$/i.test(tokens[i]!)) cmd = tokens[i++]!.toUpperCase();
      if (cmd === 'M') { sp.moveTo(num(), num()); cmd = 'L'; }
      else if (cmd === 'L') sp.lineTo(num(), num());
      else if (cmd === 'C') sp.bezierCurveTo(num(), num(), num(), num(), num(), num());
      else if (cmd === 'Z') { sp.currentPath?.closePath(); cmd = ''; }
      else throw new Error(`unsupported path command near token ${i}`);
    }
    paths.push(sp);
  }
  return paths;
}
