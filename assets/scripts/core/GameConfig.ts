/**
 * 全局数值配置，逻辑层禁止散落魔法数。
 * hp/attack 等仅为初始参考值，后续可在编辑器或配置表覆盖。
 */
export class GameConfig {
    // --- 生命值 ---
    static readonly playerMaxHp = 400;
    static readonly heroMaxHp = 100;
    static readonly bossMaxHp = 3000;
    static readonly minionMaxHp = 15;
    static readonly soldierMaxHp = 20;
    static readonly barrierMaxHp = 2000;
    /** 箭塔 / 兵营可被 Boss 摧毁的血量 */
    static readonly towerMaxHp = 200;
    static readonly barracksMaxHp = 200;
    /** 滚木固定后作为可攻击障碍的最大生命 */
    static readonly logMaxHp = 100;
    static readonly logFixedColliderOffsetX = -2;
    static readonly logFixedColliderOffsetY = 10;
    static readonly logFixedColliderWidth = 235;
    static readonly logFixedColliderHeight = 19;

    // --- 攻击 ---
    static readonly bossAttackDamage = 90;
    /** Boss 对建筑/屏障/小兵一击拆毁伤害（≥ 各建筑 maxHp） */
    static readonly bossBuildingDamage = 200;
    static readonly playerAttackDamage = 15;
    static readonly minionAttackDamage = 10;
    /**
     * 玩家射箭冷却（秒）。须 ≥ melee_attack 时长（0.7），
     * 否则会出现「动画未结束又开下一轮」。
     */
    static readonly playerAttackInterval = 0.85;
    /** 玩家自动索敌范围（世界单位；玩法坐标为百级像素格） */
    static readonly playerAttackRange = 400;
    /** 英雄远程索敌范围（世界单位；百级像素格） */
    static readonly heroAttackRange = 360;
    /** 箭矢飞行速度（世界单位/秒） */
    static readonly arrowSpeed = 520;
    /** 箭矢命中半径（世界单位；位移驱动时物理接触常丢） */
    static readonly arrowHitRadius = 48;
    /** 箭矢最大穿透敌人数（含首命中） */
    static readonly arrowMaxPierce = 5;
    /** 玩家箭矢前 N 个命中目标造成满额 playerAttackDamage */
    static readonly arrowFullDamageHits = 3;
    /** 超过满伤命中数后，每多命中一个目标的伤害倍率 */
    static readonly arrowPierceDamageFalloff = 0.5;
    /** 箭矢最大飞行距离（世界单位） */
    static readonly arrowMaxDistance = 300;

    // --- 相机跟随（玩法在 XY 平面，主相机从 +Z 看向原点；UI 由 UICamera 单独渲染）---
    static readonly cameraFollowOffsetX = 0;
    static readonly cameraFollowOffsetY = 0;
    /** 相对目标沿 +Z 拉开的观察距离（与 Main Camera 初始 z≈1000 一致） */
    static readonly cameraFollowOffsetZ = 1000;
    /** 跟随平滑系数（越大越贴） */
    static readonly cameraFollowSmooth = 6;

    // --- 移动 ---
    static readonly playerMoveSpeed = 6;
    static readonly playerParkourForwardSpeed = 7;
    /** 黄线蓄力段前进速度（应小于 playerParkourForwardSpeed） */
    static readonly playerParkourChargeSpeed = 4;
    static readonly heroFollowSpeed = 4;
    /**
     * 英雄相对玩家的期望跟随距离（世界单位）。
     * 到达该距离后 idle；攻击中不跟随。
     */
    static readonly heroFollowDistance = 100;
    /**
     * 英雄相对玩家的软拴绳半径（世界单位）。
     * ≤0 时用 max(heroFollowDistance * 8, 12)，防止脱节。
     */
    static readonly heroFollowLeash = 0;
    /** Boss 重新索敌间隔（秒） */
    static readonly bossRetargetInterval = 3;
    /** Boss 扫描场景中新防守目标的间隔（秒） */
    static readonly bossTargetScanInterval = 1.0;
    /** 小怪开始追击的索敌半径（世界单位）；以外 idle，避免远端预置怪全挤到玩家旁 */
    static readonly minionAggroRange = 420;
    static readonly minionMoveSpeed = 4;
    static readonly bossMoveSpeed = 5;
    /** 近战小兵移速（与小怪同量级；勿用百级像素误放大） */
    static readonly soldierMoveSpeed = 6;
    /** 近战小兵重索敌间隔（秒），避免每帧全场扫描 */
    static readonly soldierRetargetInterval = 0.35;
    /** 近战小兵停步/出手距离 */
    static readonly soldierMeleeAttackRange = 40;

    // --- 共享寻路（非战斗数值） ---
    /** PathAgent full repath 最小间隔（秒），避免每帧 A*。 */
    static readonly pathRepathInterval = 1.0;
    /** 目标移动超过该距离后，下次 repath 窗口刷新路径。 */
    static readonly pathTargetMoveThreshold = 48;
    /** waypoint 视为抵达的半径（世界单位）。 */
    static readonly pathWaypointReachDistance = 28;
    /** fallback 栅格尺寸；越小越贴边，节点越多。 */
    static readonly pathGridSize = 64;
    /** 直线可达 probe 步长。 */
    static readonly pathProbeStep = 48;
    /** AABB probe 尺寸膨胀，降低贴墙穿插。 */
    static readonly pathProbePadding = 1.08;
    /** A* 单次最大展开预算。 */
    static readonly pathMaxNodes = 90;
    /** 起终点附近寻找可行栅格的最大半径。 */
    static readonly pathNearestCellRadius = 3;
    /** 以起终点包围盒外扩的寻路区域。 */
    static readonly pathBoundsPadding = 128;

    // --- Enemy shared flow-field navigation ---
    static readonly enemyFlowCellSize = 30;
    static readonly enemyFlowLookaheadCells = 20;
    static readonly enemyFlowTargetSearchCells = 8;
    static readonly enemyFlowCacheEntries = 32;
    static readonly enemyFlowCacheBytes = 8 * 1024 * 1024;
    static readonly enemyFlowMaxCells = 262144;
    static readonly enemyNavWorkUnitsPerFrame = 4096;
    static readonly enemyNavDiagnostics = false;
    static readonly enemyNavDefaultMinX = -1200;
    static readonly enemyNavDefaultMinY = -1200;
    static readonly enemyNavDefaultMaxX = 1200;
    static readonly enemyNavDefaultMaxY = 1600;
    static readonly enemyEntranceWidth = 80;
    static readonly enemyPeerSeparationRadius = 36;
    static readonly enemyAvoidanceWeight = 0.55;
    static readonly enemyMinionAttackEnterRange = 32;
    static readonly enemyMinionAttackExitRange = 50;
    static readonly enemySweepMaxStep = 5;

    // --- 滚木 ---
    static readonly logRollSpeed = 4;
    static readonly logExtendAmount = 1;
    static readonly logShrinkAmount = 1;
    static readonly logMinLength = 1;
    static readonly logMaxLength = 10;
    static readonly logInitialLength = 3;
    static readonly logVisualBaseScale = 0.4;
    static readonly logVisualScalePerLength = 0.2;
    /** 蓝线固定所需最小滚木长度 */
    static readonly blueLineMinLogLength = 3;

    // --- 跑酷陷阱 / 刷怪 / UI ---
    static readonly sawTrapDamage = 15;
    static readonly farSpawnInterval = 1.6;
    /** 场上同时存活小怪上限（含侧路） */
    static readonly farSpawnMaxAlive = 50;
    /** 小怪死亡后回池并在 SpawnPoint 重生的延迟（秒） */
    static readonly enemyRespawnDelay = 5;
    static readonly joystickHintDelay = 3;
    /** 倒 8 字动画振幅（UI 本地像素） */
    static readonly joystickHintFigure8Amp = 28;
    /** 倒 8 一周时长（秒） */
    static readonly joystickHintFigure8Period = 2.2;
    /** 跑酷结束后首次 Boss 生成延迟（秒） */
    static readonly bossFirstSpawnDelay = 1.5;

    // --- 玩家引导 ---
    static readonly guideTargetRefreshInterval = 0.15;
    static readonly guideFloatTolerance = 0.001;
    static readonly guideDirectionOffset = 64;
    /** World distance between repeated direction arrows along the player-to-target line. */
    static readonly guideDirectionArrowSpacing = 72;
    /** Includes the preplaced DirectionArrow template. */
    static readonly guideDirectionArrowMaxCount = 8;
    static readonly guideTargetOffset = 52;
    /** Target marker's vertical bobbing distance in world units. */
    static readonly guideTargetFloatAmplitude = 15;
    static readonly guideTargetFloatPeriod = 0.75;
    static readonly guideDirectionArrowScale = 0.35;
    static readonly guideTargetArrowScale = 0.5;

    // --- 建造（调试期统一 10 金）---
    static readonly wallBuildCost = 10;
    static readonly towerBasicBuildCost = 10;
    static readonly towerAdvancedBuildCost = 10;
    static readonly barracksBuildCost = 10;
    static readonly heroShrineBuildCost = 10;
    static readonly expandAreaBuildCost = 10;
    static readonly barracksSpawnInterval = 3;

    // --- 金币 ---
    /** 小怪死亡掉落面额 */
    static readonly coinDropAmount = 5;
    /** 吸附飞向玩家的速度（世界单位/秒） */
    static readonly coinMagnetSpeed = 420;
    /**
     * 兼容旧逻辑的吸附启动距离；≤0 表示生成后立即吸附（不落地等待）。
     * @deprecated 现默认立即飞向玩家
     */
    static readonly coinMagnetRange = 0;
    /** 视为拾取的距离（世界单位） */
    static readonly coinPickupRange = 28;
    /** 旧掉落抛物线抬升（已不再用于掉落；保留以免外部引用报错） */
    static readonly coinDropArcHeight = 1.2;
    static readonly coinDropArcDuration = 0.35;
    /** 飞向玩家时轻微弧高 */
    static readonly coinMagnetArcHeight = 40;
    /** 道具拾取短弧时长（秒） */
    static readonly itemPickupArcDuration = 0.2;
    /** 道具拾取短弧抬升高度 */
    static readonly itemPickupArcHeight = 0.8;

    // --- 滚木 VFX ---
    static readonly logChargePulseScale = 1.08;
    static readonly logChargePulseHalf = 0.25;
    static readonly logFadeOutDuration = 0.5;

    // --- 受击闪红 ---
    static readonly hitFlashDuration = 0.12;

    // --- 对象池上限 ---
    static readonly poolMaxEnemies = 200;
    static readonly poolMaxProjectiles = 20;
    static readonly poolMaxCoins = 50;
    static readonly poolMaxSoldiers = 16;

    // --- 大招 / 收尾相机 ---
    /** 解锁后是否仅允许释放一次大招 */
    static readonly ultimateOnce = true;
    /** 大招后相机沿 +Z 额外拉远距离 */
    static readonly ultimateZoomDistance = 400;
    /** 拉远缓动时长（秒） */
    static readonly ultimateZoomDuration = 1.5;
    /** 拉远结束后再切 GameOver 的额外延迟（秒） */
    static readonly ultimateGameOverDelay = 0.2;

    /** Boss 血条白缓冲条逼近红条的速度（越大越快） */
    static readonly hpBarBufferLerpSpeed = 4;
}
