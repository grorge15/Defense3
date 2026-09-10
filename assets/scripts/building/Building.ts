import { _decorator, Component } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 可受小怪攻击的建筑基类（城墙、矮墙等）。
 * 滚木由 Log.ts 单独实现同类接口，索敌时同样视为建筑。
 */
@ccclass('Building')
export class Building extends Component {
    @property({ tooltip: '最大血量；0 表示使用 GameConfig.barrierMaxHp' })
    maxHp = 0;

    private _hp = 0;

    onLoad(): void {
        const cap = this.maxHp > 0 ? this.maxHp : GameConfig.barrierMaxHp;
        this._hp = cap;
    }

    isAlive(): boolean {
        return this._hp > 0 && this.node.active;
    }

    takeDamage(amount: number): void {
        if (!this.isAlive()) {
            return;
        }
        const cap = this.maxHp > 0 ? this.maxHp : GameConfig.barrierMaxHp;
        this._hp -= amount;
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            cap,
        );
        if (this._hp <= 0) {
            this._onDestroyed();
        }
    }

    protected _onDestroyed(): void {
        this.node.active = false;
        EventManager.instance.emitEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED);
    }
}
