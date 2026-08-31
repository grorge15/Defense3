import { _decorator, Component, Node } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 两墙建完后隐藏跑酷段物件、呈现塔防段场景物件。
 * 滚木实例须挂在 ParkourContent 外（RoadRoot/LogAnchor），避免被一并隐藏。
 */
@ccclass('PhaseTransition')
export class PhaseTransition extends Component {
    @property({ type: Node, tooltip: '跑酷段专属内容（电锯/预置敌/黄蓝线），两墙后 active=false' })
    parkourContent: Node | null = null;

    @property({ type: Node, tooltip: '塔防段显式展示的内容根节点（可选）' })
    defenseContentRoot: Node | null = null;

    @property({ type: Node, tooltip: '固定后的滚木实例，须在 ParkourContent 子树外' })
    logNode: Node | null = null;

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.BOTH_WALLS_COMPLETE, this._onBothWallsComplete, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.BOTH_WALLS_COMPLETE, this._onBothWallsComplete, this);
    }

    private _onBothWallsComplete = (): void => {
        if (this.parkourContent) {
            this.parkourContent.active = false;
        }
        if (this.logNode) {
            this.logNode.active = true;
        }
        if (this.defenseContentRoot) {
            this.defenseContentRoot.active = true;
        }
        EventManager.instance.emitEvent(GameEvents.PHASE_CHANGED, 'defense');
    };
}
