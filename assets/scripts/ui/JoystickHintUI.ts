import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';
import { Joystick } from './Joystick';

const { ccclass, property } = _decorator;

/**
 * 跑酷段摇杆提示：无输入超过 delay 后显示并倒 8 循环；有输入即停并隐藏；离开跑酷永久关闭。
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
    private _figureT = 0;
    private readonly _basePos = new Vec3();
    private readonly _tmpPos = new Vec3();

    onLoad(): void {
        if (!this.hintRoot) {
            this.hintRoot = this.node;
        }
        this._basePos.set(this.hintRoot.position);
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

        if (this._visible && this.hintRoot) {
            this._figureT += dt;
            const period = Math.max(0.2, GameConfig.joystickHintFigure8Period);
            const amp = GameConfig.joystickHintFigure8Amp;
            const w = (Math.PI * 2 * this._figureT) / period;
            // 倒 8（∞）：x=sin(w), y=sin(w)cos(w)
            this._tmpPos.set(
                this._basePos.x + amp * Math.sin(w),
                this._basePos.y + amp * Math.sin(w) * Math.cos(w),
                this._basePos.z,
            );
            this.hintRoot.setPosition(this._tmpPos);
        }
    }

    private _hasJoystickInput(): boolean {
        if (!this.joystick) {
            return false;
        }
        if (this.joystick.isActive()) {
            return true;
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
            if (!visible) {
                this.hintRoot.setPosition(this._basePos);
                this._figureT = 0;
            }
        }
    }

    private _disableHint(): void {
        this._disabled = true;
        this._idleTimer = 0;
        this._setVisible(false);
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (
            phase === 'defense' ||
            phase === GamePhase.CombatGuide ||
            phase === GamePhase.BuildPhase1 ||
            phase === GamePhase.BuildPhase2 ||
            phase === GamePhase.DefensePhase ||
            phase === GamePhase.Ultimate ||
            phase === GamePhase.GameOver
        ) {
            this._disableHint();
        }
    };

    private _onLogFixed = (): void => {
        this._disableHint();
    };
}
