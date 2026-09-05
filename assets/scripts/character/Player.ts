import {
    _decorator,
    Collider2D,
    Component,
    director,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Vec2,
} from 'cc';
import { playAnim } from '../core/AnimUtil';
import { GameConfig } from '../core/GameConfig';
import { HitFlash } from '../core/HitFlash';
import { CombatSystem } from '../game/CombatSystem';
import { HealthSystem } from '../game/HealthSystem';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

export type PlayerMode = 'parkour' | 'defense';

/**
 * 玩家移动：Dynamic + linearVelocity（零重力）；非 sensor，与 Static airWall / 固定滚木物理碰撞。
 */
@ccclass('Player')
export class Player extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    /** 大招释放回调，供 P4/P2-013c 接清场逻辑 */
    public onUltimateCast: (() => void) | null = null;

    private _rb: RigidBody2D | null = null;
    private _health: HealthSystem | null = null;
    private _combat: CombatSystem | null = null;
    private _mode: PlayerMode = 'parkour';
    private readonly _moveDir = new Vec2();
    private readonly _velocity = new Vec2();
    private _hasBow = false;
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _currentLocomotionClip = '';
    private _boundLog: Log | null = null;
    private _parkourCharging = false;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.enabledContactListener = true;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        const col = this.getComponent(Collider2D);
        if (col) {
            col.sensor = false;
        }

        this._health = this.getComponent(HealthSystem) ?? this.addComponent(HealthSystem);
        this._health.maxHp = GameConfig.playerMaxHp;
        this._health.resetHp();
        this._health.onDeath = () => this._die();

        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }

        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
        EventManager.instance.onEvent(GameEvents.LOG_FAILED, this._onLogFailed, this);
    }

    start(): void {
        if (!this._combat && this.node.scene) {
            this._combat = this.node.scene.getComponentInChildren(CombatSystem);
        }
        const phase = GameManager.instance?.getPhase();
        if (!phase || phase === GamePhase.RunParkour) {
            this.setMode('parkour');
        }
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
        EventManager.instance.offEvent(GameEvents.LOG_FAILED, this._onLogFailed, this);
    }

    get hasBow(): boolean {
        return this._hasBow;
    }

    get isDead(): boolean {
        return this._isDead;
    }

    get isAttacking(): boolean {
        return this._isAttacking;
    }

    /** 攻击动画锁：播 melee_attack 期间禁止位移动画打断出箭帧 */
    setAttacking(attacking: boolean): void {
        this._isAttacking = attacking;
        if (attacking) {
            this._currentLocomotionClip = '';
        }
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
        if (!log) {
            this._parkourCharging = false;
        }
    }

    setParkourCharging(charging: boolean): void {
        this._parkourCharging = charging;
    }

    bindCombatSystem(combat: CombatSystem | null): void {
        this._combat = combat;
    }

    tryAttack(): void {
        if (!this._hasBow || this._isDead) {
            return;
        }
        if (this._combat) {
            this._combat.tryAttack();
            return;
        }
        this.playAttackAnim();
    }

    playAttackAnim(): void {
        if (this.visualNode) {
            playAnim(this.visualNode, 'meleeAttack');
        }
    }

    castUltimate(): void {
        if (this._isDead || !this.onUltimateCast) {
            return;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'skill');
        }
        this.onUltimateCast();
    }

    /** 大招/结束时锁定移动 */
    setCanMove(enabled: boolean): void {
        this._canMove = enabled;
        if (!enabled) {
            this._moveDir.set(0, 0);
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = new Vec2(0, 0);
            }
        }
    }

    takeDamage(amount: number): void {
        if (this._isDead || amount <= 0) {
            return;
        }
        HitFlash.flash(this.visualNode ?? this.node);
        this._health?.takeDamage(amount);
    }

    heal(amount: number): void {
        if (this._isDead) {
            return;
        }
        this._health?.heal(amount);
    }

    update(dt: number): void {
        if (!this._canMove || dt <= 0) {
            return;
        }

        if (this._mode === 'parkour') {
            this._velocity.x = this._moveDir.x * GameConfig.playerMoveSpeed;
            const charging =
                this._parkourCharging || this._boundLog?.getPhase() === 'charging';
            this._velocity.y = charging
                ? GameConfig.playerParkourChargeSpeed
                : GameConfig.playerParkourForwardSpeed;
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

        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._updateLocomotionAnim();
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const mode = this._resolveModeFromPhase(args[0]);
        if (mode) {
            this.setMode(mode);
        }
    };

    private _resolveModeFromPhase(phase: unknown): PlayerMode | null {
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

    private _onLogFixed = (): void => {
        this._parkourCharging = false;
        this.setMode('defense');
    };

    private _onLogFailed = (): void => {
        this._parkourCharging = false;
        this.setMode('defense');
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
    };

    private _die(): void {
        if (this._isDead) {
            return;
        }
        this._isDead = true;
        this._canMove = false;
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
        GameManager.instance?.setGameOver();
        director.pause();
    }

    private _updateLocomotionAnim(): void {
        if (!this.visualNode || this._isDead || this._isAttacking) {
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
