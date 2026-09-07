import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';
import { CoinUI } from './CoinUI';
import { GameOverUI } from './GameOverUI';
import { HeroSelectUI } from './HeroSelectUI';
import { HpBarUI } from './HpBarUI';
import { Joystick } from './Joystick';
import { JoystickHintUI } from './JoystickHintUI';

const { ccclass, property } = _decorator;

export type HpBarKind = 'player' | 'enemy' | 'boss';

/**
 * UI 统一入口：阶段显隐。
 * 场景挂于 GameRoot/UI；静态关卡 UI 由 MCP 实例化，不在此 generate 布局。
 */
@ccclass('UIManager')
export class UIManager extends Component {
    private static _instance: UIManager | null = null;

    @property({ type: Node, tooltip: 'UI 父节点（默认自身，通常为 GameRoot/UI）' })
    uiRoot: Node | null = null;

    @property({ type: CoinUI })
    coinUI: CoinUI | null = null;

    @property({ type: Joystick })
    joystick: Joystick | null = null;

    @property({ type: JoystickHintUI })
    joystickHint: JoystickHintUI | null = null;

    @property({ type: HeroSelectUI })
    heroSelectUI: HeroSelectUI | null = null;

    @property({ type: GameOverUI })
    gameOverUI: GameOverUI | null = null;

    @property({ type: HpBarUI, tooltip: '玩家血条实例' })
    playerHpBar: HpBarUI | null = null;

    @property({ type: Prefab, tooltip: 'pref_ui_hp_bar_enemy' })
    enemyHpBarPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_ui_hp_bar_boss' })
    bossHpBarPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_ui_hp_bar_player（若场景未预放可运行时建）' })
    playerHpBarPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'pref_ui_game_over（若场景未预放）' })
    gameOverPrefab: Prefab | null = null;

    @property({ type: Player, tooltip: '玩家；绑血条用' })
    player: Player | null = null;

    public static get instance(): UIManager | null {
        return UIManager._instance;
    }

    onLoad(): void {
        if (UIManager._instance && UIManager._instance !== this) {
            this.destroy();
            return;
        }
        UIManager._instance = this;
        if (!this.uiRoot) {
            this.uiRoot = this.node;
        }
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
    }

    start(): void {
        this._resolveRefs();
        this._ensureGameOver();
        this._bindPlayerHp();
        this._ensureHeroSelectReady();
        this._applyPhase(this._currentPhaseFallback());
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        if (UIManager._instance === this) {
            UIManager._instance = null;
        }
    }

    /**
     * 为战斗单位生成血条并绑定目标。
     * @returns HpBarUI 或 null
     */
    spawnHpBar(kind: HpBarKind, target: Node, followAnchor: Node | null = null): HpBarUI | null {
        const parent = this.uiRoot ?? this.node;
        let prefab: Prefab | null = null;
        if (kind === 'enemy') {
            prefab = this.enemyHpBarPrefab;
        } else if (kind === 'boss') {
            prefab = this.bossHpBarPrefab;
        } else {
            prefab = this.playerHpBarPrefab;
        }
        if (!prefab) {
            console.warn(`[UIManager] spawnHpBar missing prefab for ${kind}`);
            return null;
        }

        const node = instantiate(prefab);
        parent.addChild(node);
        const bar = node.getComponent(HpBarUI);
        if (!bar) {
            node.destroy();
            return null;
        }
        const anchor = followAnchor ?? target;
        bar.bindTarget(target, anchor);
        if (kind === 'boss') {
            bar.showMaxInLabel = false;
            bar.hideWhenFull = false;
        }
        // 仅玩家本体写入 playerHpBar；滚木等复用玩家模板时勿覆盖
        if (kind === 'player' && target.getComponent(Player)) {
            this.playerHpBar = bar;
        }
        return bar;
    }

    showGameOver(): void {
        this._ensureGameOver();
        this.gameOverUI?.ensureReady();
        this.gameOverUI?.show();
    }

    hideGameOver(): void {
        this._ensureGameOver();
        this.gameOverUI?.ensureReady();
        this.gameOverUI?.hide();
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        this._applyPhase(args[0]);
    };

    private _applyPhase(phase: unknown): void {
        const p = phase;

        // 金币 / 摇杆：整局可见（GameOver 时仍可保留 HUD；结束面板盖在上层）
        this._setNodeActive(this.coinUI?.node ?? null, true);
        this._setNodeActive(this.joystick?.node ?? null, p !== GamePhase.GameOver && p !== 'game_over');

        // hint 由 JoystickHintUI 自管；此处仅保证父节点在跑酷阶段可用
        const parkour = p === GamePhase.RunParkour || p === 'run_parkour' || p === 'parkour';
        if (this.joystickHint?.node && !parkour) {
            // 不强制关 hint 根（脚本会 disable）；保持节点存在
        }

        // 英雄选择：默认隐藏，由 HeroSelectUI 自行弹出
        // 不在此强制 active=false 打断进行中的选择（仅 GameOver 时关）
        if (p === GamePhase.GameOver || p === 'game_over') {
            if (this.heroSelectUI?.node) {
                this.heroSelectUI.node.active = false;
            }
            this.showGameOver();
        } else {
            this.hideGameOver();
        }

        // 玩家血条：CombatGuide 起显示（跑酷段也可显示，便于受伤可见）
        const showPlayerHp =
            p !== GamePhase.GameOver &&
            p !== 'game_over';
        this._setNodeActive(this.playerHpBar?.node ?? null, showPlayerHp);
    }

    private _ensureGameOver(): void {
        if (!this.gameOverUI) {
            if (this.gameOverPrefab && this.uiRoot) {
                const node = instantiate(this.gameOverPrefab);
                this.uiRoot.addChild(node);
                this.gameOverUI = node.getComponent(GameOverUI);
            } else {
                this.gameOverUI = this.node.scene?.getComponentInChildren(GameOverUI) ?? null;
            }
        }
        this.gameOverUI?.ensureReady();
        // 开局常 inactive：保持隐藏但已挂 PHASE_CHANGED
        if (this.gameOverUI && this.gameOverUI.node.active) {
            const phase = this._currentPhaseFallback();
            if (phase !== GamePhase.GameOver && phase !== 'game_over') {
                this.gameOverUI.hide();
            }
        }
    }

    private _resolveRefs(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        if (!this.coinUI) {
            this.coinUI = scene.getComponentInChildren(CoinUI);
        }
        if (!this.joystick) {
            this.joystick = scene.getComponentInChildren(Joystick);
        }
        if (!this.joystickHint) {
            this.joystickHint = scene.getComponentInChildren(JoystickHintUI);
        }
        if (!this.heroSelectUI) {
            this.heroSelectUI = scene.getComponentInChildren(HeroSelectUI);
        }
        if (!this.gameOverUI) {
            this.gameOverUI = scene.getComponentInChildren(GameOverUI);
        }
        if (!this.player) {
            this.player = scene.getComponentInChildren(Player);
        }
        // playerHpBar 不自动抓取任意 HpBarUI（避免误绑小怪条）；优先由角色 prefab 内置血条负责
    }

    /** 开局 inactive 的 HeroSelect 不会跑 onLoad；提前挂上 HERO_SELECT_REQUESTED */
    private _ensureHeroSelectReady(): void {
        if (!this.heroSelectUI) {
            this.heroSelectUI = this.node.scene?.getComponentInChildren(HeroSelectUI) ?? null;
        }
        this.heroSelectUI?.ensureReady();
    }

    private _ensurePlayerHpBar(): void {
        if (this.playerHpBar) {
            return;
        }
        if (!this.player && this.node.scene) {
            this.player = this.node.scene.getComponentInChildren(Player);
        }
    }

    private _bindPlayerHp(): void {
        if (!this.playerHpBar || !this.player) {
            if (!this.player && this.node.scene) {
                this.player = this.node.scene.getComponentInChildren(Player);
            }
        }
        if (!this.playerHpBar || !this.player) {
            return;
        }
        const follow = this.player.visualNode ?? this.player.node;
        this.playerHpBar.bindTarget(this.player.node, follow);
    }

    private _setNodeActive(node: Node | null, active: boolean): void {
        if (node && node.active !== active) {
            node.active = active;
        }
    }

    private _currentPhaseFallback(): unknown {
        return GameManager.instance?.getPhase() ?? GamePhase.RunParkour;
    }
}
