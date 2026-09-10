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
 * 玩家箭矢：沿初始方向直线飞行；穿透最多 N 名敌人；超出最大距离销毁。
 */
@ccclass('Arrow')
export class Arrow extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    @property({ tooltip: '箭矢贴图默认朝向相对 +X 轴的角度偏移；贴图朝左填 180，朝右填 0' })
    directionAngleOffset = 180;

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
        this._faceMoveDirection();
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
        this._faceMoveDirection();

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

        // Boss 优先于小怪：同帧先结算 Boss，避免穿透名额被小怪占满
        for (const boss of scene.getComponentsInChildren(EnemyBoss)) {
            if (!boss.node.activeInHierarchy || boss.isDead) {
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
            // 命中节点树上 Boss 优先于小怪（与索敌一致）
            const boss = cur.getComponent(EnemyBoss);
            if (boss) {
                this._damageEnemy(cur.uuid, (damage) => boss.takeDamage(damage));
                return;
            }
            const minion = cur.getComponent(EnemyMinion);
            if (minion) {
                this._damageEnemy(cur.uuid, (damage) => minion.takeDamage(damage));
                return;
            }
            cur = cur.parent;
        }
    }

    private _damageEnemy(id: string, apply: (damage: number) => void): void {
        if (this._piercedIds.has(id)) {
            return;
        }
        const damage = this._damageForHit(this._piercedIds.size + 1);
        this._piercedIds.add(id);
        apply(damage);
        if (this._piercedIds.size >= GameConfig.arrowMaxPierce) {
            this._destroySelf();
        }
    }

    private _damageForHit(hitIndex: number): number {
        if (hitIndex <= GameConfig.arrowFullDamageHits) {
            return this._damage;
        }
        const decaySteps = hitIndex - GameConfig.arrowFullDamageHits;
        const multiplier = Math.pow(GameConfig.arrowPierceDamageFalloff, decaySteps);
        return Math.max(1, Math.round(this._damage * multiplier));
    }

    private _destroySelf(): void {
        this._alive = false;
        this.node.destroy();
    }

    private _faceMoveDirection(): void {
        const angleDeg = Math.atan2(this._dir.y, this._dir.x) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, 0, angleDeg + this.directionAngleOffset);
    }
}
