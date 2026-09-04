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
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { CoinSystem } from '../game/CoinSystem';
import { Log } from '../item/Log';
import { Player } from '../character/Player';
import { UIManager } from '../ui/UIManager';
import { EnemyAI } from './EnemyAI';

const { ccclass, property } = _decorator;

const PEER_SEPARATION = 36;
const PLAYER_SEPARATION = 48;

/**
 * 小怪：Kinematic + setPosition / setWorldPosition 位移；
 * 挡滚木按最小穿透轴；与玩家/同伴保持分离。
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
    private readonly _nextWorld = new Vec3();
    private readonly _peerPos = new Vec3();
    private readonly _selfRect = new Rect();
    private readonly _logRect = new Rect();
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _currentLocomotionClip = '';

    /** 死亡收进对象池时回调（EnemySpawner 监听并 5s 后重生） */
    public onReturnedToPool: ((minion: EnemyMinion) => void) | null = null;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = true;
        }
        this._ai = this.getComponent(EnemyAI) ?? this.addComponent(EnemyAI);
        this._ai.attackCooldown = this.attackCooldown;
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
    }

    start(): void {
        this.scheduleOnce(() => {
            UIManager.instance?.spawnHpBar('enemy', this.node, this.visualNode ?? this.node);
        }, 0);
    }

    setTarget(target: Node | null): void {
        this._target = target;
        this._ai?.setTarget(target);
    }

    tryAttack(): void {
        if (this._isDead || !this._ai) {
            return;
        }
        // 与 update 中 meleeRange 一致，避免分离半径大于 attackRange 时出手失败
        const range = Math.max(this.attackRange, PLAYER_SEPARATION + 8);
        if (!this._ai.tryAttack(range)) {
            return;
        }
        this._isAttacking = true;
        if (this.visualNode) {
            playAnim(this.visualNode, 'attack');
        }
        this.scheduleOnce(() => {
            this._isAttacking = false;
        }, 0.1);
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
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.minionMaxHp;
        this._target = null;
        this._isDead = false;
        this._canMove = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
        this._log = null;
        this._ai?.reset();
        this._ai?.setTarget(null);
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
            this._collider.sensor = true;
        }
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'idle');
        }
    }

    update(dt: number): void {
        if (!this._canMove || this._isDead || dt <= 0) {
            return;
        }

        const barrier = this._ai?.findNearestBarrier(this.attackRange) ?? null;
        if (barrier && barrier.isAlive() && barrier.node.activeInHierarchy) {
            this._halt(true);
            return;
        }

        if (!this._target || !this._target.active) {
            this._halt(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);

        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 分离半径 48 曾大于 attackRange 40 → 永远摸不到攻击距；出手距至少覆盖分离
        const meleeRange = Math.max(this.attackRange, PLAYER_SEPARATION + 8);
        if (dist <= meleeRange) {
            this._pushAwayFromPlayer(PLAYER_SEPARATION);
            this._halt(true);
            return;
        }

        const invDist = 1 / dist;
        this._velocity.x = dx * invDist * GameConfig.minionMoveSpeed;
        this._velocity.y = dy * invDist * GameConfig.minionMoveSpeed;

        this._nextWorld.set(
            this._selfPos.x + this._velocity.x * dt,
            this._selfPos.y + this._velocity.y * dt,
            this._selfPos.z,
        );

        this._resolveAgainstLog(this._nextWorld, dt);
        this._resolveAgainstPlayer(this._nextWorld);
        this._resolveAgainstPeers(this._nextWorld);

        this.node.setWorldPosition(this._nextWorld);

        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._updateLocomotionAnim(true);
    }

    /**
     * 必须 AABB 真重叠。侧向 → 只推 X；上方压入 → 推到 yMax，跑酷中可跟玩家 Y 速。
     */
    private _resolveAgainstLog(next: Vec3, dt: number): void {
        const log = this._resolveLog();
        if (!log || log.getPhase() === 'failed') {
            return;
        }

        this._fillLogAabb(log, this._logRect);
        this._fillVisualAabb(this.node, this._selfRect, next);
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
            next.x -= penL;
            this._velocity.x = Math.min(this._velocity.x, 0);
        } else if (minPen === penR) {
            next.x += penR;
            this._velocity.x = Math.max(this._velocity.x, 0);
        } else if (minPen === penB) {
            next.y -= penB;
            this._velocity.y = Math.min(this._velocity.y, 0);
        } else {
            next.y += penT;
            if (phase === 'rolling' || phase === 'charging') {
                const rideY = this._readRideSpeedY();
                if (rideY > 0) {
                    next.y += rideY * dt;
                    this._velocity.y = rideY;
                } else {
                    this._velocity.y = Math.max(this._velocity.y, 0);
                }
            } else {
                this._velocity.y = Math.max(this._velocity.y, 0);
            }
        }
    }

    private _resolveAgainstPlayer(next: Vec3): void {
        if (!this._target) {
            return;
        }
        this._target.getWorldPosition(this._targetPos);
        const dx = next.x - this._targetPos.x;
        const dy = next.y - this._targetPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= PLAYER_SEPARATION) {
            return;
        }
        if (dist < 0.001) {
            next.x = this._targetPos.x + PLAYER_SEPARATION;
            return;
        }
        const s = PLAYER_SEPARATION / dist;
        next.x = this._targetPos.x + dx * s;
        next.y = this._targetPos.y + dy * s;
    }

    private _pushAwayFromPlayer(minDist: number): void {
        if (!this._target) {
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);
        const dx = this._selfPos.x - this._targetPos.x;
        const dy = this._selfPos.y - this._targetPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= minDist) {
            return;
        }
        if (dist < 0.001) {
            this._selfPos.x = this._targetPos.x;
            this._selfPos.y = this._targetPos.y + minDist;
        } else {
            const s = minDist / dist;
            this._selfPos.x = this._targetPos.x + dx * s;
            this._selfPos.y = this._targetPos.y + dy * s;
        }
        this.node.setWorldPosition(this._selfPos);
    }

    private _resolveAgainstPeers(next: Vec3): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const peers = scene.getComponentsInChildren(EnemyMinion);
        for (const peer of peers) {
            if (peer === this || !peer.isValid || peer._isDead || !peer.node.activeInHierarchy) {
                continue;
            }
            peer.node.getWorldPosition(this._peerPos);
            const dx = next.x - this._peerPos.x;
            const dy = next.y - this._peerPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= PEER_SEPARATION) {
                continue;
            }
            if (dist < 0.0001) {
                next.x += PEER_SEPARATION * 0.5;
                continue;
            }
            const push = (PEER_SEPARATION - dist) * 0.5;
            const inv = 1 / dist;
            next.x += dx * inv * push;
            next.y += dy * inv * push;
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
            this.onReturnedToPool?.(this);
        }, 0.5);
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
}
