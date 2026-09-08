import { Node, Vec3 } from 'cc';

const FACE_EPSILON = 0.001;

/**
 * Script-driven left/right facing for billboarded character visuals.
 * Captures the authored Visual scale once, then only flips X sign.
 */
export class VisualFacing {
    private readonly _baseScale = new Vec3(1, 1, 1);
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private _visual: Node | null = null;
    private _facingSign: -1 | 1 = 1;

    bind(visual: Node | null): void {
        if (!visual || visual === this._visual) {
            return;
        }
        this._visual = visual;
        const scale = visual.scale;
        this._baseScale.set(
            Math.abs(scale.x) > FACE_EPSILON ? Math.abs(scale.x) : 1,
            scale.y,
            scale.z,
        );
        this._facingSign = scale.x < 0 ? -1 : 1;
        this._apply();
    }

    reset(visual: Node | null): void {
        this._visual = null;
        this._facingSign = 1;
        this.bind(visual);
    }

    faceByVelocity(visual: Node | null, velocityX: number, inverted = false): void {
        this.bind(visual);
        if (Math.abs(velocityX) <= FACE_EPSILON) {
            return;
        }
        const sign: -1 | 1 = velocityX >= 0 ? 1 : -1;
        const finalSign: -1 | 1 = inverted ? (sign === 1 ? -1 : 1) : sign;
        this.faceSign(finalSign);
    }

    faceByTarget(visual: Node | null, self: Node, target: Node | null, inverted = false): void {
        if (!target?.isValid) {
            return;
        }
        self.getWorldPosition(this._selfPos);
        target.getWorldPosition(this._targetPos);
        this.faceByVelocity(visual, this._targetPos.x - this._selfPos.x, inverted);
    }

    private faceSign(sign: -1 | 1): void {
        if (this._facingSign === sign) {
            return;
        }
        this._facingSign = sign;
        this._apply();
    }

    private _apply(): void {
        if (!this._visual?.isValid) {
            return;
        }
        this._visual.setScale(
            this._baseScale.x * this._facingSign,
            this._baseScale.y,
            this._baseScale.z,
        );
    }
}
