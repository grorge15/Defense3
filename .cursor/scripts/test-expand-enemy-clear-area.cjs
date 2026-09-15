const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;
const warnings = [];
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function test(name, fn) {
    scenarios += 1;
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; }
}

class Vec2 { constructor(x = 0, y = 0) { this.set(x, y); } set(x, y) { this.x = x; this.y = y; return this; } length() { return Math.hypot(this.x, this.y); } }
class Vec3 { constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); } set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); this.x = x; this.y = y; this.z = z; return this; } }
class Rect {
    constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; }
    get xMin() { return this.x; } get xMax() { return this.x + this.width; }
    get yMin() { return this.y; } get yMax() { return this.y + this.height; }
    set(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height; return this; }
}
class Component {
    constructor() { this.enabled = true; this.isValid = true; this.scheduled = []; }
    getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
    getComponentInChildren(Type) { return this.node?.getComponentInChildren(Type) ?? null; }
    addComponent(Type) { return this.node.addComponent(Type); }
    scheduleOnce(callback, delay) { this.scheduled.push({ callback, delay }); }
    unscheduleAllCallbacks() { this.scheduled = []; }
}
class Node {
    constructor(name = '') { this.name = name; this.uuid = `${name}-${Node.nextId++}`; this.children = []; this.components = []; this.position = new Vec3(); this.active = true; this.isValid = true; this.parent = null; this._scene = null; }
    get scene() { return this._scene ?? this.parent?.scene ?? null; }
    set scene(value) { this._setScene(value); }
    get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
    get worldPosition() { return this.getWorldPosition(new Vec3()); }
    _setScene(scene) { this._scene = scene; this.children.forEach((child) => child._setScene(scene)); }
    addChild(child) { child.parent = this; child._setScene(this.scene); this.children.push(child); return child; }
    getChildByName(name) { return this.children.find((child) => child.name === name) ?? null; }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
    getComponent(Type) { return this.components.find((component) => component instanceof Type) ?? null; }
    getComponentInChildren(Type) { return this.getComponentsInChildren(Type)[0] ?? null; }
    getComponentsInChildren(Type) { return [...this.components.filter((component) => component instanceof Type), ...this.children.flatMap((child) => child.getComponentsInChildren(Type))]; }
    getWorldPosition(out) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); return out.set(parent.x + this.position.x, parent.y + this.position.y, parent.z + this.position.z); }
    setWorldPosition(value) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); this.position.set(value.x - parent.x, value.y - parent.y, value.z - parent.z); }
}
Node.nextId = 1;
class Collider2D extends Component {
    constructor() { super(); this.sensor = false; this.width = 10; this.height = 10; this.offset = new Vec2(); }
    get worldAABB() { const p = this.node.worldPosition; return new Rect(p.x + this.offset.x - this.width / 2, p.y + this.offset.y - this.height / 2, this.width, this.height); }
}
class BoxCollider2D extends Collider2D {}
class CircleCollider2D extends Collider2D {}
class RigidBody2D extends Component { constructor() { super(); this.linearVelocity = new Vec2(); } }
class Animation extends Component { getState() { return null; } once() {} }
Animation.EventType = { FINISHED: 'finished' };
class Prefab {}
class EnemyAI extends Component { constructor() { super(); this.target = null; this.resetCalls = 0; } setTarget(target) { this.target = target; } reset() { this.resetCalls += 1; } }
class VisualFacing { bind() {} reset() {} faceByTarget() {} faceByVelocity() {} }
class EmptyComponent extends Component {}
class Player extends EmptyComponent { constructor() { super(); this.isDead = false; } }
class Hero extends EmptyComponent { constructor() { super(); this.isDead = false; } }
class Soldier extends EmptyComponent { constructor() { super(); this.isDead = false; } }
class Log extends EmptyComponent {}
class Barrier extends EmptyComponent { isAlive() { return true; } }
class Building extends EmptyComponent { isAlive() { return true; } }
class Barracks extends Building {}
class HeroShrine extends Building {}
class Tower extends Building {}
class BossSpawner extends EmptyComponent {}
class CoinSystem extends EmptyComponent {}
class HpBarUI extends EmptyComponent { bindTarget() {} applyHp() {} }

const nav = { resetCalls: [], releaseUnit() {}, resetUnit(unit) { this.resetCalls.push(unit); }, get() { return this; }, worldSpeedForPhysicsVelocity(value) { return value; }, writePhysicsVelocity(value) { return value; }, bodyForCollider() { return null; }, bodyForCircle() { return null; } };
const eventManager = { onEvent() {}, offEvent() {}, emitEvent() {} };
const cc = {
    _decorator: { ccclass: () => (cls) => cls, property: () => () => undefined },
    Animation, BoxCollider2D, CircleCollider2D, Collider2D, Component, ERigidBody2DType: { Dynamic: 'dynamic' }, Node, Prefab, Rect, RigidBody2D, Vec2, Vec3,
    director: { getTotalFrames() { return 0; } }, instantiate() { return new Node('instance'); }, resources: { load() {} }, UITransform: EmptyComponent,
};
const gameConfig = { minionMaxHp: 100, bossMaxHp: 500, enemyMinionAttackEnterRange: 40, enemyMinionAttackExitRange: 50, minionMoveSpeed: 1, bossMoveSpeed: 1, bossTargetScanInterval: 1, bossRetargetInterval: 1 };
const mocks = {
    cc,
    '../core/AnimUtil': { playAnim() {}, playAttackWithFrameHit(_node, _clip, hit) { hit(); } },
    '../core/AirWallAabb': { AirWallAabb: { bodySize() { return { w: 10, h: 10 }; }, collectAirWalls() { return []; }, steerDirection() {} } },
    '../core/AttackReservation': { AttackReservation: { releaseForTarget() {} } },
    '../core/AudioManager': { AudioManager: { playSfx() {} } },
    '../core/EnemyNavigation': { EnemyNavigation: nav }, '../core/EventManager': { EventManager: { instance: eventManager } }, '../core/GameConfig': { GameConfig: gameConfig }, '../core/GameEvents': { GameEvents: { ENEMY_NAVIGATION_INVALIDATED: 'nav', PARKOUR_FINISHED: 'parkour', BUILD_COMPLETE: 'build', COIN_CHANGED: 'coin', BOTH_ADVANCED_TOWERS_COMPLETE: 'advanced', BOSS_TARGET_REGISTER: 'target', HP_CHANGED: 'hp' } },
    '../core/FlowField': { stableFlowBody(value) { return value; } }, '../core/VisualFacing': { VisualFacing }, '../core/EnemyHitVfx': { playEnemyHitVfx() {} },
    '../game/CoinSystem': { CoinSystem }, '../game/GameManager': { GameManager: { instance: { setPhase() {} } } }, '../game/GamePhase': { GamePhase: { DefensePhase: 'defense', Ultimate: 'ultimate' } },
    '../item/Log': { Log }, '../character/Player': { Player }, '../character/Hero': { Hero }, '../character/Soldier': { Soldier }, '../ui/HpBarUI': { HpBarUI },
    '../building/Barracks': { Barracks }, '../building/Barrier': { Barrier }, '../building/Building': { Building }, '../building/HeroShrine': { HeroShrine }, '../building/Tower': { Tower }, './EnemyAI': { EnemyAI }, '../enemy/BossSpawner': { BossSpawner }, '../ui/HeroSelectUI': { HeroSelectUI: EmptyComponent },
    './Barracks': { Barracks }, './Barrier': { Barrier }, './BuildPlot': { BuildPlot: EmptyComponent }, './HeroShrine': { HeroShrine }, './Tower': { Tower }, './Wall': { Wall: EmptyComponent },
};
const loaded = new Map();
function load(relative) {
    const filename = path.resolve(root, relative); if (loaded.has(filename)) return loaded.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }, fileName: filename }).outputText;
    const module = { exports: {} };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console: { ...console, warn(...args) { warnings.push(args.join(' ')); } }, Math, Number, Set, Array }, { filename });
    factory((request) => { if (request === '../enemy/EnemyMinion') return load('assets/scripts/enemy/EnemyMinion.ts'); if (request === '../enemy/EnemyBoss') return load('assets/scripts/enemy/EnemyBoss.ts'); if (Object.hasOwn(mocks, request)) return mocks[request]; throw new Error(`Unmocked import ${request}`); }, module, module.exports);
    loaded.set(filename, module.exports); return module.exports;
}

const { EnemyMinion } = load('assets/scripts/enemy/EnemyMinion.ts');
const { EnemyBoss } = load('assets/scripts/enemy/EnemyBoss.ts');
const { BuildSystem } = load('assets/scripts/building/BuildSystem.ts');
function attach(node, Type) { const component = new Type(); component.node = node; node.components.push(component); return component; }
function scene() { const rootNode = new Node('Main'); rootNode.scene = rootNode; return rootNode; }
function marker(rootNode, name, x, y, width, height, sensor = true) { const node = rootNode.addChild(new Node(name)); node.position.set(x, y); const box = attach(node, BoxCollider2D); box.width = width; box.height = height; box.sensor = sensor; return box; }
function enemy(rootNode, Type, name, x, y, width, height) { const node = rootNode.addChild(new Node(name)); node.position.set(x, y); const unit = attach(node, Type); const body = attach(node, BoxCollider2D); body.width = width; body.height = height; const rb = attach(node, RigidBody2D); if (Type === EnemyMinion) { attach(node, EnemyAI); unit.onLoad(); } else { unit.onLoad(); } return { unit, node, body, rb }; }
function inside(inner, outer) { return inner.xMin >= outer.xMin && inner.xMax <= outer.xMax && inner.yMin >= outer.yMin && inner.yMax <= outer.yMax; }
function overlap(left, right) { return left.xMin < right.xMax && left.xMax > right.xMin && left.yMin < right.yMax && left.yMax > right.yMin; }

test('exact active sensor markers relocate living minions and bosses with complete separated footprints', () => {
    const rootNode = scene(); const system = attach(rootNode.addChild(new Node('BuildSystem')), BuildSystem);
    const clear = marker(rootNode, 'ExpandAreaCollider', 50, 50, 100, 100); const drop = marker(rootNode, 'SetPos', 250, 50, 120, 100);
    const minion = enemy(rootNode, EnemyMinion, 'Minion', 10, 50, 20, 16); const boss = enemy(rootNode, EnemyBoss, 'Boss', 70, 50, 36, 30); const outside = enemy(rootNode, EnemyMinion, 'Outside', 160, 50, 12, 12);
    const target = rootNode.addChild(new Node('Target')); minion.unit._target = target; minion.unit._ai.setTarget(target); minion.unit._isAttacking = true; minion.unit._attackGeneration = 3; minion.rb.linearVelocity.set(9, -2); minion.unit._hp = 37;
    boss.unit._lockedTarget = target; boss.unit._isAttacking = true; boss.unit._attackGeneration = 4; boss.unit._attackTimer = 2; boss.rb.linearVelocity.set(-4, 7); boss.unit._hp = 211;
    system._clearExpansionEnemies();
    ok(inside(minion.body.worldAABB, drop.worldAABB), 'minion footprint is fully inside SetPos'); ok(inside(boss.body.worldAABB, drop.worldAABB), 'boss footprint is fully inside SetPos'); ok(!overlap(minion.body.worldAABB, boss.body.worldAABB), 'relocated footprints do not overlap');
    equal(outside.node.worldPosition.x, 160, 'outside enemy remains in place'); equal(minion.unit._target, target, 'minion target ownership is preserved'); equal(boss.unit._lockedTarget, target, 'boss target ownership is preserved'); equal(minion.unit._hp, 37, 'minion health is preserved'); equal(boss.unit._hp, 211, 'boss health is preserved');
    equal(minion.unit._isAttacking, false, 'minion old attack state is cancelled'); equal(boss.unit._isAttacking, false, 'boss old attack state is cancelled'); equal(minion.unit._attackGeneration, 4, 'minion invalidates old delayed attack callbacks'); equal(boss.unit._attackGeneration, 5, 'boss invalidates old delayed attack callbacks'); equal(minion.unit._ai.resetCalls, 1, 'minion attack cooldown is reset without changing its target'); equal(boss.unit._attackTimer, 0, 'boss old attack cooldown is cleared'); equal(minion.rb.linearVelocity.x, 0, 'minion rigidbody velocity is cleared'); equal(boss.rb.linearVelocity.y, 0, 'boss rigidbody velocity is cleared'); ok(nav.resetCalls.includes(minion.node) && nav.resetCalls.includes(boss.node), 'both relocated units reset navigation state');
    ok(clear.sensor, 'clear marker remains a sensor');
});

test('touching the clear boundary is included while inactive and dead enemies are ignored', () => {
    const rootNode = scene(); const system = attach(rootNode.addChild(new Node('BuildSystem')), BuildSystem); marker(rootNode, 'ExpandAreaCollider', 50, 50, 100, 100); const drop = marker(rootNode, 'SetPos', 250, 50, 120, 100);
    const touching = enemy(rootNode, EnemyMinion, 'Touching', 105, 50, 10, 10); const dead = enemy(rootNode, EnemyMinion, 'Dead', 45, 50, 10, 10); dead.unit._isDead = true; const inactive = enemy(rootNode, EnemyBoss, 'Inactive', 55, 50, 10, 10); inactive.node.active = false;
    system._clearExpansionEnemies();
    ok(inside(touching.body.worldAABB, drop.worldAABB), 'boundary contact counts as clear-area intersection'); equal(dead.node.worldPosition.x, 45, 'dead unit is not moved'); equal(inactive.node.worldPosition.x, 55, 'inactive unit is not moved');
});

test('invalid markers and insufficient capacity leave every candidate in place', () => {
    const invalidRoot = scene(); const invalidSystem = attach(invalidRoot.addChild(new Node('BuildSystem')), BuildSystem); marker(invalidRoot, 'ExpandAreaCollider', 50, 50, 100, 100, false); marker(invalidRoot, 'SetPos', 250, 50, 120, 100); const invalidEnemy = enemy(invalidRoot, EnemyMinion, 'InvalidMarker', 50, 50, 10, 10); invalidSystem._clearExpansionEnemies(); equal(invalidEnemy.node.worldPosition.x, 50, 'non-sensor marker causes a no-op');
    const smallRoot = scene(); const smallSystem = attach(smallRoot.addChild(new Node('BuildSystem')), BuildSystem); marker(smallRoot, 'ExpandAreaCollider', 50, 50, 100, 100); marker(smallRoot, 'SetPos', 250, 50, 16, 10); const first = enemy(smallRoot, EnemyMinion, 'First', 45, 50, 10, 10); const second = enemy(smallRoot, EnemyBoss, 'Second', 55, 50, 10, 10); smallSystem._clearExpansionEnemies(); equal(first.node.worldPosition.x, 45, 'capacity failure preserves the first candidate'); equal(second.node.worldPosition.x, 55, 'capacity failure preserves the second candidate'); ok(warnings.some((message) => message.includes('cannot contain')), 'capacity failure emits a diagnostic');
});

test('expansion defers Dynamic-body relocation and removes marker fixtures before teleporting', () => {
    const rootNode = scene(); const system = attach(rootNode.addChild(new Node('BuildSystem')), BuildSystem);
    const clear = marker(rootNode, 'ExpandAreaCollider', 50, 50, 100, 100); const drop = marker(rootNode, 'SetPos', 250, 50, 120, 100);
    const minion = enemy(rootNode, EnemyMinion, 'Minion', 50, 50, 12, 12);
    system._onExpandComplete();
    equal(minion.node.worldPosition.x, 50, 'completion does not move a Dynamic body in the build callback');
    equal(system.scheduled.length, 1, 'completion schedules one deferred clear pass');
    system.scheduled[0].callback();
    ok(inside(minion.body.worldAABB, drop.worldAABB), 'deferred pass relocates the selected enemy');
    equal(clear.enabled, false, 'clear marker fixture is disabled before the teleport');
    equal(drop.enabled, false, 'drop marker fixture is disabled before the teleport');
});

if (!process.exitCode) console.log(`expand enemy clear area harness passed: ${assertions} assertions across ${scenarios} scenarios`);
