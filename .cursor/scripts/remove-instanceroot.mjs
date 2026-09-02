import fs from 'fs';

const path = 'assets/scenes/Main.scene';
const scene = JSON.parse(fs.readFileSync(path, 'utf8'));

const remove = new Set();
const log = [];

for (let i = 0; i < scene.length; i++) {
  const o = scene[i];
  if (!o || o.__type__ !== 'cc.Node' || o._name !== 'InstanceRoot') continue;

  const parentIdx = o._parent && o._parent.__id__;
  if (parentIdx == null || !scene[parentIdx]) {
    throw new Error('bad parent for InstanceRoot index ' + i);
  }

  const childIds = (o._children || []).map((c) => c.__id__);
  if (childIds.length === 0) {
    throw new Error('InstanceRoot has no children: ' + i);
  }

  for (const cid of childIds) {
    if (!scene[cid]) throw new Error('missing child ' + cid);
    scene[cid]._parent = { __id__: parentIdx };
  }

  const parent = scene[parentIdx];
  parent._children = (parent._children || []).flatMap((c) =>
    c.__id__ === i ? childIds.map((id) => ({ __id__: id })) : [c]
  );

  remove.add(i);
  for (const c of o._components || []) {
    remove.add(c.__id__);
    const comp = scene[c.__id__];
    if (comp && comp.__prefab && typeof comp.__prefab.__id__ === 'number') {
      remove.add(comp.__prefab.__id__);
    }
  }

  log.push({
    removed: i,
    parent: parent._name,
    children: childIds.map((id) => scene[id]._name),
  });
}

const oldToNew = new Map();
const next = [];
for (let i = 0; i < scene.length; i++) {
  if (remove.has(i)) continue;
  oldToNew.set(i, next.length);
  next.push(scene[i]);
}

function remap(v) {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(remap);
  if (Object.prototype.hasOwnProperty.call(v, '__id__') && Object.keys(v).length === 1) {
    const n = oldToNew.get(v.__id__);
    if (n === undefined) throw new Error('dangling __id__ ' + v.__id__);
    return { __id__: n };
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = remap(val);
  return out;
}

const remapped = next.map(remap);

const left = remapped.filter((o) => o && o.__type__ === 'cc.Node' && o._name === 'InstanceRoot');
if (left.length) throw new Error('InstanceRoot remain ' + left.length);

const textCheck = JSON.stringify(remapped);
if (/\"_id\":\s*\"Node\./.test(textCheck)) throw new Error('Node.* _id reappeared');

fs.copyFileSync(path, path + '.bak-instanceroot');
fs.writeFileSync(path, JSON.stringify(remapped, null, 2) + '\n');
fs.writeFileSync(
  '.cursor/plans/reports/instanceroot-remove-2026-09-02.json',
  JSON.stringify(log, null, 2)
);

console.log('removed', log.length, 'InstanceRoots');
console.log(JSON.stringify(log, null, 2));
console.log('new length', remapped.length, 'old', scene.length, 'removed objs', remove.size);
