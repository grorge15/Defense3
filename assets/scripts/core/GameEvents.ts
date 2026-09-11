/** 全局游戏事件名常量 */
export const GameEvents = {
    PHASE_CHANGED: 'phase_changed',
    /** 滚木到达蓝线：跑酷段结束；不代表滚木固定成功 */
    PARKOUR_FINISHED: 'parkour_finished',
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
    /** 滚木增长道具被玩家或关联滚木成功接受消费（item, log） */
    LOG_EXTEND_ITEM_CONSUMED: 'log_extend_item_consumed',
    /** 左右高级塔均建完 */
    BOTH_ADVANCED_TOWERS_COMPLETE: 'both_advanced_towers_complete',
    /**
     * Boss 索敌名单注册/更新。
     * payload: { node: Node, kind: 'player'|'hero'|'soldier'|'building'|'barrier'|'log', buildOrder?: number }
     * 优先级：soldier > Structure(building/barrier/log) > hero > player；Structure 内按建造顺序。
     */
    BOSS_TARGET_REGISTER: 'boss_target_register',
    /** Enemy shared navigation obstacle snapshot must be rebuilt. */
    ENEMY_NAVIGATION_INVALIDATED: 'enemy_navigation_invalidated',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
