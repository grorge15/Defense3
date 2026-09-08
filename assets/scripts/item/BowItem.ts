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
import { GameManager } from '../game/GameManager';
import { GamePhase } from '../game/GamePhase';

const { ccclass, property } = _decorator;

/**
 * 弓箭拾取：物理接触 + 距离轮询双通道（玩家位移驱动时接触常丢）。
 */
@ccclass('BowItem')
export class BowItem extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

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
        if (this._consumed || !this.node.scene || !this._canPickupNow()) {
            return;
        }
        const player = this.node.scene.getComponentInChildren(Player);
        if (!player || player.isDead) {
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        player.node.getWorldPosition(this._tmp);
        const dx = this._tmp.x - this._selfPos.x;
        const dy = this._tmp.y - this._selfPos.y;
        if (dx * dx + dy * dy <= this.pickupRadius * this.pickupRadius) {
            this._consume(player);
        }
    }

    private _onBeginContact = (
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void selfCollider;
        void _contact;
        if (this._consumed || !this._canPickupNow()) {
            return;
        }
        const player =
            otherCollider.node.getComponent(Player) ??
            otherCollider.node.parent?.getComponent(Player) ??
            null;
        if (!player) {
            return;
        }
        this._consume(player);
    };

    private _consume(player: Player): void {
        if (this._consumed || !this._canPickupNow()) {
            return;
        }
        this._consumed = true;
        if (this._collider) {
            this._collider.enabled = false;
        }
        player.node.getWorldPosition(this._tmp);
        TweenUtil.hopToWorld(
            this.node,
            this._tmp,
            GameConfig.itemPickupArcDuration,
            GameConfig.itemPickupArcHeight,
            () => {
                player.setHasBow(true);
                this.node.destroy();
            },
        );
    }

    private _canPickupNow(): boolean {
        const phase = GameManager.instance?.getPhase() ?? GamePhase.RunParkour;
        return phase !== GamePhase.RunParkour;
    }
}
