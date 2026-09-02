import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyMinion } from './EnemyMinion';

const { ccclass, property } = _decorator;

/**
 * 远端刷怪：仅运行时在 SpawnPoint_Far 生成小怪；LOG_FIXED 后激活 Left/Right。
 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property({ type: Prefab, tooltip: '小怪 prefab（pref_enemy_minion）' })
    enemyPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '刷怪挂点（默认自身）' })
    spawnPoint: Node | null = null;

    @property({ type: Node, tooltip: '生成后朝向的目标（玩家）' })
    target: Node | null = null;

    @property({ type: Node, tooltip: 'LOG_FIXED 后激活的左侧刷怪点' })
    leftSpawnRoot: Node | null = null;

    @property({ type: Node, tooltip: 'LOG_FIXED 后激活的右侧刷怪点' })
    rightSpawnRoot: Node | null = null;

    private _timer = 0;
    private _alive = 0;
    private _farActive = true;

    onLoad(): void {
        if (!this.spawnPoint) {
            this.spawnPoint = this.node;
        }
        if (this.leftSpawnRoot) {
            this.leftSpawnRoot.active = false;
        }
        if (this.rightSpawnRoot) {
            this.rightSpawnRoot.active = false;
        }
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    setTarget(target: Node | null): void {
        this.target = target;
    }

    update(dt: number): void {
        if (!this._farActive || !this.enemyPrefab || !this.spawnPoint) {
            return;
        }
        if (this._alive >= GameConfig.farSpawnMaxAlive) {
            return;
        }

        this._timer += dt;
        if (this._timer < GameConfig.farSpawnInterval) {
            return;
        }
        this._timer = 0;
        this._spawnAt(this.spawnPoint);
    }

    private _spawnAt(point: Node): void {
        if (!this.enemyPrefab) {
            return;
        }
        const node = instantiate(this.enemyPrefab);
        const parent = point.parent ?? this.node.parent ?? this.node;
        parent.addChild(node);
        node.setWorldPosition(point.worldPosition);
        const minion = node.getComponent(EnemyMinion);
        if (minion) {
            minion.setTarget(this.target);
        }
        this._alive += 1;
        // 死亡后节点会 active=false；简化计数：上限靠池配置，不严格回收
    }

    private _onLogFixed = (): void => {
        if (this.leftSpawnRoot) {
            this.leftSpawnRoot.active = true;
            this._startSideSpawning(this.leftSpawnRoot);
        }
        if (this.rightSpawnRoot) {
            this.rightSpawnRoot.active = true;
            this._startSideSpawning(this.rightSpawnRoot);
        }
    };

    private _startSideSpawning(root: Node): void {
        this.schedule(() => {
            if (this._alive >= GameConfig.poolMaxEnemies) {
                return;
            }
            this._spawnAt(root);
        }, GameConfig.farSpawnInterval);
    }
}
