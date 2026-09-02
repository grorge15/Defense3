import { Color, Node, Sprite, tween } from 'cc';
import { GameConfig } from './GameConfig';

/**
 * 受击闪红：短暂把 Visual 上 Sprite 染红后复原。
 */
export class HitFlash {
    static flash(visual: Node | null, duration = GameConfig.hitFlashDuration): void {
        if (!visual || !visual.isValid) {
            return;
        }
        const sprite = visual.getComponent(Sprite) ?? visual.getComponentInChildren(Sprite);
        if (!sprite) {
            return;
        }
        const original = sprite.color.clone();
        tween(sprite)
            .stop();
        sprite.color = new Color(255, 80, 80, original.a);
        tween(sprite)
            .delay(Math.max(0.02, duration))
            .call(() => {
                if (sprite.isValid) {
                    sprite.color = original;
                }
            })
            .start();
    }
}
