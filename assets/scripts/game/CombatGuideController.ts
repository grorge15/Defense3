import { _decorator, Component, Node } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from './GamePhase';

const { ccclass, property } = _decorator;

/**
 * 轻量 CombatGuide（无 UI prefab）：进入 CombatGuide 时打日志，
 * 可选高亮弓/引导空节点直至玩家 setHasBow。
 */
@ccclass('CombatGuideController')
export class CombatGuideController extends Component {
    @property({ type: Node, tooltip: '可选：弓道具或引导空节点；进入阶段时 active=true，拾弓后关闭' })
    bowGuideMarker: Node | null = null;

    @property({ type: Player, tooltip: '玩家；空则场景内查找' })
    player: Player | null = null;

    private _guiding = false;
    private _bowClaimed = false;

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PHASE_CHANGED, this._onPhaseChanged, this);
    }

    update(): void {
        if (!this._guiding || this._bowClaimed) {
            return;
        }
        const player = this._resolvePlayer();
        if (player?.hasBow) {
            this._onBowClaimed();
        }
    }

    private _onPhaseChanged = (...args: unknown[]): void => {
        const phase = args[0];
        if (phase === GamePhase.CombatGuide) {
            this._enterCombatGuide();
        }
    };

    private _enterCombatGuide(): void {
        this._guiding = true;
        this._bowClaimed = false;
        console.log('[CombatGuide] enter CombatGuide — pick up bow / defeat first enemies');
        if (this.bowGuideMarker) {
            this.bowGuideMarker.active = true;
        }
        const player = this._resolvePlayer();
        if (player?.hasBow) {
            this._onBowClaimed();
        }
    }

    private _onBowClaimed(): void {
        if (this._bowClaimed) {
            return;
        }
        this._bowClaimed = true;
        this._guiding = false;
        console.log('[CombatGuide] bow claimed — guide marker off');
        if (this.bowGuideMarker) {
            this.bowGuideMarker.active = false;
        }
    }

    private _resolvePlayer(): Player | null {
        if (this.player && this.player.isValid) {
            return this.player;
        }
        this.player = this.node.scene?.getComponentInChildren(Player) ?? null;
        return this.player;
    }
}
