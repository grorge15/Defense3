import { _decorator, Component, Node, Vec3 } from 'cc';
import { BuildPlot } from '../building/BuildPlot';
import { BuildSystem } from '../building/BuildSystem';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { Log } from '../item/Log';
import { LogExtendItem } from '../item/LogExtendItem';
import { GuideIndicatorUI } from '../ui/GuideIndicatorUI';
import { CoinSystem } from './CoinSystem';
import { GameManager } from './GameManager';
import { GamePhase } from './GamePhase';

const { ccclass, property } = _decorator;

type GuideStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type BuildPayload = { plotRoot?: Node };

const PLOT_NAMES = {
    wallLeft: 'Plot_Wall_L',
    wallRight: 'Plot_Wall_R',
    towerLeft: 'Plot_Tower_1',
    towerRight: 'Plot_Tower_2',
    barracks: 'Plot_Barracks',
    shrine: 'Plot_HeroShrine',
    expand: 'Plot_Expand',
    advancedLeft: 'Plot_TowerAdvanced_L',
    advancedRight: 'Plot_TowerAdvanced_R',
} as const;

/** Observes existing progression and exposes exactly one non-blocking guide target. */
@ccclass('CombatGuideController')
export class CombatGuideController extends Component {
    @property({ type: Player, tooltip: '玩家；空则场景内查找' })
    player: Player | null = null;

    @property({ type: Log, tooltip: '滚木；空则场景内查找' })
    log: Log | null = null;

    @property({ type: BuildSystem, tooltip: '建造系统；空则场景内查找' })
    buildSystem: BuildSystem | null = null;

    @property({ type: CoinSystem, tooltip: '金币系统；空则场景内查找' })
    coinSystem: CoinSystem | null = null;

    @property({ type: GuideIndicatorUI, tooltip: '预摆引导 UI；空则场景内查找' })
    guideIndicator: GuideIndicatorUI | null = null;

    private _step: GuideStep = 1;
    private _growthCollected = false;
    private _stopped = false;
    private _dirty = true;
    private _timer = 0;
    private _target: Node | null = null;
    private _targetIsEnemy = false;
    private readonly _completedPlots = new Set<Node>();
    private readonly _playerPosition = new Vec3();
    private readonly _candidatePosition = new Vec3();

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.LOG_EXTEND_ITEM_CONSUMED, this._onGrowthConsumed, this);
        EventManager.instance.onEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        EventManager.instance.onEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        EventManager.instance.onEvent(GameEvents.LOG_FAILED, this._onLogFailed, this);
    }

    start(): void {
        this._resolveRefs();
        this._syncProgress();
        this._dirty = true;
    }

    onDisable(): void {
        this._clearPresentation();
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_EXTEND_ITEM_CONSUMED, this._onGrowthConsumed, this);
        EventManager.instance.offEvent(GameEvents.BUILD_COMPLETE, this._onBuildComplete, this);
        EventManager.instance.offEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_FAILED, this._onLogFailed, this);
        this._clearPresentation();
    }

    update(dt: number): void {
        if (this._isTerminal()) {
            this._stopped = true;
            this._clearPresentation();
            return;
        }
        this._timer += Math.max(0, dt);
        if (!this._dirty && this._timer < GameConfig.guideTargetRefreshInterval) return;
        this._timer = 0;
        this._dirty = false;
        this._resolveRefs();
        this._syncProgress();
        this._selectTarget();
    }

    /** SceneSetup calls this after its idempotent reference resolution. */
    public bindSceneRefs(player: Player | null, log: Log | null, buildSystem: BuildSystem | null, coinSystem: CoinSystem | null, guideIndicator: GuideIndicatorUI | null): void {
        this.player ??= player;
        this.log ??= log;
        this.buildSystem ??= buildSystem;
        this.coinSystem ??= coinSystem;
        this.guideIndicator ??= guideIndicator;
        this._dirty = true;
    }

    /** Minimal diagnostic snapshot for targeted tests and editor troubleshooting. */
    public getGuideSnapshot(): { step: number; targetName: string | null; divertingToEnemy: boolean; stopped: boolean } {
        return { step: this._step, targetName: this._target?.name ?? null, divertingToEnemy: this._targetIsEnemy, stopped: this._stopped };
    }

    private _onPhaseChanged = (): void => { this._dirty = true; };

    private _onGrowthConsumed = (...args: unknown[]): void => {
        const item = args[0] as LogExtendItem | undefined;
        const affectedLog = args[1] as Log | undefined;
        if (item && affectedLog && affectedLog === this.log) {
            this._growthCollected = true;
            this._dirty = true;
        }
    };

    private _onBuildComplete = (...args: unknown[]): void => {
        const plotRoot = (args[0] as BuildPayload | undefined)?.plotRoot;
        if (plotRoot) this._completedPlots.add(plotRoot);
        this._dirty = true;
    };

    private _onCoinChanged = (): void => { this._dirty = true; };
    private _onLogFailed = (): void => { this._stopped = true; this._clearPresentation(); };

    private _resolveRefs(): void {
        const scene = this.node.scene;
        if (!scene) return;
        this.player ??= scene.getComponentInChildren(Player);
        this.log ??= scene.getComponentInChildren(Log);
        this.buildSystem ??= scene.getComponentInChildren(BuildSystem);
        this.coinSystem ??= scene.getComponentInChildren(CoinSystem);
        this.guideIndicator ??= scene.getComponentInChildren(GuideIndicatorUI);
    }

    private _syncProgress(): void {
        if (this.log?.getPhase() === 'fixed') {
            this._growthCollected = true;
            this._step = Math.max(this._step, 3) as GuideStep;
        }
        if (this.player?.hasBow) this._step = Math.max(this._step, 4) as GuideStep;
        this._advanceCompletedSteps();
    }

    private _advanceCompletedSteps(): void {
        while (this._step <= 10 && this._isStepComplete(this._step)) this._step = (this._step + 1) as GuideStep;
        if (this._step > 10) { this._stopped = true; this._clearPresentation(); }
    }

    private _isStepComplete(step: GuideStep): boolean {
        if (step === 1) return this._growthCollected;
        if (step === 2) return this.log?.getPhase() === 'fixed';
        if (step === 3) return !!this.player?.hasBow;
        const name = this._stepPlotName(step);
        return !!name && this._isPlotComplete(this._findNode(name));
    }

    private _selectTarget(): void {
        if (this._stopped || !this.player?.node?.isValid) { this._clearPresentation(); return; }
        this._advanceCompletedSteps();
        if (this._stopped) return;
        const target = this._resolveStepTarget();
        const plot = target?.getComponentInChildren(BuildPlot) ?? null;
        const divert = !!plot && this._isPurchasable(target) && this._isShortOnFunds(plot);
        this._targetIsEnemy = divert;
        this._target = divert ? this._findNearestEnemy() : target;
        this.guideIndicator?.present(this.player.node, this._target, !!this._target);
    }

    private _resolveStepTarget(): Node | null {
        if (this._step === 1) return this._findNearestGrowthItem();
        if (this._step === 2) return this._findNode('LogFixPoint');
        if (this._step === 3) return this._findBowNode();
        if (this._step === 4) {
            const leftWall = this._findNode(PLOT_NAMES.wallLeft);
            if (!this._isPlotComplete(leftWall)) return this._isPurchasable(leftWall) ? leftWall : null;
            const rightWall = this._findNode(PLOT_NAMES.wallRight);
            if (!this._isPlotComplete(rightWall)) return this._isPurchasable(rightWall) ? rightWall : null;
        }
        const plotName = this._stepPlotName(this._step);
        const plotRoot = plotName ? this._findNode(plotName) : null;
        return this._isPurchasable(plotRoot) ? plotRoot : null;
    }

    private _stepPlotName(step: GuideStep): string | null {
        switch (step) {
            case 4: return PLOT_NAMES.towerLeft;
            case 5: return PLOT_NAMES.towerRight;
            case 6: return PLOT_NAMES.barracks;
            case 7: return PLOT_NAMES.shrine;
            case 8: return PLOT_NAMES.expand;
            case 9: return PLOT_NAMES.advancedLeft;
            case 10: return PLOT_NAMES.advancedRight;
            default: return null;
        }
    }

    private _isPlotComplete(plotRoot: Node | null): boolean {
        return !!plotRoot && (this._completedPlots.has(plotRoot) || this.buildSystem?.hasCompletedPlot(plotRoot) === true);
    }

    private _isPurchasable(plotRoot: Node | null): plotRoot is Node {
        return !!plotRoot && plotRoot.isValid && plotRoot.activeInHierarchy && !!plotRoot.getComponentInChildren(BuildPlot);
    }

    private _isShortOnFunds(plot: BuildPlot): boolean {
        return (this.coinSystem?.balance ?? 0) + GameConfig.guideFloatTolerance < plot.getRemainingCost();
    }

    private _findNearestGrowthItem(): Node | null {
        const items = this.node.scene?.getComponentsInChildren(LogExtendItem) ?? [];
        return this._nearest(items.filter((item) => item.node.isValid && item.node.activeInHierarchy && !item.isConsumed).map((item) => item.node));
    }

    private _findNearestEnemy(): Node | null {
        const scene = this.node.scene;
        if (!scene) return null;
        const minions = scene.getComponentsInChildren(EnemyMinion).filter((enemy) => enemy.node.isValid && enemy.node.activeInHierarchy && !enemy.isDead).map((enemy) => enemy.node);
        const bosses = scene.getComponentsInChildren(EnemyBoss).filter((enemy) => enemy.node.isValid && enemy.node.activeInHierarchy && !enemy.isDead).map((enemy) => enemy.node);
        return this._nearest([...minions, ...bosses]);
    }

    private _nearest(candidates: Node[]): Node | null {
        if (!this.player) return null;
        this.player.node.getWorldPosition(this._playerPosition);
        let best: Node | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            candidate.getWorldPosition(this._candidatePosition);
            const dx = this._candidatePosition.x - this._playerPosition.x;
            const dy = this._candidatePosition.y - this._playerPosition.y;
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance - GameConfig.guideFloatTolerance || (Math.abs(distance - bestDistance) <= GameConfig.guideFloatTolerance && candidate.name < (best?.name ?? ''))) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best;
    }

    private _findBowNode(): Node | null {
        const scene = this.node.scene;
        if (!scene) return null;
        const walk = (node: Node): Node | null => {
            if (node.name === 'pref_item_bow' && node.activeInHierarchy) return node;
            for (const child of node.children) { const found = walk(child); if (found) return found; }
            return null;
        };
        return walk(scene);
    }

    private _findNode(name: string): Node | null {
        const scene = this.node.scene;
        if (!scene) return null;
        const walk = (node: Node): Node | null => {
            if (node.name === name) return node;
            for (const child of node.children) { const found = walk(child); if (found) return found; }
            return null;
        };
        return walk(scene);
    }

    private _isTerminal(): boolean {
        return this._stopped || this.player?.isDead === true || this.log?.getPhase() === 'failed' || GameManager.instance?.getPhase() === GamePhase.GameOver;
    }

    private _clearPresentation(): void {
        this._target = null;
        this._targetIsEnemy = false;
        this.guideIndicator?.present(this.player?.node ?? null, null, false);
    }
}
