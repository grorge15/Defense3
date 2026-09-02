import { _decorator, Component, Label, Node, Sprite, UITransform, Vec3 } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 通用血条 UI：听 HP_CHANGED(node, hp, max)；可选跟随世界锚点。
 * 玩家/小怪/Boss 用不同 prefab 结构（绿条 / 红条 / 红+白缓冲+Label）。
 * §6.5：红条 fillRange 即时；白缓冲条在 lateUpdate 按 GameConfig.hpBarBufferLerpSpeed 逼近。
 */
@ccclass('HpBarUI')
export class HpBarUI extends Component {
    @property({ type: Node, tooltip: '监听血量的目标节点；空则需运行时 bindTarget' })
    targetNode: Node | null = null;

    @property({ type: Node, tooltip: '世界跟随锚点（如 HpBarAnchor）；空则不跟随' })
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

    private _bufferRatio = 1;
    private readonly _world = new Vec3();
    private readonly _ui = new Vec3();

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.HP_CHANGED, this._onHpChanged, this);
        this._applyRatio(1, 1, true);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.HP_CHANGED, this._onHpChanged, this);
    }

    bindTarget(target: Node | null, followAnchor: Node | null = null): void {
        this.targetNode = target;
        if (followAnchor) {
            this.followAnchor = followAnchor;
        }
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
            this.valueLabel.string = `${Math.ceil(hp)}/${Math.ceil(cap)}`;
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

    private _followAnchor(): void {
        if (!this.followAnchor || !this.followAnchor.isValid) {
            return;
        }
        this.followAnchor.getWorldPosition(this._world);
        const parent = this.node.parent;
        const parentUi = parent?.getComponent(UITransform);
        if (parentUi) {
            parentUi.convertToNodeSpaceAR(this._world, this._ui);
            this.node.setPosition(this._ui.x, this._ui.y, 0);
        } else {
            this.node.setWorldPosition(this._world);
        }
    }
}
