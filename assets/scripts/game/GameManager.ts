import { _decorator, Component } from 'cc';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GamePhase } from './GamePhase';

const { ccclass } = _decorator;

/**
 * 全局阶段状态管理（单例 Component）。
 * 仅负责 currentPhase 与 PHASE_CHANGED 事件；场景显隐由 PhaseTransition 等系统处理。
 */
@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    private _currentPhase: GamePhase = GamePhase.RunParkour;

    public static get instance(): GameManager | null {
        return GameManager._instance;
    }

    onLoad(): void {
        if (GameManager._instance && GameManager._instance !== this) {
            this.destroy();
            return;
        }
        GameManager._instance = this;
    }

    onDestroy(): void {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
    }

    public getPhase(): GamePhase {
        return this._currentPhase;
    }

    public setPhase(phase: GamePhase): void {
        if (this._currentPhase === phase) {
            return;
        }
        this._currentPhase = phase;
        console.log(`[GameManager] phase_changed: ${phase}`);
        EventManager.instance.emitEvent(GameEvents.PHASE_CHANGED, phase);
    }
}
