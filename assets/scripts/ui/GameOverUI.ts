import { _decorator, Component, Node } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';

const { ccclass, property } = _decorator;

/**
 * 游戏结束 UI：听 PHASE_CHANGED(GameOver) 显示；Next Level 按钮占位回调。
 * 无 UIManager 时本组件自订事件；完整编排见 §5.9。
 */
@ccclass('GameOverUI')
export class GameOverUI extends Component {
    @property({ type: Node, tooltip: '可视根（默认自身）' })
    panelRoot: Node | null = null;

    @property({ type: Node, tooltip: 'Next Level 按钮节点' })
    nextButton: Node | null = null;

    /** 外部可注册：点 Next 时回调（重开/下一关留给后续） */
    public onNextLevel: (() => void) | null = null;

    onLoad(): void {
        if (!this.panelRoot) {
            this.panelRoot = this.node;
        }
        this._setVisible(false);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        if (this.nextButton) {
            this.nextButton.on(Node.EventType.TOUCH_END, this._onNext, this);
        }
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        if (this.nextButton) {
            this.nextButton.off(Node.EventType.TOUCH_END, this._onNext, this);
        }
    }

    show(): void {
        this._setVisible(true);
    }

    hide(): void {
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
        if (this.panelRoot) {
            this.panelRoot.active = visible;
        }
    }
}
