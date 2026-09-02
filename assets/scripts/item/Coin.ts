import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameConfig } from '../core/GameConfig';
import { TweenUtil } from '../core/TweenUtil';

const { ccclass, property } = _decorator;

/**
 * 金币：掉落后短抛物线落地，再朝玩家带弧吸附；进入拾取距离后回调并销毁。
 */
@ccclass('Coin')
export class Coin extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _target: Node | null = null;
    private _amount = 1;
    private _onCollected: ((amount: number) => void) | null = null;
    private _consumed = false;
    private _dropping = false;
    private _magnetizing = false;
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _nextPos = new Vec3();
    private readonly _ctrl = new Vec3();
    private readonly _magnetFrom = new Vec3();
    private _magnetT = 0;
    private _magnetDur = 0.4;

    /**
     * @param dropFrom 若提供，先从此点抛物线落到当前节点世界坐标（落地目标）
     */
    setup(
        target: Node | null,
        amount: number,
        onCollected: (amount: number) => void,
        dropFrom: Vec3 | null = null,
    ): void {
        this._target = target;
        this._amount = Math.max(1, amount | 0);
        this._onCollected = onCollected;
        this._consumed = false;
        this._magnetizing = false;
        this._dropping = false;

        if (dropFrom) {
            const land = new Vec3();
            this.node.getWorldPosition(land);
            this._dropping = true;
            this.node.setWorldPosition(dropFrom);
            TweenUtil.moveWorldParabola(
                this.node,
                dropFrom,
                land,
                GameConfig.coinDropArcDuration,
                GameConfig.coinDropArcHeight,
                () => {
                    this._dropping = false;
                },
            );
        }
    }

    update(dt: number): void {
        if (this._consumed || this._dropping) {
            return;
        }
        if (!this._target || !this._target.isValid || !this._target.active) {
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        this._target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= GameConfig.coinPickupRange) {
            this._collect();
            return;
        }

        if (dist > GameConfig.coinMagnetRange || dist < 1e-5) {
            this._magnetizing = false;
            return;
        }

        if (!this._magnetizing) {
            this._magnetizing = true;
            this._magnetT = 0;
            this._magnetFrom.set(this._selfPos);
            const speed = Math.max(0.1, GameConfig.coinMagnetSpeed);
            this._magnetDur = Math.min(1.2, Math.max(0.15, dist / speed));
        }

        this._magnetT += dt;
        const t = Math.min(1, this._magnetT / this._magnetDur);
        this._target.getWorldPosition(this._targetPos);
        this._ctrl.set(
            (this._magnetFrom.x + this._targetPos.x) * 0.5,
            Math.max(this._magnetFrom.y, this._targetPos.y) + GameConfig.coinMagnetArcHeight,
            (this._magnetFrom.z + this._targetPos.z) * 0.5,
        );
        TweenUtil.quadraticBezier(this._nextPos, this._magnetFrom, this._ctrl, this._targetPos, t);
        this.node.setWorldPosition(this._nextPos);

        if (t >= 1) {
            this._collect();
        }
    }

    private _collect(): void {
        if (this._consumed) {
            return;
        }
        this._consumed = true;
        TweenUtil.stopTweensOn(this.node);
        const cb = this._onCollected;
        const amount = this._amount;
        this._onCollected = null;
        cb?.(amount);
        this.node.destroy();
    }
}
