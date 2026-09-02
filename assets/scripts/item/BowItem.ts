import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Node,
} from 'cc';
import { Player } from '../character/Player';

const { ccclass, property } = _decorator;

/**
 * 弓箭拾取道具：Trigger 碰到玩家后 setHasBow(true) 并销毁自身。
 */
@ccclass('BowItem')
export class BowItem extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _collider: Collider2D | null = null;
    private _consumed = false;

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
        player.setHasBow(true);
        this.node.destroy();
    };
}
