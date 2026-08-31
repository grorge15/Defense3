import { _decorator, Component, Node, Sorting2D } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 根据 Visual 子节点世界 Y 自动设置 sortingOrder。
 * 公式：sortingOrder = Math.round(-visualNode.worldPosition.y * 100)
 */
@ccclass('SortingOrder2D')
export class SortingOrder2D extends Component {
    @property({ tooltip: 'Visual 子节点，用于取世界 Y 计算 sortingOrder；不填则用自身节点' })
    visualNode: Node | null = null;

    private _sorting: Sorting2D | null = null;

    onLoad(): void {
        const visual = this.visualNode ?? this.node;
        this._sorting = visual.getComponent(Sorting2D);
        if (!this._sorting) {
            this._sorting = visual.addComponent(Sorting2D);
        }
    }

    lateUpdate(): void {
        if (!this._sorting) {
            return;
        }
        const visual = this.visualNode ?? this.node;
        const y = visual.worldPosition.y;
        this._sorting.sortingOrder = Math.round(-y * 100);
    }
}
