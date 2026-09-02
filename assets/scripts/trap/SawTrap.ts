import {
    _decorator,
    Collider2D,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Node,
} from 'cc';
import { Player } from '../character/Player';
import { GameConfig } from '../core/GameConfig';
import { Log } from '../item/Log';

const { ccclass, property } = _decorator;

/**
 * 跑酷电锯陷阱：Trigger 碰玩家造成伤害，碰滚木砍短。
 */
@ccclass('SawTrap')
export class SawTrap extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ tooltip: '旋转速度（度/秒），程序动画' })
    spinSpeed = 360;

    private _collider: Collider2D | null = null;
    private readonly _hitCooldown = new Set<string>();

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

    update(dt: number): void {
        if (!this.visualNode) {
            return;
        }
        const euler = this.visualNode.eulerAngles;
        this.visualNode.setRotationFromEuler(euler.x, euler.y, euler.z + this.spinSpeed * dt);
    }

    private _onBeginContact = (
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void => {
        void selfCollider;
        const other = otherCollider.node;
        const key = other.uuid;
        if (this._hitCooldown.has(key)) {
            return;
        }

        const player = other.getComponent(Player);
        if (player) {
            player.takeDamage(GameConfig.sawTrapDamage);
            this._markCooldown(key);
            return;
        }

        const log = other.getComponent(Log);
        if (log) {
            log.shrink();
            this._markCooldown(key);
        }
    };

    private _markCooldown(key: string): void {
        this._hitCooldown.add(key);
        this.scheduleOnce(() => {
            this._hitCooldown.delete(key);
        }, 0.4);
    }
}
