/** 全局游戏事件名常量 */
export const GameEvents = {
    PHASE_CHANGED: 'phase_changed',
    /** 滚木在蓝线固定：跑酷段结束；隐藏电锯/加长道具；玩家切防守移动 */
    LOG_FIXED: 'log_fixed',
    /** 蓝线长度不足：滚木淡出失败；不进入 CombatGuide/建造 */
    LOG_FAILED: 'log_failed',
    /** 左右墙均建完：隐藏预置怪/黄蓝线；滚木保留（ParkourContent 子树外） */
    BOTH_WALLS_COMPLETE: 'both_walls_complete',
    COIN_CHANGED: 'coin_changed',
    HP_CHANGED: 'hp_changed',
    /** 英雄召唤碑解锁后请求二选一 UI（P5-002 监听） */
    HERO_SELECT_REQUESTED: 'hero_select_requested',
    /** 单次建造完成（墙/兵营/塔等） */
    BUILD_COMPLETE: 'build_complete',
    /** 左右高级塔均建完 */
    BOTH_ADVANCED_TOWERS_COMPLETE: 'both_advanced_towers_complete',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
