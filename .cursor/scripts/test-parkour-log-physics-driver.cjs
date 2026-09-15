const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const player = read('assets/scripts/character/Player.ts');
const log = read('assets/scripts/item/Log.ts');
const zone = read('assets/scripts/game/ParkourLineZone.ts');
const minion = read('assets/scripts/enemy/EnemyMinion.ts');
const sorting = read('assets/scripts/core/SortingOrder2D.ts');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0, `missing section start: ${start}`);
    assert.ok(to > from, `missing section end: ${end}`);
    return source.slice(from, to);
}

function assertSequence(source, values, label) {
    let previous = -1;
    for (const value of values) {
        const index = source.indexOf(value, previous + 1);
        assert.ok(index > previous, `${label}: missing or out-of-order ${value}`);
        previous = index;
    }
}

const snapshot = section(player, 'type ParkourPhysicsSnapshot = {', '/**\n * 玩家移动');
for (const field of [
    'rigidBodyEnabled: boolean;',
    'rigidBodyType: ERigidBody2DType;',
    'gravityScale: number;',
    'fixedRotation: boolean;',
    'allowSleep: boolean;',
    'enabledContactListener: boolean;',
    'linearVelocity: Vec2;',
    'angularVelocity: number;',
    'awake: boolean | null;',
    'colliderEnabled: boolean;',
    'colliderSensor: boolean;',
]) {
    assert.ok(snapshot.includes(field), `physics snapshot missing ${field}`);
}

const followStart = section(player, '    beginParkourLogFollow(logRoot: Node): void {', '    /** Synchronize once, then restore');
assertSequence(followStart, [
    'logRoot.getWorldPosition(this._parkourFollowWorldPosition);',
    'this.node.getWorldPosition(this._parkourFollowOffset);',
    'Vec3.subtract(',
    'this._parkourFollowLog = logRoot;',
], 'follow start captures the Player-to-Log world offset');
assertSequence(followStart, [
    'rigidBody.linearVelocity = new Vec2(0, 0);',
    'rigidBody.angularVelocity = 0;',
    'rigidBody.enabled = false;',
    'collider.enabled = false;',
], 'follow start disables Player physics');

const followEnd = section(player, '    endParkourLogFollow(): void {', '    lateUpdate(): void {');
assertSequence(followEnd, [
    'this._syncParkourLogWorldPosition();',
    'this._parkourFollowLog = null;',
    'this._parkourPhysicsSnapshot = null;',
], 'follow end must synchronize before restoring physics');
for (const restore of [
    'rigidBody.type = snapshot.rigidBodyType;',
    'rigidBody.gravityScale = snapshot.gravityScale;',
    'rigidBody.fixedRotation = snapshot.fixedRotation;',
    'rigidBody.allowSleep = snapshot.allowSleep;',
    'rigidBody.enabledContactListener = snapshot.enabledContactListener;',
    'rigidBody.linearVelocity = new Vec2(snapshot.linearVelocity);',
    'rigidBody.angularVelocity = snapshot.angularVelocity;',
    'rigidBody.enabled = snapshot.rigidBodyEnabled;',
    'snapshot.collider.sensor = snapshot.colliderSensor;',
    'snapshot.collider.enabled = snapshot.colliderEnabled;',
]) {
    assert.ok(followEnd.includes(restore), `follow end must restore ${restore}`);
}

const playerLateUpdate = section(player, '    lateUpdate(): void {', '    faceTarget(');
const playerFollowSync = section(player, '    private _syncParkourLogWorldPosition(): void {', '    private _bindEmbeddedHpBar');
assert.match(playerLateUpdate, /this\._syncParkourLogWorldPosition\(\);/, 'Player lateUpdate must own root follow synchronization');
assertSequence(playerFollowSync, [
    'this._parkourFollowLog.getWorldPosition(this._parkourFollowWorldPosition);',
    'Vec3.add(',
    'this.node.setWorldPosition(this._parkourFollowWorldPosition);',
], 'Player follow must use Log world position plus the captured offset');
assert.doesNotMatch(player, /\.(?:addChild|setParent)\(/, 'Player Log follow must not reparent its root subtree');
assert.doesNotMatch(log, /\.(?:addChild|setParent)\(/, 'Log must not reparent Player during follow');

const playerUpdate = section(player, '    update(dt: number): void {', '    private _onPhaseChanged');
const ownVelocity = section(player, '    private _writeOwnVelocity(): void {', '    private _bindEmbeddedHpBar');
assert.match(player, /getParkourVelocityIntent\(\): Readonly<Vec2>/, 'Player must expose Log-consumable parkour intent');
assert.match(playerUpdate, /this\._writeOwnVelocity\(\);/, 'Player uses one guarded own-velocity writer');
assert.match(ownVelocity, /this\.isFollowingParkourLog\(\)/, 'following Player must not write its own rigidbody velocity');

const death = section(player, '    private _die(): void {', '    private _updateLocomotionAnim');
assertSequence(death, [
    'this._boundLog.unbindPlayer();',
    'this.endParkourLogFollow();',
    'this._isDead = true;',
    "GameManager.instance?.setGameOver('lose');",
    'director.pause();',
], 'Player death cleanup');

const begin = section(log, '    beginParkour(): void {', '    finishParkour(): void {');
assertSequence(begin, [
    'this._configureRollingPhysics();',
    'this._pushPlayer?.beginParkourLogFollow(this.node);',
], 'Log parkour start');

const unbind = section(log, '    unbindPlayer(): void {', '    /**\n     * 固定后作为可攻击障碍');
assertSequence(unbind, [
    'player?.endParkourLogFollow();',
    'this._pushPlayer = null;',
    'this._stopParkourMotion();',
], 'Log exit must synchronize Player before ending rolling motion');

const rolling = section(log, '    update(_dt: number): void {', '    private _resolveShadowNode');
assert.match(rolling, /this\._rb\.linearVelocity = new Vec2\(this\._rollVelocity\);/, 'Log owns rolling rigidbody velocity');
assert.match(rolling, /ERigidBody2DType\.Dynamic/, 'rolling Log must be Dynamic');
assert.match(rolling, /this\._collider\.sensor = false;/, 'rolling Log must be solid');
assert.match(rolling, /this\._rb\.fixedRotation = true;/, 'rolling Log must lock rotation');
assert.doesNotMatch(rolling, /setWorldPosition|setPosition|resolveWorldPos|AirWallAabb|node\.parent|beginParkourLogFollow/, 'rolling Log path must not hard-write Player position, reparent, or use AABB push-out');
assert.doesNotMatch(log, /_followOffset|_captureFollowOffset|_pollParkourLines|lateUpdate|AirWallAabb|node\.parent/, 'legacy Log follow, parent checks, and line polling must be removed');

const finish = section(log, '    tryLockAtFinish(canLock: boolean): void {', '    private _enableAsSolidBarrier');
const success = section(finish, '        if (canLock) {', '        this._phase = \'failed\';');
assertSequence(success, [
    "this._phase = 'fixed';",
    'this.unbindPlayer();',
    'this._resolveFixedPoint();',
    'this._enableAsSolidBarrier();',
    'EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);',
], 'successful blue-line handoff');
const failure = section(finish, "        this._phase = 'failed';", '    }\n\n');
assertSequence(failure, [
    "this._phase = 'failed';",
    'this.unbindPlayer();',
    'EventManager.instance.emitEvent(GameEvents.LOG_FAILED, {',
    'this._fadeOut();',
    'EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);',
], 'failed blue-line handoff');
assert.doesNotMatch(zone, /EventManager|GameEvents|PARKOUR_FINISHED/, 'ParkourLineZone must not publish completion itself');
assert.match(zone, /tryLockAtFinish\(this\.log\.meetsFixedWidthRequirement\(\)\)/, 'blue zone must use Log completion entry with the existing width gate');

assert.doesNotMatch(minion, /_adjustVelocityAgainstLog|_readRideSpeedY|_resolveLog|_fillLogAabb|_fillVisualAabb|_aabbOverlap/, 'EnemyMinion must not retain rolling Log AABB compensation');
assert.match(minion, /nav\.nextObstacleVelocity\(/, 'fixed Log navigation/demolition path must remain');

const collect = section(sorting, '    private _collectRendererSortings(node: Node): void {', '    }\n}');
assert.match(collect, /if \(node !== this\.node && node\.getComponent\(SortingOrder2D\)\) \{\s*return;\s*\}/, 'nested sorting component must form a renderer ownership boundary');
assert.ok(
    collect.indexOf('node.getComponent(SortingOrder2D)') < collect.indexOf('const hasRenderer'),
    'sorting boundary must be checked before renderer discovery',
);

console.log('ok - Player root follows Log world position plus captured offset without reparenting');
console.log('ok - Log owns dynamic rolling velocity and ordered blue-line handoff');
console.log('ok - failed/death cleanup and fixed-log navigation remain covered');
console.log('ok - nested SortingOrder2D subtree boundary');
