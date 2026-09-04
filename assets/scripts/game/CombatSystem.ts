import { _decorator, Component, instantiate, Node, Prefab, resources, Vec3 } from 'cc';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { Arrow } from '../projectile/Arrow';

const { ccclass, property } = _decorator;

/**
 * 玩家射箭入口：有弓后自动索敌；范围内 Boss 优先于小怪。
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

    @property({ tooltip: '索敌范围（世界单位）；≤20 时启动用 GameConfig.playerAttackRange 纠正旧场景绑定' })
    attackRange = GameConfig.playerAttackRange;

    private _cooldown = 0;
    private _loadingArrow = false;
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();

    onLoad(): void {
        // 场景里若仍绑着旧默认值 10，按当前世界尺度纠正（不改 Main.scene）
        if (this.attackRange <= 20) {
            this.attackRange = GameConfig.playerAttackRange;
        }
        this._ensureArrowPrefab();
    }

    private _resolvePlayer(): Player | null {
        if (this.player && this.player.isValid) {
            return this.player;
        }
        if (this.playerNode && this.playerNode.isValid) {
            this.player = this.playerNode.getComponent(Player);
        }
        if (!this.player && this.node.scene) {
            this.player = this.node.scene.getComponentInChildren(Player);
        }
        return this.player;
    }

    private _ensureArrowPrefab(): void {
        if (this.arrowPrefab || this._loadingArrow) {
            return;
        }
        this._loadingArrow = true;
        resources.load('prefabs/projectile/pref_projectile_arrow', Prefab, (err, prefab) => {
            this._loadingArrow = false;
            if (err || !prefab) {
                console.warn('[CombatSystem] failed to load pref_projectile_arrow', err);
                return;
            }
            if (!this.arrowPrefab) {
                this.arrowPrefab = prefab;
            }
        });
    }

    update(dt: number): void {
        if (this._cooldown > 0) {
            this._cooldown -= dt;
        }
        this._ensureArrowPrefab();
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
            this._ensureArrowPrefab();
            return;
        }

        const target = this._findAttackTarget();
        if (!target) {
            return;
        }

        this._cooldown = GameConfig.playerAttackInterval;
        player.playAttackAnim();
        this._spawnArrow(target);
    }

    /** 范围内优先 Boss，其次最近小怪 */
    private _findAttackTarget(): Node | null {
        const player = this._resolvePlayer();
        if (!player) {
            return null;
        }
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        player.node.getWorldPosition(this._selfPos);
        const range = this.attackRange;

        let bestBoss: Node | null = null;
        let bestBossDist = range;
        for (const boss of scene.getComponentsInChildren(EnemyBoss)) {
            if (!boss.node.activeInHierarchy || boss.isDead) {
                continue;
            }
            const dist = this._distTo(boss.node);
            if (dist <= bestBossDist) {
                bestBossDist = dist;
                bestBoss = boss.node;
            }
        }
        if (bestBoss) {
            return bestBoss;
        }

        let nearest: Node | null = null;
        let nearestDist = range;
        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.activeInHierarchy) {
                continue;
            }
            const dist = this._distTo(minion.node);
            if (dist <= nearestDist) {
                nearestDist = dist;
                nearest = minion.node;
            }
        }
        return nearest;
    }

    private _distTo(node: Node): number {
        node.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dz = this._targetPos.z - this._selfPos.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
