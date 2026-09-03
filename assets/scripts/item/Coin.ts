import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameConfig } from '../core/GameConfig';
import { TweenUtil } from '../core/TweenUtil';

const { ccclass, property } = _decorator;

/**
 * 金币：生成后立即朝玩家带弧飞行；进入拾取距离后回调并销毁（余额由 CoinSystem 同步 UI）。
 */
@ccclass('Coin')
export class Coin extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点' })
    visualNode: Node | null = null;

    private _target: Node | null = null;
    private _amount = 1;
    private _onCollected: ((amount: number) => void) | null = null;
    private _consumed = false;
    private _magnetizing = false;
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _nextPos = new Vec3();
    private readonly _ctrl = new Vec3();
    private readonly _magnetFrom = new Vec3();
    private _magnetT = 0;
    private _magnetDur = 0.4;

    /**
     * @param dropFrom 已废弃：不再做落地抛物线；保留参数以免调用方编译失败
     */
    setup(
        target: Node | null,
        amount: number,
        onCollected: (amount: number) => void,
        _dropFrom: Vec3 | null = null,
    ): void {
        void _dropFrom;
        this._target = target;
        this._amount = Math.max(1, amount | 0);
        this._onCollected = onCollected;
        this._consumed = false;
        this._magnetizing = false;
    }

    update(dt: number): void {
        if (this._consumed) {
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

        if (!this._magnetizing) {
            this._magnetizing = true;
            this._magnetT = 0;
            this._magnetFrom.set(this._selfPos);
            const speed = Math.max(0.1, GameConfig.coinMagnetSpeed);
            this._magnetDur = Math.min(1.5, Math.max(0.12, dist / speed));
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
