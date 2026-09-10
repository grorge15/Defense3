import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    ERigidBody2DType,
    Node,
    Rect,
    RigidBody2D,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { AirWallAabb } from '../core/AirWallAabb';
import { playAnim, playAttackWithFrameHit } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { FlowBody } from '../core/FlowField';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { VisualFacing } from '../core/VisualFacing';
import { CoinSystem } from '../game/CoinSystem';
import { Log } from '../item/Log';
import { Player } from '../character/Player';
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
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _tmpPos = new Vec3();
    private readonly _selfRect = new Rect();
    private readonly _logRect = new Rect();
    private _airWalls: BoxCollider2D[] = [];
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _forceChaseTarget = false;
    private _inAttackHysteresis = false;
    private _currentLocomotionClip = '';
    private readonly _visualFacing = new VisualFacing();

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
        if (!this._ai.beginAttack(range)) {
            return;
        }
        this._isAttacking = true;
        this._visualFacing.faceByTarget(this.visualNode, this.node, this._target);
        if (this.visualNode) {
            // minion frame_012 → 0.4s
            playAttackWithFrameHit(
                this.visualNode,
                'attack',
                () => {
                    if (!this._isDead) {
                        this._ai?.applyAttackDamage(range);
                    }
                },
                0.45,
            );
        } else {
            this._ai.applyAttackDamage(range);
        }
        this.scheduleOnce(() => {
            this._isAttacking = false;
        }, 0.8);
    }

    get isDead(): boolean {
        return this._isDead;
    }

    takeDamage(amount: number): void {
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
        if (this._hp <= 0) {
            this._die();
        }
    }

    reset(): void {
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
        this._ensureRuntimeRefs();
        if (!this._canMove || this._isDead) {
            return;
        }

        if (!this._target || !this._target.activeInHierarchy) {
            this._halt(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);

        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this._forceChaseTarget && dist > GameConfig.minionAggroRange) {
            this._halt(false);
            return;
        }
        const shouldHoldForAttack = resolveMinionAttackHysteresis(this._inAttackHysteresis, dist);
        this._inAttackHysteresis = shouldHoldForAttack;
        if (dist <= GameConfig.enemyMinionAttackEnterRange) {
            this._halt(true);
            return;
        }
        if (shouldHoldForAttack) {
            this._halt(false);
            return;
        }

        const size = this._bodySize();
        const nav = EnemyNavigation.get(this.node.scene);
        if (nav) {
            nav.nextVelocity(
                {
                    unit: this.node,
                    target: this._target,
                    role: 'minion',
                    speed: GameConfig.minionMoveSpeed,
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

        this._biasVelocityAwayFromPlayer();
        this._adjustVelocityAgainstLog();

        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x);
        this._updateLocomotionAnim(true);
    }

    /** 跑酷中滚木仍为 sensor：重叠时只改速度挡穿，不写位置 */
    private _adjustVelocityAgainstLog(): void {
        const log = this._resolveLog();
        if (!log || log.getPhase() === 'failed') {
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
            const rideY = this._readRideSpeedY();
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

    private _resolveLog(): Log | null {
        if (this._log?.isValid && this._log.node.activeInHierarchy) {
            return this._log;
        }
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }
        this._log = scene.getComponentInChildren(Log);
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
            this.node.active = false;
            EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
            this.onReturnedToPool?.(this);
        }, 0.5);
    }

    onDestroy(): void {
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
            const aabb = box.worldAABB;
            const w = Math.abs(aabb.width);
            const h = Math.abs(aabb.height);
            if (w >= 1 && h >= 1) {
                this.node.getWorldPosition(this._selfPos);
                return {
                    w,
                    h,
                    width: w,
                    height: h,
                    offsetX: (aabb.xMin + aabb.xMax) * 0.5 - this._selfPos.x,
                    offsetY: (aabb.yMin + aabb.yMax) * 0.5 - this._selfPos.y,
                };
            }
        }
        const fallback = AirWallAabb.bodySize(this.node);
        return { ...fallback, width: fallback.w, height: fallback.h, offsetX: 0, offsetY: 0 };
    }
}
