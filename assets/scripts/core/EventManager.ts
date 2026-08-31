import { EventTarget } from 'cc';
import { GameEventName } from './GameEvents';

/** 全局事件总线，跨组件通信统一入口 */
export class EventManager extends EventTarget {
    private static _instance: EventManager | null = null;

    public static get instance(): EventManager {
        if (!EventManager._instance) {
            EventManager._instance = new EventManager();
        }
        return EventManager._instance;
    }

    public emitEvent(event: GameEventName, ...args: unknown[]): void {
        this.emit(event, ...args);
    }

    public onEvent(event: GameEventName, callback: (...args: unknown[]) => void, target?: unknown): void {
        this.on(event, callback, target);
    }

    public offEvent(event: GameEventName, callback?: (...args: unknown[]) => void, target?: unknown): void {
        this.off(event, callback, target);
    }
}
