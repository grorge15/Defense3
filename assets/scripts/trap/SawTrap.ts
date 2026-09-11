import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    Animation,
    AnimationClip,
    ERigidBody2DType,
    IPhysics2DContact,
    Node,
    RigidBody2D,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { playAnim } from '../core/AnimUtil';
import { GameConfig } from '../core/GameConfig';
import { Log, LogCutSide } from '../item/Log';

const { ccclass, property } = _decorator;

/**
 * 跑酷电锯陷阱：Trigger 碰玩家造成伤害，碰滚木砍短。
 * 玩家/滚木用 setPosition + 传感器时物理接触常丢，故加 AABB/距离轮询。
 * 视觉以序列帧 spin 为主；程序 euler 默认关闭（spinSpeed=0）。
 */
@ccclass('SawTrap')
export class SawTrap extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ tooltip: '旋转速度（度/秒）；有序列帧时应为 0，避免双重旋转' })
    spinSpeed = 0;

    @property({ tooltip: '无碰撞体时的兜底命中半径（世界单位）' })
    hitRadius = 60;

    private _collider: Collider2D | null = null;
    private _rb: RigidBody2D | null = null;
    private readonly _hitCooldown = new Set<string>();
    private readonly _selfPos = new Vec3();
    private readonly _otherPos = new Vec3();
    private readonly _localPlayerPos = new Vec3();
    private readonly _localSawPos = new Vec3();

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (!this._rb) {
            this._rb = this.addComponent(RigidBody2D);
        }
        this._rb.type = ERigidBody2DType.Kinematic;
        this._rb.gravityScale = 0;
        this._rb.allowSleep = false;
        this._rb.enabledContactListener = true;

        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = true;
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        if (this.visualNode) {
            this._playSpinLoop();
        }
    }

    onEnable(): void {
        this.scheduleOnce(() => this._playSpinLoop(), 0);
    }

    onDestroy(): void {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    update(_dt: number): void {
        this._pollHits();
    }

    private _pollHits(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        const player = scene.getComponentInChildren(Player);

        for (const log of scene.getComponentsInChildren(Log)) {
            if (!log.node.activeInHierarchy || !log.canBeCutBySaw()) {
                continue;
            }
            if (player && this._overlaps(log.node, log.getBoxCollider())) {
                this._hitLog(log, player);
            }
        }

        if (player && !player.isDead && this._hitsPlayer(player)) {
            this._hitPlayer(player);
        }
    }

    /** 玩家用位移驱动时 AABB 常过期，优先世界距离 */
    private _hitsPlayer(player: Player): boolean {
        player.node.getWorldPosition(this._otherPos);
        const dx = this._otherPos.x - this._selfPos.x;
        const dy = this._otherPos.y - this._selfPos.y;
        const r = Math.max(this.hitRadius, 80);
        if (dx * dx + dy * dy <= r * r) {
            return true;
        }
        return this._overlaps(player.node, player.getComponent(Collider2D));
    }

    private _overlaps(other: Node, otherBox: Collider2D | null): boolean {
        const selfBox = this._collider instanceof BoxCollider2D ? this._collider : null;
        const otherAsBox = otherBox instanceof BoxCollider2D ? otherBox : null;
        if (selfBox && otherAsBox) {
            const a = selfBox.worldAABB;
            const b = otherAsBox.worldAABB;
            return !(
                a.xMax < b.xMin ||
                a.xMin > b.xMax ||
                a.yMax < b.yMin ||
                a.yMin > b.yMax
            );
        }
        other.getWorldPosition(this._otherPos);
        const dx = this._otherPos.x - this._selfPos.x;
        const dy = this._otherPos.y - this._selfPos.y;
        const r = this.hitRadius;
        return dx * dx + dy * dy <= r * r;
    }

    private _onBeginContact = (
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void selfCollider;
        void _contact;
        const other = otherCollider.node;
        const player =
            other.getComponent(Player) ?? other.parent?.getComponent(Player) ?? null;
        if (player) {
            this._hitPlayer(player);
            return;
        }
        const log = other.getComponent(Log) ?? other.parent?.getComponent(Log) ?? null;
        if (log) {
            const player = this.node.scene?.getComponentInChildren(Player) ?? null;
            this._hitLog(log, player);
        }
    };

    private _hitPlayer(player: Player): void {
        const key = `p:${player.node.uuid}`;
        if (this._hitCooldown.has(key)) {
            return;
        }
        player.takeDamage(GameConfig.sawTrapDamage);
        this._markCooldown(key);
    }

    private _hitLog(log: Log, player: Player | null): void {
        if (!player || !log.canBeCutBySaw()) {
            return;
        }
        const key = `l:${log.node.uuid}`;
        if (this._hitCooldown.has(key)) {
            return;
        }
        const side = this._resolveCutSide(log, player);
        if (!side) {
            return;
        }
        log.cutFromSide(side);
        this._markCooldown(key);
    }

    private _resolveCutSide(log: Log, player: Player): LogCutSide | null {
        player.node.getWorldPosition(this._otherPos);
        log.node.inverseTransformPoint(this._localPlayerPos, this._otherPos);
        log.node.inverseTransformPoint(this._localSawPos, this._selfPos);
        const sawToPlayer = this._localSawPos.x - this._localPlayerPos.x;
        if (Math.abs(sawToPlayer) > 0.001) {
            return sawToPlayer < 0 ? 'left' : 'right';
        }

        // If Saw and Player overlap on the cutting axis, fall back to their side of the log.
        if (Math.abs(this._localPlayerPos.x) <= 0.001) {
            return null;
        }
        return this._localPlayerPos.x < 0 ? 'left' : 'right';
    }

    private _markCooldown(key: string): void {
        this._hitCooldown.add(key);
        this.scheduleOnce(() => {
            this._hitCooldown.delete(key);
        }, 0.4);
    }

    private _playSpinLoop(): void {
        if (!this.visualNode) {
            return;
        }
        const anim = this.visualNode.getComponent(Animation);
        const state = anim?.getState('spin') ?? null;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.repeatCount = Infinity;
        }
        playAnim(this.visualNode, 'spin');
    }
}
