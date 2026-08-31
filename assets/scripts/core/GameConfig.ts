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

    // --- 建造 ---
    static readonly wallBuildCost = 50;
    static readonly towerBasicBuildCost = 80;
    static readonly towerAdvancedBuildCost = 150;
    static readonly barracksBuildCost = 100;
    static readonly heroShrineBuildCost = 120;
    static readonly expandAreaBuildCost = 200;
    static readonly barracksSpawnInterval = 3;

    // --- 对象池上限 ---
    static readonly poolMaxEnemies = 30;
    static readonly poolMaxProjectiles = 20;
    static readonly poolMaxCoins = 50;
    static readonly poolMaxSoldiers = 16;
}
