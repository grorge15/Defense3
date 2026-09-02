import { _decorator, Component, EventTouch, Node, UITransform, Vec2, Vec3 } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

export type JoystickMode = 'parkour' | 'defense';

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
    private _touchId: number | null = null;
    private _bgTransform: UITransform | null = null;

    onLoad(): void {
        this._bgTransform = this.background?.getComponent(UITransform)
            ?? this.getComponent(UITransform);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
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

    getDirection(): Readonly<Vec2> {
        return this._direction;
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === 'defense' || phase === 'parkour') {
            this.setMode(phase);
        }
    };

    private _onTouchStart(event: EventTouch): void {
        if (this._touchId !== null) {
            return;
        }
        this._touchId = event.getID();
        this._updateFromTouch(event);
    }

    private _onTouchMove(event: EventTouch): void {
        if (this._touchId === null || event.getID() !== this._touchId) {
            return;
        }
        this._updateFromTouch(event);
    }

    private _onTouchEnd(event: EventTouch): void {
        if (this._touchId === null || event.getID() !== this._touchId) {
            return;
        }
        this._clearInput();
    }

    private _updateFromTouch(event: EventTouch): void {
        const transform = this._bgTransform;
        if (!transform) {
            return;
        }
        const uiLoc = event.getUILocation();
        this._tmpLocal.set(uiLoc.x, uiLoc.y, 0);
        transform.convertToNodeSpaceAR(this._tmpLocal, this._tmpLocal);
        this._constrainAndApply(this._tmpLocal.x, this._tmpLocal.y);
    }

    private _constrainAndApply(localX: number, localY: number): void {
        this._tmpDir.set(localX, localY);
        const len = this._tmpDir.length();
        const radius = Math.max(this.maxRadius, 0.0001);
        if (len > radius) {
            this._tmpDir.multiplyScalar(radius / len);
        }

        if (this._mode === 'parkour') {
            this._direction.set(this._tmpDir.x / radius, 0);
            if (this.knob) {
                this.knob.setPosition(this._tmpDir.x, 0, 0);
            }
        } else {
            this._direction.set(this._tmpDir.x / radius, this._tmpDir.y / radius);
            if (this.knob) {
                this.knob.setPosition(this._tmpDir.x, this._tmpDir.y, 0);
            }
        }
        this._applyDirectionToPlayer();
    }

    private _clearInput(): void {
        this._touchId = null;
        this._direction.set(0, 0);
        if (this.knob) {
            this.knob.setPosition(0, 0, 0);
        }
        this._applyDirectionToPlayer();
    }

    private _applyDirectionToPlayer(): void {
        this._player?.setMoveDirection(this._direction);
    }
}
