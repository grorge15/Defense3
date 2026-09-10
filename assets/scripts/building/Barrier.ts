import { _decorator, Collider2D, Component, Node } from 'cc';
import { GameConfig } from '../core/GameConfig';
import { HitFlash } from '../core/HitFlash';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 场景阻挡物：有血量、可受伤；与 Wall（矮墙无血量）职责分离。
 */
@ccclass('Barrier')
export class Barrier extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ type: Node, tooltip: '血条挂点；满血时可隐藏，UI 属 §5' })
    hpBarAnchor: Node | null = null;

    private _maxHp = 0;
    private _hp = 0;
    private _collider: Collider2D | null = null;
    private _dead = false;

    onLoad(): void {
        this._maxHp = GameConfig.barrierMaxHp;
        this._hp = this._maxHp;
        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = false;
        }
        this._updateHpBarVisibility();
    }

    get maxHp(): number {
        return this._maxHp;
    }

    get hp(): number {
        return this._hp;
    }

    isAlive(): boolean {
        return !this._dead && this._hp > 0 && this.node.active;
    }

    takeDamage(amount: number): void {
        if (this._dead || amount <= 0) {
            return;
        }

        this._hp = Math.max(0, this._hp - amount);
        this.flashRed();
        this._updateHpBarVisibility();

        if (this._hp <= 0) {
            this._die();
        }
    }

    flashRed(): void {
        HitFlash.flash(this.visualNode ?? this.node);
    }

    private _die(): void {
        this._dead = true;
        if (this._collider) {
            this._collider.enabled = false;
        }
        this.node.active = false;
        EventManager.instance.emitEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED);
    }

    private _updateHpBarVisibility(): void {
        if (!this.hpBarAnchor) {
            return;
        }
        this.hpBarAnchor.active = this._hp < this._maxHp && this._hp > 0;
    }
}
