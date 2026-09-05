/**
 * Fill empty .anim clips with SpriteFrame tracks (Cocos 3.8 ObjectTrack format).
 * Reads PNG .meta @f9941 UUIDs from Chinese frame folders. Does NOT invent frames.
 * Usage: node .cursor/scripts/fill-anim-clips.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const FRAMES = path.join(ROOT, 'assets/resources/sprite/frames');
const ANIMS = path.join(ROOT, 'assets/resources/animations');
const SAMPLE = 10;

/** @type {{ frameDir: string, animRel: string, wrapMode: number }[]} */
const JOBS = [
  { frameDir: '角色/主角/待机', animRel: 'player/idle.anim', wrapMode: 2 },
  { frameDir: '角色/主角/移动', animRel: 'player/walk.anim', wrapMode: 2 },
  { frameDir: '角色/主角/攻击1', animRel: 'player/melee_attack.anim', wrapMode: 1 },
  { frameDir: '角色/主角/死亡', animRel: 'player/die.anim', wrapMode: 1 },
  { frameDir: '角色/骷髅兵/待机', animRel: 'enemy_minion/idle.anim', wrapMode: 2 },
  { frameDir: '角色/骷髅兵/移动', animRel: 'enemy_minion/walk.anim', wrapMode: 2 },
  { frameDir: '角色/骷髅兵/攻击', animRel: 'enemy_minion/attack.anim', wrapMode: 1 },
  { frameDir: '角色/骷髅兵/死亡', animRel: 'enemy_minion/die.anim', wrapMode: 1 },
  { frameDir: '角色/骷髅BOSS/待机', animRel: 'enemy_boss/idle.anim', wrapMode: 2 },
  { frameDir: '角色/骷髅BOSS/移动', animRel: 'enemy_boss/walk.anim', wrapMode: 2 },
  { frameDir: '角色/骷髅BOSS/攻击', animRel: 'enemy_boss/attack.anim', wrapMode: 1 },
  { frameDir: '角色/骷髅BOSS/死亡', animRel: 'enemy_boss/die.anim', wrapMode: 1 },
  { frameDir: '角色/英雄1/待机', animRel: 'hero_01/idle.anim', wrapMode: 2 },
  { frameDir: '角色/英雄1/移动', animRel: 'hero_01/walk.anim', wrapMode: 2 },
  { frameDir: '角色/英雄1/攻击1', animRel: 'hero_01/attack.anim', wrapMode: 1 },
  { frameDir: '角色/英雄1/死亡', animRel: 'hero_01/die.anim', wrapMode: 1 },
  { frameDir: '角色/英雄2/待机', animRel: 'hero_02/idle.anim', wrapMode: 2 },
  { frameDir: '角色/英雄2/移动', animRel: 'hero_02/walk.anim', wrapMode: 2 },
  { frameDir: '角色/英雄2/攻击1', animRel: 'hero_02/attack.anim', wrapMode: 1 },
  { frameDir: '角色/英雄2/死亡', animRel: 'hero_02/die.anim', wrapMode: 1 },
];

function listFrameUuids(dirAbs) {
  if (!fs.existsSync(dirAbs)) {
    throw new Error(`missing frame dir: ${dirAbs}`);
  }
  const pngs = fs
    .readdirSync(dirAbs)
    .filter((f) => /^frame_.*\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (pngs.length === 0) {
    throw new Error(`no frame_*.png in ${dirAbs}`);
  }
  const uuids = [];
  for (const png of pngs) {
    const metaPath = path.join(dirAbs, `${png}.meta`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const sf = meta.subMetas?.f9941?.uuid;
    if (!sf || !String(sf).endsWith('@f9941')) {
      throw new Error(`no spriteFrame uuid in ${metaPath}`);
    }
    uuids.push(sf);
  }
  return uuids;
}

function buildClip(name, uuids, wrapMode) {
  const n = uuids.length;
  const times = [];
  for (let i = 0; i < n; i++) {
    times.push(i / SAMPLE);
  }
  const duration = n <= 1 ? 1 / SAMPLE : (n - 1) / SAMPLE;
  const values = uuids.map((u) => ({
    __uuid__: u,
    __expectedType__: 'cc.SpriteFrame',
  }));

  return [
    {
      __type__: 'cc.AnimationClip',
      _name: name,
      _objFlags: 0,
      __editorExtras__: { embeddedPlayerGroups: [] },
      _native: '',
      sample: SAMPLE,
      speed: 1,
      wrapMode,
      enableTrsBlending: false,
      _duration: duration,
      _hash: 0,
      _tracks: [{ __id__: 1 }],
      _exoticAnimation: null,
      _events: [],
      _embeddedPlayers: [],
      _additiveSettings: { __id__: 6 },
      _auxiliaryCurveEntries: [],
    },
    {
      __type__: 'cc.animation.ObjectTrack',
      _binding: {
        __type__: 'cc.animation.TrackBinding',
        path: { __id__: 2 },
        proxy: null,
      },
      _channel: { __id__: 4 },
    },
    {
      __type__: 'cc.animation.TrackPath',
      // Animation 挂在 Visual 上：只绑本节点 Sprite，勿再 HierarchyPath「Visual」
      _paths: [{ __id__: 3 }, 'spriteFrame'],
    },
    {
      __type__: 'cc.animation.ComponentPath',
      component: 'cc.Sprite',
    },
    {
      __type__: 'cc.animation.Channel',
      _curve: { __id__: 5 },
    },
    {
      __type__: 'cc.ObjectCurve',
      _times: times,
      _values: values,
    },
    {
      __type__: 'cc.AnimationClipAdditiveSettings',
      enabled: false,
      refClip: null,
    },
  ];
}

const report = [];
for (const job of JOBS) {
  const frameAbs = path.join(FRAMES, job.frameDir);
  const animAbs = path.join(ANIMS, job.animRel);
  const uuids = listFrameUuids(frameAbs);
  const clipName = path.basename(job.animRel, '.anim');
  const clip = buildClip(clipName, uuids, job.wrapMode);
  fs.writeFileSync(animAbs, `${JSON.stringify(clip, null, 2)}\n`, 'utf8');
  report.push(`${job.animRel}\tframes=${uuids.length}\twrap=${job.wrapMode}`);
}

const out = path.join(ROOT, '.cursor/plans/reports/fill-anim-clips-2026-09-04.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${report.join('\n')}\n`, 'utf8');
console.log(`filled ${report.length} clips`);
console.log(report.join('\n'));
console.log(`report: ${out}`);
