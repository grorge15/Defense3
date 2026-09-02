import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
} from 'cc';
import { GameConfig } from '../core/GameConfig';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

export type ParkourLineKind = 'yellow' | 'blue';

/**
 * 黄/蓝线 Trigger 区：黄线 → enterChargeZone；蓝线 → tryLockAtFinish。
 */
@ccclass('ParkourLineZone')
export class ParkourLineZone extends Component {
    @property({ tooltip: 'yellow = 蓄力；blue = 终点固定判定' })
    lineKind: ParkourLineKind = 'yellow';

    @property({ type: Log, tooltip: '关联滚木' })
    log: Log | null = null;

    private _collider: Collider2D | null = null;
    private _triggered = false;

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
        if (this._triggered || !this.log) {
            return;
        }

        const otherNode = otherCollider.node;
        const otherLog = otherNode.getComponent(Log) ?? otherNode.parent?.getComponent(Log) ?? null;
        if (!otherLog || otherLog !== this.log) {
            return;
        }

        this._triggered = true;
        if (this.lineKind === 'yellow') {
            this.log.enterChargeZone();
            return;
        }

        const canLock = this.log.getCurrentLength() >= GameConfig.blueLineMinLogLength;
        this.log.tryLockAtFinish(canLock);
    };
}
