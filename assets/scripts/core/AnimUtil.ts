import { Animation, Node } from 'cc';
import { AttackFrameRelay } from './AttackFrameRelay';

/**
 * 脚本 clip 名（camelCase）→ Animation 组件 clip 名（snake_case）映射。
 * 见 docs/ANIM_MANIFEST.md
 */
const CLIP_NAME_MAP: Record<string, string> = {
    meleeAttack: 'melee_attack',
    remoteAttack: 'remote_attack',
};

/** 攻击 clip 内帧事件函数名（与 .anim `_events[].func` 一致） */
export const ATTACK_FRAME_HIT = 'onAttackFrameHit';

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
 * 播放攻击动画，并在 clip 帧事件 `onAttackFrameHit` 触发时回调一次。
 * 须在对应 .anim 的 `_events` 中配置该事件（见各单位 attack clip）。
 * @param fallbackDelaySec 若帧事件未触发，延迟兜底调用（须小于 clip 时长，避免 FINISHED 解锁后才出弹）
 * @param onFinished 整段攻击 clip 播完（可选）
 */
export function playAttackWithFrameHit(
    visual: Node,
    clipName: string,
    onHit: () => void,
    fallbackDelaySec = 0.45,
    onFinished?: () => void,
): void {
    const relay =
        visual.getComponent(AttackFrameRelay) ?? visual.addComponent(AttackFrameRelay);
    relay.unscheduleAllCallbacks();

    const token = ++relay.attackToken;
    let fired = false;
    const wrap = (): void => {
        if (fired || relay.attackToken !== token) {
            return;
        }
        fired = true;
        onHit();
    };
    relay.handler = wrap;

    const anim = visual.getComponent(Animation);
    const resolvedName = CLIP_NAME_MAP[clipName] ?? clipName;

    if (anim && onFinished) {
        const onFin = (): void => {
            if (relay.attackToken !== token) {
                return;
            }
            onFinished();
        };
        anim.once(Animation.EventType.FINISHED, onFin);
    }

    if (anim) {
        anim.play(resolvedName);
    }

    // 帧事件丢失时兜底；必须在 clip 结束前，避免位移动画已接管后才出弹
    if (fallbackDelaySec > 0) {
        relay.scheduleOnce(() => {
            if (relay.attackToken === token && relay.handler === wrap) {
                relay.onAttackFrameHit();
            }
        }, fallbackDelaySec);
    }
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
