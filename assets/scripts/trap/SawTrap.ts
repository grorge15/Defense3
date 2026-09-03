import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    IPhysics2DContact,
    Node,
    RigidBody2D,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

/**
 * 跑酷电锯陷阱：Trigger 碰玩家造成伤害，碰滚木砍短。
 * 玩家/滚木用 setPosition + 传感器时物理接触常丢，故加 AABB/距离轮询。
 */
@ccclass('SawTrap')
export class SawTrap extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ tooltip: '旋转速度（度/秒），程序动画' })
    spinSpeed = 360;

    @property({ tooltip: '无碰撞体时的兜底命中半径（世界单位）' })
    hitRadius = 60;

    private _collider: Collider2D | null = null;
    private _rb: RigidBody2D | null = null;
    private readonly _hitCooldown = new Set<string>();
    private readonly _selfPos = new Vec3();
    private readonly _otherPos = new Vec3();

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
    }

    onDestroy(): void {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    update(dt: number): void {
        if (this.visualNode) {
            const euler = this.visualNode.eulerAngles;
            this.visualNode.setRotationFromEuler(euler.x, euler.y, euler.z + this.spinSpeed * dt);
        }
        this._pollHits();
    }

    private _pollHits(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        this.node.getWorldPosition(this._selfPos);

        for (const log of scene.getComponentsInChildren(Log)) {
            if (!log.node.activeInHierarchy || !log.canBeCutBySaw()) {
                continue;
            }
            if (this._overlaps(log.node, log.getBoxCollider())) {
                this._hitLog(log);
            }
        }

        const player = scene.getComponentInChildren(Player);
        if (player && !player.isDead && this._overlaps(player.node, player.getComponent(Collider2D))) {
            this._hitPlayer(player);
        }
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
            this._hitLog(log);
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

    private _hitLog(log: Log): void {
        if (!log.canBeCutBySaw()) {
            return;
        }
        const key = `l:${log.node.uuid}`;
        if (this._hitCooldown.has(key)) {
            return;
        }
        log.shrink();
        this._markCooldown(key);
    }

    private _markCooldown(key: string): void {
        this._hitCooldown.add(key);
        this.scheduleOnce(() => {
            this._hitCooldown.delete(key);
        }, 0.4);
    }
}
