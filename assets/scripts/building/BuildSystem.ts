import { _decorator, Component, instantiate, Node, Prefab, resources, Vec3 } from 'cc';
import { Hero } from '../character/Hero';
import { Player } from '../character/Player';
import { playAnimWithCallback } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { BossSpawner } from '../enemy/BossSpawner';
import { CoinSystem } from '../game/CoinSystem';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';
import { Barracks } from './Barracks';
import { Barrier } from './Barrier';
import { BuildPlot, BuildPlotType } from './BuildPlot';
import { HeroShrine } from './HeroShrine';
import { Tower } from './Tower';
import { Wall } from './Wall';
import type { BossTargetKind } from '../enemy/EnemyBoss';
import { HeroSelectUI } from '../ui/HeroSelectUI';

const { ccclass, property } = _decorator;

const VFX_BLUE_PATH = 'prefabs/VFX/pref_vfx_upgrade_blue';
const VFX_YELLOW_PATH = 'prefabs/VFX/pref_vfx_upgrade_yellow';

type BuildCompletePayload = {
    buildType?: BuildPlotType | string;
    spawnSide?: '' | 'left' | 'right' | string;
    worldPosition?: Vec3;
    /** pref_build_plot 的父节点（Plot_Wall_R 等），建成物挂于此 */
    plotRoot?: Node;
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

    @property({ type: Prefab, tooltip: 'pref_tower_advanced；空则用 basic 并 setTowerType(advanced)' })
    towerAdvancedPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_barracks' })
    barracksPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_shrine' })
    heroShrinePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_01（注入召唤碑）' })
    heroPrefab01: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_hero_02（注入召唤碑）' })
    heroPrefab02: Prefab | null = null;

    @property({ type: Prefab, tooltip: '基础建造完成特效 pref_vfx_upgrade_blue；空则 resources.load' })
    vfxUpgradeBluePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: '高级塔/英雄圣地完成特效 pref_vfx_upgrade_yellow；空则 resources.load' })
    vfxUpgradeYellowPrefab: Prefab | null = null;

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

    @property({ type: BossSpawner, tooltip: 'Boss 生成器；空则运行时查找；首座初级塔或兵营建成时 spawn' })
    bossSpawner: BossSpawner | null = null;

    private _wallLeftDone = false;
    private _wallRightDone = false;
    private _bothWallsEmitted = false;
    private _advLeftDone = false;
    private _advRightDone = false;
    private _advBuiltCount = 0;
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
        const plotRoot = payload.plotRoot;

        this._playBuildUpgradeVfx(buildType, worldPos);

        if (buildType === 'wall') {
            this._spawnWall(spawnSide, worldPos, plotRoot);
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
            this._spawnTower(worldPos, plotRoot);
            this._trySpawnBossOnFirstDefenseBuilding();
            return;
        }

        if (buildType === 'barracks') {
            this._spawnBarracks(worldPos, plotRoot);
            this._trySpawnBossOnFirstDefenseBuilding();
            this._revealPlots(this.heroShrinePlots, 'heroShrine');
            return;
        }

        if (buildType === 'heroShrine') {
            this._spawnHeroShrine(worldPos, plotRoot);
            return;
        }

        if (buildType === 'expandArea') {
            this._onExpandComplete();
            return;
        }

        if (buildType === 'towerAdvanced') {
            this._onAdvancedTowerBuilt(spawnSide, worldPos, plotRoot);
        }
    };

    /**
     * BuildPlot 已直接扣 CoinSystem 时不再二次扣费。
     * 仅兼容无 CoinSystem.instance、仍发三参事件的兜底路径。
     */
    private _onCoinChanged = (...args: unknown[]): void => {
        if (CoinSystem.instance) {
            return;
        }
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

    /** 首座初级箭塔或兵营建成后生成 Boss（只一次） */
    private _trySpawnBossOnFirstDefenseBuilding(): void {
        const spawner =
            this.bossSpawner ??
            this.node.scene?.getComponentInChildren(BossSpawner) ??
            null;
        this.bossSpawner = spawner;
        spawner?.trySpawnFirst();
    }

    private _ensureInitialHidden(): void {
        this._resolveWallPlotsIfEmpty();
        // 墙地块开局保持可见（可站上去蓄建造）；其余地块仍隐藏，按阶段 reveal
        this._setPlotsActive(this.wallPlots, true);
        this._configurePlots(this.wallPlots, 'wall');
        this._setPlotsActive(this.towerPlots, false);
        this._setPlotsActive(this.barracksPlots, false);
        this._setPlotsActive(this.heroShrinePlots, false);
        this._setPlotsActive(this.expandPlots, false);
        this._setPlotsActive(this.towerAdvancedPlots, false);
        this._setBarrierRootsActive(false);
    }

    /** Inspector 未绑 wallPlots 时按节点名兜底 */
    private _resolveWallPlotsIfEmpty(): void {
        if (this.wallPlots.length > 0 || !this.node.scene) {
            return;
        }
        const found: Node[] = [];
        const walk = (n: Node) => {
            if (n.name === 'Plot_Wall_L' || n.name === 'Plot_Wall_R') {
                found.push(n);
            }
            for (const c of n.children) {
                walk(c);
            }
        };
        walk(this.node.scene);
        this.wallPlots = found;
    }

    private _setPlotsActive(plots: Node[], active: boolean): void {
        for (const plotRoot of plots) {
            if (!plotRoot) {
                continue;
            }
            plotRoot.active = active;
            for (const child of plotRoot.children) {
                child.active = active;
            }
            const bp = plotRoot.getComponentInChildren(BuildPlot);
            if (bp) {
                bp.node.active = active;
            }
        }
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
    }

    private _spawnWall(spawnSide: string, worldPos?: Vec3, plotRoot?: Node): void {
        if (!this.wallPrefab) {
            return;
        }
        // 优先挂在 Plot_Wall_L/R；无 plotRoot 时退回 Stairs 锚点仅定坐标
        const fallbackAnchor =
            spawnSide === 'left'
                ? this.wallSpawnLeft
                : spawnSide === 'right'
                  ? this.wallSpawnRight
                  : null;
        const node = this._instantiateAt(
            this.wallPrefab,
            plotRoot ?? null,
            worldPos,
            plotRoot ? null : fallbackAnchor,
        );
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
        // 矮墙无血量，不进 Boss 索敌表
    }

    private _spawnTower(worldPos?: Vec3, plotRoot?: Node): void {
        if (!this.towerBasicPrefab) {
            return;
        }
        const node = this._instantiateAt(this.towerBasicPrefab, plotRoot ?? null, worldPos);
        if (!node) {
            return;
        }
        const tower = node.getComponent(Tower);
        tower?.activate();
        this._registerBossTarget(node, 'building');
    }

    private _spawnBarracks(worldPos?: Vec3, plotRoot?: Node): void {
        if (!this.barracksPrefab) {
            return;
        }
        const node = this._instantiateAt(this.barracksPrefab, plotRoot ?? null, worldPos);
        if (!node) {
            return;
        }
        const barracks = node.getComponent(Barracks);
        barracks?.activate();
        this._registerBossTarget(node, 'building');
    }

    private _spawnHeroShrine(worldPos?: Vec3, plotRoot?: Node): void {
        if (!this.heroShrinePrefab) {
            return;
        }
        const node = this._instantiateAt(this.heroShrinePrefab, plotRoot ?? null, worldPos);
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
        if (!shrine.heroPrefab01 || !shrine.heroPrefab02) {
            console.warn(
                '[BuildSystem] hero prefab missing on shrine; HeroShrine will resources.load fallback',
                !!shrine.heroPrefab01,
                !!shrine.heroPrefab02,
            );
        }
        // 强制走 HeroSelectUI（监听 HERO_SELECT_REQUESTED）
        shrine.autoSelectOnActivate = false;
        shrine.onHeroSpawned = (heroNode: Node) => {
            this._onHeroSpawned(heroNode);
        };
        // 场景里 HeroSelect 常开局 inactive → onLoad 未跑、听不到事件；先挂监听再 activate
        this._ensureHeroSelectReady();
        shrine.activate();
    }

    private _ensureHeroSelectReady(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const ui = scene.getComponentInChildren(HeroSelectUI);
        ui?.ensureReady();
    }

    private _onHeroSpawned(heroNode: Node): void {
        const hero = heroNode.getComponent(Hero);
        if (hero) {
            let player = this.playerNode;
            if (!player?.isValid) {
                const scene = this.node.scene ?? heroNode.scene;
                player = scene?.getComponentInChildren(Player)?.node ?? null;
                if (player) {
                    this.playerNode = player;
                }
            }
            if (player) {
                hero.setFollowTarget(player);
            }
            // 兜底：Hero.start 若早于 UIManager 就绪，这里再确保玩家模板血条
            hero.ensureHpBar();
        }
        this._registerBossTarget(heroNode, 'hero');
        this._setPlotsActive(this.heroShrinePlots, false);
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

    /** 高级塔建成追踪；两侧齐备后 emit + setPhase(Ultimate) */
    private _onAdvancedTowerBuilt(spawnSide: string, worldPos?: Vec3, plotRoot?: Node): void {
        const prefab = this.towerAdvancedPrefab ?? this.towerBasicPrefab;
        if (prefab) {
            const node = this._instantiateAt(prefab, plotRoot ?? null, worldPos);
            const tower = node?.getComponent(Tower);
            if (tower) {
                tower.setTowerType('advanced');
                tower.activate();
            }
            if (node) {
                this._registerBossTarget(node, 'building');
            }
        }

        // 优先用地块名纠正 spawnSide（场景里 R 曾被误标 left）
        let side = this._resolveSideFromPlot(plotRoot, spawnSide);
        if (!side) {
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
        this._advBuiltCount += 1;
        if (
            (this._advLeftDone && this._advRightDone) ||
            this._advBuiltCount >= 2
        ) {
            this._emitBothAdvancedTowers();
        }
    }

    private _resolveSideFromPlot(
        plotRoot: Node | undefined,
        spawnSide: string,
    ): '' | 'left' | 'right' {
        const name = plotRoot?.name ?? '';
        if (name.includes('_L') || name.endsWith('L')) {
            return 'left';
        }
        if (name.includes('_R') || name.endsWith('R')) {
            return 'right';
        }
        if (spawnSide === 'left' || spawnSide === 'right') {
            return spawnSide;
        }
        return '';
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
        for (const barrier of root.getComponentsInChildren(Barrier)) {
            if (barrier.isAlive()) {
                this._registerBossTarget(barrier.node, 'barrier');
            }
        }
    }

    /** 建成/生成后插入 Boss 索敌表（Structure 按建造顺序） */
    private _structureBuildSeq = 0;

    private _registerBossTarget(node: Node, kind: BossTargetKind): void {
        if (!node?.isValid) {
            return;
        }
        const isStructure = kind === 'building' || kind === 'barrier' || kind === 'log';
        const buildOrder = isStructure ? ++this._structureBuildSeq : undefined;
        EventManager.instance.emitEvent(GameEvents.BOSS_TARGET_REGISTER, {
            node,
            kind,
            buildOrder,
        });
    }

    private _playBuildUpgradeVfx(buildType: BuildPlotType | string | undefined, worldPos?: Vec3): void {
        if (!buildType) {
            return;
        }
        const blueTypes: BuildPlotType[] = ['wall', 'towerBasic', 'barracks', 'expandArea'];
        const yellowTypes: BuildPlotType[] = ['towerAdvanced', 'heroShrine'];
        let kind: 'blue' | 'yellow' | null = null;
        if (blueTypes.indexOf(buildType as BuildPlotType) >= 0) {
            kind = 'blue';
        } else if (yellowTypes.indexOf(buildType as BuildPlotType) >= 0) {
            kind = 'yellow';
        }
        if (!kind) {
            return;
        }

        const clipName = kind === 'blue' ? 'upgrade_blue' : 'upgrade_yellow';
        const path = kind === 'blue' ? VFX_BLUE_PATH : VFX_YELLOW_PATH;
        const existing = kind === 'blue' ? this.vfxUpgradeBluePrefab : this.vfxUpgradeYellowPrefab;

        const spawn = (prefab: Prefab): void => {
            const parent = this.buildingRoot ?? this.node;
            const node = instantiate(prefab);
            parent.addChild(node);
            if (worldPos) {
                node.setWorldPosition(worldPos);
            }
            const visual = node.getChildByName('Visual') ?? node;
            playAnimWithCallback(visual, clipName, () => {
                if (node.isValid) {
                    node.destroy();
                }
            });
        };

        if (existing) {
            spawn(existing);
            return;
        }
        resources.load(path, Prefab, (err, prefab) => {
            if (err || !prefab) {
                console.warn(`[BuildSystem] missing upgrade vfx path=${path}`, err);
                return;
            }
            if (kind === 'blue') {
                this.vfxUpgradeBluePrefab = prefab;
            } else {
                this.vfxUpgradeYellowPrefab = prefab;
            }
            spawn(prefab);
        });
    }

    /**
     * @param plotParent 建成物父节点（优先 Plot_*）
     * @param worldPos 世界坐标；有父节点时也可本地置零
     * @param positionOnlyAnchor 无 plotParent 时用此节点世界坐标（如 Stairs 墙锚点）
     */
    private _instantiateAt(
        prefab: Prefab,
        plotParent: Node | null,
        worldPos?: Vec3,
        positionOnlyAnchor: Node | null = null,
    ): Node | null {
        const parent = plotParent ?? this.buildingRoot ?? this.node;
        const node = instantiate(prefab);
        parent.addChild(node);
        if (plotParent) {
            // 挂在 Plot_* 下：本地原点 = 地块位置
            node.setPosition(0, 0, 0);
        } else if (positionOnlyAnchor) {
            node.setWorldPosition(positionOnlyAnchor.worldPosition);
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
