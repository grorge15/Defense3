/**
 * Strip null placeholders from prefab instance _children/_components in a scene.
 * Cocos editor often re-serializes stripped slots as null; runtime
 * expandNestedPrefabInstanceNode → generateTargetMap then crashes on null.__prefab.
 *
 * Usage: node .cursor/scripts/patch-scene-prefab-nulls.mjs [assets/scenes/Main.scene]
 * Exit: 0 always when file ok; prints Fixed=N
 */
import fs from 'fs';
import path from 'path';

const scenePath = process.argv[2] || 'assets/scenes/Main.scene';
const abs = path.resolve(scenePath);
const data = JSON.parse(fs.readFileSync(abs, 'utf8'));

let fixedNodes = 0;
let removedNulls = 0;

for (const obj of data) {
  if (!obj || obj.__type__ !== 'cc.Node' || !obj._prefab) continue;
  const prefabInfo = data[obj._prefab.__id__];
  // Only strip on prefab *instances* (have PrefabInstance), keep nested asset nodes alone
  if (!prefabInfo || !prefabInfo.instance) continue;

  let changed = false;
  if (Array.isArray(obj._children)) {
    const before = obj._children.length;
    obj._children = obj._children.filter((c) => c != null);
    const removed = before - obj._children.length;
    if (removed) {
      removedNulls += removed;
      changed = true;
    }
  }
  if (Array.isArray(obj._components)) {
    const before = obj._components.length;
    obj._components = obj._components.filter((c) => c != null);
    const removed = before - obj._components.length;
    if (removed) {
      removedNulls += removed;
      changed = true;
    }
  }
  if (changed) fixedNodes++;
}

if (fixedNodes > 0) {
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`FixedNodes=${fixedNodes} RemovedNulls=${removedNulls} Path=${scenePath}`);
process.exit(0);
