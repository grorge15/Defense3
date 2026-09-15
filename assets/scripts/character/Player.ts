import {
    _decorator,
    Collider2D,
    Component,
    director,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { playAnim } from '../core/AnimUtil';
import { GameConfig } from '../core/GameConfig';
import { HitFlash } from '../core/HitFlash';
import { VisualFacing } from '../core/VisualFacing';
import { CombatSystem } from '../game/CombatSystem';
import { HealthSystem } from '../game/HealthSystem';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';
import { Log } from '../item/Log';
import { HpBarUI } from '../ui/HpBarUI';

const { ccclass, property } = _decorator;

export type PlayerMode = 'parkour' | 'defense';

type ParkourPhysicsSnapshot = {
    rigidBody: RigidBody2D | null;
    rigidBodyEnabled: boolean;
    rigidBodyType: ERigidBody2DType;
    gravityScale: number;
    fixedRotation: boolean;
    allowSleep: boolean;
    enabledContactListener: boolean;
    linearVelocity: Vec2;
    angularVelocity: number;
    awake: boolean | null;
    collider: Collider2D | null;
    colliderEnabled: boolean;
    colliderSensor: boolean;
};


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
    private _parkourPhysicsSnapshot: ParkourPhysicsSnapshot | null = null;
    private _parkourFollowLog: Node | null = null;
    private readonly _parkourFollowOffset = new Vec3();
    private readonly _parkourFollowWorldPosition = new Vec3();

    private _parkourCharging = false;
    private _parkourInputUnlocked = false;
    private readonly _visualFacing = new VisualFacing();

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
        this._visualFacing.bind(this.visualNode);

        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.onEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
    }

    start(): void {
        if (!this._combat && this.node.scene) {
            this._combat = this.node.scene.getComponentInChildren(CombatSystem);
        }
        const phase = GameManager.instance?.getPhase();
        if (!phase || phase === GamePhase.RunParkour) {
            this.setMode('parkour');
        }
        this._bindEmbeddedHpBar();
    }

    onDestroy(): void {
        this._combat?.cancelPendingAttack();
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
        EventManager.instance.offEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
    }

    onDisable(): void {
        this._combat?.cancelPendingAttack();
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
        if (this._mode === 'parkour' && !this._parkourInputUnlocked) {
            this._moveDir.set(0, 0);
            return;
        }
        this._moveDir.set(dir);
    }

    setMode(mode: PlayerMode): void {
        this._mode = mode;
        if (mode === 'parkour') {
            this.beginParkourInputGate();
        } else {
            this._parkourInputUnlocked = true;
        }
    }

    /** Joystick calls this before delivering the first constrained horizontal direction. */
    beginParkourInputGate(): void {
        this._parkourInputUnlocked = false;
        this._moveDir.set(0, 0);
        this._velocity.set(0, 0);
        this._writeOwnVelocity();

    }

    unlockParkourMovement(): void {
        if (this._mode === 'parkour') {
            this._parkourInputUnlocked = true;
        }
    }

    get isParkourMovementUnlocked(): boolean {
        return this._parkourInputUnlocked;
    }

    setHasBow(hasBow: boolean): void {
        this._hasBow = hasBow;
    }

    getVelocity(): Readonly<Vec2> {
        return this._velocity;
    }

    /** Parkour Log consumes this intent and is the sole physics velocity writer while attached. */
    getParkourVelocityIntent(): Readonly<Vec2> {
        return this._velocity;
    }

    isFollowingParkourLog(): boolean {
        return this._parkourPhysicsSnapshot !== null;
    }

    /** Start root-level Log following without reparenting Player or its visual/UI subtree. */
    beginParkourLogFollow(logRoot: Node): void {
        if (this._parkourPhysicsSnapshot) {
            if (this._parkourFollowLog === logRoot) {
                return;
            }
            this.endParkourLogFollow();
        }

        const rigidBody = this._rb ?? this.getComponent(RigidBody2D);
        this._rb = rigidBody;
        const collider = this.getComponent(Collider2D);
        const awakeBody = rigidBody as (RigidBody2D & { awake?: boolean }) | null;
        this._parkourPhysicsSnapshot = {
            rigidBody,
            rigidBodyEnabled: rigidBody?.enabled ?? false,
            rigidBodyType: rigidBody?.type ?? ERigidBody2DType.Dynamic,
            gravityScale: rigidBody?.gravityScale ?? 0,
            fixedRotation: rigidBody?.fixedRotation ?? true,
            allowSleep: rigidBody?.allowSleep ?? false,
            enabledContactListener: rigidBody?.enabledContactListener ?? false,
            linearVelocity: rigidBody ? new Vec2(rigidBody.linearVelocity) : new Vec2(0, 0),
            angularVelocity: rigidBody?.angularVelocity ?? 0,
            awake: typeof awakeBody?.awake === 'boolean' ? awakeBody.awake : null,
            collider,
            colliderEnabled: collider?.enabled ?? false,
            colliderSensor: collider?.sensor ?? false,
        };

        logRoot.getWorldPosition(this._parkourFollowWorldPosition);
        this.node.getWorldPosition(this._parkourFollowOffset);
        Vec3.subtract(
            this._parkourFollowOffset,
            this._parkourFollowOffset,
            this._parkourFollowWorldPosition,
        );
        this._parkourFollowLog = logRoot;
        if (rigidBody) {
            rigidBody.linearVelocity = new Vec2(0, 0);
            rigidBody.angularVelocity = 0;
            rigidBody.enabled = false;
        }
        if (collider) {
            collider.enabled = false;
        }
    }

    /** Synchronize once, then restore the captured Player physics state. */
    endParkourLogFollow(): void {
        const snapshot = this._parkourPhysicsSnapshot;
        if (!snapshot) {
            return;
        }
        this._syncParkourLogWorldPosition();
        this._parkourFollowLog = null;
        this._parkourPhysicsSnapshot = null;

        const rigidBody = snapshot.rigidBody;
        if (rigidBody) {
            rigidBody.type = snapshot.rigidBodyType;
            rigidBody.gravityScale = snapshot.gravityScale;
            rigidBody.fixedRotation = snapshot.fixedRotation;
            rigidBody.allowSleep = snapshot.allowSleep;
            rigidBody.enabledContactListener = snapshot.enabledContactListener;
            rigidBody.linearVelocity = new Vec2(snapshot.linearVelocity);
            rigidBody.angularVelocity = snapshot.angularVelocity;
            rigidBody.enabled = snapshot.rigidBodyEnabled;
            if (snapshot.awake !== null) {
                (rigidBody as RigidBody2D & { awake?: boolean }).awake = snapshot.awake;
            }
        }
        if (snapshot.collider) {
            snapshot.collider.sensor = snapshot.colliderSensor;
            snapshot.collider.enabled = snapshot.colliderEnabled;
        }
    }

    lateUpdate(): void {
        this._syncParkourLogWorldPosition();
    }


    faceTarget(target: Node | null): void {
        this._visualFacing.faceByTarget(this.visualNode, this.node, target, true);
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
            this._writeOwnVelocity();

        }
    }

    takeDamage(amount: number): void {
        if (this._isDead || amount <= 0) {
            return;
        }
        const phase = GameManager.instance?.getPhase();
        if (phase === GamePhase.Ultimate || phase === GamePhase.GameOver) {
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
            if (!this._parkourInputUnlocked) {
                this._velocity.set(0, 0);
                this._writeOwnVelocity();

                return;
            }
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

        this._writeOwnVelocity();

        this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x, true);
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

    private _onParkourFinished = (): void => {
        this._parkourCharging = false;
        this.setMode('defense');
    };

    private _die(): void {
        if (this._isDead) {
            return;
        }
        if (this._boundLog) {
            this._boundLog.unbindPlayer();
        } else {
            this.endParkourLogFollow();
        }

        this._isDead = true;
        this._combat?.cancelPendingAttack();
        this._canMove = false;
        this._velocity.set(0, 0);
        this._writeOwnVelocity();

        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
        GameManager.instance?.setGameOver('lose');
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

    private _writeOwnVelocity(): void {
        if (!this._rb || this.isFollowingParkourLog()) {
            return;
        }
        this._rb.linearVelocity = new Vec2(this._velocity);
    }

    private _syncParkourLogWorldPosition(): void {
        if (!this._parkourPhysicsSnapshot || !this._parkourFollowLog) {
            return;
        }
        this._parkourFollowLog.getWorldPosition(this._parkourFollowWorldPosition);
        Vec3.add(
            this._parkourFollowWorldPosition,
            this._parkourFollowWorldPosition,
            this._parkourFollowOffset,
        );
        this.node.setWorldPosition(this._parkourFollowWorldPosition);
    }


    private _bindEmbeddedHpBar(): void {
        const bar = this.node.getComponentInChildren(HpBarUI);
        bar?.bindTarget(this.node);
    }
}
