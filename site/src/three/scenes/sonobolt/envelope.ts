/**
 * Synthetic, musically plausible amplitude envelopes, generated from a seed.
 *
 * Why synthetic: the owner has NOT approved using Sonobolt's measured waveform data (structure-v1
 * §2.2.1, open question Q4). Nothing here is read from, or modelled on, Sonobolt's code or data,
 * and nothing shows how a mix is made: it is a generic "song shape" (intro, build, main,
 * breakdown, main, outro) with a beat pulse, nothing more.
 *
 * Pure: the same seed and options always give the same arrays (unit-tested). No three.js.
 */

/** mulberry32: tiny, fast, good enough for visuals. Returns a function giving [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EnvelopeOptions {
  seed: number;
  songCount: number;
  beatsPerSong: number;
  rowsPerBeat: number;
  /** Lowest amplitude inside a song, 0..1. */
  ampFloor: number;
  /** Pinched-end length of a separate song, in beats. */
  endTaperBeats: number;
  /** Seam blend half-width once fused, in beats. */
  crossfadeBeats: number;
  tempoSpread: number;
}

export interface SongEnvelope {
  /** Pre-alignment tempo factor: this song's length is len x tempo until it aligns. */
  tempo: number;
  /** Pre-alignment vertical offset and roll as -1..1 factors (scaled by params). */
  lift: number;
  roll: number;
  /** Bob phase, radians. */
  phase: number;
  /** Amplitude per row (rows = beatsPerSong x rowsPerBeat + 1), 0..1. Separate song: pinched ends. */
  solo: Float32Array;
  /** Amplitude per row once fused into the mix: blended into its neighbours at the seams. */
  fused: Float32Array;
  /** Distance to the nearest seam with another song, in beats (Infinity at the mix head/tail). */
  seamDistance: Float32Array;
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * One beat's amplitude shape, phase 0..1. Continuous at 0 and 1 (both exactly `base`), so beats
 * and seams never step: a quick attack, a broad kick swell, a small off-beat lift at 0.5.
 */
export function beatShape(phase: number, kickDepth: number): number {
  const attack = smoothstep(0, 0.05, phase);
  const kick = attack * Math.exp(-Math.max(0, phase - 0.05) * 3.6);
  const offbeat = Math.exp(-Math.abs(phase - 0.5) * 10) * 0.5;
  const tail = smoothstep(1, 0.9, phase); // pulls the last 10% back to base so phase 1 == phase 0
  return 0.66 + (0.3 * kickDepth * kick + 0.1 * offbeat) * tail;
}

/** Integer hash -> [-1, 1]. Stable per global row, so coincident seam rows get the same grain. */
function hash11(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

/** Section levels for one song, one value per bar. Picked from a few song shapes, seeded. */
function songShape(bars: number, rand: () => number): number[] {
  const levels: number[] = [];
  const introBars = 1 + Math.floor(rand() * 2);
  const outroBars = 1 + Math.floor(rand() * 2);
  const breakAt = Math.floor(bars * (0.45 + rand() * 0.15));
  for (let b = 0; b < bars; b++) {
    let level: number;
    if (b < introBars) level = 0.34 + 0.12 * (b / introBars) + rand() * 0.05;
    else if (b === introBars) level = 0.62 + rand() * 0.08; // build
    else if (b >= bars - outroBars) level = 0.5 - 0.18 * ((b - (bars - outroBars)) / outroBars) + rand() * 0.04;
    else if (b === breakAt) level = 0.42 + rand() * 0.08; // breakdown
    else level = 0.84 + rand() * 0.16; // main
    levels.push(level);
  }
  return levels;
}

/** Smooth value noise on a 1D lattice, -1..1. */
function valueNoise(lattice: Float32Array, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = lattice[Math.min(lattice.length - 1, Math.max(0, i))] ?? 0;
  const b = lattice[Math.min(lattice.length - 1, Math.max(0, i + 1))] ?? 0;
  return lerp(a, b, f * f * (3 - 2 * f));
}

/**
 * Generate every song. Rows are sampled at `rowsPerBeat` per beat, including both ends, so a song
 * has beatsPerSong x rowsPerBeat + 1 rows and its first and last rows sit exactly on beat lines.
 */
export function generateEnvelopes(opts: EnvelopeOptions): SongEnvelope[] {
  const rand = mulberry32(opts.seed);
  const rows = opts.beatsPerSong * opts.rowsPerBeat + 1;
  const bars = Math.max(1, Math.round(opts.beatsPerSong / 4));

  // Grain: one noise lattice for the WHOLE mix (indexed by global beat), plus a per-row hash on
  // the global row index, so the waveform's fine edge runs straight through every seam.
  const GRAIN_PER_BEAT = 7;
  const grainLattice = Float32Array.from({ length: opts.songCount * opts.beatsPerSong * GRAIN_PER_BEAT + 2 }, () => rand() * 2 - 1);
  const grainAt = (song: number, row: number): number => {
    const globalBeat = song * opts.beatsPerSong + row / opts.rowsPerBeat;
    const globalRow = song * (rows - 1) + row;
    return 1 + 0.13 * valueNoise(grainLattice, globalBeat * GRAIN_PER_BEAT) + 0.07 * hash11(globalRow + opts.seed * 131);
  };

  // Pass 1: per-song smooth level and pulse, before seams are known.
  const raw: Array<{ levels: number[]; beatGain: Float32Array; tempo: number; lift: number; roll: number; phase: number }> = [];
  for (let s = 0; s < opts.songCount; s++) {
    const levels = songShape(bars, rand);
    const beatGain = Float32Array.from({ length: opts.beatsPerSong }, () => 0.85 + rand() * 0.3);
    const tempo = 1 + opts.tempoSpread * (rand() * 2 - 1);
    const lift = rand() * 2 - 1;
    const roll = rand() * 2 - 1;
    const phase = rand() * Math.PI * 2;
    raw.push({ levels, beatGain, tempo, lift, roll, phase });
  }

  /** Smooth section level at beat position x (0..beatsPerSong): bars blend over half a bar. */
  const levelAt = (levels: number[], beat: number): number => {
    const barPos = beat / 4 - 0.5;
    const i = Math.floor(barPos);
    const f = smoothstep(0.25, 0.75, barPos - i);
    const a = levels[Math.min(levels.length - 1, Math.max(0, i))] ?? 0.5;
    const b = levels[Math.min(levels.length - 1, Math.max(0, i + 1))] ?? 0.5;
    return lerp(a, b, f);
  };

  return raw.map((song, s) => {
    const solo = new Float32Array(rows);
    const fused = new Float32Array(rows);
    const seamDistance = new Float32Array(rows);
    const prev = raw[s - 1];
    const next = raw[s + 1];
    // The level the two songs meet at, so both sides of a seam agree exactly.
    const meetHead = prev ? 0.5 * (levelAt(prev.levels, opts.beatsPerSong) + levelAt(song.levels, 0)) : null;
    const meetTail = next ? 0.5 * (levelAt(song.levels, opts.beatsPerSong) + levelAt(next.levels, 0)) : null;

    for (let r = 0; r < rows; r++) {
      const beat = r / opts.rowsPerBeat; // 0..beatsPerSong
      const beatIndex = Math.min(opts.beatsPerSong - 1, Math.floor(beat));
      const phase = r === rows - 1 ? 1 : beat - Math.floor(beat);
      const level = levelAt(song.levels, beat);
      const kickDepth = (song.beatGain[beatIndex] ?? 1) * (level < 0.5 ? 0.45 : 1); // softer pulse in quiet parts
      const shape = beatShape(phase, kickDepth);
      const grain = grainAt(s, r);
      const amp = (lvl: number): number => Math.max(opts.ampFloor, Math.min(1, lvl * shape * grain));
      const own = amp(level);

      // Separate song: both ends pinch to zero (it is a closed piece).
      const fromHead = beat;
      const fromTail = opts.beatsPerSong - beat;
      const pinch = smoothstep(0, opts.endTaperBeats, fromHead) * smoothstep(0, opts.endTaperBeats, fromTail);
      solo[r] = own * pinch;

      // Fused: within crossfadeBeats of a seam, blend to the shared meeting level (with the same
      // beat pulse, which is continuous across the seam). The mix's own head and tail still pinch.
      let value = own;
      let seam = Number.POSITIVE_INFINITY;
      if (meetHead !== null && fromHead < opts.crossfadeBeats) {
        const w = smoothstep(opts.crossfadeBeats, 0, fromHead);
        value = amp(lerp(level, meetHead, w));
        seam = fromHead;
      } else if (meetHead === null) {
        value *= smoothstep(0, opts.endTaperBeats, fromHead);
      }
      if (meetTail !== null && fromTail < opts.crossfadeBeats) {
        const w = smoothstep(opts.crossfadeBeats, 0, fromTail);
        value = amp(lerp(level, meetTail, w));
        seam = Math.min(seam, fromTail);
      } else if (meetTail === null) {
        value *= smoothstep(0, opts.endTaperBeats, fromTail);
      }
      if (meetHead !== null) seam = Math.min(seam, fromHead);
      if (meetTail !== null) seam = Math.min(seam, fromTail);
      fused[r] = value;
      seamDistance[r] = seam;
    }
    return { tempo: song.tempo, lift: song.lift, roll: song.roll, phase: song.phase, solo, fused, seamDistance };
  });
}
