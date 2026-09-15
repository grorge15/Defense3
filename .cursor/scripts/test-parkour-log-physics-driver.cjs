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
assert.doesNotMatch(rolling, /setWorldPosition|setPosition|resolveWorldPos|AirWallAabb|beginParkourLogFollow/, 'rolling Log path must not hard-write Player position, reparent, or use AABB push-out');
assert.doesNotMatch(log, /_followOffset|_captureFollowOffset|lateUpdate|AirWallAabb|(?:this\.node|this\._pushPlayer\.node)\.parent/, 'legacy Log follow, parent checks, and AABB push-out must remain removed');

assertSequence(begin, [
    'this._yellowLineEntered = false;',
    'this._blueLineEntered = false;',
], 'Log parkour start resets one-shot line fallback state');
assert.match(rolling, /this\._pollParkourLineFallback\(\);/, 'rolling Log must poll line fallback after physics velocity update');
const lineFallback = section(log, '    private _pollParkourLineFallback(): void {', '    private _configureRollingPhysics');
assert.match(lineFallback, /this\._phase !== 'rolling' && this\._phase !== 'charging'/, 'line fallback must run only while parkour is active');
assert.match(lineFallback, /this\._resolveParkourLine\(this\.yellowLine, 'YellowLine'\)/, 'yellow fallback must prefer its property and resolve by name');
assert.match(lineFallback, /this\._resolveParkourLine\(this\.blueLine, 'BlueLine'\)/, 'blue fallback must prefer its property and resolve by name');
assert.match(lineFallback, /this\._lineFallbackLogPosition\.y >= this\._lineFallbackLinePosition\.y/, 'yellow fallback must compare world Y positions');
assert.match(lineFallback, /this\._blueLineOverlapsLog\(blueLine\)/, 'blue fallback must check collider overlap');
const blueOverlap = section(log, '    private _blueLineOverlapsLog(blueLine: Node): boolean {', '    /**\n     * Keep the rolling Log solid');
assert.match(blueOverlap, /const blueCollider = blueLine\.getComponent\(Collider2D\);/, 'blue fallback must read the BlueLine collider');
assert.match(blueOverlap, /this\._collider\.worldAABB/, 'blue fallback must compare the Log collider AABB');
assert.match(blueOverlap, /left\.xMin <= right\.xMax && left\.xMax >= right\.xMin/, 'blue AABB overlap must include touching horizontal edges');
assert.match(blueOverlap, /left\.yMin <= right\.yMax && left\.yMax >= right\.yMin/, 'blue AABB overlap must include touching vertical edges');
assertSequence(lineFallback, [
    'if (!this._yellowLineEntered)',
    'this._yellowLineEntered = true;',
    'this.enterChargeZone();',
], 'yellow fallback must be one-shot and use the existing charge entry');
assertSequence(lineFallback, [
    'if (!this._blueLineEntered)',
    'this._blueLineEntered = true;',
    'this.tryLockAtFinish(this.meetsFixedWidthRequirement());',
], 'blue fallback must be one-shot and use the existing lock entry');
assert.doesNotMatch(lineFallback, /EventManager|GameEvents|PARKOUR_FINISHED/, 'blue fallback must not publish completion directly');

const preSolve = section(log, '    private _onPreSolve =', '    private _isMinionCollider');
assert.match(log, /Contact2DType\.PRE_SOLVE/, 'Log must subscribe to PRE_SOLVE contact handling');
assert.match(preSolve, /this\._phase !== 'rolling' && this\._phase !== 'charging'/, 'only rolling or charging Log contacts may disable one solver step');
assert.match(preSolve, /this\._isMinionCollider\(otherCollider\)/, 'PRE_SOLVE must apply only to EnemyMinion colliders');
assert.match(preSolve, /contact\.disabledOnce = true;/, 'rolling Minion contact must disable only the current solver step');
assert.doesNotMatch(preSolve, /sensor\s*=\s*true|collisionMatrix/, 'PRE_SOLVE must not alter sensor or collision matrix settings');
assert.match(log, /onDestroy\(\): void \{\s*this\._collider\?\.off\(Contact2DType\.PRE_SOLVE/, 'Log must remove its PRE_SOLVE listener');

const minionMovement = section(minion, '    private _updateMovement(_dt: number): void {', '    /** 近距离取消朝向玩家的速度分量');
const rollingPush = section(minion, '    private _rideRollingLogIfOverlapping(', '    /** 近距离取消朝向玩家的速度分量');
assert.match(minionMovement, /const contactLog = nav\?\.contactLog\(\);/, 'Minion must use navigation contact discovery without a Log import');
assert.match(minionMovement, /this\._rideRollingLogIfOverlapping\(contactLog\)/, 'Minion must stop ordinary navigation while overlapping a rolling Log');
assert.match(rollingPush, /log\.getPhase\(\) !== 'rolling' && log\.getPhase\(\) !== 'charging'/, 'fixed Log must not enter rolling push behavior');
assert.match(rollingPush, /minionAabb\.xMax < logAabb\.xMin/, 'rolling push must require actual collider AABB overlap');
assert.match(rollingPush, /const velocity = logBody\.linearVelocity;/, 'Minion must derive its push speed from Log physics velocity');
assert.match(rollingPush, /ROLLING_LOG_LATERAL_ESCAPE_SPEED/, 'Minion push must include lateral escape');
assert.match(rollingPush, /this\._rb!\.linearVelocity = new Vec2\(this\._physicsVelocity\);/, 'Minion must write a physics velocity instead of moving by transform');
assert.doesNotMatch(log, /import\s*\{\s*EnemyMinion\s*\}/, 'Log must not create an EnemyMinion import cycle');

const finish = section(log, '    tryLockAtFinish(canLock: boolean): void {', '    private _enableAsSolidBarrier');
const success = section(finish, '        if (canLock) {', '        this._phase = \'failed\';');
assertSequence(success, [
    "this._phase = 'fixed';",
    'this.unbindPlayer();',
    'this._resolveFixedPoint();',
    'this._enableAsSolidBarrier();',
    'EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);',
], 'successful blue-line handoff');
assert.ok(
    success.indexOf('EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);')
        > success.indexOf('this._enableAsSolidBarrier();'),
    'successful completion event must be published after the fixed transition',
);
const failure = section(finish, "        this._phase = 'failed';", '    }\n\n');
assertSequence(failure, [
    "this._phase = 'failed';",
    'this.unbindPlayer();',
    'EventManager.instance.emitEvent(GameEvents.LOG_FAILED, {',
    'this._fadeOut();',
    'EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);',
], 'failed blue-line handoff');
assert.ok(
    failure.indexOf('EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);')
        > failure.indexOf('this._fadeOut();'),
    'failed completion event must be published after the failure transition starts',
);
assert.doesNotMatch(zone, /EventManager|GameEvents|PARKOUR_FINISHED/, 'ParkourLineZone must not publish completion itself');
assert.match(zone, /this\.node\.scene\?\.getComponentInChildren\(Log\) \?\? null/, 'ParkourLineZone must lazily resolve an unset Log from the scene');
assert.match(zone, /log\.tryLockAtFinish\(log\.meetsFixedWidthRequirement\(\)\)/, 'blue zone must use Log completion entry with the existing width gate');

assert.doesNotMatch(minion, /_adjustVelocityAgainstLog|_readRideSpeedY|_resolveLog|_fillLogAabb|_fillVisualAabb/, 'EnemyMinion must not retain the removed legacy Log compensation path');
assert.match(minion, /nav\.nextObstacleVelocity\(/, 'fixed Log navigation/demolition path must remain');

const collect = section(sorting, '    private _collectRendererSortings(node: Node): void {', '    }\n}');
assert.match(collect, /if \(node !== this\.node && node\.getComponent\(SortingOrder2D\)\) \{\s*return;\s*\}/, 'nested sorting component must form a renderer ownership boundary');
assert.ok(
    collect.indexOf('node.getComponent(SortingOrder2D)') < collect.indexOf('const hasRenderer'),
    'sorting boundary must be checked before renderer discovery',
);

console.log('ok - Player root follows Log world position plus captured offset without reparenting');
console.log('ok - Log owns dynamic rolling velocity and ordered blue-line handoff');
console.log('ok - rolling Minion contacts bypass one solver step and carry Minions sideways');
console.log('ok - failed/death cleanup and fixed-log navigation remain covered');
console.log('ok - nested SortingOrder2D subtree boundary');
