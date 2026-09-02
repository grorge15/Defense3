import { _decorator, Component, Node, RigidBody2D, Vec2 } from 'cc';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import type { Log } from '../item/Log';

const { ccclass, property } = _decorator;

export type PlayerMode = 'parkour' | 'defense';

@ccclass('Player')
export class Player extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    /** 大招释放回调，供 P4/P2-013c 接清场逻辑 */
    public onUltimateCast: (() => void) | null = null;

    private _rb: RigidBody2D | null = null;
    private _hp = GameConfig.playerMaxHp;
    private _mode: PlayerMode = 'parkour';
    private readonly _moveDir = new Vec2();
    private readonly _velocity = new Vec2();
    private _hasBow = false;
    private _isDead = false;
    private _canMove = true;
    private _currentLocomotionClip = '';
    private _boundLog: Log | null = null;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    setMoveDirection(dir: Vec2): void {
        this._moveDir.set(dir);
    }

    setMode(mode: PlayerMode): void {
        this._mode = mode;
    }

    setHasBow(hasBow: boolean): void {
        this._hasBow = hasBow;
    }

    getVelocity(): Readonly<Vec2> {
        return this._velocity;
    }

    bindLog(log: Log | null): void {
        this._boundLog = log;
    }

    tryAttack(): void {
        if (!this._hasBow || this._isDead) {
            return;
        }
        void GameConfig.playerAttackDamage;
        if (this.visualNode) {
            playAnim(this.visualNode, 'meleeAttack');
        }
    }

    castUltimate(): void {
        if (this._isDead) {
            return;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'skill');
        }
        this.onUltimateCast?.();
    }

    takeDamage(amount: number): void {
        if (this._isDead) {
            return;
        }
        this._hp -= amount;
        EventManager.instance.emitEvent(GameEvents.HP_CHANGED, this._hp, GameConfig.playerMaxHp);
        if (this._hp <= 0) {
            this._die();
        }
    }

    fixedUpdate(): void {
        if (!this._canMove || !this._rb) {
            return;
        }

        if (this._mode === 'parkour') {
            this._velocity.x = this._moveDir.x * GameConfig.playerMoveSpeed;
            this._velocity.y = GameConfig.playerParkourForwardSpeed;
        } else {
            const len = this._moveDir.length();
            if (len > 0.001) {
                this._velocity.x = (this._moveDir.x / len) * GameConfig.playerMoveSpeed;
                this._velocity.y = (this._moveDir.y / len) * GameConfig.playerMoveSpeed;
            } else {
                this._velocity.x = 0;
                this._velocity.y = 0;
            }
        }
        this._rb.linearVelocity = this._velocity;
        this._updateLocomotionAnim();
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === 'defense') {
            this.setMode('defense');
        } else if (phase === 'parkour') {
            this.setMode('parkour');
        }
    };

    /** 滚木固定后即可全方向移动；电锯/加长道具随即隐藏；预置怪/黄蓝线两墙后才隐藏 */
    private _onLogFixed = (): void => {
        this.setMode('defense');
    };

    private _die(): void {
        this._isDead = true;
        this._canMove = false;
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
    }

    private _updateLocomotionAnim(): void {
        if (!this.visualNode || this._isDead) {
            return;
        }

        let clip = 'idle';
        if (this._mode === 'parkour') {
            clip = 'parkour';
        } else if (this._moveDir.lengthSqr() > 0.001) {
            clip = 'walk';
        }

        if (clip === this._currentLocomotionClip) {
            return;
        }
        this._currentLocomotionClip = clip;
        playAnim(this.visualNode, clip);
    }
}
