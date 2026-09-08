import { _decorator, Component, js, Node, Sprite, UIRenderer } from 'cc';

const { ccclass, disallowMultiple, executeInEditMode, property } = _decorator;

/**
 * 挂在对象根节点：根据根节点世界 Y 自动设置子 Sprite 的排序。
 * 公式：sortingOrder = Math.round(-node.worldPosition.y) + offset
 */
@ccclass('SortingOrder2D')
@disallowMultiple(true)
@executeInEditMode(true)
export class SortingOrder2D extends Component {
    @property({ tooltip: '在 -根节点世界 Y 基础上的排序偏移' })
    offset = 0;

    private readonly _sortings: Component[] = [];
    private readonly _renderers: UIRenderer[] = [];
    private _lastOrder = Number.NaN;
    private _sortingType: (new () => Component) | null = null;

    onLoad(): void {
        this._refreshSortings();
        this._syncSortingOrder(true);
    }

    onEnable(): void {
        this._refreshSortings();
        this._syncSortingOrder(true);
    }

    update(): void {
        this._syncSortingOrder(false);
    }

    lateUpdate(): void {
        this._syncSortingOrder(false);
    }

    onRestore(): void {
        this._refreshSortings();
        this._syncSortingOrder(true);
    }

    resetInEditor(): void {
        this._refreshSortings();
        this._syncSortingOrder(true);
    }

    private _syncSortingOrder(force: boolean): void {
        const invalidSorting = this._sortings.some((s) => !s?.isValid);
        const invalidRenderer = this._renderers.some((r) => !r?.isValid);
        if (
            invalidSorting ||
            invalidRenderer ||
            (this._sortings.length === 0 && this._renderers.length === 0)
        ) {
            this._refreshSortings();
        }
        if (this._sortings.length === 0 && this._renderers.length === 0) {
            return;
        }

        const order = Math.round(-this.node.worldPosition.y) + this.offset;
        if (!force && order === this._lastOrder) {
            return;
        }
        this._lastOrder = order;
        for (const sorting of this._sortings) {
            (sorting as unknown as { sortingOrder: number }).sortingOrder = order;
        }
        for (const renderer of this._renderers) {
            renderer.priority = order;
        }
    }

    private _refreshSortings(): void {
        this._sortings.length = 0;
        this._renderers.length = 0;
        this._sortingType = js.getClassByName('cc.Sorting2D') as (new () => Component) | null;
        this._collectSpriteSortings(this.node);
    }

    private _collectSpriteSortings(node: Node): void {
        const hasSprite = node.getComponent(Sprite) !== null;
        if (hasSprite) {
            if (this._sortingType) {
                let sorting = node.getComponent(this._sortingType);
                if (!sorting) {
                    sorting = node.addComponent(this._sortingType);
                }
                this._sortings.push(sorting);
            } else {
                const renderer = node.getComponent(UIRenderer);
                if (renderer) {
                    this._renderers.push(renderer);
                }
            }
        }

        for (const child of node.children) {
            this._collectSpriteSortings(child);
        }
    }
}
