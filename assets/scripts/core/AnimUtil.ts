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
