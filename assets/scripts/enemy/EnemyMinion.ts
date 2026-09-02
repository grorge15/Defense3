import { _decorator, Collider2D, Component, Node, RigidBody2D, Vec2, Vec3 } from 'cc';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { CoinSystem } from '../game/CoinSystem';
import { UIManager } from '../ui/UIManager';
import { EnemyAI } from './EnemyAI';

const { ccclass, property } = _decorator;

@ccclass('EnemyMinion')
export class EnemyMinion extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '近战攻击范围（世界单位）' })
    attackRange = 1.5;

    @property({ tooltip: '攻击冷却（秒）；同步到 EnemyAI' })
    attackCooldown = 1.0;

    private _rb: RigidBody2D | null = null;
    private _collider: Collider2D | null = null;
    private _ai: EnemyAI | null = null;
    private _hp = GameConfig.minionMaxHp;
    private _target: Node | null = null;
    private readonly _velocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _currentLocomotionClip = '';

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(Collider2D);
        this._ai = this.getComponent(EnemyAI) ?? this.addComponent(EnemyAI);
        this._ai.attackCooldown = this.attackCooldown;
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

        if (!this._ai.tryAttack(this.attackRange)) {
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
        this._ai?.reset();
        this._ai?.setTarget(null);
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
        }
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'idle');
        }
    }

    fixedUpdate(_dt: number): void {
        if (!this._canMove || !this._rb || this._isDead) {
            return;
        }

        // 近距有 Barrier：停下优先拆障
        const barrier = this._ai?.findNearestBarrier(this.attackRange) ?? null;
        if (barrier) {
            this._velocity.set(0, 0);
            this._rb.linearVelocity = this._velocity;
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        if (!this._target || !this._target.active) {
            this._velocity.set(0, 0);
            this._rb.linearVelocity = this._velocity;
            this._updateLocomotionAnim(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.attackRange) {
            this._velocity.set(0, 0);
            this._rb.linearVelocity = this._velocity;
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const invDist = 1 / dist;
        this._velocity.x = dx * invDist * GameConfig.minionMoveSpeed;
        this._velocity.y = dy * invDist * GameConfig.minionMoveSpeed;
        this._rb.linearVelocity = this._velocity;
        this._updateLocomotionAnim(true);
    }

    private _die(): void {
        this._isDead = true;
        this._canMove = false;
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
