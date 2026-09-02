import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { Arrow } from '../projectile/Arrow';

const { ccclass, property } = _decorator;

/**
 * 玩家射箭入口：有弓后自动寻最近 EnemyMinion 射击；冷却读 GameConfig。
 */
@ccclass('CombatSystem')
export class CombatSystem extends Component {
    @property({ type: Prefab, tooltip: '箭矢 prefab（pref_projectile_arrow）' })
    arrowPrefab: Prefab | null = null;

    /** 运行时玩家引用；不用 @property(Player) 以免与 Player↔CombatSystem 循环依赖导致属性未注册 */
    player: Player | null = null;

    @property({ type: Node, tooltip: '玩家节点（含 Player；可选，SceneSetup 也会补绑）' })
    playerNode: Node | null = null;

    @property({ type: Node, tooltip: '箭矢父节点；空则用玩家父节点或场景' })
    projectileRoot: Node | null = null;

    @property({ tooltip: '索敌范围（世界单位）' })
    attackRange = 10;

    private _cooldown = 0;
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();

    private _resolvePlayer(): Player | null {
        if (this.player && this.player.isValid) {
            return this.player;
        }
        if (this.playerNode && this.playerNode.isValid) {
            this.player = this.playerNode.getComponent(Player);
        }
        return this.player;
    }

    update(dt: number): void {
        if (this._cooldown > 0) {
            this._cooldown -= dt;
        }
        this.tryAttack();
    }

    /** 供 Player.tryAttack 或自动射击调用 */
    tryAttack(): void {
        const player = this._resolvePlayer();
        if (!player || !player.hasBow || player.isDead) {
            return;
        }
        if (this._cooldown > 0) {
            return;
        }
        if (!this.arrowPrefab) {
            return;
        }

        const enemy = this._findNearestEnemy();
        if (!enemy) {
            return;
        }

        this._cooldown = GameConfig.playerAttackInterval;
        player.playAttackAnim();
        this._spawnArrow(enemy.node);
    }

    private _findNearestEnemy(): EnemyMinion | null {
        const player = this._resolvePlayer();
        if (!player) {
            return null;
        }
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        player.node.getWorldPosition(this._selfPos);
        let nearest: EnemyMinion | null = null;
        let nearestDist = this.attackRange;

        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.active) {
                continue;
            }
            minion.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const dz = this._targetPos.z - this._selfPos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist <= nearestDist) {
                nearestDist = dist;
                nearest = minion;
            }
        }
        return nearest;
    }

    private _spawnArrow(target: Node): void {
        const player = this._resolvePlayer();
        if (!this.arrowPrefab || !player) {
            return;
        }

        const arrowNode = instantiate(this.arrowPrefab);
        const parent =
            this.projectileRoot ?? player.node.parent ?? this.node.scene;
        if (!parent) {
            arrowNode.destroy();
            return;
        }
        arrowNode.setParent(parent);
        arrowNode.setWorldPosition(player.node.worldPosition);

        const arrow = arrowNode.getComponent(Arrow);
        if (arrow) {
            arrow.init(target, GameConfig.playerAttackDamage, GameConfig.arrowSpeed);
        }
    }
}
