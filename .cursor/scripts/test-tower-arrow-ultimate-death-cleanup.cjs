const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;
let warnings = 0;
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function test(name, fn) {
    scenarios += 1;
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; }
}

class Vec2 { constructor(x = 0, y = 0) { this.set(x, y); } set(x, y) { this.x = x; this.y = y; return this; } length() { return Math.hypot(this.x, this.y); } }
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vec3(this.x, this.y, this.z); }
    lengthSqr() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    normalize() { const length = Math.sqrt(this.lengthSqr()) || 1; this.x /= length; this.y /= length; this.z /= length; return this; }
    static subtract(out, a, b) { return out.set(a.x - b.x, a.y - b.y, a.z - b.z); }
}
class Component {
    constructor() { this.enabled = true; this.isValid = true; this.scheduled = []; }
    getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
    getComponentInChildren(Type) { return this.node?.getComponentInChildren(Type) ?? null; }
    addComponent(Type) { return this.node.addComponent(Type); }
    schedule(callback, interval) { this.scheduled.push({ callback, interval, repeat: true }); }
    scheduleOnce(callback, delay) { this.scheduled.push({ callback, delay, repeat: false }); }
    unschedule(callback) { this.scheduled = this.scheduled.filter((item) => item.callback !== callback); }
    unscheduleAllCallbacks() { this.scheduled = []; }
    destroy() { this.isValid = false; }
}
class Node {
    constructor(name = '') { this.name = name; this.children = []; this.components = []; this.position = new Vec3(); this.active = true; this.isValid = true; this.parent = null; this._scene = null; this.rotationZ = 0; }
    get scene() { return this._scene ?? this.parent?.scene ?? null; }
    set scene(value) { this._setScene(value); }
    get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
    get worldPosition() { return this.getWorldPosition(new Vec3()); }
    _setScene(scene) { this._scene = scene; this.children.forEach((child) => child._setScene(scene)); }
    addChild(child) { child.parent = this; child._setScene(this.scene); this.children.push(child); return child; }
    getChildByName(name) { return this.children.find((child) => child.name === name) ?? null; }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
    getComponent(Type) { return typeof Type === 'string' ? null : this.components.find((component) => component instanceof Type) ?? null; }
    getComponentInChildren(Type) { return this.getComponentsInChildren(Type)[0] ?? null; }
    getComponentsInChildren(Type) { return [...this.components.filter((component) => component instanceof Type), ...this.children.flatMap((child) => child.getComponentsInChildren(Type))]; }
    getWorldPosition(out) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); return out.set(parent.x + this.position.x, parent.y + this.position.y, parent.z + this.position.z); }
    setWorldPosition(value) { const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); this.position.set(value.x - parent.x, value.y - parent.y, value.z - parent.z); }
    setParent(parent) { parent.addChild(this); }
    setRotationFromEuler(_x, _y, z) { this.rotationZ = z; }
    destroy() { this.isValid = false; this.active = false; }
}
class Collider2D extends Component { constructor() { super(); this.enabled = true; this.sensor = false; } on() {} off() {} }
class BoxCollider2D extends Collider2D {}
class CircleCollider2D extends Collider2D {}
class RigidBody2D extends Component { constructor() { super(); this.linearVelocity = new Vec2(); } }
class Sprite extends Component {}
class Animation extends Component {
    constructor() { super(); this.finished = []; this.played = []; this.state = { speed: 1, duration: 0.25, clip: { duration: 0.25 } }; this.hasDie = true; }
    getState(name) { return name === 'die' && !this.hasDie ? null : this.state; }
    once(_event, callback) { this.finished.push(callback); }
    play(name) { this.played.push(name); }
    finish(state = this.state) { this.finished.slice().forEach((callback) => callback('finished', state)); }
}
Animation.EventType = { FINISHED: 'finished' };
class Prefab { constructor(factory) { this.factory = factory; } }
class Rect { set() {} }
class UITransform extends Component {}

const config = {
    playerAttackDamage: 10, arrowSpeed: 10, arrowMaxDistance: 100, arrowHitRadius: 1, arrowMaxPierce: 2, arrowFullDamageHits: 1, arrowPierceDamageFalloff: 0.5,
    soldierMaxHp: 100, soldierMoveSpeed: 2, soldierMeleeAttackRange: 48, soldierRetargetInterval: 1,
    minionMaxHp: 100, bossMaxHp: 200, enemyMinionAttackEnterRange: 40, enemyMinionAttackExitRange: 50, bossTargetScanInterval: 1, bossRetargetInterval: 1, bossMoveSpeed: 1,
    ultimateZoomDistance: 10, ultimateZoomDuration: 0, ultimateGameOverDelay: 1, ultimateOnce: true,
};
const nav = { releaseUnit() {}, resetUnit() {}, get() { return this; }, worldSpeedForPhysicsVelocity(value) { return value; }, writePhysicsVelocity(value) { return value; } };
const eventManager = { onEvent() {}, offEvent() {}, emitEvent() {} };
const gameManager = { wins: [], setPhase() {}, setGameOver(value) { this.wins.push(value); } };
const cc = {
    _decorator: { ccclass: () => (cls) => cls, property: () => () => undefined }, Animation, BoxCollider2D, CircleCollider2D, Collider2D, Component, Node, Prefab, Rect, RigidBody2D, Sprite, UITransform, Vec2, Vec3,
    Contact2DType: { BEGIN_CONTACT: 'begin' }, ERigidBody2DType: { Dynamic: 'dynamic' }, Input: { EventType: { KEY_DOWN: 'key' } }, KeyCode: { SPACE: 32 }, EventKeyboard: class {},
    director: { getTotalFrames() { return 0; } }, input: { on() {}, off() {} }, instantiate(prefab) { return prefab.factory(); }, resources: { load(_path, _type, callback) { callback(new Error('not used'), null); } },
};
const mocks = {
    cc,
    '../core/GameConfig': { GameConfig: config }, '../core/EventManager': { EventManager: { instance: eventManager } }, '../core/GameEvents': { GameEvents: {} },
    '../core/AnimUtil': { playAnim(node, clip) { node.getComponent(Animation)?.play(clip); }, playAttackWithFrameHit(_node, _clip, hit) { hit(); } },
    '../core/EnemyNavigation': { EnemyNavigation: nav }, '../core/EnemyHitVfx': { playEnemyHitVfx() {} }, '../core/VisualFacing': { VisualFacing: class { bind() {} reset() {} faceByTarget() {} faceByVelocity() {} } }, '../core/AirWallAabb': { AirWallAabb: { bodySize() { return { w: 1, h: 1 }; }, collectAirWalls() { return []; } } }, '../core/PathAgent': { PathAgent: class { reset() {} nextDirection(_dt, _a, _b, _c, _d, _e, out) { out.set(0, 0); } } }, '../core/FlowField': { stableFlowBody(value) { return value; } },
    '../game/CoinSystem': { CoinSystem: { instance: null } }, '../game/CombatSystem': { CombatSystem: class {} }, '../game/HealthSystem': { HealthSystem: class {} }, '../ui/HpBarUI': { HpBarUI: class {} }, '../item/Log': { Log: class {} }, '../character/Player': { Player: class {} }, '../character/Hero': { Hero: class {} }, '../character/Soldier': {}, '../building/Barracks': { Barracks: class {} }, '../building/Barrier': { Barrier: class {} }, '../building/Building': { Building: class {} }, '../building/HeroShrine': { HeroShrine: class {} }, '../building/Tower': { Tower: class {} }, './EnemyAI': { EnemyAI: class { setTarget() {} reset() {} } },
    '../enemy/EnemyMinion': { EnemyMinion: class extends Component {} }, '../enemy/EnemyBoss': { EnemyBoss: class extends Component {} },
    '../enemy/EnemySpawner': { EnemySpawner: class extends Component {} }, './CameraFollow': { CameraFollow: class {} }, './GameManager': { GameManager: { instance: gameManager } }, './GamePhase': { GamePhase: { Ultimate: 'ultimate' } },
};
const loaded = new Map();
function load(relative) {
    const filename = path.resolve(root, relative); if (loaded.has(filename)) return loaded.get(filename);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }, fileName: filename }).outputText;
    const module = { exports: {} }; const sandboxConsole = { ...console, warn(...args) { warnings += 1; } };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console: sandboxConsole, Math, Number, Set, Array }, { filename });
    factory((request) => {
        if (Object.hasOwn(mocks, request)) return mocks[request];
        if (request === '../projectile/Arrow') return load('assets/scripts/projectile/Arrow.ts');
        if (request === '../enemy/EnemyMinion') return load('assets/scripts/enemy/EnemyMinion.ts');
        if (request === '../enemy/EnemyBoss') return load('assets/scripts/enemy/EnemyBoss.ts');
        if (request === '../character/Soldier') return load('assets/scripts/character/Soldier.ts');
        throw new Error(`Unmocked import ${request} from ${relative}`);
    }, module, module.exports); loaded.set(filename, module.exports); return module.exports;
}
const { Arrow } = load('assets/scripts/projectile/Arrow.ts');
delete mocks['../enemy/EnemyMinion']; delete mocks['../enemy/EnemyBoss'];
const { EnemyMinion } = load('assets/scripts/enemy/EnemyMinion.ts');
mocks['../enemy/EnemyMinion'] = { EnemyMinion };
mocks['../character/Soldier'].Soldier = load('assets/scripts/character/Soldier.ts').Soldier;
const { Soldier } = mocks['../character/Soldier'];
const { EnemyBoss } = load('assets/scripts/enemy/EnemyBoss.ts');
mocks['../enemy/EnemyBoss'] = { EnemyBoss };
const { UltimateSystem } = load('assets/scripts/game/UltimateSystem.ts');

function scene() { const rootNode = new Node('Main'); rootNode.scene = rootNode; return rootNode; }
function attach(node, Type) { const component = new Type(); component.node = node; node.components.push(component); return component; }
function runScheduled(component) { component.scheduled.slice().forEach((item) => item.callback()); }
function makeEnemy(rootNode, Type, withAnimation = true) { const node = rootNode.addChild(new Node(Type.name)); const enemy = attach(node, Type); if (withAnimation) { const visual = node.addChild(new Node('Visual')); const animation = attach(visual, Animation); enemy.visualNode = visual; return { enemy, node, animation }; } return { enemy, node, animation: null }; }

test('Arrow angle helper preserves player direction, offset, and zero-direction fallback', () => {
    equal(Arrow.rotationZForDirection(new Vec3(1, 0, 0), 30), 30, 'rightward angle applies serialized offset');
    equal(Arrow.rotationZForDirection(new Vec3(0, 1, 0), 180), 270, 'upward angle uses the player convention');
    equal(Arrow.rotationZForDirection(new Vec3(0, 0, 7), 180), 270, 'zero XY uses deterministic upward fallback');
    const node = new Node('PlayerArrow'); const arrow = attach(node, Arrow); arrow.directionAngleOffset = 20; const target = new Node('Target'); target.position.set(0, 10, 0); arrow.init(target); equal(node.rotationZ, 110, 'player Arrow init still uses the shared helper');
});

test('Tower projectile uses Arrow offset without changing immediate damage or timed movement', () => {
    const rootNode = scene(); const soldierNode = rootNode.addChild(new Node('Ranged')); const soldier = attach(soldierNode, Soldier); soldier._deployment = 'tower'; let projectile;
    soldier.projectilePrefab = new Prefab(() => { projectile = new Node('Projectile'); const arrow = attach(projectile, Arrow); arrow.directionAngleOffset = 25; return projectile; });
    const target = rootNode.addChild(new Node('Target')); target.position.set(10, 0, 0); let hits = 0; soldier._findPreferredTarget = () => ({ node: target, isDead: false, takeDamage() { hits += 1; } }); soldier.tryAttack();
    equal(projectile.rotationZ, 25, 'tower uses the Arrow instance serialized offset'); equal(hits, 1, 'tower keeps immediate single takeDamage'); equal(soldier.scheduled[0].repeat, true, 'tower keeps the existing interpolation schedule');
    soldier.scheduled[0].callback(0.2); equal(projectile.isValid, false, 'tower keeps the 0.2 second projectile lifetime');
});

test('Tower projectile handles Sprite and no-visual fallbacks without changing flight', () => {
    const rootNode = scene(); const soldier = attach(rootNode.addChild(new Node('Ranged')), Soldier); const target = rootNode.addChild(new Node('Target')); target.position.set(1, 0, 0); let spriteProjectile; soldier.projectilePrefab = new Prefab(() => { spriteProjectile = new Node('SpriteProjectile'); attach(spriteProjectile, Sprite); return spriteProjectile; }); soldier._spawnProjectile(target); equal(spriteProjectile.rotationZ, 180, 'Sprite fallback uses default Arrow offset');
    let plainProjectile; soldier.projectilePrefab = new Prefab(() => { plainProjectile = new Node('PlainProjectile'); return plainProjectile; }); const before = warnings; soldier._spawnProjectile(target); soldier._spawnProjectile(target); equal(plainProjectile.rotationZ, 0, 'no-visual fallback leaves the projectile unrotated'); equal(warnings - before, 1, 'no-visual fallback warns once and continues'); equal(soldier.scheduled.length, 3, 'all fallback projectiles retain timed flight');
});

test('Final minion death quiesces without normal coin or pool behavior and finishes once', () => {
    const rootNode = scene(); const { enemy, node, animation } = makeEnemy(rootNode, EnemyMinion); let complete = 0; let pool = 0; enemy.onReturnedToPool = () => { pool += 1; }; enemy.playFinalDeath(() => { complete += 1; });
    equal(enemy.isDead, true, 'final minion becomes non-combatant'); equal(node.active, true, 'final minion remains visible during die animation'); equal(animation.played[0], 'die', 'final minion plays die'); equal(pool, 0, 'final minion does not return to pool'); animation.finish(); animation.finish(); equal(complete, 1, 'duplicate animation completion resolves once'); equal(node.active, true, 'component completion does not deactivate directly');
});

test('Final boss death preserves normal FINISHED behavior and resolves missing or interrupted visuals', () => {
    const rootNode = scene(); const normal = makeEnemy(rootNode, EnemyBoss); normal.enemy.takeDamage(999); equal(normal.node.active, true, 'normal boss death still waits for FINISHED'); normal.animation.finish(); equal(normal.node.active, false, 'normal boss FINISHED still deactivates');
    const missing = makeEnemy(rootNode, EnemyBoss, false); let immediate = 0; missing.enemy.playFinalDeath(() => { immediate += 1; }); equal(immediate, 1, 'missing final visual resolves immediately');
    const interrupted = makeEnemy(rootNode, EnemyBoss); let interruptedCalls = 0; interrupted.enemy.playFinalDeath(() => { interruptedCalls += 1; }); interrupted.enemy.onDisable(); interrupted.enemy.onDestroy(); equal(interruptedCalls, 1, 'disable and destroy resolve a final death once');
});

test('Final death fallback, duplicate request, reset, and throwing callback cannot deadlock', () => {
    const rootNode = scene(); const { enemy, animation } = makeEnemy(rootNode, EnemyMinion); let a = 0; let b = 0; enemy.playFinalDeath(() => { a += 1; }); enemy.playFinalDeath(() => { b += 1; }); runScheduled(enemy); equal(a, 1, 'fallback resolves first callback once'); equal(b, 1, 'duplicate request joins the same completion'); animation.finish(); equal(a + b, 2, 'late animation event is ignored');
    const reset = makeEnemy(rootNode, EnemyBoss); let resetCalls = 0; reset.enemy.playFinalDeath(() => { resetCalls += 1; }); reset.enemy.reset(); equal(resetCalls, 1, 'reset resolves pending final death'); const before = warnings; reset.enemy.playFinalDeath(() => { throw new Error('expected'); }); reset.animation.finish(); ok(warnings > before, 'throwing completion is contained as a diagnostic');
});

test('Ultimate stops spawners, waits for the whole selected batch, then deactivates and settles once', () => {
    const rootNode = scene(); const host = rootNode.addChild(new Node('Ultimate')); const ultimate = attach(host, UltimateSystem); const spawner = attach(rootNode.addChild(new Node('Spawner')), mocks['../enemy/EnemySpawner'].EnemySpawner); spawner.scheduleOnce(() => {}, 5); const minion = makeEnemy(rootNode, EnemyMinion); const boss = makeEnemy(rootNode, EnemyBoss); ultimate.clearAllEnemies();
    equal(spawner.enabled, false, 'cleanup disables future spawner update'); equal(spawner.scheduled.length, 0, 'cleanup clears pending respawn and side schedules'); equal(minion.node.active && boss.node.active, true, 'selected enemies stay visible until all presentations complete'); minion.animation.finish(); equal(boss.node.active, true, 'one completed enemy cannot deactivate the batch early'); boss.animation.finish(); equal(minion.node.active, false, 'batch minion deactivates after all completions'); equal(boss.node.active, false, 'batch boss deactivates after all completions'); equal(ultimate.scheduled.length, 1, 'one victory settlement is scheduled'); ultimate.clearAllEnemies(); equal(ultimate.scheduled.length, 1, 'duplicate cleanup does not schedule another settlement'); runScheduled(ultimate); equal(gameManager.wins.filter((value) => value === 'win').length, 1, 'victory settlement runs exactly once');
});

test('Ultimate handles no enemies, synchronous completion, destroyed targets, and failing presentation callbacks', () => {
    const emptyRoot = scene(); const empty = attach(emptyRoot.addChild(new Node('Ultimate')), UltimateSystem); empty.clearAllEnemies(); equal(empty.scheduled.length, 1, 'no selected enemies settles without waiting');
    const rootNode = scene(); const ultimate = attach(rootNode.addChild(new Node('Ultimate')), UltimateSystem); const sync = makeEnemy(rootNode, EnemyMinion, false); const failing = makeEnemy(rootNode, EnemyBoss); failing.enemy.playFinalDeath = () => { throw new Error('expected'); }; const destroyed = makeEnemy(rootNode, EnemyMinion); destroyed.node.isValid = false; ultimate.clearAllEnemies(); equal(sync.node.active, false, 'synchronous missing-visual completion joins the uniform batch removal'); equal(failing.node.active, false, 'throwing presentation resolves instead of blocking cleanup'); equal(ultimate.scheduled.length, 1, 'destroyed and failing targets still lead to one settlement');
});

if (!process.exitCode) console.log(`tower arrow / ultimate death cleanup harness passed: ${assertions} assertions across ${scenarios} scenarios`);
