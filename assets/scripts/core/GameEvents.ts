/** 全局游戏事件名常量 */
export const GameEvents = {
    PHASE_CHANGED: 'phase_changed',
    COIN_CHANGED: 'coin_changed',
    HP_CHANGED: 'hp_changed',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
