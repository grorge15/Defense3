import { _decorator, Component } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

/**
 * 通用血量：takeDamage / heal / 死亡回调；emit HP_CHANGED(node, hp, max)。
 */
@ccclass('HealthSystem')
export class HealthSystem extends Component {
    @property({ tooltip: '最大血量；0 表示使用 GameConfig.playerMaxHp' })
    maxHp = 0;

    /** 死亡时回调（由宿主如 Player 设置） */
    public onDeath: (() => void) | null = null;

    private _currentHp = 0;
    private _isDead = false;

    onLoad(): void {
        const cap = this._maxHp();
        this._currentHp = cap;
        this._isDead = false;
    }

    get currentHp(): number {
        return this._currentHp;
    }

    get isDead(): boolean {
        return this._isDead;
    }

    getMaxHp(): number {
        return this._maxHp();
    }

    resetHp(): void {
        this._currentHp = this._maxHp();
        this._isDead = false;
        this._emitHp();
    }

    takeDamage(amount: number): void {
        if (this._isDead || amount <= 0) {
            return;
        }
        this._currentHp -= amount;
        this._emitHp();
        if (this._currentHp <= 0) {
            this._currentHp = 0;
            this._isDead = true;
            this.onDeath?.();
        }
    }

    heal(amount: number): void {
        if (this._isDead || amount <= 0) {
            return;
        }
        const cap = this._maxHp();
        this._currentHp = Math.min(cap, this._currentHp + amount);
        this._emitHp();
    }

    private _maxHp(): number {
        return this.maxHp > 0 ? this.maxHp : GameConfig.playerMaxHp;
    }

    private _emitHp(): void {
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._currentHp,
            this._maxHp(),
        );
    }
}
