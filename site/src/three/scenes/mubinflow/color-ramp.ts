/**
 * Line colours that survive the post pass. The presenter tone-maps every scene with AgX, which
 * dims Alloy (#ECEAE4 showed as ~#CBCAC8) and desaturates Rhodamine. So each line's colour is
 * chosen in DISPLAY space (a mix of Carbon and the brand colour by `intensity`) and converted to
 * the linear input that AgX maps to it, through the inverse in the logo scene's agx.ts.
 *
 * A ramp of 33 samples is solved once at create(); update() only interpolates (cheap, pure).
 * Rhodamine is outside AgX's output gamut: the inverse returns the closest reachable colour.
 */
import { hexToSrgb, inverseAgx } from '../logo/agx.ts';

export type Rgb = [number, number, number];

const STEPS = 33;

function toHex(srgb: Rgb): string {
  return `#${srgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Display-space ramp from `fromHex` (k = 0) to `toHex` (k = 1), as linear AgX inputs. */
export function buildRamp(fromHex: string, toHexColour: string): Rgb[] {
  const a = hexToSrgb(fromHex);
  const b = hexToSrgb(toHexColour);
  const out: Rgb[] = [];
  for (let i = 0; i < STEPS; i++) {
    const k = i / (STEPS - 1);
    // Mix in display space, so `intensity` reads as perceived brightness between the two.
    const mixed = a.map((v, c) => v + (b[c]! - v) * k) as Rgb;
    out.push(inverseAgx(toHex(mixed)).linear);
  }
  return out;
}

/** Linear AgX input for intensity k (0..1) on a ramp. */
export function sampleRamp(ramp: readonly Rgb[], k: number, out: Rgb = [0, 0, 0]): Rgb {
  const t = Math.min(1, Math.max(0, Number.isFinite(k) ? k : 0)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(t));
  const f = t - i;
  const a = ramp[i]!;
  const b = ramp[i + 1]!;
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}
