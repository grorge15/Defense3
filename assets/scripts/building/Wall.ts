import { _decorator, Collider2D, Component, Node } from 'cc';
import { HitFlash } from '../core/HitFlash';

const { ccclass, property } = _decorator;

/**
 * 玩家建造的矮墙式阻挡物：仅物理封路，无血量；受击可闪红（供碰撞/调试调用）。
 */
@ccclass('Wall')
export class Wall extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ tooltip: '刷怪侧别（left/right）；供停刷/调试对齐' })
    spawnSide: '' | 'left' | 'right' = '';

    private _isActive = false;
    private _collider: Collider2D | null = null;

    onLoad(): void {
        this._collider = this.getComponent(Collider2D);
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        // 未 activate 前只关碰撞，禁止关整节点（否则看起来像「没生成墙」）
        if (!this._isActive) {
            this._setBlockingEnabled(false);
        }
    }

    activate(): void {
        if (this._isActive) {
            this.node.active = true;
            if (this.visualNode) {
                this.visualNode.active = true;
            }
            this._setBlockingEnabled(true);
            return;
        }
        this._isActive = true;
        this.node.active = true;
        this._setBlockingEnabled(true);
        if (this.visualNode) {
            this.visualNode.active = true;
        }
    }

    /** 无血量墙：仅视觉反馈 */
    flashRed(): void {
        HitFlash.flash(this.visualNode ?? this.node);
    }

    private _setBlockingEnabled(enabled: boolean): void {
        if (this._collider) {
            this._collider.enabled = enabled;
        }
    }
}
