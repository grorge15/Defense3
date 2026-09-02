import fs from 'fs';
import path from 'path';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function genId(used) {
  let id;
  do {
    id = '';
    for (let i = 0; i < 22; i++) id += chars[(Math.random() * chars.length) | 0];
  } while (used.has(id));
  used.add(id);
  return id;
}

const dir = 'assets/resources/prefabs/ui';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.prefab'));
const report = [];

for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, 'utf8');
  const tokens = [...new Set(s.match(/Node\.\d+/g) || [])];
  if (!tokens.length) {
    report.push(`${f}: 0`);
    continue;
  }
  const used = new Set();
  const map = {};
  for (const t of tokens) map[t] = genId(used);
  for (const [from, to] of Object.entries(map)) s = s.split(from).join(to);
  fs.writeFileSync(p, s);
  report.push(`${f}: patched ${tokens.length}`);
}

fs.mkdirSync('.cursor/plans/reports', { recursive: true });
fs.writeFileSync('.cursor/plans/reports/node-id-remap-phase-5-ui.txt', report.join('\n') + '\n');
console.log(report.join('\n'));
