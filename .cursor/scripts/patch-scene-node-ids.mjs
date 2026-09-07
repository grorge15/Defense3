/**
 * 最小替换 Main.scene（或指定 scene）中非法 "_id": "Node.<数字>" → 22 位压缩 UUID。
 * 用法: node .cursor/scripts/patch-scene-node-ids.mjs [assets/scenes/Main.scene]
 * 不改 __id__ 父子树。补丁后须: scene-close → assets-reimport-asset → scene-open。
 */
import fs from 'fs';
import path from 'path';

const scenePath = process.argv[2] || 'assets/scenes/Main.scene';
const abs = path.resolve(scenePath);
if (!fs.existsSync(abs)) {
  console.error(`missing: ${abs}`);
  process.exit(1);
}

let s = fs.readFileSync(abs, 'utf8');
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
function genId() {
  let out = '';
  for (let i = 0; i < 22; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

const used = new Set((s.match(/"[A-Za-z0-9+\-]{22}"/g) || []).map((x) => x.slice(1, -1)));
const tokens = [...new Set(s.match(/Node\.\d+/g) || [])];
if (tokens.length === 0) {
  console.log(`OK: no Node.* tokens in ${scenePath}`);
  process.exit(0);
}

const map = {};
for (const t of tokens) {
  let id;
  do {
    id = genId();
  } while (used.has(id));
  used.add(id);
  map[t] = id;
}
for (const [from, to] of Object.entries(map)) {
  s = s.split(from).join(to);
}
fs.writeFileSync(abs, s);

const remain = (s.match(/Node\.\d+/g) || []).length;
const reportDir = '.cursor/plans/reports';
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = path.join(reportDir, `node-id-remap-${stamp}.txt`);
fs.writeFileSync(
  reportPath,
  Object.entries(map)
    .map(([a, b]) => `${a} -> ${b}`)
    .join('\n') + '\n',
);
console.log(`patched ${tokens.length} tokens → ${scenePath}; remaining Node.*=${remain}`);
console.log(`map: ${reportPath}`);
if (remain !== 0) process.exit(2);
