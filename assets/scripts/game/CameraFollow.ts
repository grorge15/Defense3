import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/**
 * 透视主相机跟随目标（XY 平面玩法）：
 * desired = target + GameConfig.cameraFollowOffset（默认沿 +Z）；
 * 只改 position，不继承目标旋转；摇杆等 UI 由 UICamera 渲染，不依赖本相机。
 * zoomOut：缓动增大 Z 偏移实现拉远。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property({ type: Node, tooltip: '跟随目标（通常为玩家）' })
    target: Node | null = null;

    private readonly _desired = new Vec3();
    private readonly _current = new Vec3();
    private readonly _targetPos = new Vec3();
    private _snapped = false;

    private _zoomExtraZ = 0;
    private _zoomFrom = 0;
    private _zoomTo = 0;
    private _zoomElapsed = 0;
    private _zoomDuration = 0;
    private _zooming = false;

    start(): void {
        this._snapToTarget();
    }

    lateUpdate(dt: number): void {
        if (this._zooming) {
            this._zoomElapsed += Math.max(dt, 0);
            const t =
                this._zoomDuration <= 0
                    ? 1
                    : Math.min(1, this._zoomElapsed / this._zoomDuration);
            // smoothstep
            const s = t * t * (3 - 2 * t);
            this._zoomExtraZ = this._zoomFrom + (this._zoomTo - this._zoomFrom) * s;
            if (t >= 1) {
                this._zooming = false;
                this._zoomExtraZ = this._zoomTo;
            }
        }

        if (!this.target || !this.target.isValid) {
            return;
        }

        this._computeDesired();
        if (!this._snapped) {
            this.node.setWorldPosition(this._desired);
            this._snapped = true;
            return;
        }

        this.node.getWorldPosition(this._current);
        const followT = Math.min(1, GameConfig.cameraFollowSmooth * Math.max(dt, 0));
        this._current.x += (this._desired.x - this._current.x) * followT;
        this._current.y += (this._desired.y - this._current.y) * followT;
        this._current.z += (this._desired.z - this._current.z) * followT;
        this.node.setWorldPosition(this._current);
    }

    private _snapToTarget(): void {
        if (!this.target || !this.target.isValid) {
            return;
        }
        this._computeDesired();
        this.node.setWorldPosition(this._desired);
        this._snapped = true;
    }

    private _computeDesired(): void {
        this.target!.getWorldPosition(this._targetPos);
        this._desired.set(
            this._targetPos.x + GameConfig.cameraFollowOffsetX,
            this._targetPos.y + GameConfig.cameraFollowOffsetY,
            this._targetPos.z + GameConfig.cameraFollowOffsetZ + this._zoomExtraZ,
        );
    }

    /**
     * 大招拉远：在默认 follow offset 上再沿 +Z 缓动 `distance`。
     */
    zoomOut(distance: number, duration: number): void {
        this._zoomFrom = this._zoomExtraZ;
        this._zoomTo = this._zoomExtraZ + Math.max(0, distance);
        this._zoomDuration = Math.max(0, duration);
        this._zoomElapsed = 0;
        this._zooming = this._zoomDuration > 0;
        if (!this._zooming) {
            this._zoomExtraZ = this._zoomTo;
        }
    }
}
