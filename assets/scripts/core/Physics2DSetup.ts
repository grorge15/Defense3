import { _decorator, Component, Node, PhysicsSystem2D, RigidBody2D, Vec2 } from 'cc';

const { ccclass } = _decorator;

/**
 * 2D 物理全局约束：启用物理、零重力、禁止旋转。
 * 不做每帧 setWorldPosition（会清掉 Dynamic 速度）。
 */
@ccclass('Physics2DSetup')
export class Physics2DSetup extends Component {
    private readonly _configured = new WeakSet<RigidBody2D>();

    onLoad(): void {
        const phys = PhysicsSystem2D.instance;
        if (!phys) {
            console.error('[Physics2DSetup] PhysicsSystem2D missing — 请在项目设置启用 2D 物理');
            return;
        }
        phys.enable = true;
        phys.gravity = new Vec2(0, 0);
        // 保证步进开启；速度驱动依赖物理更新
        this._configureBodies(this.node.scene ?? this.node);
    }

    lateUpdate(): void {
        const root = this.node.scene;
        if (!root) {
            return;
        }
        this._configureBodies(root);
    }

    private _configureBodies(root: Node): void {
        const bodies = root.getComponentsInChildren(RigidBody2D);
        for (const rb of bodies) {
            if (!rb.isValid || this._configured.has(rb)) {
                continue;
            }
            rb.gravityScale = 0;
            rb.fixedRotation = true;
            rb.allowSleep = false;
            this._configured.add(rb);
        }
    }
}
