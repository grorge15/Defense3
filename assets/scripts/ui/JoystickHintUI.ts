import { _decorator, Component, EventTouch, input, Input, Node, Vec3 } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';
import { Joystick } from './Joystick';

const { ccclass, property } = _decorator;

/**
 * 摇杆提示：有输入时隐藏；无输入超过 delay 后显示。
 * 跑酷段 Knob 左右循环，塔防段保留倒 8 循环。
 */
@ccclass('JoystickHintUI')
export class JoystickHintUI extends Component {
    @property({ type: Node, tooltip: '提示可视根（默认自身）' })
    hintRoot: Node | null = null;

    @property({ type: Node, tooltip: '跑酷段左右移动的 Knob 节点' })
    knob: Node | null = null;

    @property({ type: Joystick, tooltip: '监听输入的摇杆' })
    joystick: Joystick | null = null;

    private _idleTimer = 0;
    private _visible = false;
    private _figureT = 0;
    private _mode: 'parkour' | 'defense' = 'parkour';
    private _suppressed = false;
    private readonly _basePos = new Vec3();
    private readonly _knobBasePos = new Vec3();
    private readonly _tmpPos = new Vec3();

    onLoad(): void {
        if (!this.hintRoot) {
            this.hintRoot = this.node;
        }
        if (!this.knob) {
            this.knob = this.node.getChildByName('Knob');
        }
        this._basePos.set(this.hintRoot.position);
        this._knobBasePos.set(this.knob?.position ?? Vec3.ZERO);
        this._setVisible(false);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
        input.on(Input.EventType.TOUCH_START, this._onAnyInput, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onAnyInput, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
        input.off(Input.EventType.TOUCH_START, this._onAnyInput, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onAnyInput, this);
    }

    bindJoystick(joystick: Joystick | null): void {
        this.joystick = joystick;
    }

    update(dt: number): void {
        if (this._suppressed) {
            return;
        }
        const hasInput = this._hasJoystickInput();
        if (hasInput) {
            this._idleTimer = 0;
            this._setVisible(false);
            return;
        } else {
            this._idleTimer += dt;
            if (this._idleTimer >= GameConfig.joystickHintDelay) {
                this._setVisible(true);
            }
        }

        if (this._visible) {
            this._figureT += dt;
            if (this._mode === 'parkour') {
                this._updateParkourMotion();
            } else {
                this._updateDefenseMotion();
            }
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
        this._visible = visible;
        for (const child of this.node.children) {
            child.active = visible;
        }
        if (this.hintRoot && this.hintRoot !== this.node) {
            this.hintRoot.active = visible;
        }
        if (this.hintRoot) {
            if (!visible) {
                this.hintRoot.setPosition(this._basePos);
                this.knob?.setPosition(this._knobBasePos);
                this._figureT = 0;
            }
        }
    }

    private _resetHint(): void {
        this._idleTimer = 0;
        this._figureT = 0;
        this.knob?.setPosition(this._knobBasePos);
        this.hintRoot?.setPosition(this._basePos);
        this._setVisible(false);
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === 'parkour' || phase === 'run_parkour' || phase === GamePhase.RunParkour) {
            this._suppressed = false;
            this._mode = 'parkour';
            this._resetHint();
            return;
        }
        if (
            phase === 'defense' ||
            phase === GamePhase.CombatGuide ||
            phase === GamePhase.BuildPhase1 ||
            phase === GamePhase.BuildPhase2 ||
            phase === GamePhase.DefensePhase
        ) {
            this._suppressed = false;
            this._mode = 'defense';
            this._resetHint();
            return;
        }
        if (phase === GamePhase.Ultimate || phase === GamePhase.GameOver) {
            this._suppressed = true;
            this._setVisible(false);
        }
    };

    private _onParkourFinished = (): void => {
        this._suppressed = false;
        this._mode = 'defense';
        this._resetHint();
    };

    private _onAnyInput = (_event: EventTouch): void => {
        this._idleTimer = 0;
        this._setVisible(false);
    };

    private _updateParkourMotion(): void {
        if (!this.knob) {
            return;
        }
        this.hintRoot?.setPosition(this._basePos);
        const period = Math.max(0.2, GameConfig.joystickHintFigure8Period);
        const amp = GameConfig.joystickHintFigure8Amp;
        const w = (Math.PI * 2 * this._figureT) / period;
        this._tmpPos.set(
            this._knobBasePos.x + amp * Math.sin(w),
            this._knobBasePos.y,
            this._knobBasePos.z,
        );
        this.knob.setPosition(this._tmpPos);
    }

    private _updateDefenseMotion(): void {
        if (!this.hintRoot) {
            return;
        }
        this.knob?.setPosition(this._knobBasePos);
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
