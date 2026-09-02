/**
 * Rebuild broken building prefabs with correct __id__ layout (matches pref_player pattern).
 * Bug: generator inserted orphan CompPrefabInfo before UITransform, shifting all refs.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const SPRITE = '9594c832-5943-426c-8e6a-a3e74b745cf7@f9941';
const TYPES = {
  Billboard: '7bee2OkY11CfK5SYucC6MQh',
  SortingOrder2D: '329653I9DxOXbX8SFJsOd/A',
  Wall: '9daff1GKNFFAKA7VAzHEr1b',
  Tower: '0d686hivC5D7K1C0m10O2zs',
  Barracks: 'e05dcHHtitHf6tTQVO/0xaa',
  HeroShrine: '36f47pUnglID4b3FGHkjaxA',
  BuildPlot: '62290lxgvZEpKGNu/UCe5vw',
};

const vec3 = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = () => ({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });
const size = (w, h) => ({ __type__: 'cc.Size', width: w, height: h });
const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
const color = (r = 255, g = 255, b = 255, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });
const ref = (id) => ({ __id__: id });
const compInfo = (fileId) => ({ __type__: 'cc.CompPrefabInfo', fileId });
const prefabInfo = (rootId, fileId = 'Node.375') => ({
  __type__: 'cc.PrefabInfo',
  root: ref(rootId),
  asset: ref(0),
  fileId,
});
const rootPrefabInfo = (rootId) => ({
  __type__: 'cc.PrefabInfo',
  root: ref(rootId),
  asset: ref(0),
  fileId: 'c46/YsCPVOJYA4mWEpNYRx',
});

function nodeBase(name, parentId, lpos = vec3()) {
  return {
    __type__: 'cc.Node',
    _name: name,
    _objFlags: 0,
    __editorExtras__: {},
    _parent: parentId == null ? null : ref(parentId),
    _children: [],
    _active: true,
    _components: [],
    _prefab: null,
    _lpos: lpos,
    _lrot: quat(),
    _lscale: vec3(1, 1, 1),
    _mobility: 0,
    _layer: 1073741824,
    _euler: vec3(),
    _id: '',
  };
}

function buildVisualSection(visualId, rootId, filePrefix) {
  const items = [];
  const push = (o) => {
    items.push(o);
    return items.length - 1;
  };

  const ut = push({
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(visualId),
    _enabled: true,
    __prefab: null,
    _contentSize: size(100, 100),
    _anchorPoint: vec2(0.5, 0),
    _id: '',
  });
  const utInfo = push(compInfo(`${filePrefix}.ut`));
  items[ut].__prefab = ref(utInfo);

  const sp = push({
    __type__: 'cc.Sprite',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(visualId),
    _enabled: true,
    __prefab: null,
    _customMaterial: null,
    _srcBlendFactor: 2,
    _dstBlendFactor: 4,
    _color: color(),
    _spriteFrame: { __uuid__: SPRITE, __expectedType__: 'cc.SpriteFrame' },
    _type: 0,
    _fillType: 0,
    _sizeMode: 0,
    _fillCenter: vec2(0, 0),
    _fillStart: 0,
    _fillRange: 0,
    _isTrimmedMode: true,
    _useGrayscale: false,
    _atlas: null,
    _id: '',
  });
  const spInfo = push(compInfo(`${filePrefix}.sp`));
  items[sp].__prefab = ref(spInfo);

  const bb = push({
    __type__: TYPES.Billboard,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(visualId),
    _enabled: true,
    __prefab: null,
    visualNode: null,
    mainCamera: null,
    _id: '',
  });
  const bbInfo = push(compInfo(`${filePrefix}.bb`));
  items[bb].__prefab = ref(bbInfo);

  const so = push({
    __type__: TYPES.SortingOrder2D,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(visualId),
    _enabled: true,
    __prefab: null,
    visualNode: null,
    _id: '',
  });
  const soInfo = push(compInfo(`${filePrefix}.so`));
  items[so].__prefab = ref(soInfo);

  const s2 = push({
    __type__: 'cc.Sorting2D',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(visualId),
    _enabled: true,
    __prefab: null,
    _sortingLayer: 0,
    _sortingOrder: 0,
    _id: '',
  });
  const s2Info = push(compInfo(`${filePrefix}.s2`));
  items[s2].__prefab = ref(s2Info);

  const visualPrefabInfo = push(prefabInfo(rootId));

  const componentIds = [ut, sp, bb, so, s2];
  const offset = 0; // caller adds offset
  return { items, componentIds, visualPrefabInfoId: visualPrefabInfo, offset };
}

function buildPrefab(name, config) {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  const rootId = add(null);
  add({
    __type__: 'cc.Prefab',
    _name: name,
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(rootId),
    optimizationPolicy: 0,
    persistent: false,
  });
  // swap: prefab header should be index 0
  const header = data[data.length - 1];
  data.pop();
  data.unshift(header);
  // rootId is now 1
  const actualRootId = 1;

  const visualId = add(nodeBase('Visual', actualRootId));
  const childMountIds = (config.mounts ?? []).map((m) =>
    add(nodeBase(m.name, actualRootId, vec3(m.x, m.y, m.z))),
  );
  const extraChildIds = (config.extraChildren ?? []).map((c) => {
    const id = add(nodeBase(c.name, actualRootId, vec3(c.x ?? 0, c.y ?? 0, c.z ?? 0)));
    return { id, ...c };
  });

  const root = nodeBase(name, null);
  root._children = [ref(visualId), ...childMountIds.map((id) => ref(id)), ...extraChildIds.map((c) => ref(c.id))];
  data[actualRootId] = root;

  const visualStart = data.length;
  const visualSection = buildVisualSection(visualId, actualRootId, name);
  for (const item of visualSection.items) {
    add(item);
  }
  const visualComponentIds = visualSection.componentIds.map((id) => id + visualStart);
  const visualPrefabInfoId = visualSection.visualPrefabInfoId + visualStart;

  data[visualId]._components = visualComponentIds.map((id) => ref(id));
  data[visualId]._prefab = ref(visualPrefabInfoId);

  for (let i = 0; i < childMountIds.length; i++) {
    const mountPrefabInfoId = add(prefabInfo(actualRootId));
    data[childMountIds[i]]._prefab = ref(mountPrefabInfoId);
  }
  for (const extra of extraChildIds) {
    const childPrefabInfoId = add(prefabInfo(actualRootId));
    data[extra.id]._prefab = ref(childPrefabInfoId);
    if (extra.components) {
      const compIds = [];
      for (const comp of extra.components) {
        const compId = add(comp.build(extra.id, add));
        compIds.push(compId);
      }
      data[extra.id]._components = compIds.map((id) => ref(id));
    }
  }

  const rootComponentIds = [];
  for (const comp of config.rootComponents) {
    const compId = add(comp.build(actualRootId, visualId, childMountIds, extraChildIds, add));
    rootComponentIds.push(compId);
  }

  const rootPrefabInfoId = add(rootPrefabInfo(actualRootId));
  data[actualRootId]._components = rootComponentIds.map((id) => ref(id));
  data[actualRootId]._prefab = ref(rootPrefabInfoId);

  return data;
}

function scriptComp(typeName, nodeId, prefabIdRef, props) {
  return {
    __type__: typeName,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(nodeId),
    _enabled: true,
    __prefab: prefabIdRef,
    ...props,
    _id: '',
  };
}

function withCompInfo(buildFn, fileId) {
  return {
    build(...args) {
      const add = args[args.length - 1];
      const compId = add(buildFn(...args));
      const infoId = add(compInfo(fileId));
      dataFixPrefabRef(add, compId, infoId);
      return compId;
    },
  };
}

function dataFixPrefabRef(add, compId, infoId) {
  // noop - handled inline below
}

function addScriptWithInfo(add, typeName, nodeId, fileId, props) {
  const compId = add(scriptComp(typeName, nodeId, null, props));
  const infoId = add(compInfo(fileId));
  // fix __prefab on the component we just added - need access to data array
  return { compId, infoId };
}

function makeWall() {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  add({
    __type__: 'cc.Prefab',
    _name: 'pref_wall',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(1),
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootId = add(nodeBase('pref_wall', null));
  const visualId = add(nodeBase('Visual', rootId));
  data[rootId]._children = [ref(visualId)];

  addVisualComponents(data, add, visualId, rootId, 'wall');

  const wallInfo = add(compInfo('sc_wall'));
  const wallId = add(scriptComp(TYPES.Wall, rootId, ref(wallInfo), { visualNode: ref(visualId) }));

  const boxInfo = add(compInfo('bc_wall'));
  const boxId = add({
    __type__: 'cc.BoxCollider2D',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(rootId),
    _enabled: true,
    __prefab: ref(boxInfo),
    tag: 0,
    _group: 1,
    _density: 1,
    _sensor: false,
    _friction: 0.2,
    _restitution: 0,
    _offset: vec2(0, 0),
    _size: size(2, 0.5),
    _id: '',
  });

  const rootPi = add(rootPrefabInfo(rootId));
  data[rootId]._components = [ref(wallId), ref(boxId)];
  data[rootId]._prefab = ref(rootPi);
  return data;
}

function addVisualComponents(data, add, visualId, rootId, prefix) {
  const compIds = [];
  const pairs = [
    () => ({
      __type__: 'cc.UITransform',
      _name: '',
      _objFlags: 0,
      __editorExtras__: {},
      node: ref(visualId),
      _enabled: true,
      __prefab: null,
      _contentSize: size(100, 100),
      _anchorPoint: vec2(0.5, 0),
      _id: '',
    }),
    () => ({
      __type__: 'cc.Sprite',
      _name: '',
      _objFlags: 0,
      __editorExtras__: {},
      node: ref(visualId),
      _enabled: true,
      __prefab: null,
      _customMaterial: null,
      _srcBlendFactor: 2,
      _dstBlendFactor: 4,
      _color: color(),
      _spriteFrame: { __uuid__: SPRITE, __expectedType__: 'cc.SpriteFrame' },
      _type: 0,
      _fillType: 0,
      _sizeMode: 0,
      _fillCenter: vec2(0, 0),
      _fillStart: 0,
      _fillRange: 0,
      _isTrimmedMode: true,
      _useGrayscale: false,
      _atlas: null,
      _id: '',
    }),
    () => ({
      __type__: TYPES.Billboard,
      _name: '',
      _objFlags: 0,
      __editorExtras__: {},
      node: ref(visualId),
      _enabled: true,
      __prefab: null,
      visualNode: null,
      mainCamera: null,
      _id: '',
    }),
    () => ({
      __type__: TYPES.SortingOrder2D,
      _name: '',
      _objFlags: 0,
      __editorExtras__: {},
      node: ref(visualId),
      _enabled: true,
      __prefab: null,
      visualNode: null,
      _id: '',
    }),
    () => ({
      __type__: 'cc.Sorting2D',
      _name: '',
      _objFlags: 0,
      __editorExtras__: {},
      node: ref(visualId),
      _enabled: true,
      __prefab: null,
      _sortingLayer: 0,
      _sortingOrder: 0,
      _id: '',
    }),
  ];

  for (let i = 0; i < pairs.length; i++) {
    const cid = add(pairs[i]());
    const iid = add(compInfo(`${prefix}.c${i}`));
    data[cid].__prefab = ref(iid);
    compIds.push(cid);
  }

  const vpi = add(prefabInfo(rootId));
  data[visualId]._components = compIds.map((id) => ref(id));
  data[visualId]._prefab = ref(vpi);
}

function addMounts(data, add, rootId, count, positions) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const pos = positions[i] ?? { x: 0, y: 0.8, z: 0 };
    const id = add(nodeBase(`SoldierMount_${i}`, rootId, vec3(pos.x, pos.y, pos.z)));
    const pi = add(prefabInfo(rootId));
    data[id]._prefab = ref(pi);
    ids.push(id);
  }
  return ids;
}

function makeTower(name, towerType) {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  add({
    __type__: 'cc.Prefab',
    _name: name,
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(1),
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootId = add(nodeBase(name, null));
  const visualId = add(nodeBase('Visual', rootId));
  const mounts = addMounts(data, add, rootId, 3, [
    { x: -1, y: 0.8, z: 0 },
    { x: 0, y: 0.8, z: 0 },
    { x: 1, y: 0.8, z: 0 },
  ]);
  data[rootId]._children = [ref(visualId), ...mounts.map((id) => ref(id))];

  addVisualComponents(data, add, visualId, rootId, name);

  const tInfo = add(compInfo('sc_tower'));
  const tId = add(
    scriptComp(TYPES.Tower, rootId, ref(tInfo), {
      visualNode: ref(visualId),
      soldierMounts: mounts.map((id) => ref(id)),
      soldierPrefab: null,
      advancedVisualScale: 1.25,
      towerType,
    }),
  );

  const rootPi = add(rootPrefabInfo(rootId));
  data[rootId]._components = [ref(tId)];
  data[rootId]._prefab = ref(rootPi);
  return data;
}

function makeBarracks() {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  add({
    __type__: 'cc.Prefab',
    _name: 'pref_barracks',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(1),
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootId = add(nodeBase('pref_barracks', null));
  const visualId = add(nodeBase('Visual', rootId));
  const positions = [
    { x: -1.5, y: 0.5, z: 0 },
    { x: -0.5, y: 0.5, z: 0 },
    { x: 0.5, y: 0.5, z: 0 },
    { x: 1.5, y: 0.5, z: 0 },
    { x: -1.5, y: -0.5, z: 0 },
    { x: -0.5, y: -0.5, z: 0 },
    { x: 0.5, y: -0.5, z: 0 },
    { x: 1.5, y: -0.5, z: 0 },
  ];
  const mounts = addMounts(data, add, rootId, 8, positions);
  data[rootId]._children = [ref(visualId), ...mounts.map((id) => ref(id))];

  addVisualComponents(data, add, visualId, rootId, 'barracks');

  const bInfo = add(compInfo('sc_barracks'));
  const bId = add(
    scriptComp(TYPES.Barracks, rootId, ref(bInfo), {
      visualNode: ref(visualId),
      soldierMounts: mounts.map((id) => ref(id)),
      soldierPrefab: null,
    }),
  );

  const rootPi = add(rootPrefabInfo(rootId));
  data[rootId]._components = [ref(bId)];
  data[rootId]._prefab = ref(rootPi);
  return data;
}

function makeHeroShrine() {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  add({
    __type__: 'cc.Prefab',
    _name: 'pref_hero_shrine',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(1),
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootId = add(nodeBase('pref_hero_shrine', null));
  const visualId = add(nodeBase('Visual', rootId));
  const spawnId = add(nodeBase('HeroSpawnPoint', rootId, vec3(2, 0, 0)));
  const spawnPi = add(prefabInfo(rootId));
  data[spawnId]._prefab = ref(spawnPi);
  data[rootId]._children = [ref(visualId), ref(spawnId)];

  addVisualComponents(data, add, visualId, rootId, 'shrine');

  const hInfo = add(compInfo('sc_shrine'));
  const hId = add(
    scriptComp(TYPES.HeroShrine, rootId, ref(hInfo), {
      visualNode: ref(visualId),
      heroSpawnPoint: ref(spawnId),
      heroPrefab01: null,
      heroPrefab02: null,
    }),
  );

  const rootPi = add(rootPrefabInfo(rootId));
  data[rootId]._components = [ref(hId)];
  data[rootId]._prefab = ref(rootPi);
  return data;
}

function addUiChild(data, add, rootId, name, lpos, anchorY = 0.5) {
  const id = add(nodeBase(name, rootId, lpos));
  const utId = add({
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(id),
    _enabled: true,
    __prefab: null,
    _contentSize: size(100, 100),
    _anchorPoint: vec2(0.5, anchorY),
    _id: '',
  });
  const utInfo = add(compInfo(`${name}.ut`));
  data[utId].__prefab = ref(utInfo);

  const spId = add({
    __type__: 'cc.Sprite',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(id),
    _enabled: true,
    __prefab: null,
    _customMaterial: null,
    _srcBlendFactor: 2,
    _dstBlendFactor: 4,
    _color: color(),
    _spriteFrame: { __uuid__: SPRITE, __expectedType__: 'cc.SpriteFrame' },
    _type: 0,
    _fillType: 0,
    _sizeMode: 0,
    _fillCenter: vec2(0, 0),
    _fillStart: 0,
    _fillRange: 0,
    _isTrimmedMode: true,
    _useGrayscale: false,
    _atlas: null,
    _id: '',
  });
  const spInfo = add(compInfo(`${name}.sp`));
  data[spId].__prefab = ref(spInfo);

  const pi = add(prefabInfo(rootId));
  data[id]._components = [ref(utId), ref(spId)];
  data[id]._prefab = ref(pi);
  return { nodeId: id, spriteId: spId };
}

function addLabelChild(data, add, rootId, name, lpos) {
  const id = add(nodeBase(name, rootId, lpos));
  const utId = add({
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(id),
    _enabled: true,
    __prefab: null,
    _contentSize: size(80, 40),
    _anchorPoint: vec2(0.5, 0.5),
    _id: '',
  });
  const utInfo = add(compInfo(`${name}.ut`));
  data[utId].__prefab = ref(utInfo);

  const lbId = add({
    __type__: 'cc.Label',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(id),
    _enabled: true,
    __prefab: null,
    _customMaterial: null,
    _srcBlendFactor: 2,
    _dstBlendFactor: 4,
    _color: color(255, 255, 0, 255),
    _string: '100',
    _horizontalAlign: 1,
    _verticalAlign: 1,
    _actualFontSize: 24,
    _fontSize: 24,
    _fontFamily: 'Arial',
    _lineHeight: 28,
    _overflow: 0,
    _enableWrapText: true,
    _font: null,
    _isSystemFontUsed: true,
    _spacingX: 0,
    _isItalic: false,
    _isBold: false,
    _isUnderline: false,
    _underlineHeight: 2,
    _cacheMode: 0,
    _id: '',
  });
  const lbInfo = add(compInfo(`${name}.lb`));
  data[lbId].__prefab = ref(lbInfo);

  const pi = add(prefabInfo(rootId));
  data[id]._components = [ref(utId), ref(lbId)];
  data[id]._prefab = ref(pi);
  return { nodeId: id, labelId: lbId };
}

function makeBuildPlot() {
  const data = [];
  const add = (o) => {
    data.push(o);
    return data.length - 1;
  };

  add({
    __type__: 'cc.Prefab',
    _name: 'pref_build_plot',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: ref(1),
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootId = add(nodeBase('pref_build_plot', null));
  const bg = addUiChild(data, add, rootId, 'Background', vec3(0, 0, 0), 0);
  const coin = addUiChild(data, add, rootId, 'CoinIcon', vec3(-0.8, 0.5, 0));
  const cost = addLabelChild(data, add, rootId, 'CostLabel', vec3(0.3, 0.5, 0));
  const preview = addUiChild(data, add, rootId, 'PreviewIcon', vec3(0, -0.3, 0));
  const fill = addUiChild(data, add, rootId, 'FillBar', vec3(0, 0, 0), 0);
  // FillBar uses filled sprite
  data[fill.spriteId]._type = 3;
  data[fill.spriteId]._fillType = 1;
  data[fill.spriteId]._fillRange = 0;
  data[fill.spriteId]._color = color(80, 220, 80, 255);

  data[rootId]._children = [
    ref(bg.nodeId),
    ref(coin.nodeId),
    ref(cost.nodeId),
    ref(preview.nodeId),
    ref(fill.nodeId),
  ];

  const bpInfo = add(compInfo('sc_buildplot'));
  const bpId = add(
    scriptComp(TYPES.BuildPlot, rootId, ref(bpInfo), {
      backgroundSprite: ref(bg.nodeId),
      coinIcon: ref(coin.nodeId),
      costLabel: ref(cost.labelId),
      previewIcon: ref(preview.nodeId),
      fillBar: ref(fill.spriteId),
      fillSpeedPerSecond: 20,
    }),
  );

  const colInfo = add(compInfo('bc_buildplot'));
  const colId = add({
    __type__: 'cc.BoxCollider2D',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: ref(rootId),
    _enabled: true,
    __prefab: ref(colInfo),
    tag: 0,
    _group: 1,
    _density: 1,
    _sensor: true,
    _friction: 0.2,
    _restitution: 0,
    _offset: vec2(0, 0),
    _size: size(2, 2),
    _id: '',
  });

  const rootPi = add(rootPrefabInfo(rootId));
  data[rootId]._components = [ref(bpId), ref(colId)];
  data[rootId]._prefab = ref(rootPi);
  return data;
}

function validate(data, name) {
  const errors = [];
  const walk = (obj, path) => {
    if (obj && typeof obj === 'object') {
      if (obj.__id__ !== undefined && (obj.__id__ < 0 || obj.__id__ >= data.length || data[obj.__id__] === undefined)) {
        errors.push(`${name}: bad ref ${obj.__id__} at ${path}`);
      }
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${path}.${k}[${i}]`));
        else if (v && typeof v === 'object') walk(v, `${path}.${k}`);
      }
    }
  };
  data.forEach((entry, i) => walk(entry, `[${i}]`));
  return errors;
}

const OUT = 'assets/resources/prefabs/building';
const prefabs = [
  ['pref_wall.prefab', makeWall()],
  ['pref_tower_basic.prefab', makeTower('pref_tower_basic', 'basic')],
  ['pref_tower_advanced.prefab', makeTower('pref_tower_advanced', 'advanced')],
  ['pref_barracks.prefab', makeBarracks()],
  ['pref_hero_shrine.prefab', makeHeroShrine()],
  ['pref_build_plot.prefab', makeBuildPlot()],
];

let failed = false;
for (const [file, data] of prefabs) {
  const errs = validate(data, file);
  if (errs.length) {
    console.error(`VALIDATION FAILED ${file}:`);
    errs.forEach((e) => console.error(' ', e));
    failed = true;
    continue;
  }
  const path = join(OUT, file);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`OK ${file} (${data.length} entries)`);
}

if (failed) process.exit(1);
console.log('All building prefabs rebuilt.');
