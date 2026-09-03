import {
    _decorator,
    Camera,
    Component,
    instantiate,
    Label,
    Node,
    Sprite,
    Vec3,
    director,
    tween,
} from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { TweenUtil } from '../core/TweenUtil';
import { CoinSystem } from '../game/CoinSystem';

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
    private _camera: Camera | null = null;
    private readonly _fromUi = new Vec3();
    private readonly _toUi = new Vec3();
    private readonly _flyOut = new Vec3();

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

    /** 从 HUD 图标飞一枚视觉币到地块世界坐标（余额已由 CoinSystem 扣减） */
    playDeliverFly(toWorld: Vec3): void {
        if (this._flyCd > 0 || !this.iconSprite) {
            return;
        }
        this._flyCd = this.flyCooldown;

        const parent = this.node.parent ?? this.node;
        const fly = instantiate(this.iconSprite.node);
        fly.setParent(parent);
        this._resolveCamera();

        const fromWorld = this.iconSprite.node.worldPosition;
        if (this._camera) {
            this._camera.convertToUINode(fromWorld, parent, this._fromUi);
            this._camera.convertToUINode(toWorld, parent, this._toUi);
            fly.setPosition(this._fromUi);
            const start = this._fromUi.clone();
            const end = this._toUi.clone();
            const ctrl = new Vec3((start.x + end.x) * 0.5, Math.max(start.y, end.y) + 40, 0);
            const state = { t: 0 };
            tween(state)
                .to(
                    0.28,
                    { t: 1 },
                    {
                        onUpdate: () => {
                            TweenUtil.quadraticBezier(this._flyOut, start, ctrl, end, state.t);
                            fly.setPosition(this._flyOut);
                        },
                    },
                )
                .call(() => {
                    if (fly.isValid) {
                        fly.destroy();
                    }
                })
                .start();
            return;
        }

        fly.setWorldPosition(fromWorld);
        TweenUtil.hopToWorld(fly, toWorld, 0.28, 40, () => {
            if (fly.isValid) {
                fly.destroy();
            }
        });
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

    private _resolveCamera(): void {
        if (this._camera?.isValid) {
            return;
        }
        const scene = director.getScene();
        const cams = scene?.getComponentsInChildren(Camera) ?? [];
        this._camera =
            cams.find((c) => c.node.name.toLowerCase().includes('main')) ??
            cams.find((c) => c.projection === Camera.ProjectionType.PERSPECTIVE) ??
            cams[0] ??
            null;
    }
}
