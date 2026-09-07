import { _decorator, Component, Node } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameManager } from './GameManager';
import { GamePhase } from './GamePhase';

const { ccclass, property } = _decorator;

const SAW_TRAP_NAMES = ['SawTrap_1', 'SawTrap_2', 'SawTrap_3'] as const;
const PRE_ENEMY_NAMES = [
    'PreEnemy_1', 'PreEnemy_2', 'PreEnemy_3', 'PreEnemy_4',
    'PreEnemy_5', 'PreEnemy_6', 'PreEnemy_7', 'PreEnemy_8',
] as const;

/**
 * 跑酷物件分阶段隐藏。
 * PARKOUR_FINISHED：电锯 + 滚木加长道具；BOTH_WALLS_COMPLETE：隐藏整棵 ParkourContent（滚木须在子树外）。
 * 阶段切换走 GameManager.setPhase，不裸发 PHASE_CHANGED 字符串。
 */
@ccclass('PhaseTransition')
export class PhaseTransition extends Component {
    @property({ type: Node, tooltip: 'ParkourContent 根，用于按子节点名隐藏跑酷物件' })
    parkourContent: Node | null = null;

    @property({ type: Node, tooltip: '塔防段显式展示的内容根节点（可选）' })
    defenseContentRoot: Node | null = null;

    @property({ type: Node, tooltip: '固定后的滚木实例，须在 ParkourContent 子树外' })
    logNode: Node | null = null;

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
        EventManager.instance.onEvent(GameEvents.BOTH_WALLS_COMPLETE, this._onBothWallsComplete, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
        EventManager.instance.offEvent(GameEvents.BOTH_WALLS_COMPLETE, this._onBothWallsComplete, this);
    }

    private _onParkourFinished = (): void => {
        this._setChildrenActive(SAW_TRAP_NAMES, false);
        this._setChildActive('LogExtendItemRoot', false);
    };

    private _onBothWallsComplete = (): void => {
        this._setChildrenActive(PRE_ENEMY_NAMES, false);
        this._setChildActive('YellowLine', false);
        this._setChildActive('BlueLine', false);
        if (this.logNode) {
            this.logNode.active = true;
        }
        if (this.defenseContentRoot) {
            this.defenseContentRoot.active = true;
        }
        // 用户需求：两墙解锁后整棵隐藏 ParkourContent（滚木须在其外）
        if (this.parkourContent) {
            this.parkourContent.active = false;
        }
        GameManager.instance?.setPhase(GamePhase.BuildPhase2);
    };

    private _setChildrenActive(names: readonly string[], active: boolean): void {
        if (!this.parkourContent) {
            return;
        }
        for (const name of names) {
            const child = this.parkourContent.getChildByName(name);
            if (child) {
                child.active = active;
            }
        }
    }

    private _setChildActive(name: string, active: boolean): void {
        if (!this.parkourContent) {
            return;
        }
        const child = this.parkourContent.getChildByName(name);
        if (child) {
            child.active = active;
        }
    }
}
