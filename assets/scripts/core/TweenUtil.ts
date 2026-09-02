import { Node, Vec3, tween, UIOpacity } from 'cc';

const _tmpA = new Vec3();
const _tmpB = new Vec3();
const _tmpOut = new Vec3();

/**
 * 轻量轨迹工具：二次贝塞尔世界位移 / 透明度淡出。
 * 禁止依赖 oops；供金币、道具、滚木等复用。
 */
export class TweenUtil {
    /** 二次贝塞尔：t∈[0,1] */
    static quadraticBezier(out: Vec3, p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 {
        const u = 1 - t;
        const uu = u * u;
        const tt = t * t;
        out.x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x;
        out.y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y;
        out.z = uu * p0.z + 2 * u * t * p1.z + tt * p2.z;
        return out;
    }

    /**
     * 世界坐标抛物线：从 from 到 to，控制点抬高 arcHeight（沿 Y）。
     */
    static moveWorldParabola(
        node: Node,
        from: Vec3,
        to: Vec3,
        duration: number,
        arcHeight: number,
        onComplete?: () => void,
    ): void {
        const p0 = from.clone();
        const p2 = to.clone();
        const p1 = new Vec3(
            (p0.x + p2.x) * 0.5,
            Math.max(p0.y, p2.y) + arcHeight,
            (p0.z + p2.z) * 0.5,
        );
        const state = { t: 0 };
        tween(state)
            .to(
                Math.max(0.01, duration),
                { t: 1 },
                {
                    onUpdate: () => {
                        TweenUtil.quadraticBezier(_tmpOut, p0, p1, p2, state.t);
                        node.setWorldPosition(_tmpOut);
                    },
                },
            )
            .call(() => onComplete?.())
            .start();
    }

    /** UIOpacity 淡出到 0 */
    static fadeOutOpacity(node: Node, duration: number, onComplete?: () => void): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 255;
        tween(opacity)
            .to(Math.max(0.01, duration), { opacity: 0 })
            .call(() => onComplete?.())
            .start();
    }

    /** 短弧飞向目标后回调（道具拾取） */
    static hopToWorld(
        node: Node,
        targetWorld: Vec3,
        duration: number,
        arcHeight: number,
        onComplete?: () => void,
    ): void {
        node.getWorldPosition(_tmpA);
        TweenUtil.moveWorldParabola(node, _tmpA, targetWorld, duration, arcHeight, onComplete);
    }

    static stopTweensOn(node: Node): void {
        tween(node).stop();
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity).stop();
        }
    }
}
