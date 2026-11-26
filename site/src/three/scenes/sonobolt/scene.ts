/**
 * Scene 5, Sonobolt: "One continuous line" (structure-v1 §2.2 row 5). See README.md.
 *
 * Separate Alloy ribbons (songs, each shaped by a synthetic envelope) ride the rail toward
 * station 2. A beat grid appears as ticks on the rail; the songs slow, settle to the grid, close
 * their gaps and fuse at the seams (a brief Rhodamine weld light that cools to nothing). The one
 * ribbon then winds onto the hub in the Mix slot as a flat coil: one continuous file. Studio and
 * Visuals sit beside it, capped. The Mix status ring is lit.
 *
 * Contract: update(progress, time) is pure (all state is derived from the inputs and from what
 * create/resize set), no DOM, no clock, no rAF; dispose frees everything.
 */
import { AmbientLight, DirectionalLight, Group, PerspectiveCamera, Scene as ThreeScene } from 'three';
import type { RenderableScene, SceneContext, Viewport } from '../../runtime/scene.ts';
import type { QualityLevel } from '../../runtime/ladder.ts';
import { disposeObject3D } from '../../runtime/disposal.ts';
import type { Logger } from '../../../lib/log.ts';
import { SONOBOLT_PARAMS } from './params.ts';
import { generateEnvelopes, type SongEnvelope } from './envelope.ts';
import { radiusAfter, reelState, type ReelGeometry } from './path.ts';
import { createRibbon, type Ribbon, type SongPose } from './ribbon.ts';
import { createStation, ALLOY, RHODAMINE, type Station } from './station.ts';
import { timeline } from './timeline.ts';

const TAU = Math.PI * 2;
/** Rail extent: long enough to run off frame on both sides of station 2. */
const RAIL_FROM = -48;
const RAIL_TO = 14;

export function createSonoboltScene(): RenderableScene {
  const params = structuredClone(SONOBOLT_PARAMS);
  const v = (name: keyof typeof params): number => params[name].value;

  const object3d = new ThreeScene();
  object3d.name = 'sonobolt';
  const camera = new PerspectiveCamera(v('fov'), 1, 0.1, 120);
  /** Everything except the camera. Mirrored on x for RTL pages (the flow runs the other way). */
  const world = new Group();
  world.name = 'sonobolt-world';

  let ribbon: Ribbon | null = null;
  let station: Station | null = null;
  let songs: SongEnvelope[] = [];
  let reel: ReelGeometry | null = null;
  let hubSpan = 0;
  let windTravel = 0;
  let totalLength = 0;
  let tierAllowsShadow = false;
  let dirSign = 1;
  let pullback = 1;
  let log: Logger | null = null;
  const poses: SongPose[] = [];

  const scene: RenderableScene = {
    id: 'sonobolt',
    params,
    // Separate songs on the grid / fused / wound (structure-v1 §3.6 stills).
    stillAt: [0.22, 0.5, 1],
    object3d,
    camera,

    async create(ctx: SceneContext) {
      log = ctx.log;
      object3d.environment = ctx.envMap;
      object3d.environmentIntensity = v('envIntensity');
      tierAllowsShadow = ctx.tierConfig.contactShadow;

      const rowsPerBeat = Math.max(params.rowsPerBeat.min, Math.round(v('rowsPerBeat') * ctx.tierConfig.detail));
      songs = generateEnvelopes({
        seed: (ctx.seed * 7919 + v('seedOffset')) >>> 0,
        songCount: Math.round(v('songCount')),
        beatsPerSong: Math.round(v('beatsPerSong')),
        rowsPerBeat,
        ampFloor: v('ampFloor'),
        endTaperBeats: v('endTaper'),
        crossfadeBeats: v('crossfadeBeats'),
        tempoSpread: v('tempoSpread'),
      });
      await ctx.yieldToMain();

      reel = {
        guide: { x: v('guideOffsetX'), z: 0 },
        centre: { x: 0, z: v('coilOffsetZ') },
        r0: v('hubRadius'),
        b: v('coilPitch') / TAU,
      };
      const songLength = Math.round(v('beatsPerSong')) * v('beatLength');
      totalLength = songLength * songs.length;
      hubSpan = reelState(0, reel).spanLength;
      const finalWound = totalLength + v('windOvershoot');
      const finalRadius = radiusAfter(finalWound, reel.r0, reel.b);
      windTravel = finalWound + Math.sqrt((reel.guide.x - reel.centre.x) ** 2 + (reel.guide.z - reel.centre.z) ** 2 - finalRadius ** 2);
      if (finalRadius > v('socketRadius') - 0.06) log.warn(`coil radius ${finalRadius.toFixed(2)} overruns the Mix slot (${v('socketRadius')})`);

      ribbon = createRibbon(songs, v('beatLength'), rowsPerBeat, ALLOY, v('roughness'), RHODAMINE.clone().multiplyScalar(v('weldGlow')), v('weldWidth'));
      world.add(ribbon.mesh);

      station = createStation(
        {
          coilX: reel.centre.x,
          coilZ: reel.centre.z,
          guideX: reel.guide.x,
          socketRadius: v('socketRadius'),
          socketSpacing: v('socketSpacing'),
          hubRadius: v('hubRadius'),
          railFrom: RAIL_FROM,
          railTo: RAIL_TO,
          detail: ctx.tierConfig.detail,
        },
        v('datumGlow'),
      );
      station.setShadowEnabled(tierAllowsShadow);
      world.add(station.group);

      // One key light (upper left, in front), a faint rim from behind, a whisper of ambient.
      const key = new DirectionalLight(0xffffff, v('keyLight'));
      key.name = 'sonobolt-key';
      key.position.set(-4, 6, 5);
      const rim = new DirectionalLight(0xffffff, v('rimLight'));
      rim.name = 'sonobolt-rim';
      rim.position.set(5, 2.5, -6);
      world.add(key, rim, new AmbientLight(0xffffff, 0.04));
      object3d.add(world);

      for (let s = 0; s < songs.length; s++) poses.push({ start: 0, scale: 1, lift: 0, roll: 0 });
      log.info(`created: ${songs.length} songs, ${rowsPerBeat} rows/beat, mix length ${totalLength.toFixed(1)}, coil radius ${finalRadius.toFixed(2)}`);
      await ctx.yieldToMain();
    },

    update(progress: number, timeMs: number) {
      if (!ribbon || !station || !reel) return;
      const frame = timeline(progress, params, { hubSpan, windTravel });
      const unaligned = 1 - frame.align;
      const open = 1 - frame.fuse;
      const songLength = ribbon.layout.songLength;
      const seconds = timeMs / 1000;

      // Song poses: own tempo, gaps, height and roll until aligned and fused.
      let cursor = 0;
      for (let s = 0; s < songs.length; s++) {
        const song = songs[s]!;
        const pose = poses[s]!;
        const scale = 1 + (song.tempo - 1) * unaligned;
        pose.start = cursor;
        pose.scale = scale;
        pose.lift = (song.lift * v('songLift') + v('songBob') * Math.sin(seconds * v('bobHz') * TAU + song.phase)) * unaligned;
        pose.roll = song.roll * v('songRoll') * unaligned;
        cursor += songLength * scale + v('songGap') * open;
      }

      const state = reelState(frame.travel, reel);
      ribbon.apply({
        poses,
        fuse: frame.fuse,
        reel,
        state,
        halfHeight: v('bandHalfHeight'),
        thickness: v('bandThickness'),
        centreY: v('bandCenterY'),
        crown: v('crown'),
      });
      ribbon.setWeld(frame.weld);

      // Grid ticks ride with the head along the straight feed (x = guide + travel - sigma).
      station.setRuler(reel.guide.x + frame.travel, v('beatLength'), frame.grid, reel.guide.x);
      station.setStatus(frame.status * v('statusGlow'));
      const woundFraction = Math.min(1, state.wound / totalLength);
      station.setShadow(0.5 * woundFraction, state.radius * 1.45);

      const { pos, target } = frame.camera;
      // Portrait stages: pull back along the view direction so the composition still fits.
      const k = pullback;
      camera.position.set((target[0] + (pos[0] - target[0]) * k) * dirSign, target[1] + (pos[1] - target[1]) * k, target[2] + (pos[2] - target[2]) * k);
      camera.lookAt(target[0] * dirSign, target[1], target[2]);
      camera.updateMatrixWorld();
    },

    resize(view: Viewport) {
      camera.aspect = view.aspect;
      camera.fov = v('fov');
      camera.updateProjectionMatrix();
      pullback = 1 + Math.max(0, 1 - view.aspect) * v('portraitPullback');
      dirSign = view.dir === 'rtl' ? -1 : 1;
      world.scale.x = dirSign;
    },

    applyQuality(level: QualityLevel) {
      station?.setShadowEnabled(tierAllowsShadow && level.contactShadow);
    },

    dispose() {
      object3d.environment = null; // owned by the runtime
      disposeObject3D(object3d);
      object3d.clear();
      ribbon = null;
      station = null;
      songs = [];
      poses.length = 0;
      log?.debug('disposed');
    },
  };
  return scene;
}
