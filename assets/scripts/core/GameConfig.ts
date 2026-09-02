/**
 * 全局数值配置，逻辑层禁止散落魔法数。
 * hp/attack 等仅为初始参考值，后续可在编辑器或配置表覆盖。
 */
export class GameConfig {
    // --- 生命值 ---
    static readonly playerMaxHp = 100;
    static readonly heroMaxHp = 100;
    static readonly bossMaxHp = 500;
    static readonly minionMaxHp = 30;
    static readonly soldierMaxHp = 20;
    static readonly barrierMaxHp = 200;

    // --- 攻击 ---
    static readonly bossAttackDamage = 25;
    static readonly playerAttackDamage = 15;
    static readonly minionAttackDamage = 10;
    /** 玩家射箭冷却（秒） */
    static readonly playerAttackInterval = 0.8;
    /** 箭矢飞行速度（世界单位/秒） */
    static readonly arrowSpeed = 18;

    // --- 相机跟随（玩法在 XY 平面，主相机从 +Z 看向原点；UI 由 UICamera 单独渲染）---
    static readonly cameraFollowOffsetX = 0;
    static readonly cameraFollowOffsetY = 0;
    /** 相对目标沿 +Z 拉开的观察距离（与 Main Camera 初始 z≈1000 一致） */
    static readonly cameraFollowOffsetZ = 1000;
    /** 跟随平滑系数（越大越贴） */
    static readonly cameraFollowSmooth = 6;

    // --- 移动 ---
    static readonly playerMoveSpeed = 5;
    static readonly playerParkourForwardSpeed = 3;
    static readonly heroFollowSpeed = 4;
    static readonly minionMoveSpeed = 2;
    static readonly bossMoveSpeed = 1.5;

    // --- 滚木 ---
    static readonly logRollSpeed = 4;
    static readonly logExtendAmount = 1;
    static readonly logShrinkAmount = 1;
    static readonly logMinLength = 1;
    static readonly logMaxLength = 10;
    /** 蓝线固定所需最小滚木长度 */
    static readonly blueLineMinLogLength = 3;

    // --- 跑酷陷阱 / 刷怪 / UI ---
    static readonly sawTrapDamage = 15;
    static readonly farSpawnInterval = 2.5;
    static readonly farSpawnMaxAlive = 8;
    static readonly joystickHintDelay = 3;
    /** 倒 8 字动画振幅（UI 本地像素） */
    static readonly joystickHintFigure8Amp = 28;
    /** 倒 8 一周时长（秒） */
    static readonly joystickHintFigure8Period = 2.2;
    /** LOG_FIXED 后首次 Boss 生成延迟（秒） */
    static readonly bossFirstSpawnDelay = 1.5;

    // --- 建造 ---
    static readonly wallBuildCost = 50;
    static readonly towerBasicBuildCost = 80;
    static readonly towerAdvancedBuildCost = 150;
    static readonly barracksBuildCost = 100;
    static readonly heroShrineBuildCost = 120;
    static readonly expandAreaBuildCost = 200;
    static readonly barracksSpawnInterval = 3;

    // --- 金币 ---
    /** 小怪死亡掉落面额 */
    static readonly coinDropAmount = 5;
    /** 吸附速度（世界单位/秒） */
    static readonly coinMagnetSpeed = 8;
    /** 开始吸附的距离（世界单位） */
    static readonly coinMagnetRange = 6;
    /** 视为拾取的距离（世界单位） */
    static readonly coinPickupRange = 0.6;
    /** 掉落抛物线抬升高度 */
    static readonly coinDropArcHeight = 1.2;
    /** 掉落抛物线时长（秒） */
    static readonly coinDropArcDuration = 0.35;
    /** 吸附时轻微弧高 */
    static readonly coinMagnetArcHeight = 0.4;
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
    static readonly poolMaxEnemies = 30;
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
