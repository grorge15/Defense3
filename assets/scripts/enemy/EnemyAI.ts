import { _decorator, Component, Node, Vec3 } from 'cc';
import { Barrier } from '../building/Barrier';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/**
 * 小怪近战 AI：近距优先打 Barrier，否则打玩家（Player.takeDamage → HealthSystem）。
 */
@ccclass('EnemyAI')
export class EnemyAI extends Component {
    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 1.0;

    private _target: Node | null = null;
    private _attackTimer = 0;
    private readonly _selfPos = new Vec3();
    private readonly _barrierPos = new Vec3();

    setTarget(target: Node | null): void {
        this._target = target;
    }

    update(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }
    }

    /**
     * 在攻击范围内找最近存活 Barrier。
     */
    findNearestBarrier(range: number): Barrier | null {
        const scene = this.node.scene;
        if (!scene || range <= 0) {
            return null;
        }
        const barriers = scene.getComponentsInChildren(Barrier);
        let nearest: Barrier | null = null;
        let nearestDistSq = range * range;
        this.node.getWorldPosition(this._selfPos);

        for (const barrier of barriers) {
            if (!barrier.isAlive()) {
                continue;
            }
            barrier.node.getWorldPosition(this._barrierPos);
            const dx = this._barrierPos.x - this._selfPos.x;
            const dy = this._barrierPos.y - this._selfPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= nearestDistSq) {
                nearestDistSq = distSq;
                nearest = barrier;
            }
        }
        return nearest;
    }

    /**
     * 近距优先 Barrier.takeDamage，否则攻击玩家。
     * @returns 是否成功造成伤害
     */
    tryAttack(range: number): boolean {
        if (this._attackTimer > 0) {
            return false;
        }

        const barrier = this.findNearestBarrier(range);
        if (barrier) {
            barrier.takeDamage(GameConfig.minionAttackDamage);
            this._attackTimer = this.attackCooldown;
            return true;
        }

        return this.tryAttackPlayer(range);
    }

    /**
     * 尝试攻击当前目标玩家（须在 range 内）。
     */
    tryAttackPlayer(range = Number.POSITIVE_INFINITY): boolean {
        if (!this._target || !this._target.activeInHierarchy || this._attackTimer > 0) {
            return false;
        }

        const player = this._target.getComponent(Player);
        if (!player || player.isDead) {
            return false;
        }

        if (Number.isFinite(range) && range > 0) {
            this.node.getWorldPosition(this._selfPos);
            this._target.getWorldPosition(this._barrierPos);
            const dx = this._barrierPos.x - this._selfPos.x;
            const dy = this._barrierPos.y - this._selfPos.y;
            if (dx * dx + dy * dy > range * range) {
                return false;
            }
        }

        player.takeDamage(GameConfig.minionAttackDamage);
        this._attackTimer = this.attackCooldown;
        return true;
    }

    reset(): void {
        this._attackTimer = 0;
    }
}
