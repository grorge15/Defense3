import { _decorator, Component, ERigidBody2DType, Node, RigidBody2D, Vec2, Vec3 } from 'cc';
import { playAnim } from '../core/AnimUtil';
import { GameConfig } from '../core/GameConfig';
import { CombatSystem } from '../game/CombatSystem';
import { HealthSystem } from '../game/HealthSystem';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from '../game/GamePhase';
import type { Log } from '../item/Log';

const { ccclass, property } = _decorator;

export type PlayerMode = 'parkour' | 'defense';

/**
 * 玩家移动：用节点位移驱动（XY），刚体仅保留碰撞（Kinematic）。
 * 避免 Dynamic + linearVelocity 在本项目物理配置下完全不位移。
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
    private readonly _tmpPos = new Vec3();
    private _hasBow = false;
    private _isDead = false;
    private _canMove = true;
    private _currentLocomotionClip = '';
    private _boundLog: Log | null = null;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
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
    }

    start(): void {
        if (!this._combat && this.node.scene) {
            this._combat = this.node.scene.getComponentInChildren(CombatSystem);
        }
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
    }

    get hasBow(): boolean {
        return this._hasBow;
    }

    get isDead(): boolean {
        return this._isDead;
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

    /** 由 CombatSystem 在真正开射时调用，避免与自动射击重复播动画逻辑散落 */
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

    /** 保持对外 API：SawTrap / EnemyMinion / Boss 仍调此方法 */
    takeDamage(amount: number): void {
        if (this._isDead) {
            return;
        }
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

        if (this._velocity.x !== 0 || this._velocity.y !== 0) {
            this.node.getPosition(this._tmpPos);
            this._tmpPos.x += this._velocity.x * dt;
            this._tmpPos.y += this._velocity.y * dt;
            this.node.setPosition(this._tmpPos);
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
        this.setMode('defense');
    };

    private _die(): void {
        this._isDead = true;
        this._canMove = false;
        this._velocity.set(0, 0);
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
