import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Node,
} from 'cc';
import { Player } from '../character/Player';
import { Log } from './Log';

const { ccclass, property } = _decorator;

/**
 * 滚木加长道具：Trigger 碰到玩家或滚木后调用 Log.extend() 并销毁自身。
 */
@ccclass('LogExtendItem')
export class LogExtendItem extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    @property({ type: Log, tooltip: '目标滚木；为空则从碰撞对方或场景查找' })
    targetLog: Log | null = null;

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
        if (this._consumed) {
            return;
        }

        const other = otherCollider.node;
        const hitPlayer = !!other.getComponent(Player);
        const hitLog = other.getComponent(Log);
        if (!hitPlayer && !hitLog) {
            return;
        }

        const log = hitLog ?? this.targetLog ?? this._findLogInScene();
        if (!log) {
            return;
        }

        this._consumed = true;
        log.extend();
        this.node.destroy();
    };

    private _findLogInScene(): Log | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }
        return scene.getComponentInChildren(Log);
    }
}
