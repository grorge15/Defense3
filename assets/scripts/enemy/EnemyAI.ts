import { _decorator, BoxCollider2D, Component, Node, Vec3 } from 'cc';
import { Barrier } from '../building/Barrier';
import { Player } from '../character/Player';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { FlowBody } from '../core/FlowField';
import { GameConfig } from '../core/GameConfig';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

/**
 * 小怪近战 AI：近距优先打 Barrier，否则打玩家（Player.takeDamage → HealthSystem）。
 */
@ccclass('EnemyAI')
export class EnemyAI extends Component {
    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 1.0;

    @property({ tooltip: '旧模式：攻击帧优先打近处 Barrier。共享导航模式默认关闭。' })
    attackPrefersBarrier = false;

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
     * 开冷却并允许播攻击动画（伤害改由帧事件 applyAttackDamage）。
     * @returns 是否成功进入攻击
     */
    beginAttack(range: number, log: Log | null = null): boolean {
        if (this._attackTimer > 0) {
            return false;
        }
        if (log ? !EnemyNavigation.get(this.node.scene)?.canAttackLog(this.node, log, this._body(), range) : !this._hasAttackTarget(range)) {
            return false;
        }
        this._attackTimer = this.attackCooldown;
        return true;
    }

    applyLogDamage(log: Log, range: number): boolean {
        const nav = EnemyNavigation.get(this.node.scene);
        if (!nav?.canAttackLog(this.node, log, this._body(), range)) return false;
        log.takeDamage(GameConfig.minionAttackDamage);
        if (!log.isAttackable()) nav.invalidate();
        return true;
    }

    /** 帧事件出手：近距优先 Barrier，否则打玩家 */
    applyAttackDamage(range: number): boolean {
        if (this.attackPrefersBarrier) {
            const barrier = this.findNearestBarrier(range);
            if (barrier) {
                barrier.takeDamage(GameConfig.minionAttackDamage);
                return true;
            }
        }
        return this._damagePlayer(range);
    }

    applyAttackDamageTo(target: Node | null, range: number): boolean {
        const old = this._target;
        this._target = target;
        const hit = this._damagePlayer(range);
        this._target = old;
        return hit;
    }

    attackBarrierNow(barrier: Barrier | null): boolean {
        if (!barrier?.isAlive() || this._attackTimer > 0) {
            return false;
        }
        this._attackTimer = this.attackCooldown;
        barrier.takeDamage(GameConfig.minionAttackDamage);
        return true;
    }

    /**
     * @deprecated 使用 beginAttack + applyAttackDamage（帧事件）
     */
    tryAttack(range: number): boolean {
        if (!this.beginAttack(range)) {
            return false;
        }
        return this.applyAttackDamage(range);
    }

    /**
     * 尝试攻击当前目标玩家（须在 range 内）。
     * @deprecated 帧事件路径请用 applyAttackDamage
     */
    tryAttackPlayer(range = Number.POSITIVE_INFINITY): boolean {
        if (this._attackTimer > 0) {
            return false;
        }
        if (!this._damagePlayer(range)) {
            return false;
        }
        this._attackTimer = this.attackCooldown;
        return true;
    }

    private _hasAttackTarget(range: number): boolean {
        if (this.attackPrefersBarrier && this.findNearestBarrier(range)) {
            return true;
        }
        if (!this._target || !this._target.activeInHierarchy) {
            return false;
        }
        const player = this._target.getComponent(Player);
        if (!player || player.isDead) {
            return false;
        }
        return this._canDamagePlayer(range);
    }

    private _damagePlayer(range: number): boolean {
        if (!this._target || !this._target.activeInHierarchy) {
            return false;
        }
        const player = this._target.getComponent(Player);
        if (!player || player.isDead) {
            return false;
        }
        if (!this._canDamagePlayer(range)) {
            return false;
        }
        player.takeDamage(GameConfig.minionAttackDamage);
        return true;
    }

    private _canDamagePlayer(range: number): boolean {
        if (!this._target || !this._target.activeInHierarchy) {
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
        const nav = EnemyNavigation.get(this.node.scene);
        return nav ? nav.hasLineOfSight(this.node, this._target, this._body()) : true;
    }

    private _body(): FlowBody {
        const box = this.node.getComponent(BoxCollider2D);
        if (!box) {
            return { width: 24, height: 24 };
        }
        const physical = EnemyNavigation.bodyForCollider?.(box);
        if (physical) return physical;
        const aabb = box.worldAABB;
        this.node.getWorldPosition(this._selfPos);
        return {
            width: Math.max(1, Math.abs(aabb.width)),
            height: Math.max(1, Math.abs(aabb.height)),
            offsetX: (aabb.xMin + aabb.xMax) * 0.5 - this._selfPos.x,
            offsetY: (aabb.yMin + aabb.yMax) * 0.5 - this._selfPos.y,
        };
    }

    reset(): void {
        this._attackTimer = 0;
    }
}
