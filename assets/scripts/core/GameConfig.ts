/**
 * 全局数值配置，逻辑层禁止散落魔法数。
 * hp/attack 等仅为初始参考值，后续可在编辑器或配置表覆盖。
 */
export class GameConfig {
    // --- 音频 ---
    /** BGM 总音量（由场景 AudioManager 读取） */
    static readonly audioBgmVolume = 0.35;
    /** 短音效总音量（由场景 AudioManager 读取） */
    static readonly audioSfxVolume = 0.8;
    /** Inspector cue 的默认音量倍率 */
    static readonly audioCueVolumeMultiplier = 1;
    /** 同时播放的短音效最大数量 */
    static readonly audioSfxConcurrencyLimit = 8;
    /** BGM 默认最小重播间隔 */
    static readonly audioBgmMinInterval = 0;
    /** 攻击类 cue 的默认最小重播间隔 */
    static readonly audioAttackMinInterval = 0.1;
    /** 普通敌人死亡 cue 的默认最小重播间隔 */
    static readonly audioDeathMinInterval = 0.1;
    /** 金币收集 cue 的默认最小重播间隔 */
    static readonly audioCoinMinInterval = 0.1;
    /** 建造完成 cue 的默认最小重播间隔 */
    static readonly audioBuildMinInterval = 0;
    /** 英雄生成 cue 的默认最小重播间隔 */
    static readonly audioHeroSpawnMinInterval = 0;
    // --- 生命值 ---
    static readonly playerMaxHp = 700;
    static readonly heroMaxHp = 300;
    static readonly bossMaxHp = 2000;
    static readonly minionMaxHp = 15;
    static readonly soldierMaxHp = 15;
    static readonly barrierMaxHp = 6000;
    /** 箭塔 / 兵营可被 Boss 摧毁的血量 */
    static readonly towerMaxHp = 300;
    static readonly barracksMaxHp = 900;
    /** 滚木固定后作为可攻击障碍的最大生命 */
    static readonly logMaxHp = 400;
    static readonly logFixedColliderOffsetX = -2;
    static readonly logFixedColliderOffsetY = 10;
    static readonly logFixedColliderWidth = 235;
    static readonly logFixedColliderHeight = 19;

    // --- 攻击 ---
    static readonly bossAttackDamage = 120;
    /** Boss 对建筑/屏障/小兵一击拆毁伤害（≥ 各建筑 maxHp） */
    static readonly bossBuildingDamage = 300;
    static readonly playerAttackDamage = 15;
    static readonly minionAttackDamage = 2;
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
    static readonly arrowFullDamageHits = 1;
    /** 超过满伤命中数后，每多命中一个目标的伤害倍率 */
    static readonly arrowPierceDamageFalloff = 0.7;
    /** 箭矢最大飞行距离（世界单位） */
    static readonly arrowMaxDistance = 300;
    /** 玩家同帧扇形箭数量（含中心） */
    static readonly playerArrowFanCount = 3;
    /** 玩家扇形总张角（度）；3 发时为 -22.5 / 0 / +22.5 */
    static readonly playerArrowFanTotalAngleDeg = 45;

    // --- 相机跟随（玩法在 XY 平面，主相机从 +Z 看向原点；UI 由 UICamera 单独渲染）---
    static readonly cameraFollowOffsetX = 0;
    static readonly cameraFollowOffsetY = -440;
    /** 相对目标沿 +Z 拉开的观察距离 */
    static readonly cameraFollowOffsetZ = 1485;
    /** 跟随平滑系数（越大越贴） */
    static readonly cameraFollowSmooth = 6;

    // --- 移动 ---
    static readonly playerMoveSpeed = 9;
    static readonly playerParkourForwardSpeed = 9;
    /** 黄线蓄力段前进速度（应小于 playerParkourForwardSpeed） */
    static readonly playerParkourChargeSpeed = 2;
    /** 触黄线后减速到 chargeSpeed 的时长（秒），结束后瞬间恢复 forwardSpeed */
    static readonly playerParkourChargeDecelDuration = 1;
    static readonly heroFollowSpeed = 7;
    /**
     * 英雄相对玩家的期望跟随距离（世界单位）。
     * 到达该距离后 idle；攻击中不跟随。
     */
    static readonly heroFollowDistance = 130;
    /**
     * 英雄相对玩家的软拴绳半径（世界单位）。
     * ≤0 时用 max(heroFollowDistance * 8, 12)，防止脱节。
     */
    static readonly heroFollowLeash = 15;
    /** Boss 重新索敌间隔（秒） */
    static readonly bossRetargetInterval = 1.0;
    /** Boss 扫描场景中新防守目标的间隔（秒） */
    static readonly bossTargetScanInterval = 2;
    /** 小怪开始追击的索敌半径（世界单位）；以外 idle，避免远端预置怪全挤到玩家旁 */
    static readonly minionAggroRange = 420;
    static readonly minionMoveSpeed = 3.5;
    static readonly bossMoveSpeed = 4.5;
    /** 近战小兵移速（与小怪同量级；勿用百级像素误放大） */
    static readonly soldierMoveSpeed = 3.5;
    /** 近战小兵重索敌间隔（秒），避免每帧全场扫描 */
    static readonly soldierRetargetInterval = 3;
    static readonly soldierRangedTargetCount = 1;
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
    /** Cooperative scheduler deadline; checked every 32 work units. */
    static readonly enemyNavJobTimeBudgetMs = 2;
    static readonly enemyMinionDecisionInterval = 0.25;
    static readonly enemyMinionAvoidanceInterval = 0.25;
    static readonly enemyMinionAvoidanceMaxNeighbors = 4;
    static readonly enemyMinionAvoidanceMaxVisits = 24;
    /** Cap how many units drop stale fields after a geometry epoch bump (per frame). */
    static readonly enemyNavMaxFieldInvalidationsPerFrame = 8;
    /** Cap distinct new distance-field jobs admitted per frame (coalesced keys do not count). */
    static readonly enemyNavMaxNewFieldJobsPerFrame = 2;
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
    static readonly logRollSpeed = 7;
    /** @deprecated Prefer world-width extend via logVisualScalePerLength × collider base. */
    static readonly logExtendAmount = 1;
    /** @deprecated Saw cuts use contact local X; retained for debug/compat only. */
    static readonly logShrinkAmount = 1;
    static readonly logMinLength = 1;
    static readonly logMaxLength = 10;
    static readonly logInitialLength = 3;
    static readonly logVisualBaseScale = 0.7;
    static readonly logVisualScalePerLength = 0.1;
    /**
     * Legacy logical blue-line gate. Lock now uses rolling world width vs
     * baseColliderWidth * logFixedMinWidthFactor.
     */
    static readonly blueLineMinLogLength = 5;
    /**
     * Blue-line lock when rollingWidth >= baseColliderWidth * this factor
     * (equals old length>=6 visual scale: 0.4 + 6*0.15).
     */
    static readonly logFixedMinWidthFactor = 0.4 + 6 * 0.15;
    /** Ground shadow UITransform width = log Visual content width − slack. */
    static readonly logShadowWidthSlack = 0;

    // --- 跑酷陷阱 / 刷怪 / UI ---
    static readonly sawTrapDamage = 70;
    static readonly farSpawnInterval = 0.7;
    /** 场上同时存活小怪上限（含侧路） */
    static readonly farSpawnMaxAlive = 50;
    /** 小怪死亡后回池并在 SpawnPoint 重生的延迟（秒） */
    static readonly enemyRespawnDelay = 4;
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
    static readonly towerBasicBuildCost = 25;
    static readonly towerAdvancedBuildCost = 30;
    static readonly barracksBuildCost = 35;
    static readonly heroShrineBuildCost = 35;
    static readonly expandAreaBuildCost = 45;
    static readonly barracksSpawnInterval = 3;
    /** 兵营首次出兵后，每波最多补刷的盾兵数 */
    static readonly barracksRefillPerWave = 4;

    // --- 建筑生成小怪击退 ---
    /** 建筑 collider AABB 向外扩展的候选范围（世界单位）。 */
    static readonly buildingSpawnMinionKnockbackRangePadding = 48;
    /** 建筑 collider 无效时，以根节点世界中心为圆心的回退半径（世界单位）。 */
    static readonly buildingSpawnMinionKnockbackFallbackRange = 96;
    /** 初始击退速度（RigidBody2D 物理速度，米/秒）。 */
    static readonly buildingSpawnMinionKnockbackInitialSpeed = 6;
    /** 击退覆盖窗口（秒）。 */
    static readonly buildingSpawnMinionKnockbackDuration = 0.3;
    /** 速度按 remainingRatio 的该指数单调衰减；1 表示线性。 */
    static readonly buildingSpawnMinionKnockbackDecayExponent = 1;

    // --- 金币 ---
    /** 小怪死亡掉落面额 */
    static readonly coinDropAmount = 1;
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
    static readonly poolMaxEnemies = 140;
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
    /** Camera callback safety margin when the follow component becomes unavailable mid-finale. */
    static readonly ultimateZoomFallbackGrace = 0.25;
    /** First BigMove wave applies this fraction of each enemy's current HP. */
    static readonly ultimateFirstWaveDamageRatio = 0.5;
    /** Delay after first BigMove wave finishes before starting second wave + zoom (seconds). */
    static readonly ultimateInterWaveDelay = 0.8;
    /** VFX resource fallback when an async load never resolves. */
    static readonly ultimateVfxLoadFallbackDelay = 1;

    /** 拉远结束后再切 GameOver 的额外延迟（秒） */
    static readonly ultimateGameOverDelay = 0;

    /** Boss 血条白缓冲条逼近红条的速度（越大越快） */
    static readonly hpBarBufferLerpSpeed = 4;
}
