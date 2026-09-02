import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Node,
    Vec3,
} from 'cc';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/**
 * 玩家箭矢：朝目标飞行，命中 EnemyMinion/EnemyBoss 后扣血并销毁。
 */
@ccclass('Arrow')
export class Arrow extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _collider: Collider2D | null = null;
    private _target: Node | null = null;
    private _damage = GameConfig.playerAttackDamage;
    private _speed = GameConfig.arrowSpeed;
    private _alive = false;
    private readonly _dir = new Vec3();
    private readonly _pos = new Vec3();
    private readonly _targetPos = new Vec3();

    onLoad(): void {
        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = true;
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    onDestroy(): void {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    /** 由 CombatSystem 调用：朝目标飞行并施加伤害 */
    init(target: Node, damage?: number, speed?: number): void {
        this._target = target;
        this._damage = damage ?? GameConfig.playerAttackDamage;
        this._speed = speed ?? GameConfig.arrowSpeed;
        this._alive = true;

        this.node.getWorldPosition(this._pos);
        target.getWorldPosition(this._targetPos);
        Vec3.subtract(this._dir, this._targetPos, this._pos);
        if (this._dir.lengthSqr() < 0.0001) {
            this._dir.set(0, 0, -1);
        } else {
            this._dir.normalize();
        }
    }

    update(dt: number): void {
        if (!this._alive) {
            return;
        }

        this.node.getWorldPosition(this._pos);
        if (this._target && this._target.isValid && this._target.active) {
            this._target.getWorldPosition(this._targetPos);
            Vec3.subtract(this._dir, this._targetPos, this._pos);
            const dist = this._dir.length();
            if (dist < 0.35) {
                this._applyHit(this._target);
                return;
            }
            if (dist > 0.0001) {
                this._dir.multiplyScalar(1 / dist);
            }
        }

        const step = this._speed * dt;
        this._pos.x += this._dir.x * step;
        this._pos.y += this._dir.y * step;
        this._pos.z += this._dir.z * step;
        this.node.setWorldPosition(this._pos);
    }

    private _onBeginContact = (
        _selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void _selfCollider;
        void _contact;
        if (!this._alive) {
            return;
        }
        this._applyHit(otherCollider.node);
    };

    private _applyHit(node: Node): void {
        if (!this._alive) {
            return;
        }

        const minion = node.getComponent(EnemyMinion);
        if (minion) {
            this._alive = false;
            minion.takeDamage(this._damage);
            this.node.destroy();
            return;
        }

        const boss = node.getComponent(EnemyBoss);
        if (boss) {
            this._alive = false;
            boss.takeDamage(this._damage);
            this.node.destroy();
        }
    }
}
