import { _decorator, Collider2D, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 玩家建造的矮墙式阻挡物：仅物理封路，不受击、无侧别逻辑。
 * 受击闪红与血量见 P2-013 Barrier.ts。
 */
@ccclass('Wall')
export class Wall extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    private _isActive = false;
    private _collider: Collider2D | null = null;

    onLoad(): void {
        this._collider = this.getComponent(Collider2D);
        if (!this._isActive) {
            this._setBlockingEnabled(false);
        }
    }

    activate(): void {
        if (this._isActive) {
            return;
        }
        this._isActive = true;
        this._setBlockingEnabled(true);
        if (this.visualNode) {
            this.visualNode.active = true;
        }
    }

    private _setBlockingEnabled(enabled: boolean): void {
        if (this._collider) {
            this._collider.enabled = enabled;
        }
        this.node.active = enabled;
    }
}
