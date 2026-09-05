import { Color, Node, Sprite, Tween, tween } from 'cc';
import { GameConfig } from './GameConfig';

const _baseColors = new WeakMap<Sprite, Color>();

/**
 * 受击闪红：短暂把 Visual 上 Sprite 染红后复原。
 * 基底色按 Sprite 缓存，避免连环闪红把「当前红」当成原色导致卡红。
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

        let base = _baseColors.get(sprite);
        if (!base) {
            const c = sprite.color;
            const looksFlash = c.r >= 200 && c.g <= 100 && c.b <= 100;
            base = looksFlash ? new Color(255, 255, 255, c.a) : c.clone();
            _baseColors.set(sprite, base);
        }

        Tween.stopAllByTarget(sprite);
        sprite.color = new Color(255, 80, 80, base.a);
        const restore = base;
        tween(sprite)
            .delay(Math.max(0.02, duration))
            .call(() => {
                if (sprite.isValid) {
                    sprite.color = restore.clone();
                }
            })
            .start();
    }
}
