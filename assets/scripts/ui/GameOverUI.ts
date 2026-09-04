import { _decorator, Component, Node } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';

const { ccclass, property } = _decorator;

/**
 * 游戏结束 UI：听 PHASE_CHANGED(GameOver) 显示；Next Level 按钮占位回调。
 */
@ccclass('GameOverUI')
export class GameOverUI extends Component {
    @property({ type: Node, tooltip: '可视根（默认自身）' })
    panelRoot: Node | null = null;

    @property({ type: Node, tooltip: 'Next Level 按钮节点' })
    nextButton: Node | null = null;

    /** 外部可注册：点 Next 时回调（重开/下一关留给后续） */
    public onNextLevel: (() => void) | null = null;

    private _listening = false;
    private _nextBound = false;

    onLoad(): void {
        this.ensureReady();
    }

    onDestroy(): void {
        if (this._listening) {
            EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
            this._listening = false;
        }
        if (this.nextButton && this._nextBound) {
            this.nextButton.off(Node.EventType.TOUCH_END, this._onNext, this);
            this._nextBound = false;
        }
    }

    /**
     * 场景实例常开局 `_active=false`，onLoad 不跑则听不到 PHASE_CHANGED。
     * UIManager 在 show 前调用。
     */
    ensureReady(): void {
        if (!this.panelRoot) {
            this.panelRoot = this.node;
        }
        if (this.nextButton && !this._nextBound) {
            this.nextButton.on(Node.EventType.TOUCH_END, this._onNext, this);
            this._nextBound = true;
        }
        if (this._listening) {
            return;
        }
        this._listening = true;
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
    }

    show(): void {
        this.ensureReady();
        this._setVisible(true);
    }

    hide(): void {
        this.ensureReady();
        this._setVisible(false);
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        if (args[0] === GamePhase.GameOver || args[0] === 'game_over') {
            this.show();
        }
    };

    private _onNext = (): void => {
        this.onNextLevel?.();
        console.log('[GameOverUI] Next Level pressed (handler optional)');
    };

    private _setVisible(visible: boolean): void {
        if (visible) {
            this.node.active = true;
        }
        if (this.panelRoot) {
            this.panelRoot.active = visible;
        } else {
            this.node.active = visible;
        }
    }
}
