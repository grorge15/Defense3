/**
 * Fill/create v2 .anim clips (saw / arrow_trail / upgrade_blue / upgrade_yellow).
 * Reads PNG .meta @f9941 SpriteFrame UUIDs. Does NOT invent frames.
 * Usage: node .cursor/scripts/fill-anim-clips-v2.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SPRITE = path.join(ROOT, 'assets/resources/sprite');
const ANIMS = path.join(ROOT, 'assets/resources/animations');
const SAMPLE = 10;

/** @type {{ frameDirRel: string, animRel: string, wrapMode: number }[]} */
const JOBS = [
  { frameDirRel: 'frames/动画-圆锯', animRel: 'saw/spin.anim', wrapMode: 2 },
  { frameDirRel: '特效/主角远程攻击特效', animRel: 'vfx/arrow_trail.anim', wrapMode: 2 },
  { frameDirRel: '特效/蓝色升级特效序列帧', animRel: 'vfx/upgrade_blue.anim', wrapMode: 1 },
  { frameDirRel: '特效/黄色升级特效序列帧', animRel: 'vfx/upgrade_yellow.anim', wrapMode: 1 },
];

function listFrameUuids(dirAbs) {
  if (!fs.existsSync(dirAbs)) {
    throw new Error(`missing frame dir: ${dirAbs}`);
  }
  const pngs = fs
    .readdirSync(dirAbs)
    .filter((f) => /\.png$/i.test(f) && !f.endsWith('.meta'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (pngs.length === 0) {
    throw new Error(`no png in ${dirAbs}`);
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
      // Animation 挂在 Visual 本节点：只绑本节点 Sprite
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
  const frameAbs = path.join(SPRITE, job.frameDirRel);
  const animAbs = path.join(ANIMS, job.animRel);
  fs.mkdirSync(path.dirname(animAbs), { recursive: true });
  const uuids = listFrameUuids(frameAbs);
  const clipName = path.basename(job.animRel, '.anim');
  const clip = buildClip(clipName, uuids, job.wrapMode);
  fs.writeFileSync(animAbs, `${JSON.stringify(clip, null, 2)}\n`, 'utf8');
  report.push(`${job.animRel}\tframes=${uuids.length}\twrap=${job.wrapMode}`);
}

const out = path.join(ROOT, '.cursor/plans/reports/fill-anim-clips-v2.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${report.join('\n')}\n`, 'utf8');
console.log(`filled ${report.length} clips`);
console.log(report.join('\n'));
console.log(`report: ${out}`);
