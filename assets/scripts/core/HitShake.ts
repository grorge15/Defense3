import { Node, Tween, Vec3, tween } from 'cc';

const _basePos = new WeakMap<Node, Vec3>();

/**
 * 受击轻抖：短时扰动本地 XY 后复原。
 */
export class HitShake {
    static shake(
        visual: Node | null,
        amplitude = 3,
        duration = 0.1,
    ): void {
        if (!visual || !visual.isValid) {
            return;
        }

        let base = _basePos.get(visual);
        if (!base) {
            base = visual.position.clone();
            _basePos.set(visual, base);
        }

        Tween.stopAllByTarget(visual);
        visual.setPosition(base);
        const amp = Math.max(0.5, amplitude);
        const half = Math.max(0.03, duration * 0.5);
        const restore = base.clone();
        tween(visual)
            .to(half, {
                position: new Vec3(restore.x + amp, restore.y - amp * 0.5, restore.z),
            })
            .to(half, { position: restore })
            .call(() => {
                if (visual.isValid) {
                    visual.setPosition(restore);
                }
            })
            .start();
    }
}
