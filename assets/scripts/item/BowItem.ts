import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Node,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';
import { TweenUtil } from '../core/TweenUtil';

const { ccclass, property } = _decorator;

/**
 * 弓箭拾取道具：Trigger 碰到玩家后短弧飞向玩家再 setHasBow(true) 并销毁。
 */
@ccclass('BowItem')
export class BowItem extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _collider: Collider2D | null = null;
    private _consumed = false;
    private readonly _tmp = new Vec3();

    onLoad(): void {
        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = true;
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    onDestroy(): void {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
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

        const player = otherCollider.node.getComponent(Player);
        if (!player) {
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
    };
}
