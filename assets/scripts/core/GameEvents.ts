/** 全局游戏事件名常量 */
export const GameEvents = {
    PHASE_CHANGED: 'phase_changed',
    /** 滚木在蓝线固定：跑酷玩法结束，玩家切防守移动，墙地块出现 */
    LOG_FIXED: 'log_fixed',
    /** 左右墙均建完：隐藏跑酷段物件、呈现塔防段场景（滚木保留） */
    BOTH_WALLS_COMPLETE: 'both_walls_complete',
    COIN_CHANGED: 'coin_changed',
    HP_CHANGED: 'hp_changed',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
