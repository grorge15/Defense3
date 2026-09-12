import {
    _decorator,
    Animation,
    BoxCollider2D,
    CircleCollider2D,
    Collider2D,
    Component,
    director,
    ERigidBody2DType,
    Node,
    Prefab,
    Rect,
    RigidBody2D,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { AirWallAabb } from '../core/AirWallAabb';
import { AttackReservation } from '../core/AttackReservation';
import { playAnim, playAttackWithFrameHit } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { FlowBody, stableFlowBody } from '../core/FlowField';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { VisualFacing } from '../core/VisualFacing';
import { CoinSystem } from '../game/CoinSystem';
import { Log } from '../item/Log';
import { Player } from '../character/Player';
import { playEnemyHitVfx, type EnemyHitSource } from '../core/EnemyHitVfx';
import { HpBarUI } from '../ui/HpBarUI';
import { EnemyAI } from './EnemyAI';

const { ccclass, property } = _decorator;

const PLAYER_SOFT_SEPARATION = 24;

export function resolveMinionAttackHysteresis(inAttackHysteresis: boolean, distance: number): boolean {
    if (distance <= GameConfig.enemyMinionAttackEnterRange) {
        return true;
    }
    if (inAttackHysteresis && distance <= GameConfig.enemyMinionAttackExitRange) {
        return true;
    }
    return false;
}

/**
 * 小怪：Dynamic + linearVelocity；非 sensor，与 Static airWall / 固定滚木物理碰撞。
 * 同伴/玩家分离以速度微调；跑酷中滚木仍为 sensor 时用速度挡穿。
 */
@ccclass('EnemyMinion')
export class EnemyMinion extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ type: Prefab, tooltip: 'Hero 来源受击蓝色 VFX Prefab' })
    hitVfxBluePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'Player/Arrow 或 Soldier 来源受击黄色 VFX Prefab' })
    hitVfxYellowPrefab: Prefab | null = null;

    @property({ tooltip: '近战攻击范围（世界单位）' })
    attackRange = 40;

    @property({ tooltip: '攻击冷却（秒）；同步到 EnemyAI' })
    attackCooldown = 1.0;

    private _rb: RigidBody2D | null = null;
    private _collider: Collider2D | null = null;
    private _ai: EnemyAI | null = null;
    private _log: Log | null = null;
    private _hp = GameConfig.minionMaxHp;
    private _target: Node | null = null;
    private readonly _velocity = new Vec2();
    private readonly _physicsVelocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _tmpPos = new Vec3();
    private readonly _selfRect = new Rect();
    private readonly _logRect = new Rect();
    private _airWalls: BoxCollider2D[] = [];
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _blockingObstacle: Node | null = null;
    private _lifeGeneration = 0;
    private _attackGeneration = 0;
    private _forceChaseTarget = false;
    private _inAttackHysteresis = false;
    private _currentLocomotionClip = '';
    private readonly _visualFacing = new VisualFacing();
    private _finalDeathActive = false;
    private readonly _finalDeathCallbacks: Array<() => void> = [];

    /** 死亡收进对象池时回调（EnemySpawner 监听并 5s 后重生） */
    public onReturnedToPool: ((minion: EnemyMinion) => void) | null = null;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = false;
        }
        this._ai = this.getComponent(EnemyAI) ?? this.addComponent(EnemyAI);
        this._ai.attackCooldown = this.attackCooldown;
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        this._visualFacing.bind(this.visualNode);
    }

    start(): void {
        this.scheduleOnce(() => {
            this._bindEmbeddedHpBar();
        }, 0);
    }

    setTarget(target: Node | null): void {
        this._ensureRuntimeRefs();
        if (this._target !== target) {
            this._blockingObstacle = null;
            this._attackGeneration++;
            this._isAttacking = false;
            this._inAttackHysteresis = false;
            EnemyNavigation.get(this.node.scene)?.resetUnit(this.node);
        }
        this._target = target;
        this._ai?.setTarget(target);
    }

    setForceChaseTarget(force: boolean): void {
        this._forceChaseTarget = force;
    }

    tryAttack(): void {
        if (this._isDead || !this._ai || this._isAttacking) {
            return;
        }
        const range = GameConfig.enemyMinionAttackEnterRange;
        const obstacle = this._blockingObstacle, target = this._target;
        if (!this._ai.beginAttack(range, obstacle)) {
            return;
        }
        this._isAttacking = true;
        const life = this._lifeGeneration, attack = ++this._attackGeneration;
        let hit = false;
        const valid = (): boolean => this._lifeGeneration === life && this._attackGeneration === attack &&
            !this._isDead && this.node.isValid && this.node.activeInHierarchy && this._target === target &&
            !!target?.isValid && target.activeInHierarchy && !target.getComponent(Player)?.isDead;
        const damage = (): void => {
            if (hit || !valid()) return;
            hit = true;
            if (obstacle) { if (this._blockingObstacle === obstacle) this._ai?.applyObstacleDamage(obstacle, range); }
            else this._ai?.applyAttackDamage(range);
        };
        this._visualFacing.faceByTarget(this.visualNode, this.node, obstacle ?? target);
        if (this.visualNode) {
            // minion frame_012 → 0.4s
            playAttackWithFrameHit(
                this.visualNode,
                'attack',
                damage,
                0.45,
            );
        } else {
            damage();
        }
        this.scheduleOnce(() => {
            if (valid()) this._isAttacking = false;
        }, 0.8);
    }

    get isDead(): boolean {
        return this._isDead;
    }

    get currentHp(): number {
        return this._hp;
    }

    /** Clears only transient combat state before BuildSystem moves this live unit. */
    public relocateForExpansion(worldPosition: Readonly<Vec3>): boolean {
        this._ensureRuntimeRefs();
        if (this._isDead || !this.node.isValid || !this.node.activeInHierarchy) {
            return false;
        }
        this._attackGeneration += 1;
        this._blockingObstacle = null;
        this._inAttackHysteresis = false;
        this._isAttacking = false;
        this._velocity.set(0, 0);
        this._physicsVelocity.set(0, 0);
        // EnemyAI.reset only clears its cooldown; its target remains owned by this minion.
        this._ai?.reset();
        EnemyNavigation.get(this.node.scene)?.resetUnit(this.node);
        this.node.setWorldPosition(worldPosition);
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        this._updateLocomotionAnim(false);
        return true;
    }

    /** Ultimate-only death presentation. It intentionally bypasses normal reward and pool behavior. */
    public playFinalDeath(onComplete: () => void): void {
        let completed = false;
        const completeOnce = (): void => {
            if (completed) {
                return;
            }
            completed = true;
            try {
                onComplete();
            } catch (error) {
                console.warn('[EnemyMinion] final-death completion callback failed', error);
            }
        };
        if (!this.isValid || !this.node?.isValid || !this.node.activeInHierarchy) {
            completeOnce();
            return;
        }
        this._finalDeathCallbacks.push(completeOnce);
        if (this._finalDeathActive) {
            return;
        }

        this._ensureRuntimeRefs();
        AttackReservation.releaseForTarget(this);
        this._finalDeathActive = true;
        const life = ++this._lifeGeneration;
        this._attackGeneration += 1;
        this.unscheduleAllCallbacks();
        this._blockingObstacle = null;
        this._target = null;
        this._ai?.setTarget(null);
        this._ai?.reset();
        this._isAttacking = false;
        this._isDead = true;
        this._canMove = false;
        this._halt(false);
        if (this._collider) {
            this._collider.enabled = false;
        }
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);

        const animation = this.visualNode?.getComponent(Animation);
        const state = animation?.getState('die');
        if (!animation || !state) {
            this._completeFinalDeath();
            return;
        }
        const finish = (_event?: unknown, finishedState?: unknown): void => {
            if (this._lifeGeneration !== life || !this._finalDeathActive) {
                return;
            }
            if (finishedState && finishedState !== state) {
                return;
            }
            this._completeFinalDeath();
        };
        animation.once(Animation.EventType.FINISHED, finish);
        playAnim(this.visualNode!, 'die');
        this.scheduleOnce(finish, this._finalDeathFallbackDelay(state));
    }

    takeDamage(amount: number, source: EnemyHitSource = 'hero'): void {
        if (this._isDead) {
            return;
        }
        this._hp -= amount;
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.minionMaxHp,
        );
        playEnemyHitVfx(this.node, this.hitVfxBluePrefab, this.hitVfxYellowPrefab, source);
        if (this._hp <= 0) {
            this._die();
        }
    }

    reset(): void {
        if (minionDebug.enabled) {
            minionDebug.candidates.delete(this);
            if (minionDebug.selected === this) minionDebug.stop('selected-reset');
        }
        AttackReservation.releaseForTarget(this);
        this._completeFinalDeath();
        this._lifeGeneration++;
        this._blockingObstacle = null;
        this._ensureRuntimeRefs();
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.minionMaxHp;
        this._target = null;
        this._forceChaseTarget = false;
        this._inAttackHysteresis = false;
        this._isDead = false;
        this._canMove = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
        this._log = null;
        this._ai?.reset();
        this._ai?.setTarget(null);
        EnemyNavigation.get(this.node.scene)?.resetUnit(this.node);
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
            this._collider.sensor = false;
        }
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            this._visualFacing.reset(this.visualNode);
            playAnim(this.visualNode, 'idle');
        }
        this._bindEmbeddedHpBar();
    }

    update(_dt: number): void {
        if (!minionDebug.enabled) { this._updateMovement(_dt); return; }
        const selected = minionDebug.selected;
        if (selected && (!selected.isValid || !selected.node.activeInHierarchy || selected._isDead ||
            selected._lifeGeneration !== minionDebug.life)) {
            minionDebug.stop('selected-life-ended');
        }
        if (minionDebug.enabled && !minionDebug.selected && this.onReturnedToPool && !this._isDead &&
            this._target?.isValid && !this._isAttacking) {
            // Only cheap positions for at most 16 candidates; no scene scan or navigation query.
            let candidate = minionDebug.candidates.get(this);
            const p = this.node.worldPosition;
            if (!candidate && minionDebug.candidates.size < 16) {
                candidate = { x: p.x, y: p.y, seconds: 0, life: this._lifeGeneration };
                minionDebug.candidates.set(this, candidate);
            }
            if (candidate) {
                candidate.seconds += Math.max(0, _dt);
                if (candidate.life !== this._lifeGeneration) minionDebug.candidates.delete(this);
                else if (candidate.seconds >= 1) {
                    const target = this._target.worldPosition;
                    if (Math.hypot(p.x - candidate.x, p.y - candidate.y) < 6 &&
                        Math.hypot(p.x - target.x, p.y - target.y) > GameConfig.enemyMinionAttackExitRange) {
                        minionDebug.choose(this, 'auto-low-net-displacement', { ...candidate });
                    } else minionDebug.candidates.delete(this);
                }
            }
        }
        if (!minionDebug.enabled || minionDebug.selected !== this) { this._updateMovement(_dt); return; }
        const position = debugPosition(this.node);
        const previous = minionDebug.previous;
        const data: Record<string, any> = {
            frame: director.getTotalFrames(), dt: _dt, seconds: minionDebug.seconds,
            branch: 'cannot-move-or-dead', position, target: debugNode(this._target),
            blockerBefore: debugNode(this._blockingObstacle), attackingBefore: this._isAttacking,
            hysteresisBefore: this._inAttackHysteresis, forceChase: this._forceChaseTarget,
            rigidbodyBefore: this._rb ? { x: this._rb.linearVelocity.x, y: this._rb.linearVelocity.y } : null,
            // Physics happens between updates. Compare this displacement to the PREVIOUS command.
            previousFrame: previous?.frame ?? null,
            actualDisplacement: previous ? { x: position.x - previous.position.x, y: position.y - previous.position.y } : null,
            expectedDisplacement: previous?.commandWorld ? {
                x: previous.commandWorld.x * _dt, y: previous.commandWorld.y * _dt,
            } : null,
        };
        EnemyNavigation.diagnosticFrame = { unit: this.node, data };
        try {
            this._updateMovement(_dt);
        } finally {
            const scale = data.branch === 'fallback-move' ? EnemyNavigation.worldSpeedForPhysicsVelocity(1) : 1;
            data.finalWorldVelocity = { x: this._velocity.x * scale, y: this._velocity.y * scale };
            const rb = this._rb?.linearVelocity;
            data.commandPhysics = rb ? { x: rb.x, y: rb.y } : null;
            data.commandWorld = rb ? { x: EnemyNavigation.worldSpeedForPhysicsVelocity(rb.x),
                y: EnemyNavigation.worldSpeedForPhysicsVelocity(rb.y) } : null;
            data.blockerAfter = debugNode(this._blockingObstacle);
            data.attackingAfter = this._isAttacking;
            data.hysteresisAfter = this._inAttackHysteresis;
            data.navigation = EnemyNavigation.diagnosticSnapshot(this.node);
            // Snapshot now: route points and geometry are mutable in subsequent frames.
            minionDebug.records[minionDebug.cursor] = JSON.parse(JSON.stringify(data));
            minionDebug.cursor = (minionDebug.cursor + 1) % 900;
            minionDebug.total++;
            minionDebug.previous = data;
            minionDebug.seconds += Math.max(0, _dt);
            EnemyNavigation.diagnosticFrame = null;
            if (minionDebug.seconds >= 15) minionDebug.stop('15-game-seconds-captured');
        }
    }

    private _updateMovement(_dt: number): void {
        const trace = EnemyNavigation.diagnosticFrame?.unit === this.node ? EnemyNavigation.diagnosticFrame.data : null;
        this._ensureRuntimeRefs();
        if (!this._canMove || this._isDead) {
            return;
        }

        if (!this._target?.isValid || !this._target.activeInHierarchy || this._target.getComponent(Player)?.isDead) {
            if (trace) trace.branch = 'invalid-target';
            this._blockingObstacle = null;
            EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
            this._halt(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);

        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this._forceChaseTarget && dist > GameConfig.minionAggroRange) {
            if (trace) trace.branch = 'outside-aggro';
            this._halt(false);
            return;
        }
        const size = this._bodySize();
        const nav = EnemyNavigation.get(this.node.scene);
        const navigationSpeed = EnemyNavigation.worldSpeedForPhysicsVelocity(GameConfig.minionMoveSpeed);
        const request = { unit: this.node, target: this._target, role: 'minion' as const,
            speed: navigationSpeed, dt: _dt, body: size, stopDistance: GameConfig.enemyMinionAttackEnterRange };
        if (this._isAttacking && this._blockingObstacle) {
            if (trace) trace.branch = 'obstacle-attack-lock';
            this._halt(false); return;
        }
        const diversion = nav?.blockingObstacle(request, GameConfig.enemyMinionAttackEnterRange) ?? null;
        if (trace) trace.diversion = diversion ? { target: debugNode(diversion.target), point: { ...diversion.point } } : null;
        if (this._blockingObstacle !== (diversion?.target ?? null)) {
            if (trace) trace.blockerChanged = true;
            this._inAttackHysteresis = false;
        }
        this._blockingObstacle = diversion?.target ?? null;
        if (diversion && nav) {
            if (trace) trace.branch = 'obstacle-move';
            if (nav.canAttackObstacle(this.node, diversion.target, size, GameConfig.enemyMinionAttackEnterRange)) {
                if (trace) trace.branch = 'obstacle-attack-range';
                this._halt(true); return;
            }
            nav.nextObstacleVelocity(request, diversion, this._velocity);
            if (trace) trace.requestedWorldVelocity = { x: this._velocity.x, y: this._velocity.y };
            this._adjustVelocityAgainstLog(true);
            nav.constrainFinalVelocity(this.node, size, _dt, navigationSpeed, this._velocity);
            this._applyNavigationVelocity();
            this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x);
            this._updateLocomotionAnim(true);
            return;
        }
        const shouldHoldForAttack = resolveMinionAttackHysteresis(this._inAttackHysteresis, dist);
        this._inAttackHysteresis = shouldHoldForAttack;
        if (dist <= GameConfig.enemyMinionAttackEnterRange) {
            if (trace) trace.branch = 'target-attack-range';
            this._halt(true);
            return;
        }
        if (shouldHoldForAttack) {
            if (trace) trace.branch = 'target-attack-hysteresis';
            this._halt(false);
            return;
        }

        if (trace) trace.branch = nav ? 'target-move' : 'fallback-move';
        if (nav) {
            nav.nextVelocity(
                {
                    unit: this.node,
                    target: this._target,
                    role: 'minion',
                    speed: navigationSpeed,
                    dt: _dt,
                    body: { width: size.w, height: size.h, offsetX: size.offsetX, offsetY: size.offsetY },
                    stopDistance: GameConfig.enemyMinionAttackEnterRange,
                },
                this._velocity,
            );
        } else {
            const walls = AirWallAabb.collectAirWalls(this.node.scene, this._airWalls);
            AirWallAabb.steerDirection(
                this._selfPos,
                this._targetPos,
                size.w,
                size.h,
                walls,
                this._velocity,
            );
            this._velocity.x *= GameConfig.minionMoveSpeed;
            this._velocity.y *= GameConfig.minionMoveSpeed;
        }

        if (trace) {
            const scale = nav ? 1 : EnemyNavigation.worldSpeedForPhysicsVelocity(1);
            trace.requestedWorldVelocity = { x: this._velocity.x * scale, y: this._velocity.y * scale };
        }
        this._biasVelocityAwayFromPlayer();
        this._adjustVelocityAgainstLog(!!nav);
        // Preserve legal rolling-log carry speed, but never let post-processing bypass the map sweep.
        const finalSpeed = Math.max(navigationSpeed, Math.hypot(this._velocity.x, this._velocity.y));
        nav?.constrainFinalVelocity(this.node, size, _dt, finalSpeed, this._velocity);

        if (nav) {
            this._applyNavigationVelocity();
        } else if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x);
        this._updateLocomotionAnim(true);
    }

    /** 跑酷中滚木仍为 sensor：重叠时只改速度挡穿，不写位置 */
    private _adjustVelocityAgainstLog(navigationVelocity: boolean): void {
        const log = this._resolveLog();
        if (!log || log.getPhase() === 'failed') {
            return;
        }
        // Fixed logs are constrained by the physical body sweep, not the larger visual rectangle.
        if (log.getPhase() === 'fixed' && EnemyNavigation.get(this.node.scene)) {
            return;
        }

        this._fillLogAabb(log, this._logRect);
        this._fillVisualAabb(this.node, this._selfRect, this._selfPos);
        if (!this._aabbOverlap(this._selfRect, this._logRect)) {
            return;
        }

        const penL = this._selfRect.xMax - this._logRect.xMin;
        const penR = this._logRect.xMax - this._selfRect.xMin;
        const penB = this._selfRect.yMax - this._logRect.yMin;
        const penT = this._logRect.yMax - this._selfRect.yMin;
        if (penL <= 0 || penR <= 0 || penB <= 0 || penT <= 0) {
            return;
        }

        const minPen = Math.min(penL, penR, penB, penT);
        const phase = log.getPhase();
        if (minPen === penL) {
            this._velocity.x = Math.min(this._velocity.x, 0);
        } else if (minPen === penR) {
            this._velocity.x = Math.max(this._velocity.x, 0);
        } else if (minPen === penB) {
            this._velocity.y = Math.min(this._velocity.y, 0);
        } else if (phase === 'rolling' || phase === 'charging') {
            const rideSpeed = this._readRideSpeedY();
            const rideY = navigationVelocity ? EnemyNavigation.worldSpeedForPhysicsVelocity(rideSpeed) : rideSpeed;
            this._velocity.y = rideY > 0 ? rideY : Math.max(this._velocity.y, 0);
        } else {
            this._velocity.y = Math.max(this._velocity.y, 0);
        }
    }

    /** 近距离取消朝向玩家的速度分量（不写 setWorldPosition） */
    private _biasVelocityAwayFromPlayer(): void {
        if (!this._target) {
            return;
        }
        this._target.getWorldPosition(this._targetPos);
        const dx = this._selfPos.x - this._targetPos.x;
        const dy = this._selfPos.y - this._targetPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= PLAYER_SOFT_SEPARATION) {
            return;
        }
        if (dist < 0.001) {
            this._velocity.set(0, 0);
            return;
        }
        const inv = 1 / dist;
        const nx = dx * inv;
        const ny = dy * inv;
        const approach = -(this._velocity.x * nx + this._velocity.y * ny);
        if (approach > 0) {
            this._velocity.x += nx * approach;
            this._velocity.y += ny * approach;
        }
    }

    private _aabbOverlap(a: Rect, b: Rect): boolean {
        return a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax;
    }

    private _readRideSpeedY(): number {
        if (!this._target) {
            return 0;
        }
        const player = this._target.getComponent(Player);
        const vy = player?.getVelocity().y ?? 0;
        return vy > 0 ? vy : 0;
    }

    private _halt(doAttack: boolean): void {
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._visualFacing.faceByTarget(this.visualNode, this.node, this._target);
        this._updateLocomotionAnim(false);
        if (doAttack) {
            this.tryAttack();
        }
    }

    private _applyNavigationVelocity(): void {
        if (!this._rb) return;
        this._rb.linearVelocity = EnemyNavigation.writePhysicsVelocity(this._velocity, this._physicsVelocity);
    }

    private _resolveLog(): Log | null {
        this._log = EnemyNavigation.get(this.node.scene)?.contactLog() ?? null;
        return this._log;
    }

    private _fillLogAabb(log: Log, out: Rect): void {
        const box = log.getBoxCollider();
        if (box) {
            const aabb = box.worldAABB;
            const w = Math.abs(aabb.width);
            const h = Math.abs(aabb.height);
            if (w >= 8 && h >= 8) {
                out.set(aabb.x, aabb.y, w, h);
                return;
            }
        }
        log.node.getWorldPosition(this._tmpPos);
        this._fillVisualAabb(log.node, out, this._tmpPos);
    }

    private _fillVisualAabb(node: Node, out: Rect, worldCenter: Vec3): void {
        const visual = node.getChildByName('Visual') ?? node;
        const ui = visual.getComponent(UITransform);
        if (ui) {
            const ws = visual.worldScale;
            const w = Math.max(Math.abs(ui.contentSize.width * ws.x), 24);
            const h = Math.max(Math.abs(ui.contentSize.height * ws.y), 24);
            const anchor = ui.anchorPoint;
            out.set(worldCenter.x - w * anchor.x, worldCenter.y - h * anchor.y, w, h);
            return;
        }
        const box = node.getComponent(BoxCollider2D);
        if (box) {
            const aabb = box.worldAABB;
            out.set(aabb.x, aabb.y, Math.abs(aabb.width), Math.abs(aabb.height));
            return;
        }
        out.set(worldCenter.x - 24, worldCenter.y - 24, 48, 48);
    }

    private _die(): void {
        if (minionDebug.enabled) {
            minionDebug.candidates.delete(this);
            if (minionDebug.selected === this) minionDebug.stop('selected-died');
        }
        AttackReservation.releaseForTarget(this);
        const life = ++this._lifeGeneration;
        this._blockingObstacle = null;
        this._isAttacking = false;
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
        this._isDead = true;
        this._canMove = false;
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this._collider) {
            this._collider.enabled = false;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }

        this.node.getWorldPosition(this._selfPos);
        const coinSys =
            CoinSystem.instance ?? this.node.scene?.getComponentInChildren(CoinSystem) ?? null;
        coinSys?.dropAt(this._selfPos);

        this.scheduleOnce(() => {
            if (this._lifeGeneration !== life || !this._isDead) return;
            this._lifeGeneration++;
            this.node.active = false;
            EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
            this.onReturnedToPool?.(this);
        }, 0.5);
    }

    onDestroy(): void {
        this.onDisable();
    }

    onDisable(): void {
        AttackReservation.releaseForTarget(this);
        this._completeFinalDeath();
        if (minionDebug.enabled) {
            minionDebug.candidates.delete(this);
            if (minionDebug.selected === this) minionDebug.stop('selected-disabled');
        }
        this._lifeGeneration++;
        this._blockingObstacle = null;
        this._isAttacking = false;
        this._target = null;
        this._ai?.setTarget(null);
        this._ai?.reset();
        this._halt(false);
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
    }

    private _updateLocomotionAnim(isMoving: boolean): void {
        if (!this.visualNode || this._isDead || this._isAttacking) {
            return;
        }
        const clip = isMoving ? 'walk' : 'idle';
        if (clip === this._currentLocomotionClip) {
            return;
        }
        this._currentLocomotionClip = clip;
        playAnim(this.visualNode, clip);
    }

    private _completeFinalDeath(): void {
        if (!this._finalDeathActive && this._finalDeathCallbacks.length === 0) {
            return;
        }
        this._finalDeathActive = false;
        const callbacks = this._finalDeathCallbacks.splice(0);
        for (const callback of callbacks) {
            callback();
        }
    }

    private _finalDeathFallbackDelay(state: { speed: number; clip?: { duration?: number } | null; duration?: number }): number {
        const speed = Number(state.speed);
        const effectiveSpeed = Number.isFinite(speed) && Math.abs(speed) > 0 ? Math.abs(speed) : 1;
        const clipDuration = Number(state.clip?.duration);
        const stateDuration = Number(state.duration);
        const duration = Number.isFinite(clipDuration) && clipDuration > 0
            ? clipDuration
            : stateDuration;
        return Math.max(Number.isFinite(duration) && duration > 0 ? duration / effectiveSpeed : 0.1, 0.1);
    }

    private _bindEmbeddedHpBar(): void {
        const bar = this.node.getComponentInChildren(HpBarUI);
        if (!bar) {
            return;
        }
        bar.hideWhenFull = true;
        bar.hideWhenDead = true;
        bar.bindTarget(this.node);
        bar.applyHp(this._hp, GameConfig.minionMaxHp, true);
    }

    private _ensureRuntimeRefs(): void {
        if (!this._rb) {
            this._rb = this.getComponent(RigidBody2D);
        }
        if (!this._collider) {
            this._collider = this.getComponent(Collider2D);
        }
        if (!this._ai) {
            this._ai = this.getComponent(EnemyAI) ?? this.addComponent(EnemyAI);
            this._ai.attackCooldown = this.attackCooldown;
        }
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
    }

    private _bodySize(): FlowBody & { w: number; h: number } {
        const box = this.node.getComponent(BoxCollider2D);
        if (box) {
            const physical = EnemyNavigation.bodyForCollider?.(box);
            if (physical) return { ...physical, w: physical.width, h: physical.height };
            const aabb = box.worldAABB;
            const w = Math.abs(aabb.width);
            const h = Math.abs(aabb.height);
            if (w >= 1 && h >= 1) {
                this.node.getWorldPosition(this._selfPos);
                const stable = stableFlowBody({
                    width: w,
                    height: h,
                    offsetX: (aabb.xMin + aabb.xMax) * 0.5 - this._selfPos.x,
                    offsetY: (aabb.yMin + aabb.yMax) * 0.5 - this._selfPos.y,
                });
                return { ...stable, w: stable.width, h: stable.height };
            }
        }
        const circle = this.node.getComponent(CircleCollider2D);
        if (circle) {
            const physical = EnemyNavigation.bodyForCircle?.(circle);
            if (physical) return { ...physical, w: physical.width, h: physical.height };
            const aabb = circle.worldAABB;
            return { width: Math.abs(aabb.width), height: Math.abs(aabb.height), w: Math.abs(aabb.width), h: Math.abs(aabb.height) };
        }
        const fallback = AirWallAabb.bodySize(this.node);
        return { ...fallback, width: fallback.w, height: fallback.h, offsetX: 0, offsetY: 0 };
    }
}

function debugPosition(node: Node): { x: number; y: number; z: number } {
    const p = node.worldPosition;
    return { x: p.x, y: p.y, z: p.z };
}

function debugNode(node: Node | null): unknown {
    return node?.isValid ? { id: node.uuid, name: node.name, active: node.activeInHierarchy,
        position: debugPosition(node) } : null;
}

// Browser Console: EnemyNavDebug.start(); EnemyNavDebug.list(); EnemyNavDebug.select('uuid');
// EnemyNavDebug.stop(); copy(EnemyNavDebug.export()); or EnemyNavDebug.download().
const minionDebug = {
    enabled: false,
    selected: null as EnemyMinion | null,
    life: 0,
    candidates: new Map<EnemyMinion, { x: number; y: number; seconds: number; life: number }>(),
    records: [] as Record<string, any>[],
    previous: null as Record<string, any> | null,
    cursor: 0, total: 0, seconds: 0,
    selection: null as Record<string, unknown> | null,
    reason: 'disabled',
    startedAt: '',
    choose(unit: EnemyMinion, reason: string, evidence: unknown = null): void {
        this.selected = unit;
        this.life = unit['_lifeGeneration'];
        this.selection = { ...debugNode(unit.node) as object, life: this.life, reason, evidence };
        this.candidates.clear();
        this.reason = 'capturing';
        console.info('[EnemyNavDebug] selected', this.selection);
    },
    stop(reason = 'manual-stop'): void {
        this.enabled = false;
        this.selected = null;
        this.candidates.clear();
        this.previous = null;
        EnemyNavigation.diagnosticFrame = null;
        this.reason = reason;
        console.info('[EnemyNavDebug] stopped', reason, this.records.length, 'records; export() or download()');
    },
};

function debugMinions(): EnemyMinion[] {
    return (director.getScene()?.getComponentsInChildren(EnemyMinion) ?? [])
        .filter(unit => unit.node.activeInHierarchy && !unit.isDead);
}

const enemyNavDebugApi = {
    start(): string {
        minionDebug.enabled = true;
        minionDebug.selected = null;
        minionDebug.candidates.clear();
        minionDebug.records = [];
        minionDebug.previous = null;
        minionDebug.cursor = minionDebug.total = minionDebug.seconds = 0;
        minionDebug.selection = null;
        minionDebug.reason = 'waiting-for-stalled-spawned-minion';
        minionDebug.startedAt = new Date().toISOString();
        return 'Armed: auto-select after 1s with <6 world units net movement, outside attack range. list()/select(id) overrides.';
    },
    stop(): void { minionDebug.stop(); },
    status(): unknown {
        return { enabled: minionDebug.enabled, reason: minionDebug.reason,
            selection: minionDebug.selection, records: minionDebug.records.length,
            seconds: minionDebug.seconds, candidates: minionDebug.candidates.size };
    },
    list(): unknown[] {
        return debugMinions().map(unit => ({ ...debugNode(unit.node) as object,
            spawned: !!unit.onReturnedToPool, selected: minionDebug.selected === unit }));
    },
    select(id: string): string {
        const unit = debugMinions().find(candidate => candidate.node.uuid === id);
        if (!unit) return 'No active minion with that UUID. Call list() again.';
        this.start();
        minionDebug.choose(unit, 'manual');
        return 'Selected; fresh capture, automatic stop after 15 game seconds.';
    },
    export(): string {
        const records = minionDebug.total > 900 ? minionDebug.records.slice(minionDebug.cursor)
            .concat(minionDebug.records.slice(0, minionDebug.cursor)) : minionDebug.records.slice();
        const branches: Record<string, number> = {}, switches: Record<string, number> = {};
        let previous = '';
        for (const record of records) {
            const key = [record.branch, record.path ?? '-', record.blockerQuery ?? '-', record.retained ?? '-'].join('|');
            branches[key] = (branches[key] ?? 0) + 1;
            if (previous && key !== previous) {
                const transition = `${previous} -> ${key}`;
                switches[transition] = (switches[transition] ?? 0) + 1;
            }
            previous = key;
        }
        return JSON.stringify({ schema: 'EnemyNavDebug-v1', startedAt: minionDebug.startedAt,
            enabled: minionDebug.enabled, reason: minionDebug.reason, selection: minionDebug.selection,
            totalFrames: minionDebug.total, droppedFrames: Math.max(0, minionDebug.total - 900),
            limits: { records: 900, captureGameSeconds: 15, autoCandidates: 16 },
            limitations: 'Minions only. Auto selection is heuristic; no detailed pre-selection history. Unknown direction readiness is not settled-none; global job counts are not per-unit readiness.',
            units: 'positions/displacement/worldVelocity: world units; commandPhysics/rigidbodyBefore: meters/s (x32). Displacement belongs to previousFrame; expected uses current dt, not fixed physics steps.',
            thresholds: { attackEnter: GameConfig.enemyMinionAttackEnterRange, attackExit: GameConfig.enemyMinionAttackExitRange,
                moveSpeedPhysics: GameConfig.minionMoveSpeed, cellSize: GameConfig.enemyFlowCellSize },
            branches, switches, records }, null, 2);
    },
    download(): void {
        const url = URL.createObjectURL(new Blob([this.export()], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'enemy-nav-debug.json';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
};

if (typeof window !== 'undefined') {
    (window as unknown as { EnemyNavDebug: typeof enemyNavDebugApi }).EnemyNavDebug = enemyNavDebugApi;
}
