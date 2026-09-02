import { Animation, Node } from 'cc';

/**
 * 脚本 clip 名（camelCase）→ Animation 组件 clip 名（snake_case）映射。
 * 见 docs/ANIM_MANIFEST.md
 */
const CLIP_NAME_MAP: Record<string, string> = {
    meleeAttack: 'melee_attack',
    remoteAttack: 'remote_attack',
};

/**
 * 在节点上播放指定动画 clip。
 * @param node 挂有 Animation 组件的节点（通常为 Visual）
 * @param clipName 脚本侧 clip 名，如 'idle'、'meleeAttack'
 */
export function playAnim(node: Node, clipName: string): void {
    const anim = node.getComponent(Animation);
    if (!anim) {
        return;
    }
    const resolvedName = CLIP_NAME_MAP[clipName] ?? clipName;
    anim.play(resolvedName);
}

/**
 * 播放动画并在 clip 播放完成时回调一次。
 */
export function playAnimWithCallback(
    node: Node,
    clipName: string,
    callback: () => void,
): void {
    const anim = node.getComponent(Animation);
    if (!anim) {
        return;
    }
    const resolvedName = CLIP_NAME_MAP[clipName] ?? clipName;
    anim.once(Animation.EventType.FINISHED, callback);
    anim.play(resolvedName);
}

/**
 * 监听指定 clip 播放完成（不自动播放）。
 */
export function onAnimFinished(node: Node, callback: () => void): void {
    const anim = node.getComponent(Animation);
    if (!anim) {
        return;
    }
    anim.once(Animation.EventType.FINISHED, callback);
}
