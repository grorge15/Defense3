import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { Coin } from '../item/Coin';

const { ccclass, property } = _decorator;

/**
 * 金币系统：怪死掉落、维护余额、emit COIN_CHANGED(delta, balance)。
 */
@ccclass('CoinSystem')
export class CoinSystem extends Component {
    private static _instance: CoinSystem | null = null;

    @property({ type: Prefab, tooltip: '金币 prefab（pref_item_coin）' })
    coinPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '玩家节点（吸附目标；SceneSetup 可补绑）' })
    playerNode: Node | null = null;

    @property({ type: Node, tooltip: '掉落父节点；空则用本节点或 GameRoot/Effect' })
    dropRoot: Node | null = null;

    private _balance = 0;
    private _aliveCoins = 0;
    private readonly _dropPos = new Vec3();

    public static get instance(): CoinSystem | null {
        return CoinSystem._instance;
    }

    onLoad(): void {
        if (CoinSystem._instance && CoinSystem._instance !== this) {
            this.destroy();
            return;
        }
        CoinSystem._instance = this;
    }

    onDestroy(): void {
        if (CoinSystem._instance === this) {
            CoinSystem._instance = null;
        }
    }

    get balance(): number {
        return this._balance;
    }

    setPlayer(playerNode: Node | null): void {
        this.playerNode = playerNode;
    }

    /**
     * 在世界坐标掉落一枚金币并开始吸附。
     */
    dropAt(worldPos: Vec3): void {
        if (!this.coinPrefab) {
            return;
        }
        if (this._aliveCoins >= GameConfig.poolMaxCoins) {
            return;
        }

        const parent = this._resolveDropRoot();
        const node = instantiate(this.coinPrefab);
        parent.addChild(node);
        this._dropPos.set(worldPos.x, worldPos.y, worldPos.z);
        node.setWorldPosition(this._dropPos);

        const coin = node.getComponent(Coin);
        if (!coin) {
            node.destroy();
            return;
        }

        const from = new Vec3(
            worldPos.x,
            worldPos.y + GameConfig.coinDropArcHeight * 0.5,
            worldPos.z,
        );
        this._aliveCoins += 1;
        coin.setup(
            this.playerNode,
            GameConfig.coinDropAmount,
            (amount) => {
                this._aliveCoins = Math.max(0, this._aliveCoins - 1);
                this.addCoins(amount);
            },
            from,
        );
    }

    addCoins(delta: number): void {
        if (delta === 0) {
            return;
        }
        this._balance = Math.max(0, this._balance + delta);
        EventManager.instance.emitEvent(GameEvents.COIN_CHANGED, delta, this._balance);
    }

    trySpend(amount: number): boolean {
        if (amount <= 0) {
            return true;
        }
        if (this._balance < amount) {
            return false;
        }
        this.addCoins(-amount);
        return true;
    }

    private _resolveDropRoot(): Node {
        if (this.dropRoot && this.dropRoot.isValid) {
            return this.dropRoot;
        }
        const effect = this.node.scene?.getChildByName('GameRoot')?.getChildByName('Effect');
        if (effect) {
            return effect;
        }
        return this.node;
    }
}
