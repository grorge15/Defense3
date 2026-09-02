import { _decorator, Component, EventTouch, input, Input, Node, UITransform, Vec2, Vec3 } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';

const { ccclass, property } = _decorator;

export type JoystickMode = 'parkour' | 'defense';

/**
 * 动态摇杆：按下显示并拖拽，松开隐藏。
 * 使用全局 input（桌面鼠标会映射为 TOUCH_*），不依赖 UI 命中检测
 * （隐藏底盘/摇杆头后根节点无渲染组件，node.on(TOUCH) 收不到点击）。
 */
@ccclass('Joystick')
export class Joystick extends Component {
    @property({ type: Node, tooltip: '底盘节点' })
    background: Node | null = null;

    @property({ type: Node, tooltip: '摇杆头节点' })
    knob: Node | null = null;

    @property({ tooltip: '拖拽最大半径（本地像素）' })
    maxRadius = 80;

    private _player: Player | null = null;
    private _mode: JoystickMode = 'parkour';
    private readonly _direction = new Vec2();
    private readonly _tmpLocal = new Vec3();
    private readonly _tmpDir = new Vec2();
    private readonly _originUI = new Vec2();
    private readonly _centerLocal = new Vec3();
    private _touchId: number | null = null;
    private _rootTransform: UITransform | null = null;
    private _enabledInput = true;

    onLoad(): void {
        this._rootTransform = this.getComponent(UITransform);
        this._resolveVisualNodes();

        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);

        this._setVisualVisible(false);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        this._clearInput();
    }

    bindPlayer(player: Player | null): void {
        this._player = player;
        this._applyDirectionToPlayer();
    }

    unbindPlayer(): void {
        this._clearInput();
        this._player = null;
    }

    setMode(mode: JoystickMode): void {
        this._mode = mode;
        if (this._touchId !== null) {
            this._constrainAndApply(this._direction.x * this.maxRadius, this._direction.y * this.maxRadius);
        } else {
            this._applyDirectionToPlayer();
        }
    }

    /** GameOver 等阶段关闭全局输入 */
    setInputEnabled(enabled: boolean): void {
        this._enabledInput = enabled;
        if (!enabled) {
            this._clearInput();
        }
    }

    getDirection(): Readonly<Vec2> {
        return this._direction;
    }

    isActive(): boolean {
        return this._touchId !== null;
    }

    private _resolveVisualNodes(): void {
        if (!this.background) {
            this.background = this.node.getChildByName('Background');
        }
        if (!this.knob) {
            this.knob = this.node.getChildByName('Knob');
        }
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === GamePhase.GameOver || phase === 'game_over') {
            this.setInputEnabled(false);
        } else {
            this.setInputEnabled(true);
        }
        const mode = this._resolveModeFromPhase(phase);
        if (mode) {
            this.setMode(mode);
        }
    };

    private _resolveModeFromPhase(phase: unknown): JoystickMode | null {
        if (phase === 'parkour' || phase === GamePhase.RunParkour) {
            return 'parkour';
        }
        if (
            phase === 'defense' ||
            phase === GamePhase.CombatGuide ||
            phase === GamePhase.BuildPhase1 ||
            phase === GamePhase.BuildPhase2 ||
            phase === GamePhase.DefensePhase ||
            phase === GamePhase.Ultimate ||
            phase === GamePhase.GameOver
        ) {
            return 'defense';
        }
        return null;
    }

    private _onTouchStart(event: EventTouch): void {
        if (!this._enabledInput || !this.node.activeInHierarchy) {
            return;
        }
        if (this._touchId !== null) {
            return;
        }
        this._touchId = event.getID();
        const ui = event.getUILocation();
        this._originUI.set(ui.x, ui.y);
        this._placeVisualAtUI(ui.x, ui.y);
        this._setVisualVisible(true);
        this._constrainAndApply(0, 0);
    }

    private _onTouchMove(event: EventTouch): void {
        if (this._touchId === null || event.getID() !== this._touchId) {
            return;
        }
        const ui = event.getUILocation();
        this._constrainAndApply(ui.x - this._originUI.x, ui.y - this._originUI.y);
    }

    private _onTouchEnd(event: EventTouch): void {
        if (this._touchId === null || event.getID() !== this._touchId) {
            return;
        }
        this._clearInput();
    }

    private _constrainAndApply(dx: number, dy: number): void {
        this._tmpDir.set(dx, dy);
        const len = this._tmpDir.length();
        const radius = Math.max(this.maxRadius, 0.0001);
        if (len > radius) {
            this._tmpDir.multiplyScalar(radius / len);
        }

        if (this._mode === 'parkour') {
            this._direction.set(this._tmpDir.x / radius, 0);
            this._setKnobOffset(this._tmpDir.x, 0);
        } else {
            this._direction.set(this._tmpDir.x / radius, this._tmpDir.y / radius);
            this._setKnobOffset(this._tmpDir.x, this._tmpDir.y);
        }
        this._applyDirectionToPlayer();
    }

    private _clearInput(): void {
        this._touchId = null;
        this._direction.set(0, 0);
        this._setKnobOffset(0, 0);
        this._setVisualVisible(false);
        this._applyDirectionToPlayer();
    }

    private _applyDirectionToPlayer(): void {
        this._player?.setMoveDirection(this._direction);
    }

    private _setVisualVisible(visible: boolean): void {
        if (this.background) {
            this.background.active = visible;
        }
        if (this.knob) {
            this.knob.active = visible;
        }
    }

    private _setKnobOffset(ox: number, oy: number): void {
        if (!this.knob) {
            return;
        }
        this.knob.setPosition(this._centerLocal.x + ox, this._centerLocal.y + oy, this._centerLocal.z);
    }

    private _placeVisualAtUI(uiX: number, uiY: number): void {
        const root = this._rootTransform;
        if (!root) {
            // 无 UITransform 时退回父节点本地原点附近
            this._centerLocal.set(0, 0, 0);
            if (this.background) {
                this.background.setPosition(this._centerLocal);
            }
            this._setKnobOffset(0, 0);
            return;
        }
        this._tmpLocal.set(uiX, uiY, 0);
        root.convertToNodeSpaceAR(this._tmpLocal, this._centerLocal);
        if (this.background) {
            this.background.setPosition(this._centerLocal);
        }
        this._setKnobOffset(0, 0);
    }
}
