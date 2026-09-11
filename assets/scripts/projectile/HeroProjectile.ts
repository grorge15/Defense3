import { _decorator, Component, Node, Vec3 } from 'cc';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/**
 * 英雄远程弹道：朝目标直线飞行，命中小怪/Boss 造成伤害后销毁。
 */
@ccclass('HeroProjectile')
export class HeroProjectile extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    @property({ tooltip: '弹道贴图默认朝向相对 +X 轴的角度偏移；贴图朝左填 180，朝右填 0' })
    directionAngleOffset = 180;

    private _damage = 15;
    private _speed = GameConfig.arrowSpeed;
    private _alive = false;
    private _traveled = 0;
    private readonly _dir = new Vec3();
    private readonly _pos = new Vec3();
    private readonly _targetPos = new Vec3();

    onLoad(): void {
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
    }

    init(target: Node, damage: number, speed?: number): void {
        this._damage = damage;
        this._speed = speed ?? GameConfig.arrowSpeed;
        this._alive = true;
        this._traveled = 0;

        this.node.getWorldPosition(this._pos);
        target.getWorldPosition(this._targetPos);
        Vec3.subtract(this._dir, this._targetPos, this._pos);
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

        this._pollHits();
    }

    private _pollHits(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const r = GameConfig.arrowHitRadius;
        const r2 = r * r;
        this.node.getWorldPosition(this._pos);

        for (const boss of scene.getComponentsInChildren(EnemyBoss)) {
            if (!boss.node.activeInHierarchy || boss.isDead) {
                continue;
            }
            boss.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._pos.x;
            const dy = this._targetPos.y - this._pos.y;
            if (dx * dx + dy * dy <= r2) {
                boss.takeDamage(this._damage, 'hero');
                this._destroySelf();
                return;
            }
        }
        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.activeInHierarchy || minion.isDead) {
                continue;
            }
            minion.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._pos.x;
            const dy = this._targetPos.y - this._pos.y;
            if (dx * dx + dy * dy <= r2) {
                minion.takeDamage(this._damage, 'hero');
                this._destroySelf();
                return;
            }
        }
    }

    private _destroySelf(): void {
        this._alive = false;
        if (this.node?.isValid) {
            this.node.destroy();
        }
    }

    private _faceMoveDirection(): void {
        const angleDeg = Math.atan2(this._dir.y, this._dir.x) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, 0, angleDeg + this.directionAngleOffset);
    }
}
