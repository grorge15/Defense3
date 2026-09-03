import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    ERigidBody2DType,
    Node,
    Rect,
    RigidBody2D,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { playAnim } from '../core/AnimUtil';
import { GameConfig } from '../core/GameConfig';
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
 * 玩家移动：节点 setPosition 驱动；刚体 Kinematic + 同步 linearVelocity。
 * 固定后滚木用 AABB 挡路（双方均为传感器/位移驱动时物理挡不住）。
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
    private readonly _worldPos = new Vec3();
    private readonly _selfRect = new Rect();
    private readonly _logRect = new Rect();
    private _hasBow = false;
    private _isDead = false;
    private _canMove = true;
    private _currentLocomotionClip = '';
    private _boundLog: Log | null = null;
    private _parkourCharging = false;
    private _fixedLog: Log | null = null;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.enabledContactListener = true;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        const col = this.getComponent(Collider2D);
        if (col) {
            col.sensor = true;
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

        if (this._velocity.x !== 0 || this._velocity.y !== 0) {
            this.node.getPosition(this._tmpPos);
            this._tmpPos.x += this._velocity.x * dt;
            this._tmpPos.y += this._velocity.y * dt;
            this._resolveAgainstFixedLog(this._tmpPos);
            this.node.setPosition(this._tmpPos);
        } else {
            this.node.getPosition(this._tmpPos);
            this._resolveAgainstFixedLog(this._tmpPos);
            this.node.setPosition(this._tmpPos);
        }
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._updateLocomotionAnim();
    }

    /** 固定滚木 AABB 挡玩家（传感器 + setPosition 时物理不会挡） */
    private _resolveAgainstFixedLog(localPos: Vec3): void {
        const log = this._resolveFixedLog();
        if (!log) {
            return;
        }
        // 先落到拟议本地坐标，再取世界坐标做 AABB
        this.node.setPosition(localPos);
        this.node.getWorldPosition(this._worldPos);

        this._fillPlayerAabb(this._worldPos);
        this._fillLogAabb(log);
        if (!this._aabbOverlap(this._selfRect, this._logRect)) {
            return;
        }

        const penL = this._selfRect.xMax - this._logRect.xMin;
        const penR = this._logRect.xMax - this._selfRect.xMin;
        const penB = this._selfRect.yMax - this._logRect.yMin;
        const penT = this._logRect.yMax - this._selfRect.yMin;
        if (penL <= 0 || penR <= 0 || penB <= 0 || penT <= 0) {
            return;
        }

        const minPen = Math.min(penL, penR, penB, penT);
        if (minPen === penL) {
            this._worldPos.x -= penL;
            this._velocity.x = Math.min(this._velocity.x, 0);
        } else if (minPen === penR) {
            this._worldPos.x += penR;
            this._velocity.x = Math.max(this._velocity.x, 0);
        } else if (minPen === penB) {
            this._worldPos.y -= penB;
            this._velocity.y = Math.min(this._velocity.y, 0);
        } else {
            this._worldPos.y += penT;
            this._velocity.y = Math.max(this._velocity.y, 0);
        }

        const parent = this.node.parent;
        if (parent) {
            parent.inverseTransformPoint(localPos, this._worldPos);
        } else {
            localPos.set(this._worldPos);
        }
    }

    private _resolveFixedLog(): Log | null {
        if (this._fixedLog?.isValid && this._fixedLog.getPhase() === 'fixed') {
            return this._fixedLog;
        }
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }
        for (const log of scene.getComponentsInChildren(Log)) {
            if (log.getPhase() === 'fixed' && log.node.activeInHierarchy) {
                this._fixedLog = log;
                return log;
            }
        }
        this._fixedLog = null;
        return null;
    }

    private _fillLogAabb(log: Log): void {
        const box = log.getBoxCollider();
        if (box) {
            const a = box.worldAABB;
            this._logRect.set(a.x, a.y, Math.abs(a.width), Math.abs(a.height));
            return;
        }
        log.node.getWorldPosition(this._worldPos);
        this._logRect.set(this._worldPos.x - 50, this._worldPos.y - 38, 100, 76);
    }

    private _fillPlayerAabb(worldCenter: Vec3): void {
        const box = this.getComponent(BoxCollider2D);
        if (box) {
            // 用拟议中心近似：先写位置后 worldAABB 才准；此处用尺寸包围中心
            const w = Math.abs(box.size.width);
            const h = Math.abs(box.size.height);
            this._selfRect.set(worldCenter.x - w * 0.5, worldCenter.y - h * 0.5, w, h);
            return;
        }
        const ui = this.visualNode?.getComponent(UITransform);
        if (ui) {
            const w = Math.max(Math.abs(ui.contentSize.width * this.visualNode!.worldScale.x), 24);
            const h = Math.max(Math.abs(ui.contentSize.height * this.visualNode!.worldScale.y), 24);
            this._selfRect.set(worldCenter.x - w * 0.5, worldCenter.y - h * 0.5, w, h);
            return;
        }
        this._selfRect.set(worldCenter.x - 24, worldCenter.y - 24, 48, 48);
    }

    private _aabbOverlap(a: Rect, b: Rect): boolean {
        return !(a.xMax < b.xMin || a.xMin > b.xMax || a.yMax < b.yMin || a.yMin > b.yMax);
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
        this._fixedLog = null;
        this._resolveFixedLog();
    };

    private _onLogFailed = (): void => {
        this._parkourCharging = false;
        this.setMode('defense');
        this._fixedLog = null;
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
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
