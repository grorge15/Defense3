import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyMinion } from './EnemyMinion';

const { ccclass, property } = _decorator;

/**
 * 远端刷怪：对象池 + 死亡 5s 后在原 SpawnPoint 重生；上限读 GameConfig.poolMaxEnemies。
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
    private _leftStopped = false;
    private _rightStopped = false;
    private _leftSpawnRoot: Node | null = null;
    private _rightSpawnRoot: Node | null = null;
    private readonly _pool: EnemyMinion[] = [];
    private readonly _spawnOrigin = new Map<EnemyMinion, Node>();

    private readonly _leftSpawnTick = (): void => {
        if (this._leftStopped || !this._leftSpawnRoot) {
            return;
        }
        this._trySpawnAt(this._leftSpawnRoot);
    };

    private readonly _rightSpawnTick = (): void => {
        if (this._rightStopped || !this._rightSpawnRoot) {
            return;
        }
        this._trySpawnAt(this._rightSpawnRoot);
    };

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
        EventManager.instance.onEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
        EventManager.instance.offEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        this.unscheduleAllCallbacks();
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
        this._trySpawnAt(this.spawnPoint);
    }

    private _trySpawnAt(point: Node): void {
        if (this._alive >= GameConfig.poolMaxEnemies) {
            return;
        }
        if (!this._spawnAt(point)) {
            return;
        }
    }

    private _spawnAt(point: Node): boolean {
        if (!this.enemyPrefab) {
            return false;
        }
        const minion = this._acquireFromPool(point);
        if (!minion) {
            return false;
        }
        this._spawnOrigin.set(minion, point);
        minion.node.setWorldPosition(point.worldPosition);
        minion.reset();
        minion.setTarget(this.target);
        minion.onReturnedToPool = (m) => this._onMinionDied(m);
        minion.node.active = true;
        this._alive += 1;
        return true;
    }

    private _acquireFromPool(point: Node): EnemyMinion | null {
        for (const m of this._pool) {
            if (m && m.isValid && !m.node.activeInHierarchy) {
                return m;
            }
        }
        if (this._pool.length >= GameConfig.poolMaxEnemies) {
            return null;
        }
        const parent = point.parent ?? this.node.parent ?? this.node;
        const node = instantiate(this.enemyPrefab!);
        parent.addChild(node);
        node.active = false;
        const minion = node.getComponent(EnemyMinion);
        if (!minion) {
            node.destroy();
            return null;
        }
        this._pool.push(minion);
        return minion;
    }

    private _onMinionDied = (minion: EnemyMinion): void => {
        this._alive = Math.max(0, this._alive - 1);
        const origin = this._spawnOrigin.get(minion) ?? this.spawnPoint;
        this.scheduleOnce(() => {
            if (!minion?.isValid || !origin?.isValid) {
                return;
            }
            if (this._alive >= GameConfig.poolMaxEnemies) {
                return;
            }
            minion.node.setWorldPosition(origin.worldPosition);
            minion.reset();
            minion.setTarget(this.target);
            minion.onReturnedToPool = (m) => this._onMinionDied(m);
            minion.node.active = true;
            this._alive += 1;
        }, GameConfig.enemyRespawnDelay);
    };

    private _onLogFixed = (): void => {
        if (this.leftSpawnRoot) {
            this.leftSpawnRoot.active = true;
            this._startSideSpawning(this.leftSpawnRoot, 'left');
        }
        if (this.rightSpawnRoot) {
            this.rightSpawnRoot.active = true;
            this._startSideSpawning(this.rightSpawnRoot, 'right');
        }
    };

    private _startSideSpawning(root: Node, side: 'left' | 'right'): void {
        if (side === 'left') {
            this._leftSpawnRoot = root;
            this.schedule(this._leftSpawnTick, GameConfig.farSpawnInterval);
            return;
        }
        this._rightSpawnRoot = root;
        this.schedule(this._rightSpawnTick, GameConfig.farSpawnInterval);
    }

    stopSide(side: 'left' | 'right'): void {
        if (side === 'left') {
            this._leftStopped = true;
            this.unschedule(this._leftSpawnTick);
        } else {
            this._rightStopped = true;
            this.unschedule(this._rightSpawnTick);
        }
    }

    private _onBuildComplete = (payload: { buildType?: string; spawnSide?: string }): void => {
        const side = payload?.spawnSide;
        if (side === 'left' || side === 'right') {
            this.stopSide(side);
        }
    };
}
