import { Animation, instantiate, Node, Prefab, Vec3 } from 'cc';
import { onAnimFinished } from './AnimUtil';

export type EnemyHitSource =
    | 'hero'
    | 'player-arrow'
    | 'soldier-ranged'
    | 'soldier-melee';

type EnemyHitVfxKind = 'blue' | 'yellow';

export function playEnemyHitVfx(
    enemyNode: Node,
    bluePrefab: Prefab | null,
    yellowPrefab: Prefab | null,
    source: EnemyHitSource,
): void {
    const kind: EnemyHitVfxKind = source === 'hero' ? 'blue' : 'yellow';
    const prefab = kind === 'blue' ? bluePrefab : yellowPrefab;
    const effectRoot = enemyNode.scene?.getChildByName('GameRoot')?.getChildByName('Effect');
    if (!prefab || !effectRoot?.isValid) {
        return;
    }

    const worldPosition = new Vec3();
    enemyNode.getWorldPosition(worldPosition);

    let effect: Node;
    try {
        effect = instantiate(prefab);
    } catch (_error) {
        return;
    }

    effectRoot.addChild(effect);
    effect.setWorldPosition(worldPosition);
    effect.active = true;

    const animation = effect.getComponent(Animation) ?? effect.getComponentInChildren(Animation);
    const clipName = kind === 'blue' ? 'hit_blue' : 'hit_yellow';
    if (!animation || !animation.getState(clipName)) {
        effect.destroy();
        return;
    }

    animation.playOnLoad = false;
    onAnimFinished(animation.node, () => {
        if (effect.isValid) {
            effect.destroy();
        }
    });
    animation.play(clipName);
}
