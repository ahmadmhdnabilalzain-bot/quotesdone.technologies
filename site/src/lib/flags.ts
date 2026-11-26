/**
 * URL flags, parsed in ONE place (structure-v1 §6.6). Pure: give it a query string, get flags.
 * Every flag is documented in site/README.md.
 */
import type { Tier } from '../three/runtime/tier-types.ts';

export interface Flags {
  /** Show the performance HUD overlay. */
  hud: boolean;
  /** Verbose logging, shader error checks, HUD, and the window.__qdt console handle. */
  debug: boolean;
  /** Force a tier instead of detecting one. */
  tier: Tier | null;
  /** Force the still fallback (no 3D is fetched). */
  still: boolean;
  /** Pin the quality ladder to a level (0 = full). */
  level: number | null;
  /** Deep link: render one scene slot frozen at one progress (`?scene=smoke&p=0.5`). */
  scene: string | null;
  progress: number | null;
  /**
   * Look debug switches (`?look=noao,nosignal,bloom` or a view: `?look=ao` | `?look=mask`), see
   * three/runtime/README.md. Undefined when absent.
   */
  look?: LookFlag[];
}

export type LookFlag = 'noao' | 'nosignal' | 'ao' | 'mask' | 'bloom';
const LOOK_FLAGS: readonly LookFlag[] = ['noao', 'nosignal', 'ao', 'mask', 'bloom'];

const TIER_NAMES: readonly Tier[] = ['still', 'low', 'mid', 'high'];
/** Numeric aliases: structure-v1 §6.6 documents `?tier=0|1|2`; 0 = still, 1 = low, 2 = mid, 3 = high. */
const TIER_ALIASES: Readonly<Record<string, Tier>> = { '0': 'still', '1': 'low', '2': 'mid', '3': 'high' };

/** A flag is on when present with no value, or with a truthy value (`?hud`, `?hud=1`, `?hud=true`). */
function isOn(params: URLSearchParams, name: string): boolean {
  if (!params.has(name)) return false;
  const value = (params.get(name) ?? '').trim().toLowerCase();
  return value === '' || value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

function parseTier(raw: string | null): Tier | null {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if ((TIER_NAMES as readonly string[]).includes(value)) return value as Tier;
  return TIER_ALIASES[value] ?? null;
}

function parseNumber(raw: string | null, min: number, max: number): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function parseId(raw: string | null): string | null {
  if (raw === null) return null;
  const value = raw.trim();
  return /^[a-z0-9-]{1,40}$/.test(value) ? value : null;
}

function parseLook(raw: string | null): LookFlag[] {
  return (raw ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is LookFlag => (LOOK_FLAGS as readonly string[]).includes(v));
}

export function parseFlags(search: string): Flags {
  const params = new URLSearchParams(search);
  const debug = isOn(params, 'debug');
  const level = parseNumber(params.get('level'), 0, 10);
  return {
    hud: debug || isOn(params, 'hud'),
    debug,
    tier: parseTier(params.get('tier')),
    still: isOn(params, 'still'),
    level: level === null ? null : Math.round(level),
    scene: parseId(params.get('scene')),
    progress: parseNumber(params.get('p'), 0, 1),
    look: params.has('look') ? parseLook(params.get('look')) : undefined,
  };
}

let cached: Flags | null = null;
/** Flags for the current page (browser only). */
export function currentFlags(): Flags {
  if (cached === null) cached = parseFlags(typeof location === 'undefined' ? '' : location.search);
  return cached;
}
