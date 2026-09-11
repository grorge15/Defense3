import {
    _decorator,
    Component,
    instantiate,
    Label,
    Node,
    Sprite,
    Vec3,
    director,
} from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { TweenUtil } from '../core/TweenUtil';
import { CoinSystem } from '../game/CoinSystem';
import { Coin } from '../item/Coin';

const { ccclass, property } = _decorator;

/**
 * 金币数量 HUD：图标 + Label；监听 COIN_CHANGED(delta, balance)。
 * 建造交付时随 balance 渐变显示，并播放飞向地块的短弧。
 */
@ccclass('CoinUI')
export class CoinUI extends Component {
    private static _instance: CoinUI | null = null;

    @property({ type: Label, tooltip: '数量 Label' })
    amountLabel: Label | null = null;

    @property({ type: Sprite, tooltip: '金币图标（可选）' })
    iconSprite: Sprite | null = null;

    @property({ type: Node, tooltip: '背景节点（可选）' })
    background: Node | null = null;

    @property({ tooltip: '显示数字追赶真实余额的速度（越大越快）' })
    displayLerpSpeed = 14;

    @property({ tooltip: '交付飞币最短间隔（秒）' })
    flyCooldown = 0.08;

    private _displayBalance = 0;
    private _targetBalance = 0;
    private _flyCd = 0;

    public static get instance(): CoinUI | null {
        return CoinUI._instance;
    }

    onLoad(): void {
        if (!CoinUI._instance) {
            CoinUI._instance = this;
        }
        EventManager.instance.onEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        this._targetBalance = CoinSystem.instance?.balance ?? 0;
        this._displayBalance = this._targetBalance;
        this._setAmount(this._displayBalance);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.COIN_CHANGED, this._onCoinChanged, this);
        if (CoinUI._instance === this) {
            CoinUI._instance = null;
        }
    }

    update(dt: number): void {
        if (this._flyCd > 0) {
            this._flyCd -= dt;
        }
        if (Math.abs(this._displayBalance - this._targetBalance) < 0.05) {
            this._displayBalance = this._targetBalance;
            this._setAmount(this._displayBalance);
            return;
        }
        const t = 1 - Math.exp(-this.displayLerpSpeed * Math.max(0, dt));
        this._displayBalance += (this._targetBalance - this._displayBalance) * t;
        this._setAmount(this._displayBalance);
    }

    /** 从玩家世界坐标飞一枚视觉币到地块（余额已由 CoinSystem 扣减） */
    playDeliverFly(toWorld: Vec3, fromWorld?: Vec3 | null): void {
        if (this._flyCd > 0) {
            return;
        }

        const coinPrefab = CoinSystem.instance?.coinPrefab;
        const fly = coinPrefab
            ? instantiate(coinPrefab)
            : this.iconSprite
              ? instantiate(this.iconSprite.node)
              : null;
        if (!fly) {
            return;
        }
        this._flyCd = this.flyCooldown;

        const coin = fly.getComponent(Coin) ?? fly.getComponentInChildren(Coin);
        if (coin) {
            coin.enabled = false;
        }

        const parent = this._resolveFlyParent();
        parent.addChild(fly);
        const playerWorld = fromWorld ?? CoinSystem.instance?.playerNode?.worldPosition ?? this.node.worldPosition;
        fly.setWorldPosition(playerWorld);
        TweenUtil.hopToWorld(fly, toWorld, 0.28, 40, () => {
            if (fly.isValid) {
                fly.destroy();
            }
        });
    }

    private _resolveFlyParent(): Node {
        const gameRoot = director.getScene()?.getChildByName('GameRoot');
        const effect = gameRoot?.getChildByName('Effect');
        if (effect?.isValid) {
            return effect;
        }
        if (gameRoot?.isValid) {
            return gameRoot;
        }
        return this.node.parent ?? this.node;
    }

    private _onCoinChanged = (...args: unknown[]): void => {
        // 仅认 CoinSystem 两参 (delta, balance)；忽略建造三参
        if (args.length >= 3 && typeof args[2] === 'number') {
            return;
        }
        let balance = CoinSystem.instance?.balance ?? 0;
        if (args.length >= 2 && typeof args[1] === 'number') {
            balance = args[1];
        } else if (typeof args[0] === 'number' && args.length === 1) {
            balance = args[0];
        }
        this._targetBalance = Math.max(0, balance);
    };

    private _setAmount(balance: number): void {
        if (!this.amountLabel) {
            return;
        }
        this.amountLabel.string = String(Math.max(0, Math.floor(balance + 1e-6)));
    }

}
