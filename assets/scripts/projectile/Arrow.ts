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
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

/**
 * 玩家箭矢：沿初始方向直线飞行；穿透最多 N 名敌人；超出最大距离销毁。
 */
@ccclass('Arrow')
export class Arrow extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _collider: Collider2D | null = null;
    private _damage = GameConfig.playerAttackDamage;
    private _speed = GameConfig.arrowSpeed;
    private _alive = false;
    private _traveled = 0;
    private readonly _piercedIds = new Set<string>();
    private readonly _dir = new Vec3();
    private readonly _pos = new Vec3();
    private readonly _enemyPos = new Vec3();

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

    /** 由 CombatSystem 调用：朝首目标方向直线飞行 */
    init(target: Node, damage?: number, speed?: number): void {
        this._damage = damage ?? GameConfig.playerAttackDamage;
        this._speed = speed ?? GameConfig.arrowSpeed;
        this._alive = true;
        this._traveled = 0;
        this._piercedIds.clear();

        this.node.getWorldPosition(this._pos);
        target.getWorldPosition(this._enemyPos);
        Vec3.subtract(this._dir, this._enemyPos, this._pos);
        if (this._dir.lengthSqr() < 0.0001) {
            this._dir.set(0, 1, 0);
        } else {
            this._dir.normalize();
        }
    }

    update(dt: number): void {
        if (!this._alive || dt <= 0) {
            return;
        }

        const step = this._speed * dt;
        this.node.getWorldPosition(this._pos);
        this._pos.x += this._dir.x * step;
        this._pos.y += this._dir.y * step;
        this._pos.z += this._dir.z * step;
        this.node.setWorldPosition(this._pos);

        this._traveled += step;
        if (this._traveled >= GameConfig.arrowMaxDistance) {
            this._destroySelf();
            return;
        }

        this._pollEnemyHits();
    }

    private _pollEnemyHits(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const r = GameConfig.arrowHitRadius;
        const r2 = r * r;
        this.node.getWorldPosition(this._pos);

        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.activeInHierarchy) {
                continue;
            }
            minion.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._pos.x;
            const dy = this._enemyPos.y - this._pos.y;
            if (dx * dx + dy * dy <= r2) {
                this._applyHit(minion.node);
                if (!this._alive) {
                    return;
                }
            }
        }
        for (const boss of scene.getComponentsInChildren(EnemyBoss)) {
            if (!boss.node.activeInHierarchy) {
                continue;
            }
            boss.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._pos.x;
            const dy = this._enemyPos.y - this._pos.y;
            if (dx * dx + dy * dy <= r2) {
                this._applyHit(boss.node);
                if (!this._alive) {
                    return;
                }
            }
        }
        for (const log of scene.getComponentsInChildren(Log)) {
            if (!log.node.activeInHierarchy || !log.isAttackable()) {
                continue;
            }
            log.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._pos.x;
            const dy = this._enemyPos.y - this._pos.y;
            if (dx * dx + dy * dy <= r2) {
                this._applyHit(log.node);
                if (!this._alive) {
                    return;
                }
            }
        }
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

        let cur: Node | null = node;
        while (cur) {
            const minion = cur.getComponent(EnemyMinion);
            if (minion) {
                this._damageEnemy(cur.uuid, () => minion.takeDamage(this._damage));
                return;
            }
            const boss = cur.getComponent(EnemyBoss);
            if (boss) {
                this._damageEnemy(cur.uuid, () => boss.takeDamage(this._damage));
                return;
            }
            const log = cur.getComponent(Log);
            if (log?.isAttackable()) {
                this._damageEnemy(cur.uuid, () => log.takeDamage(this._damage));
                return;
            }
            cur = cur.parent;
        }
    }

    private _damageEnemy(id: string, apply: () => void): void {
        if (this._piercedIds.has(id)) {
            return;
        }
        this._piercedIds.add(id);
        apply();
        if (this._piercedIds.size >= GameConfig.arrowMaxPierce) {
            this._destroySelf();
        }
    }

    private _destroySelf(): void {
        this._alive = false;
        this.node.destroy();
    }
}
