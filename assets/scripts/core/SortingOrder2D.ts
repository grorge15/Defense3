import { _decorator, Component, Node, UIRenderer } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 根据 Visual 子节点世界 Y 自动设置 sortingOrder。
 * 公式：sortingOrder = Math.round(-visualNode.worldPosition.y * 100) + offset
 */
@ccclass('SortingOrder2D')
export class SortingOrder2D extends Component {
    @property({ tooltip: 'Visual 子节点，用于取世界 Y 计算 sortingOrder；不填则用自身节点' })
    visualNode: Node | null = null;

    @property({ tooltip: 'sortingOrder 偏移量，用于同层微调' })
    offset = 0;

    private _renderer: UIRenderer | null = null;

    onLoad(): void {
        const visual = this.visualNode ?? this.node;
        this._renderer = visual.getComponent(UIRenderer);
    }

    lateUpdate(): void {
        if (!this._renderer) {
            return;
        }
        const visual = this.visualNode ?? this.node;
        const y = visual.worldPosition.y;
        this._renderer.priority = Math.round(-y * 100) + this.offset;
    }
}
