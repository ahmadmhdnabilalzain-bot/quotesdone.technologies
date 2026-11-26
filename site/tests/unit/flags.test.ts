import { describe, expect, it } from 'vitest';
import { parseFlags } from '../../src/lib/flags.ts';

describe('parseFlags', () => {
  it('defaults everything off', () => {
    expect(parseFlags('')).toEqual({ hud: false, debug: false, tier: null, still: false, level: null, scene: null, progress: null });
  });

  it('treats a bare flag and truthy values as on', () => {
    expect(parseFlags('?hud').hud).toBe(true);
    expect(parseFlags('?hud=1').hud).toBe(true);
    expect(parseFlags('?hud=true').hud).toBe(true);
    expect(parseFlags('?hud=0').hud).toBe(false);
    expect(parseFlags('?still').still).toBe(true);
  });

  it('?debug implies the HUD', () => {
    const flags = parseFlags('?debug');
    expect(flags.debug).toBe(true);
    expect(flags.hud).toBe(true);
  });

  it('parses tier names and numeric aliases, rejects junk', () => {
    expect(parseFlags('?tier=high').tier).toBe('high');
    expect(parseFlags('?tier=MID').tier).toBe('mid');
    expect(parseFlags('?tier=0').tier).toBe('still');
    expect(parseFlags('?tier=2').tier).toBe('mid');
    expect(parseFlags('?tier=ultra').tier).toBeNull();
  });

  it('clamps progress and level, validates scene ids', () => {
    expect(parseFlags('?scene=smoke&p=0.5')).toMatchObject({ scene: 'smoke', progress: 0.5 });
    expect(parseFlags('?p=4').progress).toBe(1);
    expect(parseFlags('?p=-1').progress).toBe(0);
    expect(parseFlags('?p=abc').progress).toBeNull();
    expect(parseFlags('?level=2.6').level).toBe(3);
    expect(parseFlags('?scene=<script>').scene).toBeNull();
  });
});
