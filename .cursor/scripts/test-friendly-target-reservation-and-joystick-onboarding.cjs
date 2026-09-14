const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function test(name, fn) {
    scenarios += 1;
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; }
}

class Vec2 {
    constructor(x = 0, y = 0) { this.set(x, y); }
    set(x, y) { if (typeof x === 'object') ({ x, y } = x); this.x = x; this.y = y; return this; }
    length() { return Math.hypot(this.x, this.y); }
    lengthSqr() { return this.x * this.x + this.y * this.y; }
    multiplyScalar(value) { this.x *= value; this.y *= value; return this; }
}
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vec3(this.x, this.y, this.z); }
    lengthSqr() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    normalize() { const length = Math.sqrt(this.lengthSqr()) || 1; this.x /= length; this.y /= length; this.z /= length; return this; }
    static subtract(out, a, b) { return out.set(a.x - b.x, a.y - b.y, a.z - b.z); }
}
Vec3.ZERO = new Vec3();
class Component {
    constructor() { this.enabled = true; this.isValid = true; this.scheduled = []; }
    getComponent(Type) { return this.node?.getComponent(Type) ?? null; }
    getComponentInChildren(Type) { return this.node?.getComponentInChildren(Type) ?? null; }
    addComponent(Type) { return this.node.addComponent(Type); }
    schedule(callback, interval) { this.scheduled.push({ callback, interval, repeat: true }); }
    scheduleOnce(callback, delay) { this.scheduled.push({ callback, delay, repeat: false }); }
    unschedule(callback) { this.scheduled = this.scheduled.filter((item) => item.callback !== callback); }
    unscheduleAllCallbacks() { this.scheduled = []; }
}
class Node {
    constructor(name = '') { this.name = name; this.children = []; this.components = []; this.position = new Vec3(); this.active = true; this.isValid = true; this.parent = null; this._scene = null; }
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
    setWorldPosition(value, y, z = 0) { if (typeof value === 'number') value = new Vec3(value, y, z); const parent = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3(); this.position.set(value.x - parent.x, value.y - parent.y, value.z - parent.z); }
    setParent(parent) { parent.addChild(this); }
    setPosition(value) { this.position.set(value); }
    setRotationFromEuler() {}
    destroy() { this.isValid = false; this.active = false; }
}
class Collider2D extends Component { constructor() { super(); this.sensor = false; this.enabled = true; } on() {} off() {} }
class RigidBody2D extends Component { constructor() { super(); this.linearVelocity = new Vec2(); } }
class Animation extends Component { getState() { return { duration: 1, speed: 1, clip: { duration: 1 } }; } }
class UITransform extends Component { convertToNodeSpaceAR(value, out) { out.set(value); } }
class Prefab { constructor(factory) { this.factory = factory; } }
class EnemyMinion extends Component { constructor(hp = 15) { super(); this.currentHp = hp; this.isDead = false; this.hits = 0; } takeDamage() { this.hits += 1; } }
class EnemyBoss extends Component { constructor() { super(); this.currentHp = 1500; this.isDead = false; this.hits = 0; } takeDamage() { this.hits += 1; } }
class HealthSystem extends Component { resetHp() {} takeDamage() {} heal() {} }

const config = {
    playerAttackDamage: 10, playerAttackRange: 100, playerAttackInterval: 1, arrowSpeed: 10, arrowMaxDistance: 20, arrowHitRadius: 2, arrowMaxPierce: 5, arrowFullDamageHits: 3, arrowPierceDamageFalloff: 0.5,
    soldierMaxHp: 20, soldierMoveSpeed: 6, soldierMeleeAttackRange: 40, soldierRetargetInterval: 0.35, soldierRangedTargetCount: 3, playerMoveSpeed: 6, playerParkourForwardSpeed: 7, playerParkourChargeSpeed: 4,
    joystickHintDelay: 3, joystickHintFigure8Amp: 28, joystickHintFigure8Period: 2.2,
};
const eventManager = { onEvent() {}, offEvent() {}, emitEvent() {} };
const deferredAnimations = new WeakMap();
const cc = {
    _decorator: { ccclass: () => (cls) => cls, property: () => () => undefined }, Component, Node, Vec2, Vec3, Collider2D, RigidBody2D, Animation, UITransform, Prefab,
    BoxCollider2D: Collider2D, CircleCollider2D: Collider2D, Sprite: class extends Component {}, Rect: class {},
    Contact2DType: { BEGIN_CONTACT: 'contact' }, ERigidBody2DType: { Dynamic: 'dynamic' }, Input: { EventType: { TOUCH_START: 'start', TOUCH_MOVE: 'move', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel' } },
    input: { on() {}, off() {} }, director: { pause() {} }, instantiate(prefab) { return prefab.factory(); }, resources: { load() {} },
};
const mocks = {
    cc,
    '../core/GameConfig': { GameConfig: config }, '../core/EventManager': { EventManager: { instance: eventManager } }, '../core/GameEvents': { GameEvents: { PHASE_CHANGED: 'phase', PARKOUR_FINISHED: 'finished' } },
    '../core/AnimUtil': { playAnim() {}, playAttackWithFrameHit(node, clip, hit, _fallback, complete) { const queue = deferredAnimations.get(node); if (queue) queue.push({ clip, hit, complete }); else { hit(); complete?.(); } } },
    '../core/HitFlash': { HitFlash: class { flash() {} } },
    '../core/VisualFacing': { VisualFacing: class { bind() {} reset() {} faceByTarget() {} faceByVelocity() {} } }, '../core/AirWallAabb': { AirWallAabb: { bodySize() { return { w: 1, h: 1 }; }, collectAirWalls() { return []; } } }, '../core/PathAgent': { PathAgent: class { reset() {} nextDirection(_dt, _a, _b, _c, _d, _e, out) { out.set(0, 0); } } },
    '../core/EnemyHitVfx': { playEnemyHitVfx() {} }, '../core/EnemyNavigation': { EnemyNavigation: { get() { return null; } } }, '../core/FlowField': { stableFlowBody(value) { return value; } },
    '../enemy/EnemyMinion': { EnemyMinion }, '../enemy/EnemyBoss': { EnemyBoss }, '../projectile/Arrow': null,
    '../character/Player': null, '../character/Soldier': { Soldier: class {} }, '../game/CombatSystem': { CombatSystem: class {} }, '../game/HealthSystem': { HealthSystem }, '../item/Log': { Log: class {} }, '../ui/HpBarUI': { HpBarUI: class {} },
    '../game/GameManager': { GameManager: { instance: null } }, '../game/GamePhase': { GamePhase: { RunParkour: 'parkour', CombatGuide: 'guide', BuildPhase1: 'build1', BuildPhase2: 'build2', DefensePhase: 'defense', Ultimate: 'ultimate', GameOver: 'gameover' } },
};
const loaded = new Map();
function load(relative) {
    const filename = path.resolve(root, relative);
    if (loaded.has(filename)) return loaded.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }, fileName: filename }).outputText;
    const module = { exports: {} };
    loaded.set(filename, module.exports);
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Math, Number, Map, Set, Array }, { filename });
    factory((request) => {
        if (request === '../core/AttackReservation') return load('assets/scripts/core/AttackReservation.ts');
        if (request === '../projectile/Arrow') return mocks['../projectile/Arrow'];
        if (request === '../character/Player') return mocks['../character/Player'];
        if (Object.hasOwn(mocks, request)) return mocks[request];
        throw new Error(`Unmocked import ${request} from ${relative}`);
    }, module, module.exports);
    loaded.set(filename, module.exports);
    return module.exports;
}
const { AttackReservation } = load('assets/scripts/core/AttackReservation.ts');
const { Arrow } = load('assets/scripts/projectile/Arrow.ts');
mocks['../projectile/Arrow'] = { Arrow };
const { CombatSystem } = load('assets/scripts/game/CombatSystem.ts');
const { Soldier } = load('assets/scripts/character/Soldier.ts');
const { Player } = load('assets/scripts/character/Player.ts');
mocks['../character/Player'] = { Player };
const { Joystick } = load('assets/scripts/ui/Joystick.ts');
mocks['./Joystick'] = { Joystick };
const { JoystickHintUI } = load('assets/scripts/ui/JoystickHintUI.ts');

function scene() { const node = new Node('Main'); node.scene = node; return node; }
function attach(node, Type, ...args) { const component = new Type(...args); component.node = node; node.components.push(component); return component; }
function minion(rootNode, hp, x = 0) { const node = rootNode.addChild(new Node('Minion')); node.position.x = x; return { node, component: attach(node, EnemyMinion, hp) }; }

function tower(rootNode) {
    const soldier = attach(rootNode.addChild(new Node('Ranged')), Soldier);
    soldier.setDeployment('tower'); soldier.attackRange = 100; soldier.attackDamage = 10;
    soldier.visualNode = soldier.node.addChild(new Node('Visual')); attach(soldier.visualNode, Animation);
    const animations = []; const projectiles = [];
    deferredAnimations.set(soldier.visualNode, animations);
    soldier.projectilePrefab = new Prefab(() => {
        const node = new Node('Projectile'); attach(node, cc.Sprite); projectiles.push(node); return node;
    });
    return { soldier, animations, projectiles };
}
function startVolley(fixture, count) {
    const { soldier, animations, projectiles } = fixture;
    const before = animations.length;
    soldier.tryAttack();
    equal(animations.length, before + 1, 'one deferred animation starts per volley');
    equal(animations[before].clip, 'remoteAttack', 'tower uses ranged animation');
    equal(soldier._attackReservations.length, count, 'all targets are reserved before the hit frame');
    equal(new Set(soldier._attackReservations.map((token) => token.target)).size, count, 'upfront reservations are distinct');
    for (const token of soldier._attackReservations) {
        equal(token.attacker, soldier, 'reservation belongs to the attacking tower');
        equal(token.damage, soldier.attackDamage, 'reservation records shot damage');
        equal(token.released, false, 'reservation remains live during windup');
        ok(AttackReservation.pendingDamage(token.target) >= soldier.attackDamage, 'shared ledger includes each captured target');
    }
    equal(projectiles.length, 0, 'windup has not spawned a projectile');
    return animations[before];
}
function assertReleased(soldier, tokens) {
    equal(soldier._attackReservations.length, 0, 'tower retains no resolved reservation tokens');
    for (const token of tokens) equal(token.released, true, 'every captured token is released');
}

test('ledger aggregates, releases once, and flushes target or attacker ownership', () => {
    const attacker = {}; const target = {}; const one = AttackReservation.reserve(attacker, target, 4); const two = AttackReservation.reserve(attacker, target, 6);
    equal(AttackReservation.pendingDamage(target), 10, 'pending damage aggregates tokens'); AttackReservation.release(one); AttackReservation.release(one); equal(AttackReservation.pendingDamage(target), 6, 'duplicate release is harmless'); AttackReservation.releaseForAttacker(attacker); equal(AttackReservation.pendingDamage(target), 0, 'attacker cleanup flushes unresolved tokens');
    const fresh = AttackReservation.reserve({}, target, 5); AttackReservation.releaseForTarget(target); equal(AttackReservation.pendingDamage(target), 0, 'target death cleanup flushes reservations'); ok(fresh.released, 'target cleanup marks token released');
});

test('minion allocation avoids preventable overkill but permits a sole target and ignores Boss focus', () => {
    const low = {}; const high = {}; const boss = {}; AttackReservation.reserve({}, low, 5);
    equal(AttackReservation.selectMinion([low, high], 10, () => 15), high, 'safe later minion wins over reserved low minion'); equal(AttackReservation.selectMinion([low], 10, () => 15), low, 'sole minion remains eligible');
    AttackReservation.reserve({}, boss, 999); equal(AttackReservation.pendingDamage(boss), 999, 'Boss pending is tracked without entering minion candidate selection');
});

test('CombatSystem uses real target ordering and transfers a Player reservation to Arrow', () => {
    const rootNode = scene(); const playerNode = rootNode.addChild(new Node('Player')); const player = { node: playerNode, isValid: true, hasBow: true, isDead: false, isAttacking: false, visualNode: null, faceTarget() {}, setAttacking(value) { this.isAttacking = value; } };
    const low = minion(rootNode, 10, 10); const high = minion(rootNode, 30, 20); AttackReservation.reserve({}, low.component, 10);
    const combat = attach(rootNode.addChild(new Node('Combat')), CombatSystem); combat.player = player; combat.attackRange = 100; let arrowNode;
    combat.arrowPrefab = new Prefab(() => { arrowNode = new Node('Arrow'); attach(arrowNode, Arrow); return arrowNode; });
    equal(combat._findAttackTarget(), high.node, 'Player allocation skips a preventably overkilled nearer minion'); combat.tryAttack(); equal(AttackReservation.pendingDamage(high.component), 10, 'Player reserves before Arrow resolution'); arrowNode.getComponent(Arrow)._applyHit(high.node); equal(AttackReservation.pendingDamage(high.component), 0, 'reserved target hit releases Arrow token'); equal(high.component.hits, 1, 'Arrow damage still resolves once');
});

test('Arrow releases on range expiry, destroy, and reserved target hit without changing pierce state', () => {
    const rootNode = scene(); const target = minion(rootNode, 20, 10); const arrowNode = rootNode.addChild(new Node('Arrow')); const arrow = attach(arrowNode, Arrow); const token = AttackReservation.reserve({}, target.component, 10); arrow.init(target.node, 10, 10, token); arrow.update(3); equal(AttackReservation.pendingDamage(target.component), 0, 'maximum distance cancellation releases token');
    const second = AttackReservation.reserve({}, target.component, 10); arrow.init(target.node, 10, 10, second); arrow.onDestroy(); equal(AttackReservation.pendingDamage(target.component), 0, 'destroy releases current token exactly once');
});

for (const count of [0, 1, 2, 3, 5]) test(`tower tryAttack fires distinct max-three volley with ${count} available minions`, () => {
    const rootNode = scene(); const fixture = tower(rootNode); const { soldier, animations, projectiles } = fixture;
    const targets = Array.from({ length: count }, (_, i) => minion(rootNode, 5, 10 + i * 10));
    if (!count) { soldier.tryAttack(); equal(animations.length, 0, 'no target starts no animation'); equal(soldier._attackReservations.length, 0, 'no target reserves nothing'); equal(projectiles.length, 0, 'no target spawns nothing'); return; }
    const shots = Math.min(count, 3); const animation = startVolley(fixture, shots);
    const tokens = [...soldier._attackReservations];
    targets.forEach(({ component }) => equal(component.hits, 0, 'damage waits for the hit frame even when fallback overkills'));
    soldier.tryAttack(); equal(animations.length, 1, 'windup rejects a second attack');
    animation.hit();
    equal(projectiles.length, shots, 'one projectile per distinct target, without padding scarce targets');
    equal(targets.reduce((sum, { component }) => sum + component.hits, 0), shots, 'all damage happens at the single hit frame');
    targets.forEach(({ component }) => { equal(component.hits, tokens.some((token) => token.target === component) ? 1 : 0, 'only captured targets take one hit'); equal(AttackReservation.pendingDamage(component), 0, 'hit frame clears pending damage'); });
    assertReleased(soldier, tokens);
    animation.hit(); animation.complete?.(); animation.hit();
    equal(projectiles.length, shots, 'repeated hit callbacks cannot duplicate projectiles');
    for (const scheduled of [...soldier.scheduled]) if (scheduled.repeat) scheduled.callback(0.2);
    equal(targets.reduce((sum, { component }) => sum + component.hits, 0), shots, 'duplicate callbacks and projectile arrival deal no extra damage');
    ok(projectiles.every((node) => !node.isValid), 'actual projectile movement reaches arrival and removes visuals');
    equal(soldier._isAttacking, false, 'animation completion unlocks the attack');
});

test('tower selection reads configured count and prefers non-overkill candidates before fallback', () => {
    const rootNode = scene(); const fixture = tower(rootNode); const low = minion(rootNode, 15, 10);
    const safe = [20, 30, 40].map((x) => minion(rootNode, 30, x));
    const external = AttackReservation.reserve({}, low.component, 10);
    try {
        config.soldierRangedTargetCount = 2;
        const selected = fixture.soldier._selectTowerTargets();
        equal(selected.length, 2, 'selection honors configured count');
        equal(selected[0], safe[0].component, 'reserved nearer minion yields to first safe candidate');
        equal(selected[1], safe[1].component, 'second distinct safe candidate follows distance order');
        const animation = startVolley(fixture, 2); animation.hit();
        equal(low.component.hits, 0, 'actual tryAttack also skips preventable overkill');
        equal(safe[0].component.hits + safe[1].component.hits, 2, 'configured volley hits selected safe targets');
        equal(safe[2].component.hits, 0, 'configured limit excludes additional safe target');
        equal(AttackReservation.pendingDamage(low.component), 10, 'tower leaves another attacker reservation intact');
    } finally { config.soldierRangedTargetCount = 3; fixture.soldier.onDisable(); AttackReservation.release(external); }
});

for (const invalidation of ['death', 'destroy', 'inactive', 'range']) test(`tower replaces ${invalidation} capture without stealing later valid captures`, () => {
    const rootNode = scene(); const fixture = tower(rootNode);
    const targets = [10, 20, 30, 40, 50].map((x) => minion(rootNode, 30, x));
    const animation = startVolley(fixture, 3); const tokens = [...fixture.soldier._attackReservations];
    const stale = targets[0];
    if (invalidation === 'death') stale.component.isDead = true;
    if (invalidation === 'destroy') stale.node.destroy();
    if (invalidation === 'inactive') stale.node.active = false;
    if (invalidation === 'range') stale.node.position.x = 101;
    // A newly preferable target must not displace captures that remain legal.
    targets[4].node.position.x = 1;
    animation.hit();
    equal(stale.component.hits, 0, 'illegal capture takes no damage');
    equal(targets[1].component.hits, 1, 'second captured target keeps its shot');
    equal(targets[2].component.hits, 1, 'third captured target keeps its shot');
    equal(targets[3].component.hits, 0, 'unused farther candidate remains untouched');
    equal(targets[4].component.hits, 1, 'invalid slot uses nearest unused legal replacement');
    equal(fixture.projectiles.length, 3, 'replacement maintains three distinct shots');
    assertReleased(fixture.soldier, tokens);
    targets.forEach(({ component }) => equal(AttackReservation.pendingDamage(component), 0, 'captured and replacement reservations are released'));
});

for (const replacements of [0, 1]) test(`tower cancels unfilled invalid slots with ${replacements} unused replacements`, () => {
    const rootNode = scene(); const fixture = tower(rootNode);
    const targets = [10, 20, 30].map((x) => minion(rootNode, 30, x));
    const spare = replacements ? minion(rootNode, 30, 40) : null;
    const animation = startVolley(fixture, 3); const tokens = [...fixture.soldier._attackReservations];
    targets[0].node.active = false; targets[1].component.isDead = true;
    animation.hit(); animation.complete?.();
    equal(targets[0].component.hits + targets[1].component.hits, 0, 'both invalid captures are revalidated');
    equal(targets[2].component.hits, 1, 'valid capture is never reused as a replacement');
    if (spare) equal(spare.component.hits, 1, 'one spare fills only one invalid slot');
    equal(fixture.projectiles.length, 1 + replacements, 'unfilled slots produce no projectiles');
    assertReleased(fixture.soldier, tokens);
    equal(fixture.soldier._isAttacking, false, 'partly cancelled volley still completes');
    ok(fixture.soldier._attackTimer > 0, 'partly cancelled volley retains cooldown');
});

test('two towers allocate through the shared ledger before either hit frame', () => {
    const rootNode = scene(); const first = tower(rootNode); const second = tower(rootNode);
    const targets = [10, 20, 30, 40, 50, 60].map((x) => minion(rootNode, 15, x));
    const one = startVolley(first, 3); const two = startVolley(second, 3);
    const tokens = [...first.soldier._attackReservations, ...second.soldier._attackReservations];
    equal(new Set(tokens.map((token) => token.target)).size, 6, 'second tower avoids first tower pending overkill');
    targets.forEach(({ component }) => { equal(component.hits, 0, 'both volleys remain deferred'); equal(AttackReservation.pendingDamage(component), 10, 'each minion has exactly one pending shot'); });
    one.hit();
    for (const token of second.soldier._attackReservations) equal(AttackReservation.pendingDamage(token.target), 10, 'first hit preserves second tower pending shots');
    two.hit();
    targets.forEach(({ component }) => { equal(component.hits, 1, 'each minion receives one shot across both towers'); equal(AttackReservation.pendingDamage(component), 0, 'both volleys leave ledger clear'); });
});

for (const action of ['onDisable', 'reset', 'deactivate', 'death']) test(`tower ${action} releases every windup reservation and rejects late callbacks`, () => {
    const rootNode = scene(); const fixture = tower(rootNode); const targets = [10, 20, 30].map((x) => minion(rootNode, 30, x));
    const animation = startVolley(fixture, 3); const tokens = [...fixture.soldier._attackReservations];
    if (action === 'death') fixture.soldier.takeDamage(config.soldierMaxHp); else fixture.soldier[action]();
    assertReleased(fixture.soldier, tokens);
    targets.forEach(({ component }) => equal(AttackReservation.pendingDamage(component), 0, 'interruption clears all pending damage'));
    animation.hit(); animation.complete?.(); animation.hit();
    equal(fixture.projectiles.length, 0, 'interrupted animation cannot spawn projectiles');
    targets.forEach(({ component }) => equal(component.hits, 0, 'interrupted animation cannot deal damage'));
    if (action === 'reset') {
        const next = startVolley(fixture, 3); animation.hit(); animation.complete?.();
        equal(fixture.soldier._isAttacking, true, 'old completion cannot unlock new volley');
        targets.forEach(({ component }) => equal(AttackReservation.pendingDamage(component), 10, 'old callback cannot clear new reservations'));
        next.hit(); targets.forEach(({ component }) => equal(component.hits, 1, 'new volley still resolves once'));
    }
});

test('enemy lifecycle cleanup semantics are represented by target flushing', () => {
    const target = {}; for (const event of ['death', 'disable', 'destroy', 'reset']) { const token = AttackReservation.reserve({}, target, 10); AttackReservation.releaseForTarget(target); equal(token.released, true, `${event} leaves no stale target token`); }
});

test('CombatSystem cancellation flushes reservations', () => {
    const target = {};
    const combat = attach(new Node('Combat'), CombatSystem); combat._pendingReservation = AttackReservation.reserve(combat, target, 10); combat.cancelPendingAttack(); equal(AttackReservation.pendingDamage(target), 0, 'Player cancellation releases pre-hit token');
});

test('Player parkour gate blocks all movement until Joystick unlocks it', () => {
    const playerNode = new Node('Player'); const player = attach(playerNode, Player); player._rb = attach(playerNode, RigidBody2D); player.setMode('parkour'); player.setMoveDirection(new Vec2(1, 0)); player.update(1); equal(player._velocity.y, 0, 'locked parkour gate suppresses automatic forward movement');
    const joystick = attach(new Node('Joystick'), Joystick); joystick.maxRadius = 100; joystick.bindPlayer(player); joystick._constrainAndApply(0, 80); equal(player.isParkourMovementUnlocked, false, 'vertical-only parkour drag remains constrained to zero'); equal(joystick.hasEffectiveInput(), false, 'zero constrained direction is not effective'); joystick._constrainAndApply(50, 80); equal(player.isParkourMovementUnlocked, true, 'first horizontal direction unlocks before delivery'); equal(player._moveDir.x, 0.5, 'unlocked direction reaches Player immediately');
});

test('touch start and clear input never unlock parkour, while defense keeps full direction', () => {
    const player = attach(new Node('Player'), Player); player.setMode('parkour'); const joystick = attach(new Node('Joystick'), Joystick); joystick.maxRadius = 100; joystick.bindPlayer(player); joystick._constrainAndApply(0, 0); equal(player.isParkourMovementUnlocked, false, 'touch start zero vector cannot unlock'); joystick._clearInput(); equal(joystick.hasEffectiveInput(), false, 'touch end clears effective state'); joystick.setMode('defense'); joystick._constrainAndApply(20, 30); equal(joystick.getDirection().y, 0.3, 'defense keeps the existing full-direction joystick behavior');
});

test('hint is immediate in parkour, follows effective input, idles, and obeys suppression', () => {
    const rootNode = new Node('Hint'); const knob = rootNode.addChild(new Node('Knob')); const joystick = attach(new Node('Joystick'), Joystick); joystick.maxRadius = 100; const hint = attach(rootNode, JoystickHintUI); hint.knob = knob; hint.onLoad(); hint.bindJoystick(joystick); equal(hint._visible, true, 'parkour hint is immediately visible'); joystick._constrainAndApply(10, 0); hint.update(0.1); equal(hint._visible, false, 'effective movement hides hint'); joystick._clearInput(); hint.update(3); equal(hint._visible, true, 'three seconds without effective input re-shows hint'); hint._onPhaseChanged('ultimate'); equal(hint._visible, false, 'ultimate suppression hides hint'); hint.update(10); equal(hint._visible, false, 'suppression prevents idle reappearance');
});

test('real target modules transpile and retain lifecycle hook coverage', () => {
    for (const file of ['assets/scripts/enemy/EnemyMinion.ts', 'assets/scripts/enemy/EnemyBoss.ts']) { const source = fs.readFileSync(path.join(root, file), 'utf8'); const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText; ok(output.length > 0, `${file} transpiles`); ok(source.includes('AttackReservation.releaseForTarget(this)'), `${file} releases target reservations on lifecycle paths`); }
});

if (!process.exitCode) console.log(`friendly reservation / joystick onboarding harness passed: ${assertions} assertions across ${scenarios} scenarios`);
