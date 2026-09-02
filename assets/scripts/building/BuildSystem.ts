import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { Hero } from '../character/Hero';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { CoinSystem } from '../game/CoinSystem';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';
import { Barracks } from './Barracks';
import { BuildPlot, BuildPlotType } from './BuildPlot';
import { HeroShrine } from './HeroShrine';
import { Tower } from './Tower';
import { Wall } from './Wall';

const { ccclass, property } = _decorator;

type BuildCompletePayload = {
    buildType?: BuildPlotType | string;
    spawnSide?: '' | 'left' | 'right' | string;
    worldPosition?: Vec3;
};

/**
 * 建造编排：LOG_FIXED 解锁墙地块 → 建墙 → 两墙 BOTH_WALLS_COMPLETE
 * → 塔/兵营 → 兵营后 Plot_HeroShrine → 建碑 activate → 选英雄后 Plot_Expand
 * → expandArea 完成激活 Barrier / ExpandSideWalls / 高级塔地块。
 */
@ccclass('BuildSystem')
export class BuildSystem extends Component {
    @property({ type: [Node], tooltip: '墙地块根：Plot_Wall_L/R' })
    wallPlots: Node[] = [];

    @property({ type: [Node], tooltip: '初级塔地块根：Plot_Tower_1/2' })
    towerPlots: Node[] = [];

    @property({ type: [Node], tooltip: '兵营地块根：Plot_Barracks' })
    barracksPlots: Node[] = [];

    @property({ type: [Node], tooltip: '英雄碑地块：Plot_HeroShrine' })
    heroShrinePlots: Node[] = [];

    @property({ type: [Node], tooltip: '拓展地块：Plot_Expand' })
    expandPlots: Node[] = [];

    @property({ type: [Node], tooltip: '高级塔地块：Plot_TowerAdvanced_L/R' })
    towerAdvancedPlots: Node[] = [];

    @property({ type: Prefab, tooltip: 'pref_wall' })
    wallPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_tower_basic' })
    towerBasicPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_barracks' })
    barracksPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_shrine' })
    heroShrinePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_01（注入召唤碑）' })
    heroPrefab01: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_02（注入召唤碑）' })
    heroPrefab02: Prefab | null = null;

    @property({ type: Node, tooltip: 'Stairs 左墙生成锚点' })
    wallSpawnLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Stairs 右墙生成锚点' })
    wallSpawnRight: Node | null = null;

    @property({ type: Node, tooltip: '建筑实例父节点；空则用本节点' })
    buildingRoot: Node | null = null;

    @property({ type: Node, tooltip: '玩家节点（英雄 setFollowTarget）' })
    playerNode: Node | null = null;

    @property({ type: Node, tooltip: 'BarrierWall_L' })
    barrierWallL: Node | null = null;

    @property({ type: Node, tooltip: 'BarrierWall_R' })
    barrierWallR: Node | null = null;

    @property({ type: Node, tooltip: 'BarrierLong_Center' })
    barrierLongCenter: Node | null = null;

    @property({ type: Node, tooltip: 'ExpandSideWalls' })
    expandSideWalls: Node | null = null;

    @property({ type: CoinSystem, tooltip: '金币系统；空则运行时查找' })
    coinSystem: CoinSystem | null = null;

    private _wallLeftDone = false;
    private _wallRightDone = false;
    private _bothWallsEmitted = false;
    private _advLeftDone = false;
    private _advRightDone = false;
    private _bothAdvEmitted = false;
    private readonly _spawnPos = new Vec3();

    onLoad(): void {
        this._ensureInitialHidden();
        this._wirePlots();
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
        EventManager.instance.onEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        EventManager.instance.onEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        // 预留：外部若已 emit BOTH_ADVANCED_TOWERS_COMPLETE，仍切 Ultimate
        EventManager.instance.onEvent(
            GameEvents.BOTH_ADVANCED_TOWERS_COMPLETE,
            this._onBothAdvancedTowersComplete,
            this,
        );
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
        EventManager.instance.offEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        EventManager.instance.offEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        EventManager.instance.offEvent(
            GameEvents.BOTH_ADVANCED_TOWERS_COMPLETE,
            this._onBothAdvancedTowersComplete,
            this,
        );
    }

    private _onLogFixed = (): void => {
        this._revealPlots(this.wallPlots, 'wall');
    };

    private _onBuildComplete = (...args: unknown[]): void => {
        const payload = (args[0] ?? {}) as BuildCompletePayload;
        const buildType = payload.buildType;
        const spawnSide = payload.spawnSide ?? '';
        const worldPos = payload.worldPosition;

        if (buildType === 'wall') {
            this._spawnWall(spawnSide, worldPos);
            if (spawnSide === 'left') {
                this._wallLeftDone = true;
            } else if (spawnSide === 'right') {
                this._wallRightDone = true;
            }
            if (this._wallLeftDone && this._wallRightDone) {
                this._onBothWallsComplete();
            }
            return;
        }

        if (buildType === 'towerBasic') {
            this._spawnTower(worldPos);
            return;
        }

        if (buildType === 'barracks') {
            this._spawnBarracks(worldPos);
            this._revealPlots(this.heroShrinePlots, 'heroShrine');
            return;
        }

        if (buildType === 'heroShrine') {
            this._spawnHeroShrine(worldPos);
            return;
        }

        if (buildType === 'expandArea') {
            this._onExpandComplete();
            return;
        }

        if (buildType === 'towerAdvanced') {
            this._onAdvancedTowerBuilt(spawnSide, worldPos);
        }
    };

    /**
     * BuildPlot 以 (delta, paid, totalCost) 三参 emit；CoinSystem 以 (delta, balance) 两参。
     * 仅对建造扣费三参同步余额。
     */
    private _onCoinChanged = (...args: unknown[]): void => {
        const delta = args[0];
        const totalCost = args[2];
        if (typeof delta !== 'number' || delta >= 0 || typeof totalCost !== 'number') {
            return;
        }
        const cs = this._resolveCoinSystem();
        cs?.addCoins(delta);
    };

    private _onBothWallsComplete(): void {
        if (this._bothWallsEmitted) {
            return;
        }
        this._bothWallsEmitted = true;
        EventManager.instance.emitEvent(GameEvents.BOTH_WALLS_COMPLETE);
        this._revealPlots(this.towerPlots, 'towerBasic');
        this._revealPlots(this.barracksPlots, 'barracks');
    }

    private _ensureInitialHidden(): void {
        this._setPlotsActive(this.wallPlots, false);
        this._setPlotsActive(this.towerPlots, false);
        this._setPlotsActive(this.barracksPlots, false);
        this._setPlotsActive(this.heroShrinePlots, false);
        this._setPlotsActive(this.expandPlots, false);
        this._setPlotsActive(this.towerAdvancedPlots, false);
        this._setBarrierRootsActive(false);
    }

    private _wirePlots(): void {
        this._configurePlots(this.wallPlots, 'wall');
        this._configurePlots(this.towerPlots, 'towerBasic');
        this._configurePlots(this.barracksPlots, 'barracks');
        this._configurePlots(this.heroShrinePlots, 'heroShrine');
        this._configurePlots(this.expandPlots, 'expandArea');
        this._configurePlots(this.towerAdvancedPlots, 'towerAdvanced');
    }

    private _configurePlots(plots: Node[], type: BuildPlotType): void {
        for (const plotRoot of plots) {
            if (!plotRoot) {
                continue;
            }
            const bp = plotRoot.getComponentInChildren(BuildPlot);
            if (!bp) {
                continue;
            }
            bp.setBuildType(type);
            if (type === 'wall' || type === 'towerAdvanced') {
                const name = plotRoot.name;
                if (name.includes('_L') || name.endsWith('L')) {
                    bp.spawnSide = 'left';
                } else if (name.includes('_R') || name.endsWith('R')) {
                    bp.spawnSide = 'right';
                }
            }
            bp.setAvailableCoins(() => this._getBalance());
        }
    }

    private _revealPlots(plots: Node[], type: BuildPlotType): void {
        for (const plotRoot of plots) {
            if (!plotRoot) {
                continue;
            }
            plotRoot.active = true;
            for (const child of plotRoot.children) {
                child.active = true;
            }
            const bp = plotRoot.getComponentInChildren(BuildPlot);
            if (bp) {
                bp.node.active = true;
                bp.setBuildType(type);
                bp.setAvailableCoins(() => this._getBalance());
            }
        }
    }

    private _setPlotsActive(plots: Node[], active: boolean): void {
        for (const plotRoot of plots) {
            if (!plotRoot) {
                continue;
            }
            for (const child of plotRoot.children) {
                child.active = active;
            }
            const bp = plotRoot.getComponentInChildren(BuildPlot);
            if (bp) {
                bp.node.active = active;
            }
        }
    }

    private _spawnWall(spawnSide: string, worldPos?: Vec3): void {
        if (!this.wallPrefab) {
            return;
        }
        const anchor =
            spawnSide === 'left'
                ? this.wallSpawnLeft
                : spawnSide === 'right'
                  ? this.wallSpawnRight
                  : null;
        const node = this._instantiateAt(this.wallPrefab, anchor, worldPos);
        if (!node) {
            return;
        }
        const wall = node.getComponent(Wall);
        if (wall) {
            if (spawnSide === 'left' || spawnSide === 'right') {
                wall.spawnSide = spawnSide;
            }
            wall.activate();
        }
    }

    private _spawnTower(worldPos?: Vec3): void {
        if (!this.towerBasicPrefab) {
            return;
        }
        const node = this._instantiateAt(this.towerBasicPrefab, null, worldPos);
        if (!node) {
            return;
        }
        const tower = node.getComponent(Tower);
        tower?.activate();
    }

    private _spawnBarracks(worldPos?: Vec3): void {
        if (!this.barracksPrefab) {
            return;
        }
        const node = this._instantiateAt(this.barracksPrefab, null, worldPos);
        if (!node) {
            return;
        }
        const barracks = node.getComponent(Barracks);
        barracks?.activate();
    }

    private _spawnHeroShrine(worldPos?: Vec3): void {
        if (!this.heroShrinePrefab) {
            return;
        }
        const node = this._instantiateAt(this.heroShrinePrefab, null, worldPos);
        if (!node) {
            return;
        }
        const shrine = node.getComponent(HeroShrine);
        if (!shrine) {
            return;
        }
        if (this.heroPrefab01) {
            shrine.heroPrefab01 = this.heroPrefab01;
        }
        if (this.heroPrefab02) {
            shrine.heroPrefab02 = this.heroPrefab02;
        }
        shrine.onHeroSpawned = (heroNode: Node) => {
            this._onHeroSpawned(heroNode);
        };
        shrine.activate();
    }

    private _onHeroSpawned(heroNode: Node): void {
        const hero = heroNode.getComponent(Hero);
        if (hero && this.playerNode) {
            hero.setFollowTarget(this.playerNode);
        }
        this._revealPlots(this.expandPlots, 'expandArea');
    }

    private _onExpandComplete(): void {
        this._activateBarrierRoot(this.barrierWallL);
        this._activateBarrierRoot(this.barrierWallR);
        this._activateBarrierRoot(this.barrierLongCenter);
        this._activateBarrierRoot(this.expandSideWalls);
        this._revealPlots(this.towerAdvancedPlots, 'towerAdvanced');
        // 拓展完成 → 防守拓展阶段
        GameManager.instance?.setPhase(GamePhase.DefensePhase);
    }

    /** 高级塔建成追踪；两侧齐备后 emit + setPhase(Ultimate)（大招逻辑留给 4.33） */
    private _onAdvancedTowerBuilt(spawnSide: string, worldPos?: Vec3): void {
        void worldPos;
        // 优先用 spawnSide；否则按地块名推断（Plot_TowerAdvanced_L/R）
        let side = spawnSide;
        if (side !== 'left' && side !== 'right') {
            side = '';
        }
        if (!side) {
            // 无法区分则按完成次数：第一次 left，第二次 right
            if (!this._advLeftDone) {
                side = 'left';
            } else if (!this._advRightDone) {
                side = 'right';
            }
        }
        if (side === 'left') {
            this._advLeftDone = true;
        } else if (side === 'right') {
            this._advRightDone = true;
        }
        if (this._advLeftDone && this._advRightDone) {
            this._emitBothAdvancedTowers();
        }
    }

    private _emitBothAdvancedTowers(): void {
        if (this._bothAdvEmitted) {
            return;
        }
        this._bothAdvEmitted = true;
        EventManager.instance.emitEvent(GameEvents.BOTH_ADVANCED_TOWERS_COMPLETE);
        GameManager.instance?.setPhase(GamePhase.Ultimate);
    }

    private _onBothAdvancedTowersComplete = (): void => {
        // 若事件由本类发出，setPhase 已在 _emitBothAdvancedTowers；此处兜底外部触发
        GameManager.instance?.setPhase(GamePhase.Ultimate);
    };

    private _setBarrierRootsActive(active: boolean): void {
        for (const root of [
            this.barrierWallL,
            this.barrierWallR,
            this.barrierLongCenter,
            this.expandSideWalls,
        ]) {
            if (!root) {
                continue;
            }
            if (active) {
                this._activateBarrierRoot(root);
            } else {
                root.active = false;
                for (const child of root.children) {
                    child.active = false;
                }
            }
        }
    }

    private _activateBarrierRoot(root: Node | null): void {
        if (!root) {
            return;
        }
        root.active = true;
        for (const child of root.children) {
            child.active = true;
        }
    }

    private _instantiateAt(prefab: Prefab, anchor: Node | null, worldPos?: Vec3): Node | null {
        const parent = this.buildingRoot ?? this.node;
        const node = instantiate(prefab);
        parent.addChild(node);
        if (anchor) {
            node.setWorldPosition(anchor.worldPosition);
        } else if (worldPos) {
            this._spawnPos.set(worldPos.x, worldPos.y, worldPos.z);
            node.setWorldPosition(this._spawnPos);
        }
        return node;
    }

    private _getBalance(): number {
        const cs = this._resolveCoinSystem();
        return cs ? cs.balance : Number.POSITIVE_INFINITY;
    }

    private _resolveCoinSystem(): CoinSystem | null {
        if (this.coinSystem && this.coinSystem.isValid) {
            return this.coinSystem;
        }
        if (CoinSystem.instance) {
            this.coinSystem = CoinSystem.instance;
            return this.coinSystem;
        }
        const found = this.node.scene?.getComponentInChildren(CoinSystem) ?? null;
        this.coinSystem = found;
        return found;
    }
}
