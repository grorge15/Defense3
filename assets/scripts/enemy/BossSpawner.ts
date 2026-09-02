import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { EnemyBoss } from './EnemyBoss';

const { ccclass, property } = _decorator;

/**
 * Boss 首次生成：挂 BossSpawn_First；LOG_FIXED / CombatGuide 后 spawn 一次。
 */
@ccclass('BossSpawner')
export class BossSpawner extends Component {
    @property({ type: Prefab, tooltip: 'Boss prefab（pref_enemy_boss）' })
    bossPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '生成挂点（默认自身）' })
    spawnPoint: Node | null = null;

    @property({ type: Node, tooltip: '索敌玩家节点' })
    player: Node | null = null;

    private _spawned = false;

    onLoad(): void {
        if (!this.spawnPoint) {
            this.spawnPoint = this.node;
        }
    }

    setPlayer(player: Node | null): void {
        this.player = player;
    }

    trySpawnFirst(): void {
        if (this._spawned || !this.bossPrefab || !this.spawnPoint) {
            return;
        }
        this._spawned = true;

        const node = instantiate(this.bossPrefab);
        const parent = this.spawnPoint.parent ?? this.node.parent ?? this.node;
        parent.addChild(node);
        node.setWorldPosition(this.spawnPoint.worldPosition);

        const boss = node.getComponent(EnemyBoss);
        if (boss) {
            boss.registerTargets({
                player: this.player,
                buildings: [],
                heroes: [],
            });
        }
    }
}
