import fs from 'fs';

const path = 'assets/scenes/Main.scene';
let s = fs.readFileSync(path, 'utf8');
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function genId() {
  let out = '';
  for (let i = 0; i < 22; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}
const used = new Set();
const tokens = [...new Set(s.match(/Node\.\d+/g) || [])];
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
fs.writeFileSync(path, s);
const remain = (s.match(/"_id": "Node\./g) || []).length;
console.log(`patched ${tokens.length} tokens; remaining Node._id=${remain}`);
fs.writeFileSync(
  '.cursor/plans/reports/node-id-remap-phase-4f.txt',
  Object.entries(map)
    .map(([a, b]) => `${a} -> ${b}`)
    .join('\n') + '\n',
);
