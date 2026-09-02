import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { CoinSystem } from '../game/CoinSystem';

const { ccclass, property } = _decorator;

/**
 * 金币数量 HUD：图标 + Label；监听 COIN_CHANGED(delta, balance)。
 */
@ccclass('CoinUI')
export class CoinUI extends Component {
    @property({ type: Label, tooltip: '数量 Label' })
    amountLabel: Label | null = null;

    @property({ type: Sprite, tooltip: '金币图标（可选）' })
    iconSprite: Sprite | null = null;

    @property({ type: Node, tooltip: '背景节点（可选）' })
    background: Node | null = null;

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        this._setAmount(CoinSystem.instance?.balance ?? 0);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
    }

    private _onCoinChanged = (...args: unknown[]): void => {
        // CoinSystem: (delta, balance)；兼容仅传 balance
        let balance = 0;
        if (args.length >= 2 && typeof args[1] === 'number') {
            balance = args[1];
        } else if (typeof args[0] === 'number' && args.length === 1) {
            balance = args[0];
        } else {
            balance = CoinSystem.instance?.balance ?? 0;
        }
        this._setAmount(balance);
    };

    private _setAmount(balance: number): void {
        if (!this.amountLabel) {
            return;
        }
        this.amountLabel.string = String(Math.max(0, Math.floor(balance)));
    }
}
