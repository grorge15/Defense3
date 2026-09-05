import { _decorator, Camera, Component, Label, Node, Sprite, UITransform, Vec3, director } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { HealthSystem } from '../game/HealthSystem';

const { ccclass, property } = _decorator;

/**
 * 通用血条 UI：听 HP_CHANGED(node, hp, max)；跟随世界锚点（主相机 convertToUINode）。
 * 头顶偏移 = Visual UITransform 高度（含 scale/锚点）+ 额外间隙，避免与贴图重叠。
 */
@ccclass('HpBarUI')
export class HpBarUI extends Component {
    @property({ type: Node, tooltip: '监听血量的目标节点；空则需运行时 bindTarget' })
    targetNode: Node | null = null;

    @property({ type: Node, tooltip: '世界跟随锚点（通常为 Visual）；空则不跟随' })
    followAnchor: Node | null = null;

    @property({ type: Sprite, tooltip: '主血条填充（FILLED 横向）' })
    fillSprite: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Boss 白缓冲条；非 Boss 可空' })
    bufferSprite: Sprite | null = null;

    @property({ type: Label, tooltip: 'Boss 数值 Label；可空' })
    valueLabel: Label | null = null;

    @property({ tooltip: '满血时隐藏整条（小怪）' })
    hideWhenFull = false;

    @property({ tooltip: 'hp<=0 时隐藏' })
    hideWhenDead = true;

    @property({ tooltip: '叠在 Visual 顶部之上的额外世界间隙' })
    followOffsetY = 12;

    @property({ tooltip: 'Label 是否显示 max（false 则只显示当前 hp，Boss 用）' })
    showMaxInLabel = true;

    private _bufferRatio = 1;
    private _camera: Camera | null = null;
    private readonly _world = new Vec3();
    private readonly _ui = new Vec3();
    private readonly _ws = new Vec3();

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.HP_CHANGED, this._onHpChanged, this);
        this._resolveCamera();
        this._applyRatio(1, 1, true);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.HP_CHANGED, this._onHpChanged, this);
    }

    bindTarget(target: Node | null, followAnchor: Node | null = null): void {
        this.targetNode = target;
        if (followAnchor) {
            this.followAnchor = followAnchor;
        } else if (target) {
            this.followAnchor = target.getChildByName('Visual') ?? target;
        }
        this._syncFromTarget();
    }

    /** 宿主无 HealthSystem 时（Hero/Boss/Log）可主动推一次满血/当前值 */
    applyHp(hp: number, maxHp: number, init = true): void {
        this._applyRatio(hp, maxHp, init);
    }

    /** 绑定后立刻同步一次，避免早于血条创建的 HP_CHANGED 丢失 */
    private _syncFromTarget(): void {
        if (!this.targetNode) {
            return;
        }
        const hs = this.targetNode.getComponent(HealthSystem);
        if (hs) {
            this._applyRatio(hs.currentHp, hs.getMaxHp(), true);
            return;
        }
        // Boss / Log / Hero 等非 HealthSystem：保持 onLoad 满血态，等宿主 emit 或 applyHp
    }

    lateUpdate(dt: number): void {
        this._followAnchor();
        if (!this.bufferSprite || !this.fillSprite) {
            return;
        }
        const target = this.fillSprite.fillRange;
        if (Math.abs(this._bufferRatio - target) < 0.001) {
            this._bufferRatio = target;
            this.bufferSprite.fillRange = target;
            return;
        }
        const speed = GameConfig.hpBarBufferLerpSpeed;
        const t = 1 - Math.exp(-speed * Math.max(0, dt));
        this._bufferRatio += (target - this._bufferRatio) * t;
        this.bufferSprite.fillRange = this._bufferRatio;
    }

    private _resolveCamera(): void {
        if (this._camera && this._camera.isValid) {
            return;
        }
        const scene = director.getScene();
        if (!scene) {
            return;
        }
        const cams = scene.getComponentsInChildren(Camera);
        this._camera =
            cams.find((c) => c.node.name.toLowerCase().includes('main')) ??
            cams.find((c) => c.projection === Camera.ProjectionType.PERSPECTIVE) ??
            cams[0] ??
            null;
    }

    private _onHpChanged = (...args: unknown[]): void => {
        const node = args[0] as Node | null;
        if (!this.targetNode || !node || node !== this.targetNode) {
            return;
        }
        const hp = typeof args[1] === 'number' ? args[1] : 0;
        const max = typeof args[2] === 'number' ? args[2] : 1;
        this._applyRatio(hp, max, false);
    };

    private _applyRatio(hp: number, max: number, init: boolean): void {
        const cap = Math.max(1, max);
        const ratio = Math.max(0, Math.min(1, hp / cap));

        if (this.fillSprite) {
            this.fillSprite.fillRange = ratio;
        }
        if (init && this.bufferSprite) {
            this._bufferRatio = ratio;
            this.bufferSprite.fillRange = ratio;
        }
        if (this.valueLabel) {
            this.valueLabel.string = this.showMaxInLabel
                ? `${Math.ceil(hp)}/${Math.ceil(cap)}`
                : `${Math.ceil(hp)}`;
        }

        const full = ratio >= 0.999;
        const dead = hp <= 0;
        let show = true;
        if (this.hideWhenFull && full) {
            show = false;
        }
        if (this.hideWhenDead && dead) {
            show = false;
        }
        this.node.active = show;
    }

    /** Visual 世界高度：contentSize.height × |worldScale.y|，再按 anchorY 算到顶部 */
    private _visualTopOffsetY(visual: Node): number {
        const ui = visual.getComponent(UITransform);
        visual.getWorldScale(this._ws);
        const scaleY = Math.abs(this._ws.y) || 1;
        if (!ui) {
            return this.followOffsetY;
        }
        const h = Math.abs(ui.contentSize.height) * scaleY;
        // anchorY=0（脚底）→ 顶部在 +h；anchorY=0.5 → 顶部在 +h/2
        const toTop = h * (1 - ui.anchorPoint.y);
        return toTop + this.followOffsetY;
    }

    private _followAnchor(): void {
        if (!this.followAnchor || !this.followAnchor.isValid) {
            return;
        }
        this._resolveCamera();
        this.followAnchor.getWorldPosition(this._world);
        this._world.y += this._visualTopOffsetY(this.followAnchor);

        const parent = this.node.parent;
        if (this._camera && parent) {
            this._camera.convertToUINode(this._world, parent, this._ui);
            this.node.setPosition(this._ui.x, this._ui.y, 0);
            return;
        }
        this.node.setWorldPosition(this._world);
    }
}
