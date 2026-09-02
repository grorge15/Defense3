import fs from 'fs';

const path = 'assets/scenes/Main.scene';
let s = fs.readFileSync(path, 'utf8');
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function genId() {
  let out = '';
  for (let i = 0; i < 22; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

const targets = ['Node.4655', 'Node.4661', 'Node.4674'];
const map = {};
for (const t of targets) {
  map[t] = genId();
  const re = new RegExp(`"_id": "${t.replace('.', '\\.')}"`, 'g');
  s = s.replace(re, `"_id": "${map[t]}"`);
}

fs.writeFileSync(path, s);
const remain = (s.match(/"_id": "Node\./g) || []).length;
console.log(JSON.stringify({ map, remain }, null, 2));
fs.writeFileSync(
  '.cursor/plans/reports/node-id-remap-phase-5-5-9.txt',
  Object.entries(map)
    .map(([a, b]) => `${a} -> ${b}`)
    .join('\n') + `\nremain=${remain}\n`,
);
