import { _decorator, Component, Node } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { Joystick } from './Joystick';

const { ccclass, property } = _decorator;

/**
 * 跑酷段摇杆提示：无输入超过 delay 后显示；有输入隐藏；进入 defense 后永久关闭。
 */
@ccclass('JoystickHintUI')
export class JoystickHintUI extends Component {
    @property({ type: Node, tooltip: '提示可视根（默认自身）' })
    hintRoot: Node | null = null;

    @property({ type: Joystick, tooltip: '监听输入的摇杆' })
    joystick: Joystick | null = null;

    private _idleTimer = 0;
    private _disabled = false;
    private _visible = false;

    onLoad(): void {
        if (!this.hintRoot) {
            this.hintRoot = this.node;
        }
        this._setVisible(false);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    bindJoystick(joystick: Joystick | null): void {
        this.joystick = joystick;
    }

    update(dt: number): void {
        if (this._disabled) {
            return;
        }

        const hasInput = this._hasJoystickInput();
        if (hasInput) {
            this._idleTimer = 0;
            this._setVisible(false);
            return;
        }

        this._idleTimer += dt;
        if (this._idleTimer >= GameConfig.joystickHintDelay) {
            this._setVisible(true);
        }
    }

    private _hasJoystickInput(): boolean {
        if (!this.joystick) {
            return false;
        }
        return this.joystick.getDirection().lengthSqr() > 0.0001;
    }

    private _setVisible(visible: boolean): void {
        if (this._visible === visible) {
            return;
        }
        this._visible = visible;
        if (this.hintRoot) {
            this.hintRoot.active = visible;
        }
    }

    private _disableHint(): void {
        this._disabled = true;
        this._idleTimer = 0;
        this._setVisible(false);
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === 'defense' || phase === 'defense_phase') {
            this._disableHint();
        }
    };

    private _onLogFixed = (): void => {
        this._disableHint();
    };
}
