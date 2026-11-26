/**
 * Colour temperature -> linear RGB, for the key light. Tanner Helland's fit of the Planckian locus
 * (good to a few percent between 1000 K and 40000 K), normalised so the brightest channel is 1.
 * The fit works in sRGB 0..255; three's Color.setRGB with SRGBColorSpace converts to linear.
 */
import { Color, SRGBColorSpace } from 'three';

export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (x: number): number => Math.min(255, Math.max(0, x)) / 255;
  const rgb: [number, number, number] = [c(r), c(g), c(b)];
  const max = Math.max(...rgb);
  return [rgb[0] / max, rgb[1] / max, rgb[2] / max];
}

export function kelvinToColor(kelvin: number): Color {
  const [r, g, b] = kelvinToRgb(kelvin);
  return new Color().setRGB(r, g, b, SRGBColorSpace);
}
