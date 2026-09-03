import {
    _decorator,
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
import { TweenUtil } from '../core/TweenUtil';
import { Log } from './Log';

const { ccclass, property } = _decorator;

/**
 * 滚木加长：物理接触 + 距离轮询（玩家/滚木位移驱动时接触常丢）。
 */
@ccclass('LogExtendItem')
export class LogExtendItem extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    @property({ type: Log, tooltip: '目标滚木；为空则从碰撞对方或场景查找' })
    targetLog: Log | null = null;

    @property({ tooltip: '距离拾取半径（世界单位）' })
    pickupRadius = 50;

    private _collider: Collider2D | null = null;
    private _rb: RigidBody2D | null = null;
    private _consumed = false;
    private readonly _tmp = new Vec3();
    private readonly _selfPos = new Vec3();

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

    update(_dt: number): void {
        if (this._consumed || !this.node.scene) {
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        const r2 = this.pickupRadius * this.pickupRadius;

        const player = this.node.scene.getComponentInChildren(Player);
        if (player && !player.isDead) {
            player.node.getWorldPosition(this._tmp);
            const dx = this._tmp.x - this._selfPos.x;
            const dy = this._tmp.y - this._selfPos.y;
            if (dx * dx + dy * dy <= r2) {
                this._consume(player.node, this._resolveLog(null));
                return;
            }
        }

        const log = this._resolveLog(null);
        if (log) {
            log.node.getWorldPosition(this._tmp);
            const dx = this._tmp.x - this._selfPos.x;
            const dy = this._tmp.y - this._selfPos.y;
            if (dx * dx + dy * dy <= r2) {
                this._consume(log.node, log);
            }
        }
    }

    private _onBeginContact = (
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void selfCollider;
        void _contact;
        if (this._consumed) {
            return;
        }

        const other = otherCollider.node;
        const hitPlayer = !!other.getComponent(Player) || !!other.parent?.getComponent(Player);
        const hitLog = other.getComponent(Log) ?? other.parent?.getComponent(Log) ?? null;
        if (!hitPlayer && !hitLog) {
            return;
        }

        const log = hitLog ?? this._resolveLog(null);
        if (!log) {
            return;
        }
        this._consume(other, log);
    };

    private _resolveLog(prefer: Log | null): Log | null {
        if (prefer) {
            return prefer;
        }
        if (this.targetLog) {
            return this.targetLog;
        }
        return this.node.scene?.getComponentInChildren(Log) ?? null;
    }

    private _consume(flyTarget: Node, log: Log | null): void {
        if (this._consumed || !log) {
            return;
        }
        this._consumed = true;
        if (this._collider) {
            this._collider.enabled = false;
        }
        flyTarget.getWorldPosition(this._tmp);
        TweenUtil.hopToWorld(
            this.node,
            this._tmp,
            GameConfig.itemPickupArcDuration,
            GameConfig.itemPickupArcHeight,
            () => {
                log.extend();
                this.node.destroy();
            },
        );
    }
}
