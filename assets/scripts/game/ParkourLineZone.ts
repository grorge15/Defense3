import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
} from 'cc';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

export type ParkourLineKind = 'yellow' | 'blue';

/**
 * 黄/蓝线 Trigger 区：黄线 → enterChargeZone；蓝线 → 跑酷结束并按世界宽度尝试固定滚木。
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

    private _resolveLog(): Log | null {
        return this.log ?? (this.log = this.node.scene?.getComponentInChildren(Log) ?? null);
    }

    private _onBeginContact = (
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void selfCollider;
        const log = this._resolveLog();
        if (this._triggered || !log) {
            return;
        }

        const otherNode = otherCollider.node;
        const otherLog = otherNode.getComponent(Log) ?? otherNode.parent?.getComponent(Log) ?? null;
        if (!otherLog || otherLog !== log) {
            return;
        }
        const phase = log.getPhase();
        if (phase === 'fixed' || phase === 'failed') {
            return;
        }

        this._triggered = true;
        if (this.lineKind === 'yellow') {
            log.enterChargeZone();
            return;
        }

        log.tryLockAtFinish(log.meetsFixedWidthRequirement());
    };
}
