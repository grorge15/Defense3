import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { EnemyMinion } from './EnemyMinion';

const { ccclass, property } = _decorator;

@ccclass('EnemyEntranceBinding')
export class EnemyEntranceBinding {
    @property({ tooltip: 'Entrance id. 1 and 3 close after their wall completes; 2 stays open.' })
    id = 2;

    @property({ type: Node, tooltip: 'World marker on the exterior side of this stair.' })
    outside: Node | null = null;

    @property({ type: Node, tooltip: 'World marker on the castle/interior side of this stair.' })
    inside: Node | null = null;

    @property({ type: Node, tooltip: 'Optional wall plot root that closes this entrance when built.' })
    closePlot: Node | null = null;

    @property({ tooltip: 'Passage width in world units.' })
    width = GameConfig.enemyEntranceWidth;

    @property({ tooltip: 'Initial open state. Entrance 2 should remain open.' })
    open = true;
}

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

    @property({ type: Node, tooltip: '左侧刷怪点' })
    leftSpawnRoot: Node | null = null;

    @property({ type: Node, tooltip: '右侧刷怪点' })
    rightSpawnRoot: Node | null = null;

    @property({ type: Node, tooltip: 'NavBounds min marker. Optional; defaults to GameConfig bounds.' })
    navBoundsMin: Node | null = null;

    @property({ type: Node, tooltip: 'NavBounds max marker. Optional; defaults to GameConfig bounds.' })
    navBoundsMax: Node | null = null;

    @property({ type: [Node], tooltip: 'CastleArea polygon markers in world XY order.' })
    castleArea: Node[] = [];

    @property({ type: [Node], tooltip: 'Walkable ground polygon markers in world XY order. Navigation fails closed when unset.' })
    walkableGround: Node[] = [];

    @property({ type: [EnemyEntranceBinding], tooltip: 'Three stair entrances; id 2 is permanently open.' })
    entrances: EnemyEntranceBinding[] = [];

    private _timer = 0;
    private _alive = 0;
    /** 远端刷怪开局直接启用 */
    private _farActive = false;
    private _leftStopped = false;
    private _rightStopped = false;
    private _leftSpawnRoot: Node | null = null;
    private _rightSpawnRoot: Node | null = null;
    private readonly _pool: EnemyMinion[] = [];
    private readonly _spawnOrigin = new Map<EnemyMinion, Node>();
    private readonly _spawnGeneration = new Map<EnemyMinion, number>();
    private readonly _pendingRespawn = new Set<EnemyMinion>();
    private readonly _spawnCursor = new Map<string, number>();
    private readonly _spawnPoints: Node[] = [];
    private _navigationConfigKey = '';

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
        EventManager.instance.onEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
    }

    start(): void {
        this._resolveTarget();
        this._configureNavigation();
        this._activateFarSpawning();
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        this.unscheduleAllCallbacks();
        EnemyNavigation.get(this.node.scene)?.destroy();
    }

    setTarget(target: Node | null): void {
        this.target = target;
        this._syncTargetToSpawned();
    }

    update(dt: number): void {
        this._resolveTarget();
        this._syncTargetToSpawned();
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
        if (!this._spawnAt(this._nextSpawnPoint(point))) {
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
        this._pendingRespawn.delete(minion);
        this._spawnGeneration.set(minion, (this._spawnGeneration.get(minion) ?? 0) + 1);
        minion.node.setWorldPosition(point.worldPosition);
        minion.reset();
        minion.setForceChaseTarget(true);
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
        if (this._pendingRespawn.has(minion)) {
            return;
        }
        this._pendingRespawn.add(minion);
        this._alive = Math.max(0, this._alive - 1);
        const origin = this._spawnOrigin.get(minion) ?? this.spawnPoint;
        const generation = this._spawnGeneration.get(minion) ?? 0;
        this.scheduleOnce(() => {
            this._pendingRespawn.delete(minion);
            if (!minion?.isValid || !origin?.isValid) {
                return;
            }
            if (minion.node.activeInHierarchy || this._spawnGeneration.get(minion) !== generation) {
                return;
            }
            if (this._alive >= GameConfig.poolMaxEnemies) {
                return;
            }
            this._spawnGeneration.set(minion, generation + 1);
            minion.node.setWorldPosition(origin.worldPosition);
            minion.reset();
            minion.setForceChaseTarget(true);
            minion.setTarget(this.target);
            minion.onReturnedToPool = (m) => this._onMinionDied(m);
            minion.node.active = true;
            this._alive += 1;
        }, GameConfig.enemyRespawnDelay);
    };

    private _activateFarSpawning(): void {
        if (this._farActive) {
            return;
        }
        this._resolveTarget();
        this._farActive = true;
        this._timer = 0;
        if (this.leftSpawnRoot) {
            this.leftSpawnRoot.active = true;
            this._startSideSpawning(this.leftSpawnRoot, 'left');
        }
        if (this.rightSpawnRoot) {
            this.rightSpawnRoot.active = true;
            this._startSideSpawning(this.rightSpawnRoot, 'right');
        }
        if (this.spawnPoint) {
            this._trySpawnAt(this.spawnPoint);
        }
    }

    private _nextSpawnPoint(root: Node): Node {
        const points = this._collectSpawnPoints(root);
        const key = root.uuid;
        const next = this._spawnCursor.get(key) ?? 0;
        const point = points[next % points.length] ?? root;
        this._spawnCursor.set(key, (next + 1) % Math.max(1, points.length));
        return point;
    }

    private _collectSpawnPoints(root: Node): Node[] {
        this._spawnPoints.length = 0;
        if (root.activeInHierarchy) {
            this._spawnPoints.push(root);
        }
        for (const child of root.children) {
            if (!child.activeInHierarchy) {
                continue;
            }
            if (child.name.startsWith('SpawnPoint_')) {
                this._spawnPoints.push(child);
            }
        }
        if (this._spawnPoints.length === 0) {
            this._spawnPoints.push(root);
        }
        return this._spawnPoints;
    }

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
        if (payload?.buildType === 'wall') {
            EnemyNavigation.get(this.node.scene)?.syncClosedEntranceFromPlot(
                (payload as { plotRoot?: Node }).plotRoot ?? null,
                side,
            );
            EventManager.instance.emitEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED);
        }
        if (side === 'left' || side === 'right') {
            this.stopSide(side);
        }
    };

    private _resolveTarget(): void {
        if (this.target?.isValid) {
            return;
        }
        this.target = this.node.scene?.getComponentInChildren(Player)?.node ?? null;
    }

    private _syncTargetToSpawned(): void {
        if (!this.target?.activeInHierarchy) {
            return;
        }
        for (const minion of this._pool) {
            if (!minion?.isValid || !minion.node.activeInHierarchy) {
                continue;
            }
            minion.setForceChaseTarget(true);
            minion.setTarget(this.target);
        }
    }

    private _configureNavigation(): void {
        const service = EnemyNavigation.get(this.node.scene);
        if (!service) {
            return;
        }
        const key = this._navigationConfigSignature();
        if (key === this._navigationConfigKey) {
            return;
        }
        this._navigationConfigKey = key;
        service.configure({
            boundsMin: this.navBoundsMin,
            boundsMax: this.navBoundsMax,
            castlePolygon: this.castleArea,
            walkablePolygon: this.walkableGround,
            entrances: this.entrances.map((e) => ({
                id: e.id,
                outside: e.outside,
                inside: e.inside,
                closePlot: e.closePlot,
                width: e.width,
                open: e.id === 2 ? true : e.open,
            })),
        });
    }

    private _navigationConfigSignature(): string {
        const parts = [
            this.navBoundsMin?.uuid ?? '',
            this.navBoundsMax?.uuid ?? '',
            ...this.castleArea.map((n) => n?.uuid ?? ''),
            ...this.walkableGround.map((n) => n?.uuid ?? ''),
            ...this.entrances.map((e) =>
                [
                    e.id,
                    e.outside?.uuid ?? '',
                    e.inside?.uuid ?? '',
                    e.closePlot?.uuid ?? '',
                    e.width,
                    e.id === 2 ? true : e.open,
                ].join(':'),
            ),
        ];
        return parts.join('|');
    }
}
