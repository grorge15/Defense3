const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;
const flashes = [];
const nav = {
    resetCalls: [], nextCalls: 0, releaseUnit() {}, resetUnit(unit) { this.resetCalls.push(unit); },
    get() { return this; }, contactLog() { return null; }, blockingObstacle() { return null; },
    nextVelocity(_request, out) { this.nextCalls += 1; out.set(64, 0); },
    nextObstacleVelocity(_request, _route, out) { out.set(64, 0); }, canAttackObstacle() { return false; },
    constrainFinalVelocity() {}, worldSpeedForPhysicsVelocity(value) { return value * 32; },
    writePhysicsVelocity(value, out) { out.set(value.x / 32, value.y / 32); return out; },
    bodyForCollider() { return null; }, bodyForCircle() { return null; }, diagnosticSnapshot() { return null; },
};
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function near(actual, expected, message) { assertions += 1; assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: ${actual} !== ${expected}`); }
function test(name, fn) { scenarios += 1; try { fn(); console.log(`ok - ${name}`); } catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; } }

class Vec2 { constructor(x = 0, y = 0) { this.set(x, y); } set(x, y) { if (typeof x === 'object') ({ x, y } = x); this.x = x; this.y = y; return this; } }
class Vec3 { constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); } set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); this.x = x; this.y = y; this.z = z; return this; } clone() { return new Vec3(this); } }
class Rect { constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; } get xMin() { return this.x; } get xMax() { return this.x + this.width; } get yMin() { return this.y; } get yMax() { return this.y + this.height; } }
class Component { constructor() { this.enabled = true; this.isValid = true; this.scheduled = []; } getComponent(Type) { return this.node?.getComponent(Type) ?? null; } getComponentInChildren(Type) { return this.node?.getComponentInChildren(Type) ?? null; } addComponent(Type) { return this.node.addComponent(Type); } scheduleOnce(callback, delay) { this.scheduled.push({ callback, delay }); } unscheduleAllCallbacks() { this.scheduled = []; } }
class Node {
    constructor(name = '') { this.name = name; this.uuid = `${name}-${Node.nextId++}`; this.children = []; this.components = []; this.parent = null; this._scene = null; this.active = true; this.isValid = true; this.position = new Vec3(); this.transformWrites = 0; }
    get scene() { return this._scene ?? this.parent?.scene ?? null; } set scene(value) { this._setScene(value); }
    get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); } get worldPosition() { return this.getWorldPosition(new Vec3()); }
    _setScene(scene) { this._scene = scene; for (const child of this.children) child._setScene(scene); }
    addChild(child) { child.parent = this; child._setScene(this.scene); this.children.push(child); return child; }
    getChildByName(name) { return this.children.find(child => child.name === name) ?? null; }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
    getComponent(Type) { return typeof Type === 'string' ? this.components.find(component => component.constructor.name === Type) ?? null : this.components.find(component => component instanceof Type) ?? null; }
    getComponentInChildren(Type) { return this.getComponentsInChildren(Type)[0] ?? null; }
    getComponentsInChildren(Type) { return [...this.components.filter(component => component instanceof Type), ...this.children.flatMap(child => child.getComponentsInChildren(Type))]; }
    getWorldPosition(out) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); return out.set(parent.x + this.position.x, parent.y + this.position.y, parent.z + this.position.z); }
    setPosition(x, y, z = 0) { this.transformWrites += 1; this.position.set(x, y, z); }
    setWorldPosition(value) { this.transformWrites += 1; const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); this.position.set(value.x - parent.x, value.y - parent.y, value.z - parent.z); }
}
Node.nextId = 1;
class Collider2D extends Component { constructor() { super(); this.width = 10; this.height = 10; this.offset = new Vec2(); this.sensor = false; } get worldAABB() { const p = this.node.worldPosition; return new Rect(p.x + this.offset.x - this.width / 2, p.y + this.offset.y - this.height / 2, this.width, this.height); } }
class BoxCollider2D extends Collider2D {}
class CircleCollider2D extends Collider2D {}
class RigidBody2D extends Component { constructor() { super(); this.type = 'dynamic'; this.linearVelocity = new Vec2(); this.gravityScale = 0; this.fixedRotation = true; this.allowSleep = false; } }
class Animation extends Component { getState() { return null; } once() {} }
Animation.EventType = { FINISHED: 'finished' };
class Prefab { constructor(factory) { this.factory = factory; } }
class EnemyAI extends Component { constructor() { super(); this.target = null; this.resetCalls = 0; } setTarget(target) { this.target = target; } reset() { this.resetCalls += 1; } beginAttack() { return false; } }
class VisualFacing { bind() {} reset() {} faceByTarget() {} faceByVelocity() {} }
class Empty extends Component {}
class Player extends Empty { constructor() { super(); this.isDead = false; } }
class EnemyBoss extends Empty { constructor() { super(); this.isDead = false; } }
class Barracks extends Empty { activate() { this.activations = (this.activations ?? 0) + 1; } }
class HeroShrine extends Empty { activate() { this.activations = (this.activations ?? 0) + 1; } }
class HeroSelectUI extends Empty { ensureReady() {} }
class CoinSystem extends Empty { static instance = null; dropAt() {} }
const cc = { _decorator: { ccclass: () => cls => cls, property: () => () => undefined }, Animation, BoxCollider2D, CircleCollider2D, Collider2D, Component, ERigidBody2DType: { Dynamic: 'dynamic' }, Node, Prefab, Rect, RigidBody2D, Vec2, Vec3, director: { getTotalFrames() { return 0; }, getScene() { return null; } }, instantiate(prefab) { return prefab.factory(); }, resources: { load() {} } };
const events = { onEvent() {}, offEvent() {}, emitEvent() {} };
const mocks = {
    cc,
    '../core/AnimUtil': { playAnim() {}, playAnimWithCallback() {}, playAttackWithFrameHit() {} },
    '../core/AirWallAabb': { AirWallAabb: { bodySize() { return { w: 10, h: 10 }; }, collectAirWalls() { return []; }, steerDirection() {} } },
    '../core/AudioManager': { AudioManager: { playSfx() {} } }, '../core/AttackReservation': { AttackReservation: { releaseForTarget() {} } },
    '../core/EnemyNavigation': { EnemyNavigation: nav }, '../core/EventManager': { EventManager: { instance: events } },
    '../core/GameEvents': { GameEvents: { HP_CHANGED: 'hp', BUILD_COMPLETE: 'build', COIN_CHANGED: 'coin', PARKOUR_FINISHED: 'parkour', BOTH_ADVANCED_TOWERS_COMPLETE: 'advanced', BOSS_TARGET_REGISTER: 'boss-target', ENEMY_NAVIGATION_INVALIDATED: 'nav' } },
    '../core/FlowField': { stableFlowBody(value) { return value; } }, '../core/VisualFacing': { VisualFacing }, '../core/EnemyHitVfx': { playEnemyHitVfx() {} }, '../core/HitFlash': { HitFlash: { flash(node) { flashes.push(node); } } },
    '../game/CoinSystem': { CoinSystem }, '../game/GameManager': { GameManager: { instance: { setPhase() {} } } }, '../game/GamePhase': { GamePhase: { DefensePhase: 'defense', Ultimate: 'ultimate' } },
    '../character/Player': { Player }, '../character/Hero': { Hero: Empty }, '../character/Soldier': { Soldier: Empty }, '../ui/HpBarUI': { HpBarUI: Empty },
    './EnemyAI': { EnemyAI }, '../enemy/BossSpawner': { BossSpawner: Empty }, '../enemy/EnemyBoss': { EnemyBoss }, '../ui/HeroSelectUI': { HeroSelectUI },
    './Barracks': { Barracks }, './Barrier': { Barrier: Empty }, './BuildPlot': { BuildPlot: Empty }, './HeroShrine': { HeroShrine }, './Tower': { Tower: Empty }, './Wall': { Wall: Empty },
};
const loaded = new Map();
function load(relative) {
    const filename = path.resolve(root, relative); if (loaded.has(filename)) return loaded.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }, fileName: filename }).outputText;
    const module = { exports: {} }; const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Math, Number, Set, Array, JSON, Date }, { filename });
    factory(request => { if (request === '../core/GameConfig') return load('assets/scripts/core/GameConfig.ts'); if (request === '../enemy/EnemyMinion') return load('assets/scripts/enemy/EnemyMinion.ts'); if (Object.hasOwn(mocks, request)) return mocks[request]; throw new Error(`Unmocked import ${request}`); }, module, module.exports);
    loaded.set(filename, module.exports); return module.exports;
}

const { GameConfig } = load('assets/scripts/core/GameConfig.ts');
const { EnemyMinion } = load('assets/scripts/enemy/EnemyMinion.ts');
const { BuildSystem } = load('assets/scripts/building/BuildSystem.ts');

nav.notifyObstacleNode = () => {};
nav.requestGeometryCheck = () => {};
function attach(node, Type) { const component = new Type(); component.node = node; node.components.push(component); return component; }
function scene() { const rootNode = new Node('Main'); rootNode.scene = rootNode; return rootNode; }
function minion(rootNode, name, x, y, options = {}) {
    const node = rootNode.addChild(new Node(name)); node.position.set(x, y, 0);
    const visual = node.addChild(new Node('Visual')); const unit = attach(node, EnemyMinion);
    const collider = attach(node, BoxCollider2D); collider.width = options.width ?? 10; collider.height = options.height ?? 10; collider.enabled = options.colliderEnabled ?? true;
    const body = attach(node, RigidBody2D); attach(node, EnemyAI); unit.visualNode = visual; unit.onLoad();
    if (options.dead) unit._isDead = true;
    if (options.active === false) node.active = false;
    if (options.foreignScene) node._scene = options.foreignScene;
    return { unit, node, collider, body };
}
function buildingPrefab(Type, width, height, instances, withCollider = true) {
    return new Prefab(() => {
        const node = new Node(Type.name); const component = attach(node, Type);
        if (withCollider) { const collider = attach(node, BoxCollider2D); collider.width = width; collider.height = height; }
        instances.push({ node, component }); return node;
    });
}
function systemAt(rootNode) { return attach(rootNode.addChild(new Node('BuildSystem')), BuildSystem); }

test('Barracks and HeroShrine each pulse once after activation', () => {
    flashes.length = 0; const rootNode = scene(); const system = systemAt(rootNode); system.buildingRoot = rootNode;
    const barracksInstances = []; const shrineInstances = [];
    system.barracksPrefab = buildingPrefab(Barracks, 100, 50, barracksInstances);
    system.heroShrinePrefab = buildingPrefab(HeroShrine, 80, 40, shrineInstances);
    system.heroPrefab01 = new Prefab(() => new Node('hero1')); system.heroPrefab02 = new Prefab(() => new Node('hero2'));
    const barracksMinion = minion(rootNode, 'barracks-minion', 90, 0);
    system._spawnBarracks(new Vec3(0, 0, 0));
    equal(barracksInstances[0].component.activations, 1, 'Barracks activates once before its pulse');
    equal(flashes.length, 1, 'Barracks accepts one nearby Minion');
    near(barracksMinion.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'Barracks pulse is outward physics velocity');
    const shrineMinion = minion(rootNode, 'shrine-minion', 380, 0);
    system._spawnHeroShrine(new Vec3(300, 0, 0));
    equal(shrineInstances[0].component.activations, 1, 'HeroShrine activates once before its pulse');
    equal(flashes.length, 2, 'HeroShrine accepts one nearby Minion');
    near(shrineMinion.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'HeroShrine pulse is outward physics velocity');
});

test('candidate filtering uses padded AABBs, strict overlap exclusion, and same-scene live Minions only', () => {
    flashes.length = 0; const rootNode = scene(); const system = systemAt(rootNode);
    const building = rootNode.addChild(new Node('building')); const buildingCollider = attach(building, BoxCollider2D); buildingCollider.width = 100; buildingCollider.height = 50;
    const accepted = minion(rootNode, 'accepted', 90, 0); const touching = minion(rootNode, 'touching', 55, 0);
    const embedded = minion(rootNode, 'embedded', 45, 0); const outside = minion(rootNode, 'outside', 100, 0);
    const dead = minion(rootNode, 'dead', 90, 20, { dead: true }); const inactive = minion(rootNode, 'inactive', 90, -20, { active: false });
    const disabled = minion(rootNode, 'disabled', 80, 20, { colliderEnabled: false }); const zero = minion(rootNode, 'zero', 80, -20, { width: 0 });
    const foreign = minion(rootNode, 'foreign', 80, 30, { foreignScene: {} }); const bossNode = rootNode.addChild(new Node('boss')); const boss = attach(bossNode, EnemyBoss); const bossBody = attach(bossNode, RigidBody2D); bossNode.position.set(80, 0);
    const target = rootNode.addChild(new Node('target')); accepted.unit._target = target; accepted.unit._hp = 9;
    accepted.node.transformWrites = 0; touching.node.transformWrites = 0; building.transformWrites = 0;
    system._pushNearbyMinionsFromSpawnedBuilding(building);
    equal(flashes.length, 2, 'only separated Minions, including a touching boundary, receive pulses');
    near(accepted.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'accepted Minion points away from building center');
    near(touching.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'AABB boundary contact is not strict overlap');
    equal(embedded.body.linearVelocity.x, 0, 'strictly embedded Minion is untouched'); equal(outside.body.linearVelocity.x, 0, 'outside padded range is untouched');
    equal(dead.body.linearVelocity.x, 0, 'dead Minion is untouched'); equal(inactive.body.linearVelocity.x, 0, 'inactive Minion is untouched');
    equal(disabled.body.linearVelocity.x, 0, 'disabled collider is untouched'); equal(zero.body.linearVelocity.x, 0, 'zero-size collider is untouched');
    equal(foreign.body.linearVelocity.x, 0, 'foreign-scene Minion is untouched'); equal(bossBody.linearVelocity.x, 0, 'Boss is not considered');
    equal(accepted.unit._hp, 9, 'pulse does not damage'); equal(accepted.unit._target, target, 'pulse preserves combat target');
    equal(accepted.node.transformWrites + touching.node.transformWrites + building.transformWrites, 0, 'pulse writes no transforms');
});

test('root-center fallback accepts only nonzero radial directions', () => {
    flashes.length = 0; const rootNode = scene(); const system = systemAt(rootNode); const building = rootNode.addChild(new Node('no-collider')); building.position.set(400, 0, 0);
    const valid = minion(rootNode, 'fallback-valid', 450, 0); const zero = minion(rootNode, 'fallback-zero', 400, 0); const outside = minion(rootNode, 'fallback-outside', 510, 0);
    system._pushNearbyMinionsFromSpawnedBuilding(building);
    equal(flashes.length, 1, 'fallback range has one eligible Minion'); near(valid.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'fallback uses root-center radial direction');
    equal(zero.body.linearVelocity.x, 0, 'zero radial direction is ignored'); equal(outside.body.linearVelocity.x, 0, 'fallback range is bounded');
});

test('accepted pulses flash once, decay over navigation, refresh safely, and clear at lifecycle boundaries', () => {
    flashes.length = 0; nav.nextCalls = 0; nav.resetCalls.length = 0;
    const rootNode = scene(); const mover = minion(rootNode, 'mover', 0, 0); const target = rootNode.addChild(new Node('target')); target.position.set(300, 0, 0);
    mover.unit._target = target; mover.unit._ai.setTarget(target); mover.unit._forceChaseTarget = true; mover.unit._hp = 12;
    ok(mover.unit.applyBuildingSpawnKnockback(new Vec2(1, 0)), 'valid Dynamic Minion accepts first pulse');
    equal(flashes.length, 1, 'first accepted pulse flashes once'); near(mover.body.linearVelocity.x, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'first pulse starts at configured speed');
    equal(flashes[0], mover.unit.visualNode, 'accepted pulse uses the existing Minion visual HitFlash');
    mover.unit.update(GameConfig.buildingSpawnMinionKnockbackDuration / 3);
    ok(mover.body.linearVelocity.x > 0 && mover.body.linearVelocity.x < GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'pulse velocity monotonically decays');
    equal(nav.nextCalls, 0, 'navigation cannot overwrite an active pulse'); equal(mover.unit._hp, 12, 'pulse preserves hp'); equal(mover.unit._target, target, 'pulse preserves target ownership');
    ok(mover.unit.applyBuildingSpawnKnockback(new Vec2(0, 1)), 'second pulse refreshes direction and full window');
    equal(flashes.length, 2, 'refresh adds exactly one flash'); near(mover.body.linearVelocity.x, 0, 'refresh replaces the old direction'); near(mover.body.linearVelocity.y, GameConfig.buildingSpawnMinionKnockbackInitialSpeed, 'refresh restores full configured speed');
    equal(mover.unit.applyBuildingSpawnKnockback(new Vec2(0, 0)), false, 'zero vector is rejected'); equal(mover.unit.applyBuildingSpawnKnockback(new Vec2(Number.NaN, 1)), false, 'non-finite vector is rejected'); equal(flashes.length, 2, 'rejected vectors do not flash');
    mover.unit.update(GameConfig.buildingSpawnMinionKnockbackDuration);
    ok(nav.nextCalls > 0, 'navigation resumes when pulse expires'); near(mover.body.linearVelocity.x, 2, 'resumed navigation writes through physics conversion');
    ok(mover.unit.applyBuildingSpawnKnockback(new Vec2(-1, 0)), 'pulse can start before normal death'); mover.unit._die();
    equal(mover.unit._buildingSpawnKnockbackLifeGeneration, -1, 'normal death clears pulse state'); near(mover.body.linearVelocity.x, 0, 'normal death clears body velocity');
    mover.unit.reset(); ok(mover.unit.applyBuildingSpawnKnockback(new Vec2(1, 0)), 'pooled Minion can receive a new pulse'); mover.node.active = false; mover.unit.onDisable();
    equal(mover.unit._buildingSpawnKnockbackLifeGeneration, -1, 'disable clears pulse state'); near(mover.body.linearVelocity.x, 0, 'disable clears body velocity');
    mover.node.active = false; equal(mover.unit.applyBuildingSpawnKnockback(new Vec2(1, 0)), false, 'inactive Minion rejects pulses');
});

if (!process.exitCode) console.log(`building spawn minion knockback harness passed: ${assertions} assertions across ${scenarios} scenarios`);
