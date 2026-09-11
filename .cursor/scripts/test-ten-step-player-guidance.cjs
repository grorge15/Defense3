const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
class Events {
    constructor() { this.listeners = new Map(); }
    onEvent(name, fn, ctx) { this.listeners.set(name, [...(this.listeners.get(name) || []), { fn, ctx }]); }
    offEvent(name, fn, ctx) { this.listeners.set(name, (this.listeners.get(name) || []).filter(e => e.fn !== fn || e.ctx !== ctx)); }
    emitEvent(name, ...args) { for (const e of [...(this.listeners.get(name) || [])]) e.fn.apply(e.ctx, args); }
}
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); this.x = x; this.y = y; this.z = z; return this; }
}
class Component { constructor() { this.isValid = true; this.enabled = true; } }
class Node {
    constructor(name = '') { this.name = name; this.children = []; this.components = []; this.position = new Vec3(); this.active = true; this.isValid = true; }
    get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
    addChild(child) { child.parent = this; child._setScene(this.scene || (this.parent ? this.parent.scene : null)); this.children.push(child); return child; }
    _setScene(scene) { this.scene = scene; for (const child of this.children) child._setScene(scene); }
    addComponent(Type) { const value = new Type(); value.node = this; this.components.push(value); return value; }
    getComponent(Type) { return this.components.find(value => value instanceof Type) || null; }
    getComponentInChildren(Type) { return this.getComponentsInChildren(Type)[0] || null; }
    getComponentsInChildren(Type) { return [...this.components.filter(value => value instanceof Type), ...this.children.flatMap(child => child.getComponentsInChildren(Type))]; }
    getChildByName(name) { return this.children.find(child => child.name === name) || null; }
    getWorldPosition(out) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); return out.set(parent.x + this.position.x, parent.y + this.position.y, parent.z + this.position.z); }
    setWorldPosition(value) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); this.position.set(value.x - parent.x, value.y - parent.y, value.z - parent.z); }
    setWorldRotationFromEuler(x, y, z) { this.worldRotation = { x, y, z }; }
    setPosition(value) { this.position.set(value); }
    destroy() { this.isValid = false; this.active = false; }
}
class Player extends Component { constructor() { super(); this.hasBow = false; this.isDead = false; } }
class Log extends Component { constructor() { super(); this.phase = 'rolling'; } getPhase() { return this.phase; } }
class BuildSystem extends Component { constructor() { super(); this.done = new Set(); } hasCompletedPlot(node) { return this.done.has(node); } }
class BuildPlot extends Component { constructor() { super(); this.remaining = 10; } getRemainingCost() { return this.remaining; } }
class CoinSystem extends Component { constructor() { super(); this.balance = 0; } }
class LogExtendItem extends Component { constructor() { super(); this.isConsumed = false; } }
class EnemyMinion extends Component { constructor() { super(); this.isDead = false; } }
class EnemyBoss extends Component { constructor() { super(); this.isDead = false; } }
class GuideIndicatorUI extends Component { present(player, target, visible) { this.last = { player, target, visible }; } }
class Prefab { constructor(factory) { this.factory = factory; } }
const director = { paused: false, isPaused() { return this.paused; }, on() {}, off() {} };
const Director = { EVENT_BEFORE_DRAW: 'before-draw' };
function instantiate(prefab) { return prefab.factory(); }
const events = new Events();
const cc = { _decorator: { ccclass: () => cls => cls, property: () => () => undefined }, Component, Director, Node, Prefab, Vec3, director, instantiate };
const gameManager = { getPhase: () => 'run_parkour' };
const mocks = {
    cc,
    '../building/BuildPlot': { BuildPlot },
    '../building/BuildSystem': { BuildSystem },
    '../character/Player': { Player },
    '../core/EventManager': { EventManager: { instance: events } },
    '../enemy/EnemyBoss': { EnemyBoss },
    '../enemy/EnemyMinion': { EnemyMinion },
    '../item/Log': { Log },
    '../item/LogExtendItem': { LogExtendItem },
    '../core/GameConfig': { GameConfig: { guideDirectionOffset: 64, guideDirectionArrowSpacing: 72, guideDirectionArrowMaxCount: 8, guideFloatTolerance: 0.001, guideTargetOffset: 52, guideTargetFloatAmplitude: 15, guideTargetFloatPeriod: 0.75 } },
    '../ui/GuideIndicatorUI': { GuideIndicatorUI },
    './CoinSystem': { CoinSystem },
    './GameManager': { GameManager: { instance: gameManager } },
    './GamePhase': { GamePhase: { GameOver: 'game_over' } },
};
const cache = new Map();
function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
    const module = { exports: {} };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Set, Math, Number }, { filename });
    factory(request => {
        if (Object.hasOwn(mocks, request)) return mocks[request];
        if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), `${request}.ts`));
        throw new Error(`Unmocked import ${request}`);
    }, module, module.exports);
    cache.set(filename, module.exports);
    return module.exports;
}
const { GameEvents } = load('assets/scripts/core/GameEvents.ts');
const { CombatGuideController } = load('assets/scripts/game/CombatGuideController.ts');

function namedPlot(scene, name) {
    const rootNode = scene.addChild(new Node(name));
    const child = rootNode.addChild(new Node('BuildPlot'));
    child.addComponent(BuildPlot);
    return rootNode;
}
function makeWorld() {
    events.listeners.clear();
    const scene = new Node('Main'); scene._setScene(scene);
    const host = scene.addChild(new Node('SceneSetup'));
    const playerNode = scene.addChild(new Node('Player')); const player = playerNode.addComponent(Player);
    const log = scene.addChild(new Node('Log')).addComponent(Log);
    const buildSystem = host.addComponent(BuildSystem);
    const coins = host.addComponent(CoinSystem);
    const indicator = scene.addChild(new Node('GuideIndicator')).addComponent(GuideIndicatorUI);
    const itemNear = scene.addChild(new Node('GrowthNear')); itemNear.position.set(10, 0); itemNear.addComponent(LogExtendItem);
    const itemFar = scene.addChild(new Node('GrowthFar')); itemFar.position.set(30, 0); itemFar.addComponent(LogExtendItem);
    const fix = scene.addChild(new Node('LogFixPoint')); fix.position.set(0, 40);
    scene.addChild(new Node('pref_item_bow'));
    const plots = Object.fromEntries(['Plot_Wall_L', 'Plot_Wall_R', 'Plot_Tower_1', 'Plot_Tower_2', 'Plot_Barracks', 'Plot_HeroShrine', 'Plot_Expand', 'Plot_TowerAdvanced_L', 'Plot_TowerAdvanced_R'].map(name => [name, namedPlot(scene, name)]));
    const enemyNear = scene.addChild(new Node('EnemyNear')); enemyNear.position.set(15, 0); enemyNear.addComponent(EnemyMinion);
    const enemyFar = scene.addChild(new Node('EnemyFar')); enemyFar.position.set(50, 0); enemyFar.addComponent(EnemyBoss);
    const guide = host.addComponent(CombatGuideController);
    guide.bindSceneRefs(player, log, buildSystem, coins, indicator);
    guide.onLoad(); guide.start();
    return { scene, guide, player, log, coins, plots, itemNear, indicator, enemyNear, enemyFar };
}
function tick(world) { world.guide.update(1); return world.guide.getGuideSnapshot(); }
function complete(world, plot) { world.buildSystem?.done?.add?.(plot); events.emitEvent(GameEvents.BUILD_COMPLETE, { plotRoot: plot }); }
function test(name, fn) { try { fn(); console.log(`ok - ${name}`); } catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; } }

test('nearest growth pickup is one-time and advances to LogFixPoint', () => {
    const world = makeWorld();
    assert.equal(tick(world).targetName, 'GrowthNear');
    events.emitEvent(GameEvents.LOG_EXTEND_ITEM_CONSUMED, world.itemNear.getComponent(LogExtendItem), world.log);
    assert.equal(tick(world).targetName, 'LogFixPoint');
    events.emitEvent(GameEvents.LOG_EXTEND_ITEM_CONSUMED, world.itemNear.getComponent(LogExtendItem), world.log);
    assert.equal(tick(world).step, 2);
});

test('fixed log, bow, walls, affordability and early right tower completion preserve order', () => {
    const world = makeWorld();
    world.log.phase = 'fixed';
    assert.equal(tick(world).targetName, 'pref_item_bow');
    world.player.hasBow = true;
    assert.equal(tick(world).targetName, 'EnemyNear', 'wall cost diverts to nearest live enemy');
    world.coins.balance = 10;
    assert.equal(tick(world).targetName, 'Plot_Wall_L');
    complete(world, world.plots.Plot_Wall_L);
    assert.equal(tick(world).targetName, 'Plot_Wall_R');
    complete(world, world.plots.Plot_Wall_R);
    complete(world, world.plots.Plot_Tower_2);
    assert.equal(tick(world).targetName, 'Plot_Tower_1');
    complete(world, world.plots.Plot_Tower_1);
    assert.equal(tick(world).targetName, 'Plot_Barracks', 'precompleted right tower is skipped at step five');
});

test('no valid enemy, log failure, and game over suppress stale presentation', () => {
    const world = makeWorld();
    world.log.phase = 'fixed'; world.player.hasBow = true;
    world.enemyNear.active = false;
    world.enemyFar.active = false;
    assert.equal(tick(world).targetName, null);
    events.emitEvent(GameEvents.LOG_FAILED);
    assert.equal(tick(world).stopped, true);
    assert.equal(world.indicator.last.visible, false);
});

test('world guide wires use BuildPlot coordinates, atan2 rotation, pooling, and big-arrow bobbing', () => {
    const { GuideIndicatorUI: WorldGuide } = load('assets/scripts/ui/GuideIndicatorUI.ts');
    const scene = new Node('Main'); scene._setScene(scene);
    const gameRoot = scene.addChild(new Node('GameRoot'));
    const host = gameRoot.addChild(new Node('GuideIndicator'));
    const firstWire = gameRoot.addChild(new Node('DirectionArrow'));
    const bigArrow = gameRoot.addChild(new Node('TargetArrow'));
    const bigVisual = bigArrow.addChild(new Node('Visual'));
    const player = scene.addChild(new Node('Player'));
    const plotRoot = scene.addChild(new Node('Plot_Tower_1')); plotRoot.position.set(100, 100, 0);
    const buildPlotNode = plotRoot.addChild(new Node('BuildPlot')); buildPlotNode.position.set(108, 108, 0); buildPlotNode.addComponent(BuildPlot);
    const prefab = new Prefab(() => { const arrow = new Node('DirectionArrow'); arrow.addChild(new Node('Visual')); return arrow; });
    const indicator = host.addComponent(WorldGuide);
    indicator.directionArrow = firstWire;
    indicator.targetArrow = bigArrow;
    indicator.directionArrowPrefab = prefab;
    indicator.onLoad();
    indicator.present(player, plotRoot, true);
    indicator.update(0.1875);
    const firstWireWorld = firstWire.getWorldPosition(new Vec3());
    assert.ok(Math.abs(firstWireWorld.x - 64 / Math.SQRT2) < 0.0001);
    assert.ok(Math.abs(firstWireWorld.y - 64 / Math.SQRT2) < 0.0001);
    assert.equal(firstWire.worldRotation.z, -135);
    assert.equal(gameRoot.children.filter(node => node.name.startsWith('DirectionArrowGuide')).length, 3);
    assert.deepEqual(bigArrow.getWorldPosition(new Vec3()), new Vec3(208, 208, 0));
    assert.equal(bigVisual.position.y, 67);
    const pooled = gameRoot.children.filter(node => node.name.startsWith('DirectionArrowGuide'));
    buildPlotNode.position.set(32, 0, 0);
    indicator.update(0.1);
    assert.equal(gameRoot.children.filter(node => node.name.startsWith('DirectionArrowGuide')).length, pooled.length, 'shorter targets reuse the pool');
    player.position.set(132, 100, 0);
    indicator.update(0.1);
    assert.equal(firstWire.active, false, 'zero distance hides guide wires');
    assert.equal(bigArrow.active, true, 'zero distance keeps the target marker');
    director.paused = true;
    indicator._beforeDraw();
    assert.equal(bigArrow.active, false, 'paused draw suppresses stale world markers');
    director.paused = false;
});
