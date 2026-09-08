# Bug 修复记录

> 每次 `/fix-bug`（或等价修复）**完成后**写入。  
> **一点一条**：用户若一次列了 N 个独立问题，必须写成 N 条独立条目（禁止把多点塞进同一条的 ①②③）。  
> **同题升版**：写入前先全文检索是否已有同类现象/主题；有则在原条目下叠加 `v2` / `v3`…，勿另开同名条目；没有再新建。  
> 每条须含：**现象**、**原因**、**解决**（各 1–3 句即可）。

---

## fix-log-follow-contact — 滚木跟随漂移 / 黄蓝线不触发 / 小怪穿滚木

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 开局玩家–滚木 Y 差约 60–80，跑一会儿漂到 ~200；越过黄/蓝线无蓄力/固定；小怪可穿过滚木贴脸。 |
| **原因** | ① `Log` 只对齐 X，Y 用 `velocity*dt` 独立积分，与玩家实际位移不同步；② `Player` 强制 Kinematic 且同时 `setPosition`+写速度，与 Dynamic 预制冲突；③ 黄蓝线过远且仅靠物理 `BEGIN_CONTACT`，位移跟随时接触不可靠；④ `EnemyMinion` 用 `setPosition` 追玩家，不把 Log 当障碍。 |
| **解决** | 玩家 Dynamic 仅写 `linearVelocity`；滚木绑定瞬间缓存世界 `_followOffset`，每帧 `player+offset` 跟随；黄/蓝线改合理 Y + 越过世界 Y 一次性触发；小怪移动前与 Log AABB 相交则本帧不穿入。计划：`.cursor/plans/fix-log-follow-contact.md`。 |

### v2（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 玩家改物理移动后，Hierarchy 里滚木根节点坐标每帧跳动（人木碰撞矩阵已忽略仍抖）。 |
| **原因** | `Log.update` 用 `(desired-self)/dt` 追玩家点 + airWall 软推期望点，与 Dynamic 玩家物理步进不同步，形成误差反馈抖动。 |
| **解决** | `lateUpdate` 直接 `setWorldPosition(player+offset)`，`linearVelocity` 同步玩家速度；去掉误差/dt 与跟木路径上的 airWall 软推；滚动视觉仍用玩家速度。 |

### v3（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | v2 后根节点不抖，但滚木可穿过 `airWall*` 高台。 |
| **原因** | 跟木为 sensor + 死贴 offset，且去掉了 airWall AABB；引擎固体不挡。 |
| **解决** | 仍 `lateUpdate` 贴 `player+offset`（禁止误差/dt）；贴前对期望点 `AirWallAabb.resolveWorldPos` 并用推出后坐标 `setWorldPosition`，速度同步时钳制穿墙轴。 |

---

## fix-log-fixed-bow-saw — 固定后滚木转 / 拾弓不射 / 电锯不砍木

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 滚木蓝线固定后 Visual 仍在转；拾取弓后不攻击小怪；撞上电锯滚木不被砍短。 |
| **原因** | ① 固定后 `_updateRollVisual` 已停，但 Visual 上 `Billboard` 每帧改 euler；② `CombatSystem.attackRange`/`arrowSpeed`/`命中半径` 按「约 10 单位」写死，与百级像素世界不匹配，且箭 prefab 未绑时静默不射；③ `SawTrap` 只靠 `BEGIN_CONTACT`，玩家/滚木 `setPosition`+传感器时常无接触事件。 |
| **解决** | `Log` 固定/失败时禁用 Billboard、清零角速度并冻 Visual 旋转；`GameConfig` 扩大索敌/箭速/命中半径，`CombatSystem` 纠正旧 range≤20 并 `resources.load` 箭 prefab；`SawTrap` 增加 AABB/距离轮询砍木与伤玩家。未改 `Main.scene`。 |

---

## fix-coin-fly-arrow-pierce — 金币不落地直飞 / 箭穿透与限距

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 金币落地后常不吸附、UI 不加；箭矢首命即毁、可无限追踪。 |
| **原因** | ① `Coin` 先抛物线落地，且仅在 `coinMagnetRange=6` 内吸附，与百级世界尺度不匹配，拾取回调不触发则无 `COIN_CHANGED`；② `Arrow` 命中即 `destroy`，无穿透计数与最大飞行距离。 |
| **解决** | 取消落地弧，生成后立即飞向玩家（提速/拾取半径），`addCoins` 仍 emit `COIN_CHANGED` 同步 `CoinUI`；箭沿初始方向直线飞行，最多穿透 5 名敌人，超出 `arrowMaxDistance` 销毁。 |

---

## fix-build-spawn-under-plot — 建成物挂到对应 Plot_* 下

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | `Plot_Wall_R` 下 `pref_build_plot` 消失后，墙未生成在 `Plot_Wall_R` 下（其它地块同理）。 |
| **原因** | `BuildSystem._instantiateAt` 一律挂到 `buildingRoot`，忽略地块父节点。 |
| **解决** | `BuildPlot` 完成时把 `plotRoot`（父节点）一并 emit；墙/塔/兵营/碑/高级塔占位均 `addChild` 到该 `Plot_*`，本地坐标置零。 |

---

## fix-hpbar-visual-height — 血条按 Visual 高度抬升

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 血条与角色 Visual 重叠。 |
| **原因** | 跟随只用固定 `followOffsetY`，未读 Visual 实际高度。 |
| **解决** | `HpBarUI` 取锚点 `UITransform.contentSize.height × \|worldScale.y\|`，按 `anchorY` 算到顶部后再加间隙。 |

---

## fix-build-coin-log-boss — 建造飞币 / 固定滚木 / Boss 血条

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | ① 建造时 CoinUI 一次跳变而非随交付渐减；② 滚木固定后不挡物、不可打；③ Boss 血条像 1、未上移；④ Boss Label 显示 `100/100`。 |
| **原因** | ① BuildPlot 三参 `(delta,paid,cost)` 被 CoinUI 当成 balance；② `isAttackable` 在固定后为 false，collider 仍是 sensor，无血量；③ Boss 无 HealthSystem，`bindTarget` 写成 1/1，`visualNode` 常空；④ Label 写死 `hp/max`。 |
| **解决** | BuildPlot 直接 `CoinSystem.addCoins` + `CoinUI` 渐变与飞币；固定后滚木改 Static 固体、可攻击、玩家血条模板；Boss 解析 Visual、emit 满血、放大过小攻击距离；`showMaxInLabel=false` 只显示当前血量。 |

---

## fix-enemy-pool-boss-chase-log-block — 小怪池/Boss 追人/滚木挡玩家

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 小怪上限过低且死后不重生；Boss 不追玩家；固定滚木挡不住玩家。 |
| **原因** | `poolMaxEnemies/farSpawnMaxAlive` 过小且只 instantiate 不回收；Boss `pickTarget` 优先建筑且只写 `linearVelocity`；玩家 sensor+`setPosition` 不吃固体。 |
| **解决** | 上限 200 + 对象池，死后 5s 在原 SpawnPoint 重生；Boss 优先追玩家并用 `setWorldPosition`；玩家对固定滚木做 AABB 分离。 |

---

## fix-coin-fly-start — 飞币起点应为玩家

### v1（2026-09-03）
见 `fix-build-coin-log-boss` / `fix-coin-fly-arrow-pierce`：已有飞币/吸币逻辑，但起点未固定为玩家。

### v2（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 建造交付时飞币从 UI 金币图标出发，而不是从玩家位置飞向图标。 |
| **原因** | `CoinUI` 飞币用图标世界/UI 坐标当起点。 |
| **解决** | 飞币起点改为玩家世界坐标（再转换到 UI），终点仍为 CoinUI 图标。 |

---

## fix-boss-spawn-chase — Boss 生成时机与追玩家

### v1（2026-09-03）
见 `fix-enemy-pool-boss-chase-log-block`：Boss 不追玩家、索敌偏建筑。

### v2（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | Boss 过早生成；应在首座初始箭塔或兵营解锁时生成，朝玩家靠近；无索敌距离限制，仅按优先级索敌。 |
| **原因** | Boss 挂在 `LOG_FIXED` 时机；索敌仍带距离或未统一优先级。 |
| **解决** | 首座初级塔/兵营建成后再 spawn；全程按优先级追击玩家（无距离阈值）。 |

---

## fix-log-fixed-collider-visual — 固定后滚木碰撞与视觉长短不一

### v1（2026-09-03）
见 `fix-build-coin-log-boss` / `fix-enemy-pool-boss-chase-log-block`：固定后挡物/可打性问题。

### v2（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 滚木固定后碰撞体长度与 Visual 视觉长度不一致。 |
| **原因** | 固定后未按 Visual 世界尺寸重同步 `BoxCollider2D`。 |
| **解决** | 固定时用 Visual `contentSize×scale` 对齐碰撞盒尺寸与偏移。 |

---


## fix-parkour-hide-after-walls — 两墙解锁后隐藏 ParkourContent

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | `Plot_Wall_L` / `Plot_Wall_R` 解锁建完后，`ParkourContent` 仍可见。 |
| **原因** | `PhaseTransition` 在 `BOTH_WALLS_COMPLETE` 时只藏部分子节点，未隐藏整棵 `ParkourContent`。 |
| **解决** | 两墙完成后 `ParkourContent.active=false`（滚木实例须挂在其外并保持可见）。 |

---

## fix-boss-not-moving — Boss 不移动

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | Boss 生成后一直不移动。 |
| **原因** | 依赖 `fixedUpdate` + 过大近战停步（约 120），且 Kinematic 下 `linearVelocity` 不可靠。 |
| **解决** | 改 `update` + `setWorldPosition` 追玩家；近战停步收至约 56。 |

---

## fix-barracks-soldier-no-attack — 兵营小兵不攻击敌人

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 兵营生成的小兵不会攻击 enemy。 |
| **原因** | `Soldier` 攻击/移动范围仍是约 1~4，且用 `fixedUpdate`+`linearVelocity`。 |
| **解决** | 放大索敌/近战/移速到百级像素；`update`+`setWorldPosition` 追敌并出手。 |

---

## fix-hero-shrine-no-select-ui — 英雄碑不弹 HeroSelect

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 英雄召唤碑解锁后不跳 HeroSelect UI。 |
| **原因** | `autoSelectOnActivate=true`（脚本默认与 prefab）直接选英雄 0，跳过 UI。 |
| **解决** | 默认与 `pref_hero_shrine` 改为 false；`BuildSystem` 建成时强制关闭自动选，走 `HERO_SELECT_REQUESTED`。 |

### v2（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | HeroSelect 又不显示；选完无英雄；拓展区 `Plot_Expand` 也不出现。 |
| **原因** | 场景里 `pref_ui_hero_select` 开局 `_active=false`，`HeroSelectUI.onLoad` 不跑 → 未监听 `HERO_SELECT_REQUESTED`；事件丢失则不生成英雄，`_onHeroSpawned` 不触发 → 拓展地块不 reveal。 |
| **解决** | 新增 `HeroSelectUI.ensureReady()`（inactive 也可挂监听）；`UIManager`/`SceneSetup`/`BuildSystem` 在弹窗前调用；去掉 onLoad 里强制关节点以免首次打开被关掉。 |

---

## fix-boss-aggro-priority — Boss 未按优先级动态索敌

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | Boss 索敌未按优先级；塔/兵营/英雄建成后仍可能死盯玩家，或攻击候选引用失效。 |
| **原因** | 索敌表虽按 priority 选目标，但建成时未发 `BOSS_TARGET_REGISTER`；`_collectAttackCandidates` 仍引用已删的 `_buildings`/`_heroes`。 |
| **解决** | `BuildSystem`/滚木固定发事件写入表（hero40 > building30 > barrier20 > log15 > player10）；攻击候选改读 `_targetList`。 |


---

## fix-soldier-melee-move-too-fast — 近战小兵移速过快

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | `pref_soldier_melee` 配置 speed≈2~3，实际冲刺过快。 |
| **原因** | `Soldier.onLoad` 把 `moveSpeed < 20` 强制抬到 90，未像小怪/Boss 使用 `GameConfig`。 |
| **解决** | 新增 `GameConfig.soldierMoveSpeed=2`，近战位移统一读配置；去掉错误抬速。 |

---

## fix-boss-cannot-destroy-buildings — Boss 打不死塔/兵营

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | Boss 能靠近塔/兵营但无法消灭。 |
| **原因** | 非缺 collider：索敌靠距离表。`Tower`/`Barracks` 原不继承 `Building`，无血量/`takeDamage`，伤害落空。 |
| **解决** | `Tower`/`Barracks` 继承 `Building` 并设 `towerMaxHp`/`barracksMaxHp`；Boss 伤害走 `Building.takeDamage`。 |

---

## fix-advanced-towers-no-ultimate — 双高级塔后无后续

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 建完两侧高级箭塔后不进大招/收尾流程。 |
| **原因** | 场景无 `UltimateSystem` 监听 `BOTH_ADVANCED_TOWERS_COMPLETE`；且 `spawnSide`/reveal 未用地块名纠正，两侧可能只记成一边。 |
| **解决** | `SceneSetup` 运行时挂上 `UltimateSystem`；reveal/建成用地块名判 L/R，并 `>=2` 座兜底 emit。 |


---

## fix-boss-building-oneshot — Boss 一击拆建筑

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | Boss 打塔/兵营/屏障一下就拆掉。 |
| **原因** | `bossBuildingDamage=9999`，远超 `towerMaxHp`/`barracksMaxHp`。 |
| **解决** | 建筑/屏障改吃 `bossAttackDamage`（与打人一致，需多下）。 |

### v2（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 按最新设计，Boss 应对建筑/屏障/`pref_soldier_melee` 一击秒杀；v1 多下拆建筑不符合当前需求。 |
| **原因** | v1 去掉了 `bossBuildingDamage`，建筑/屏障改吃 `bossAttackDamage`；小兵未进 Boss 线攻候选与 `_dealDamageToNode`。 |
| **解决** | 恢复 `GameConfig.bossBuildingDamage=9999`，Barrier/Building 用其伤害；线攻候选扫 `Soldier`，`takeDamage(max(bossBuildingDamage, soldierMaxHp))`；Player/Hero 仍用 `bossAttackDamage`。 |

---

## fix-player-arrow-boss-priority — 玩家箭优先打 Boss

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 玩家索敌应优先 Boss，但箭常先打小怪甚至打不到 Boss。 |
| **原因** | `CombatSystem` 已优先 Boss，但 `Arrow._pollEnemyHits` 先扫小怪，穿透名额被占满。 |
| **解决** | 箭矢命中轮询与 `_applyHit` 均改为 Boss 优先于小怪。 |

---

## fix-advanced-towers-no-gameover — 双高级塔无收尾

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 两座高级塔齐后无 GameOver、不锁移动、镜头不拉远。 |
| **原因** | 收尾依赖 `castUltimate` 回调；`pref_ui_game_over` 开局 inactive，`GameOverUI.onLoad` 未挂监听。 |
| **解决** | `UltimateSystem` 解锁后直接 `_runFinale`；`GameOverUI.ensureReady` + `UIManager` 显示前唤醒。 |

---

## fix-log-extend-collider — 滚木加长碰撞未变长

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 拾取加长道具后 Visual 变长，碰撞体仍是旧长度。 |
| **原因** | `_refreshLengthVisual` 改了 `size` 但未 `apply()` 同步物理。 |
| **解决** | 改尺寸后调用 `BoxCollider2D.apply()`。 |

---

## fix-player-death-no-gameover — 玩家死亡无结束与暂停

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 玩家死亡不弹 GameOver，世界仍在跑。 |
| **原因** | `Player._die` 只播死亡动画，未 `setGameOver` / `director.pause`。 |
| **解决** | 死亡时 `GameManager.setGameOver` + `director.pause`（UI 由阶段事件唤起）。 |


---

## fix-minion-saw-no-player-damage — 小怪/电锯不伤玩家

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 小怪贴近、电锯碰到玩家都不掉血。 |
| **原因** | 小怪 `PLAYER_SEPARATION(48) > attackRange(40)`，永远进不了出手距；电锯依赖易过期的 AABB。 |
| **解决** | 出手距至少覆盖分离+余量；电锯优先世界距离判定命中。 |

---

## fix-player-hit-flash — 玩家受击不闪红

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 玩家掉血时 Visual 无闪红。 |
| **原因** | `takeDamage` 未调用 `HitFlash`。 |
| **解决** | `Player.takeDamage` 时对 `visualNode` 调用 `HitFlash.flash`。 |

### v2（2026-09-05）— 受击闪红卡红 + 英雄未闪

| 项 | 说明 |
|---|---|
| **现象** | 受击后 Sprite 长期保持红色；英雄受击不闪红。 |
| **原因** | `HitFlash.flash` 在已染红时把当前色当「原色」缓存；`tween().stop()` 清不干净；`Hero.takeDamage` 未调 `HitFlash`。 |
| **解决** | WeakMap 缓存首次非闪红基底色；`Tween.stopAllByTarget(sprite)` 后再闪；复原到缓存基底；`Hero.takeDamage` 对 `visualNode` 调 `HitFlash.flash`。 |

---

## fix-heroselect-no-hero-spawn — 选英雄后不生成

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | HeroSelect 选完后场上没有英雄。 |
| **原因** | 生成放在 UI fade 回调末尾，易丢；prefab 空时静默失败；父节点可能不当。 |
| **解决** | 点选后立刻 `onHeroSelected`；缺 prefab 时 `resources.load`；生成挂到 `GameRoot/World`。 |

---

## fix-highplatform-airwall-no-collision — HighPlatform airWall 不挡玩家/滚木

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | HighPlatform1–4 的 `airWall*` 节点无法挡住 Player 与滚木（Log）。 |
| **原因** | airWall 虽为 Static 固体 BoxCollider2D，但 Player/Log 用 `setPosition`/`setWorldPosition` 且运行时 `sensor=true`，Box2D 不会阻挡；Player 仅对固定滚木做 AABB 推出，未对 airWall 做同类解析。 |
| **解决** | `Player` / `Log` 在位移后用最小穿透轴 AABB 解析场景中 `airWall*` 的 `worldAABB`（轻量缓存碰撞体列表），不改 sensor、不改 prefab/scene。 |

---

## fix-airwall-minion-boss-hero — airWall 不挡小怪/Boss/英雄

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | `airWall*` 能挡 Player/Log，但 Minion、Boss、Hero 仍可穿过高台空气墙。 |
| **原因** | 三者同样用 `setWorldPosition`/位移驱动且多为 sensor，未做 airWall AABB 推出。 |
| **解决** | 抽出 `AirWallAabb`（`collectAirWalls` + `resolveWorldPos`）；Minion/Boss/Hero 在写入世界坐标前解析；Player/Log 改用同一 helper。 |

### v2（2026-09-05）— Boss/小怪贴墙滑停、不绕行

| 项 | 说明 |
|---|---|
| **现象** | Boss / Minion 追目标时在 HighPlatform `airWall` 上卡住或贴墙滑动，不会绕行。 |
| **原因** | 直线朝目标积分后再 `resolveWorldPos` 只做穿透推出，无绕障转向。 |
| **解决** | `AirWallAabb.steerDirection`：沿期望方向探测 AABB，撞墙则试 ±30/60/90/120°，优先 `dot>0` 畅通方向；`EnemyBoss`/`EnemyMinion` 在积分与 resolve 前改用转向；resolve 仍作安全网。 |

---

## fix-hero-follow-ranged — 英雄不跟随且远程打不到怪

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄不跟着玩家走，远程也打不到小怪。 |
| **原因** | `fixedUpdate` + `linearVelocity` 对 Kinematic 不可靠；`attackRange=6` 相对百级像素世界过小；`playerNode` 空时未兜底绑跟随目标。 |
| **解决** | 改 `update` + `setWorldPosition` 追 `followOffset`（读 `heroFollowSpeed`）；`GameConfig.heroAttackRange=360` 覆盖过小默认；场景兜底解析 Player；`BuildSystem._onHeroSpawned` 在 `playerNode` 空时从场景找玩家再 `setFollowTarget`。 |

### v2（2026-09-05）— 拴绳 + 朝向 + 打 Boss

| 项 | 说明 |
|---|---|
| **现象** | 英雄只挂在 `followOffset`；只打 Minion；不朝向敌人；易脱离玩家攻击圈。 |
| **原因** | 无玩家 `playerAttackRange` 软拴绳；`_findNearestEnemy` 仅扫 Minion；无面向翻转；无战斗时朝敌 strafing。 |
| **解决** | 期望点先 followOffset，有目标则朝敌，再钳到玩家拴绳圆（`heroFollowLeash` 或回退 `playerAttackRange`）；索敌含存活 Minion+Boss；`visualNode` scale.x 朝敌；范围内 `tryAttack` 可伤 Boss。 |

---

## fix-physics-movement — 单位改回物理速度移动

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 小怪/盾兵/英雄/滚木等用 `setWorldPosition`（或 Kinematic+sensor）位移，与 Player/Boss 的 Dynamic+`linearVelocity` 不一致，固体墙/固定滚木碰撞不可靠。 |
| **原因** | 历史为绕过 Kinematic 速度不可靠与像素尺度，改成写世界坐标；Minion `reset` 还会把刚体改回 Kinematic+sensor。 |
| **解决** | Minion/Soldier/Hero：Dynamic、`sensor=false`、仅写 `linearVelocity`；Minion 同伴/玩家/跑酷滚木改为速度偏置；Log 跑酷用速度追 `player+offset`（期望点可软 airWall），固定仍 Static+非 sensor。Player/Boss 未改。 |

---

## fix-hero-hp-bar — 英雄缺少玩家血条

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄召唤后头顶没有 `pref_ui_hp_bar_player` 血条。 |
| **原因** | `Hero` 从未调用 `UIManager.spawnHpBar`；且无 `HealthSystem`，血条绑定时不会自动同步满血。 |
| **解决** | `Hero.start` 调度 `spawnHpBar('player', …)`（不覆盖玩家条），并 `emit HP_CHANGED` 初始满血。 |

### v2（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 仍偶发无血条或满血不同步。 |
| **原因** | 仅 `scheduleOnce` 依赖 `UIManager.instance` 时机；`HpBarUI` 对无 `HealthSystem` 宿主不主动 `applyHp`。 |
| **解决** | `Hero.ensureHpBar` + `applyHp`；`BuildSystem._onHeroSpawned` 再兜底一次；`HpBarUI.applyHp` 公开推送。 |

---

## fix-hero-shrine-visual-linger — 召唤后召唤碑 Visual 不消失

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄选出后，召唤碑（或地块上碑身/地贴）仍可见。 |
| **原因** | 仅 `this.node.active=false`；`visualNode` 未显式关；同地块其它子节点（建造垫等）仍显示，易被当成碑 Visual。 |
| **解决** | `_hideShrineVisual`：关 `Visual`、关碑根，并关掉同 `plotRoot` 下其它子节点。 |

### v2（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 关碑根后地块/地贴仍像召唤碑 Visual。 |
| **原因** | `Plot_HeroShrine` 整块未关；`_onHeroSpawned` 未强制关掉 `heroShrinePlots`。 |
| **解决** | `_hideShrineVisual` 关全部子节点并 `plotRoot.active=false`；`BuildSystem` 召唤后 `_setPlotsActive(heroShrinePlots, false)`。 |

---

## fix-attack-frame-events — 攻击改用动画帧事件出手

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 攻击在动画一开始就结算伤害/出弹，与指定序列帧不同步。 |
| **原因** | 各单位 `tryAttack` 播放 clip 后立刻 `_applyLineAttack` / `takeDamage` / `_spawnArrow`；attack `.anim` 的 `_events` 为空。 |
| **解决** | 在 clip 写入 `onAttackFrameHit`：hero1=`frame_008`(0.3s)、hero2=`frame_010`(0.4)、player=`frame_011`(0.7)、boss=`frame_007`(0.7)、minion=`frame_012`(0.4)；`AttackFrameRelay`+`playAttackWithFrameHit`；出手改到帧回调（带超时兜底）。 |

---

## fix-hero-projectile-missing — 英雄远程看不到弹道

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄远程攻击看不到 `pref_projectile_hero_01/02`。 |
| **原因** | 出手瞬间直接 `takeDamage`；弹道用 0.2s `setWorldPosition` 插值且无命中逻辑，几乎不可见；缺 prefab 时静默 return。 |
| **解决** | 帧事件再生成弹道；`HeroProjectile` 按 `arrowSpeed` 飞行并 AABB 命中；`resources.load` 兜底加载弹道 prefab。 |

---

## fix-player-attack-frame-011 — 主角出箭帧改到 frame_011

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 主角攻击帧事件应对齐 `frame_011`，实际出箭偏早。 |
| **原因** | `CombatSystem` 兜底 `PLAYER_ATTACK_HIT_FALLBACK=0.45`，早于 `.anim` 事件 0.7，且 `fired` 后忽略真正的 frame_011。 |
| **解决** | 兜底改为 0.72（晚于 frame_011@0.7）；clip `_events` 保持 `frame: 0.7`。 |

---

## fix-boss-path-steer — 优化 Boss 绕障寻路

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | Boss 贴墙易卡住、绕障不稳。 |
| **原因** | `steerDirection` 探测偏短、缺大偏角；卡住无脱困。 |
| **解决** | 双距探测 + 150/180°；卡住加大 probe 并侧向滑行。 |

---

## fix-hero-cannot-reach-follow — 英雄有时跟不到位

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄跟随玩家时偶发走不到目标点。 |
| **原因** | Dynamic 非 sensor 撞 airWall 无绕行；拴绳过紧（`distance*3`）。 |
| **解决** | 跟随用 `AirWallAabb.steerDirection`；拴绳改为 `distance*8`（至少 12）。 |

---

## fix-preenemy-swarm-player — 远端预置怪运行时挤到玩家旁

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 场景里放得很远的 enemy，运行时全出现在玩家周围。 |
| **原因** | ① 预置怪开局即 `setTarget` 且无索敌半径，全图追击；② `EnemySpawner._farActive` 开局就刷。 |
| **解决** | `minionAggroRange=420`，范围外 idle；远端刷怪改 LOG_FIXED 后再启用。 |

---

## fix-player-ranged-arrow-frame — 玩家应帧事件出箭射敌

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 玩家攻击应是帧事件生成 Arrow 射向敌人，而不是走进近战圈。 |
| **原因** | 虽有帧事件出箭，但攻击中位移动画可打断；攻击锁缺失导致出手不稳定。 |
| **解决** | `CombatSystem`：范围内仅选目标；`melee_attack`+`frame_011` 生成 Arrow 射向目标；`Player.setAttacking` 期间禁 locomotion。 |

### v2（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | attack 动画没播完就射出第二根箭；有时看不到 attack 动画也会出箭。 |
| **原因** | 命中帧写在 clip 结束时刻 0.7s，与 `FINISHED` 竞态 → 先解锁 `isAttacking` 后 locomotion 打断攻击；冷却 0.8 仅比时长多 0.1；兜底出箭 0.75 可能发生在动画已被切走之后。 |
| **解决** | 命中帧改到 0.4s；冷却 `max(interval, duration+0.05)` 且 interval≥0.85；`AttackFrameRelay.attackToken` 作废旧回调；兜底出箭 &lt; clip 结束；攻击锁坚持到 FINISHED。 |

---

## fix-hero-follow-hold-on-attack — 英雄跟距 idle / 攻击中停步

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | 英雄应保持与玩家距离并 idle；攻击时玩家移动英雄仍应原地播完 attack 再跟随。 |
| **原因** | 有敌时朝敌位移追击；攻击锁结束后立即跟随，未等完整动画。 |
| **解决** | 默认只跟 `followOffset`/`heroFollowDistance`，到位停；攻击清速度并锁至 clip `FINISHED` 后再跟随；射程内原地远程出手。 |

---

## fix-boss-retarget-structure-order — Boss 5s 索敌 Structure>Hero>Player

### v1（2026-09-05）

| 项 | 说明 |
|---|---|
| **现象** | Boss 应每 5s 重索敌；优先级 Structure>hero>player；Structure 按建造顺序。 |
| **原因** | 旧优先级 hero>building；同级取最近；每帧重选无锁定。 |
| **解决** | `building/barrier/log` 同为 Structure 档；`buildOrder` 升序；`bossRetargetInterval=5` 锁定目标；`BuildSystem` 注册时递增建造序号。 |

---

## fix-scene-prefab-null-expand — 预览加载 `__prefab` null

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 预览运行 `Main.scene` 报 `TypeError: Cannot read properties of null (reading '__prefab')`，栈在 `generateTargetMap` → `expandNestedPrefabInstanceNode` → `Scene._load`。 |
| **原因** | 场景里 42 个 prefab 实例的 `_children`/`_components` 被序列化成 `[null,…]` 占位；运行时展开嵌套 prefab 时遍历到 null 组件崩溃。编辑器打开/保存常会再次写入这类占位。 |
| **解决** | 最小补丁去掉实例上的 null（保留真实挂载组件如 player 上的 SortingOrder2D）；`patch-scene-prefab-nulls.mjs` 并入 `post-scene-save.ps1`；同步 library 后 reimport。门禁 AC-S1b 已覆盖。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `assets/scenes/Main.scene` 已无 prefab null，预览仍报 `__prefab` null（同栈）。 |
| **原因** | 运行时读的是 `library/27/2786ab12-….json`，该缓存仍含大量 `_children`/`_components` null；assets 干净时 `post-scene-save` 因 `RemovedNulls=0` 跳过 library 同步。 |
| **解决** | 强制把干净 scene 同步进 library 并 `assets-reimport-asset`；`post-scene-save.ps1` 在 assets 干净时仍检查 library null 计数，脏则强制 Sync。 |

### v3（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 编辑器预览 `Cannot read properties of null (reading 'length')` + 大量 `Command 'draw' must be recorded inside a render pass`；角色/序列帧动画全部不可见。紧随 6.1 执行后出现。 |
| **原因** | ① 6.1 场景保存后 `PrefabInfo.fileId` 残留 `Node.*`（门禁只查 `_id` 漏检），嵌套 prefab 展开目标表错乱；② 6.1 误触后把 `player/parkour|skill` 与士兵空 clip **回滚成旧版** `curveDatas/_keys` 占位，与 3.8 `ObjectTrack` clip 混挂在同一 `Animation` 上，初始化/播片时读 null.length，Sprite 绘制链失败。 |
| **解决** | 全量替换场景任意 `Node.*`（含 fileId）并同步 library；AC-S1/`post-scene-save` 改为匹配任意 `Node.\d+`；8 个旧格式空 clip 改为 3.8 空 `_tracks` 结构并 reimport。 |

### v4（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 预览仍报 `Can not find class 'cc.Sorting2D'`，随后 `generateTargetMap` → `null.__prefab`，场景无法加载。 |
| **原因** | `pref_build_plot` 上原自定义 `SortingOrder2D` 被改成引擎 `cc.Sorting2D`，但项目未开启「2D Rendering Sorting」特性，浏览器/预览无此类；缺类组件在展开嵌套 prefab 时变成 null。 |
| **解决** | 恢复 `pref_build_plot` 为 `SortingOrder2D`（及误改的 UI 尺寸/`instance` 字段），并同步 library。 |

---

## fix-log-extend-autodestroy-tween — 开局无操作连环 destroy / length null

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 场景可见后无操作即反复 `Cannot read properties of null (reading 'length')`（`TweenUtil.stopTweensOn` → `getComponent`）与 `destroy a object twice`；栈在 `LogExtendItem.onDestroy`。 |
| **原因** | `update` 对静止滚木做距离拾取，开局道具贴着滚木瞬间全 `_consume`→`destroy`；销毁中子节点已 invalid 仍 `getComponent`；`tween(node).stop()` 停不掉 `floatLocalY` 的 forever tween。 |
| **解决** | 距离拾取只对玩家，滚木仍靠接触；`Tween.stopAllByTarget` + `isValid` 守卫；hop 回调防二次 destroy。`BowItem` 同步加固。 |

---

## fix-saw-spin-loop — 电锯动画不保证循环

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 电锯 `spin` 动画需要循环播放，运行时只依赖一次 `playAnim` 调用。 |
| **原因** | `SawTrap` 未在脚本侧强制 `spin` 状态循环，若动画状态被导入/实例状态覆盖为非循环，会播放一次后停止。 |
| **解决** | `SawTrap` 播放 `spin` 前解析 `AnimationState`，设置 `wrapMode=Loop` 与 `repeatCount=Infinity`，保留原 `spinSpeed=0` 序列帧方案。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 仍没有看到 `pref_trap_saw` 明显转动。 |
| **原因** | `spin` 序列帧播放依赖 Animation 初始化时机；同时 `Billboard` 每帧把 Visual 的 Z 旋转清零，程序旋转兜底也被覆盖。 |
| **解决** | `SawTrap.onEnable` 下一帧再次确保播放 `spin`，并把 prefab `spinSpeed` 设为 360 作为可见旋转兜底；`Billboard` 保留 Visual 原有 Z 角度，只更新朝向相机的 Y 角。 |

### v3（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `pref_trap_saw` 的 `Visual` 不应自转，visual 的 rotation 需要保持静止。 |
| **原因** | v2 的可见旋转兜底把 `spinSpeed` 设为 360，并让 `Billboard` 保留 Z 角，导致 `Visual` 发生程序自转。 |
| **解决** | `SawTrap` 移除 update 中的 Visual 欧拉角累加，prefab `spinSpeed` 恢复 0，`Billboard` 恢复只设置 `(0, angleY, 0)`；仍在 onLoad/onEnable 保证 `spin` 序列帧循环播放。 |

---

## fix-gameover-win-lose-sprite — GameOver 胜负图无法区分

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `pref_ui_game_over` 的 `WinLose` Sprite 没有 win/lose 两张图的脚本属性，主角死亡和胜利收尾显示无法区分。 |
| **原因** | `GameManager.setGameOver` 只广播 `GameOver` 阶段，不携带胜负结果；`GameOverUI` 也未解析 `WinLose` Sprite 或设置结果图。 |
| **解决** | `setGameOver(result)` 增加可选 `win/lose` 结果并随 `PHASE_CHANGED` 发出；主角死亡传 `lose`，大招收尾传 `win`；`GameOverUI` 暴露 `winSprite`/`loseSprite` 并运行时设置 `WinLose` SpriteFrame。 |

---

## fix-joystick-hint-parkour-knob — 跑酷摇杆提示运动方式不对

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 新版 `pref_joystickHint` 跑酷提示应为 `Knob` 左右循环移动，但脚本仍按倒 8 轨迹驱动提示节点。 |
| **原因** | `JoystickHintUI` 只有单一 `hintRoot` 运动逻辑，未区分跑酷段 Knob 横移与塔防段倒 8。 |
| **解决** | 新增 `knob` 引用并自动查找 `Knob` 子节点；跑酷模式只让 Knob 按正弦左右移动，塔防模式保留原倒 8 轨迹。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 滚木到达蓝线后跑酷段已结束，但提示仍容易按跑酷段/子节点隐藏方式残留。 |
| **原因** | `LOG_FIXED` 只重置提示状态，没有明确把模式切为塔防倒 8，并且隐藏的是 `hintRoot` 而不是 `pref_joystickHint` 根。 |
| **解决** | `LOG_FIXED` 时先切到 `defense` 模式，再重置轨迹并隐藏 `pref_joystickHint` 根节点；后续若节点被重新激活，运动逻辑按倒 8 执行。 |

### v3（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 摇杆提示隐藏规则应为超过 n 秒未移动后隐藏 `pref_joystickHint` 根节点，而不是空闲后显示。 |
| **原因** | 旧空闲逻辑方向与需求相反，并且隐藏对象容易落在可视子节点而不是 prefab 根节点。 |
| **解决** | `JoystickHintUI` 有输入时重置空闲计时并显示根节点，超过 `GameConfig.joystickHintDelay` 无输入时隐藏 `this.node`；`LOG_FIXED` 后切到塔防倒 8 逻辑，跑酷段仍驱动 Knob 左右循环。 |

### v4（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 需求再次明确：当前错误行为是“有输入就隐藏，3 秒无输入就显示”，应反过来。 |
| **原因** | 历史注释和早期实现仍描述空闲后显示提示，容易误判或回退。 |
| **解决** | 明确 `JoystickHintUI` 语义为“有输入显示，无输入超过 delay 隐藏”，并保留隐藏 `pref_joystickHint` 根节点的实现。 |

### v5（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 最终需求确认：`JoystickHintUI` 应该是有输入隐藏，3 秒无输入才显示。 |
| **原因** | v4 按反向语义更新，且隐藏脚本根节点会让组件停止 update，无法靠空闲计时重新显示。 |
| **解决** | `JoystickHintUI` 改回有输入隐藏、空闲超过 `GameConfig.joystickHintDelay` 显示；组件根节点保持 active，只隐藏/显示可视子节点，并用 `PARKOUR_FINISHED` 切到塔防倒 8 逻辑。 |

---

## fix-enemy-spawner-not-starting — EnemySpawner 不出怪

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 跑酷结束后 `EnemySpawner` 不出怪或生成后小怪无目标表现为不推进。 |
| **原因** | 刷怪器只靠 `LOG_FIXED` 事件打开 `_farActive`，若组件启动/绑定时已处于非跑酷阶段会错过激活；目标引用失效时也没有自行恢复。 |
| **解决** | `EnemySpawner.start` 根据当前 `GameManager` 阶段兜底激活，`LOG_FIXED` 激活逻辑幂等化，启动时立即首刷一次，并在更新/生成前自动解析场景中的 `Player` 目标。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `SpawnPoint_Far` 和其子节点 `_F0`、`_F1` 都应该出怪，但场景里没有看到这些点都参与生成。 |
| **原因** | `_trySpawnAt` 只使用传入的根节点坐标，没有收集 `SpawnPoint_*` 子节点，也没有在多个点之间轮询。 |
| **解决** | 生成前收集根节点和激活的 `SpawnPoint_*` 子节点，并按根节点分别维护轮询游标，使 `SpawnPoint_Far/F0/F1` 都能作为生成点。 |

### v3（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `EnemySpawner` 不应该等 `PARKOUR_FINISHED`，需要开局直接刷怪；生成出来的小怪没有朝玩家靠近。 |
| **原因** | 刷怪器仍监听跑酷结束事件才激活；远端刷怪点到玩家距离可能超过 `minionAggroRange`，生成小怪会被仇恨范围逻辑停在原地；对象池目标也可能在后续解析到玩家后未同步给已生成小怪。 |
| **解决** | `EnemySpawner.start` 直接激活刷怪并移除 `PARKOUR_FINISHED` 监听；刷怪器生成/复用的小怪标记为强制追踪目标，忽略仇恨距离上限；刷怪器每帧把已解析到的玩家目标同步给活跃池对象。 |

---

## fix-embedded-character-hp-bars — 角色 prefab 内置血条未生效

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 角色 prefab 已经内置并摆好血条，但运行时仍可能在 UI 下动态生成血条，血条也保留在 UI2D Layer。 |
| **原因** | Player/Hero/Enemy/Log 等逻辑仍调用 `UIManager.spawnHpBar` 或依赖 UI 坐标跟随；三个血条 prefab 的节点 Layer 仍是 UI_2D。 |
| **解决** | Player、Hero、EnemyMinion、EnemyBoss、Soldier、Log 改为绑定自身子节点中的 `HpBarUI`；`HpBarUI` 发现自己是目标节点后代时保留本地摆放；停止 UIManager 开局自动生成玩家血条；三个血条 prefab Layer 改为 Default。 |

---

## fix-log-blue-line-direct-fixed — 滚木到蓝线未直接结束跑酷

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 滚木到达蓝线后还会按长度是否达标决定 `LOG_FIXED` 或 `LOG_FAILED`，导致跑酷段可能不结束。 |
| **原因** | `Log._pollParkourLines` 和 `ParkourLineZone` 都在蓝线触发时计算 `blueLineMinLogLength`，并把结果传给 `tryLockAtFinish`。 |
| **解决** | 蓝线轮询和 Trigger 路径都直接调用 `tryLockAtFinish()`；`tryLockAtFinish` 不再用长度门槛分支，触发即固定滚木并发送 `LOG_FIXED`。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | `LOG_FIXED` 只能表示滚木固定成功；跑酷段结束需要新标识，且滚木固定仍要求到达蓝线并长度 >= 3。 |
| **原因** | v1 把跑酷结束和滚木固定混在 `LOG_FIXED` 中，导致长度不足时也会触发固定成功后续系统。 |
| **解决** | 新增 `PARKOUR_FINISHED` 表示滚木到达蓝线并结束跑酷；`LOG_FIXED` 只在长度达到 `GameConfig.blueLineMinLogLength` 时发送；Player/Joystick/SceneSetup/PhaseTransition/JoystickHint 使用新事件，BuildSystem/EnemySpawner 仍只监听 `LOG_FIXED`。 |

### v3（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 建造、刷怪、目标注册等后续逻辑都应该由跑酷段结束驱动，滚木固定本身不需要全局监听。 |
| **原因** | 继续保留 `LOG_FIXED` 容易让“滚木固定成功”和“跑酷结束”再次混用。 |
| **解决** | 删除 `GameEvents.LOG_FIXED`；`BuildSystem`、`EnemySpawner`、Player/Joystick/SceneSetup/PhaseTransition/JoystickHint 全部监听 `PARKOUR_FINISHED`；滚木长度达标时只更新自身 fixed 状态并按原有 `BOSS_TARGET_REGISTER` 通道注册 Boss 目标。 |

---

## fix-log-visual-length-scale — 滚木视觉长度过长

### v1（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 滚木逻辑长度 1/2/3/.../10 直接映射到 Visual X 缩放 1/2/3/.../10，视觉增长过大。 |
| **原因** | `_refreshLengthVisual` 同一个 `lengthScale` 同时用于视觉缩放和碰撞盒逻辑尺寸。 |
| **解决** | 逻辑长度保持不变，碰撞盒仍按逻辑长度缩放；Visual X 缩放改为 `1 + 当前长度 * 0.2`，对应 1.2/1.4/1.6/...。 |

### v2（2026-09-07）

| 项 | 说明 |
|---|---|
| **现象** | 滚木碰撞体长度还沿用旧的逻辑长度缩放，和最新视觉长度不一致。 |
| **原因** | v1 只改了 `Visual` X 缩放，`BoxCollider2D.size.width` 仍使用旧 `lengthScale`。 |
| **解决** | `_refreshLengthVisual` 中碰撞体宽度同步改用 `visualLengthScale = 1 + 当前长度 * 0.2`，保持视觉和碰撞长度一致。 |

---

## fix-log-rotation-x-unbounded — pref_log rotation.x 无限增长

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | `pref_log` 滚动时 `Visual` 的 `rotation.x` 数值持续累加，运行越久 Inspector 中数值越大。 |
| **原因** | `Log._updateRollVisual` 每帧直接在当前欧拉角 X 上叠加滚动角度，没有做周期归一化。 |
| **解决** | 滚动视觉仍按速度更新，但每次写回前把 X 角度限制到 0–360 度范围；同时移除 `Log.ts` 中已无用的 `Billboard` 引用。 |

### v2（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 需求明确为不要动 `rotation.x`，滚木 `Visual` 的 X 旋转应始终维持 0。 |
| **原因** | v1 仍保留滚动视觉对 X 旋转的写入，只是将角度取模，仍不符合静止旋转需求。 |
| **解决** | 移除滚木运行时滚动旋转累加逻辑，滚动阶段和固定/失败阶段都只把 `Visual` rotation 写为 `(0,0,0)`。 |

---

## fix-soldier-boss-targeting-and-walk — 近战兵不播走路且不优先打 Boss

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | `pref_soldier_melee` 已添加 walk 动画，但移动时仍播 idle；近战兵没有优先索敌 Boss。 |
| **原因** | `Soldier._updateLocomotionAnim` 无论移动状态都只播放 idle；近战兵目标搜索只扫描 `EnemyMinion`，没有把 `EnemyBoss` 纳入候选。 |
| **解决** | Soldier 移动时播放 walk、停止时播放 idle；近战兵优先查找 Boss，找不到 Boss 再找小怪，并保留远程兵原有逻辑。 |

---

## fix-boss-circle-attack-and-soldier-priority — Boss 攻击范围和索敌优先级不符合需求

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | Boss 攻击还是长条范围；Boss 索敌优先级没有把 `pref_soldier_melee` 放在建筑前。 |
| **原因** | `EnemyBoss._applyLineAttack` 使用朝向前方长条判定；索敌优先级只区分 Structure/hero/player，未纳入 melee Soldier。 |
| **解决** | Boss 攻击改为以 `attackTriggerRange` 为半径的圆形判定；索敌优先级新增 soldier=40，高于 building/barrier/log=30，并只把 barracks/melee Soldier 插到该优先级。 |

---

## fix-build-plot-background-arrow-and-shrine — 建造地块背景、英雄碑和箭矢表现

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 通用建造地块无法按建筑类型换背景；近战兵 walk 播一次结束；箭矢没有朝射出方向旋转。 |
| **原因** | `BuildPlot` 未暴露各建筑类型背景图属性；`soldier_melee/walk.anim` wrapMode 为单次；`Arrow` 只移动位置没有设置 Z 轴角度。 |
| **解决** | `BuildPlot` 暴露 wall/towerBasic/towerAdvanced/barracks/heroShrine/expandArea 背景 SpriteFrame 并随 buildType 应用；近战兵 walk 动画改循环；`Arrow` 按飞行方向设置 Z 轴旋转。 |

### v2（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 英雄召唤后 `pref_hero_shrine` 应继续存在在场景中。 |
| **原因** | v1 处理中误按“召唤后隐藏/销毁英雄碑”理解，且 BuildSystem 会关闭英雄碑地块。 |
| **解决** | `HeroShrine` 召唤英雄后不隐藏、不销毁自身；`BuildSystem._onHeroSpawned` 不再关闭 `heroShrinePlots`，只继续显示 expand 地块。 |

### v3（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | `pref_build_plot` 根据建筑类型替换图片时改到了 Background，而不是 `PreviewIcon`。 |
| **原因** | `BuildPlot._applyBackgroundSprite` 读取类型图后写入 `backgroundSprite` 的 Sprite。 |
| **解决** | 类型图改为应用到 `previewIcon` 的 Sprite；保留原序列化字段名，避免丢失 Inspector 中已配置的 SpriteFrame。 |

---

## fix-path-agent-frame-drop — 寻路导致明显掉帧

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 接入共享 `PathAgent` 后，Boss、小怪、英雄、近战兵同时寻路时帧率明显下降。 |
| **原因** | 每个单位各自低频 A*，普通小怪和英雄数量多时仍会产生大量路径重建、直线探测和障碍 AABB 检测。 |
| **解决** | 普通小怪和英雄跟随回退为轻量 `AirWallAabb.steerDirection`；保留 Boss/近战兵使用 `PathAgent`；同时调粗寻路参数：重算间隔 1s、格子 64、最大展开 90，降低单次和总体 CPU 压力；小怪/士兵满血血条默认隐藏，降低同屏 DrawCall 压力。 |

---

## fix-root-sorting-order-auto-bind — 根节点 SortingOrder2D 不给子 Sprite 补 Sorting2D

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 在 prefab 根节点添加 `SortingOrder2D` 后，子节点里带 `Sprite` 的渲染节点没有自动挂上 `Sorting2D`。 |
| **原因** | 旧 `SortingOrder2D` 只查 `visualNode` 或自身节点上的 `UIRenderer`，并写 `UIRenderer.priority`；没有扫描子 Sprite，也没有创建/同步 `Sorting2D`。 |
| **解决** | `SortingOrder2D` 改为根节点控制版：按根节点 `worldPosition.y` 计算排序，扫描自身和所有子节点；若工程可用 `cc.Sorting2D`，给带 `Sprite` 的节点自动补 `Sorting2D` 并同步 `sortingOrder`；否则回退写 `UIRenderer.priority`，避免未启用 2D Sorting 时预览缺类。开启 `executeInEditMode` 便于编辑器中生效。 |

### v2（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 在 Inspector 中把 `SortingOrder2D.offset` 从 0 改到 10，子节点 `Sorting2D.sortingOrder` 没有立刻变化。 |
| **原因** | 脚本只在 `lateUpdate` 同步，编辑器属性变更时不一定触发运行时 lateUpdate 路径。 |
| **解决** | 增加 `update`、`onRestore`、`resetInEditor` 同步入口，offset 在编辑器修改后会重新扫描子 Sprite 并强制写入排序值。 |

### v3（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | `Sorting2D.sortingOrder` 到达 `-32768` 后，修改 `SortingOrder2D.offset` 仍看不到变化。 |
| **原因** | `Sorting2D.sortingOrder` 有 `-32768~32767` 范围限制；旧公式 `-worldY * 100 + offset` 在场景 Y 较大时很容易被钳到下限。 |
| **解决** | 去掉 `*100`，改为 `Math.round(-node.worldPosition.y) + offset`，让排序值保持在 `Sorting2D` 可用范围内。 |

### v4（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 部分 prefab 的自定义 `SortingOrder2D` 挂在 `Visual` 等子节点上，一个 prefab 有多个 Sprite 时不能用根节点统一决定整组渲染层级。 |
| **原因** | 旧挂法按单个 Sprite/Visual 节点排序，根节点移动或存在多 Sprite 子树时，排序控制点不一致。 |
| **解决** | 将 character/building 相关 prefab 的自定义 `SortingOrder2D` 迁移到 prefab 根节点；子 Sprite 继续由根节点脚本自动补/同步 `cc.Sorting2D`。全量扫描确认 `SortingOrder2D` 非根挂载数为 0。 |

---

## fix-boss-cannot-hit-barracks — Boss 碰到兵营边缘但不攻击

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | Boss 靠近 `pref_barracks` 时看起来已经碰到建筑，但不会出手或打不到兵营。 |
| **原因** | Boss 的进入攻击距离和圆形 AOE 命中都按目标根节点中心点计算；兵营这类宽建筑从侧面被 collider 挡住时，Boss 到根节点中心仍可能大于攻击半径。 |
| **解决** | Boss 判距改为优先使用目标 `BoxCollider2D.worldAABB` 最近点距离；没有碰撞盒时才回退到根节点中心距离。这样碰到兵营外边缘即可进入攻击并被 AOE 命中。 |

---

## fix-character-left-right-facing — 角色缺少左右转向程序动画

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 小怪、盾兵、弓兵、Boss、Player、Hero1、Hero2 移动或攻击时不会按左右方向翻转 Visual。 |
| **原因** | 多数角色脚本只更新位移和 locomotion clip，没有同步 Visual 朝向；Hero 里的临时翻转逻辑也只覆盖部分攻击场景。 |
| **解决** | 新增 `VisualFacing` 共享 helper，记录 Visual 初始缩放并只切换 X 轴正负；Player/Hero/Soldier/EnemyMinion/EnemyBoss 在移动和攻击停住时按速度或目标位置更新左右朝向。 |

### v2（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | Player、Hero1、Hero2 的左右转向方向反了；Boss 和近战 Soldier 索敌扫描频率偏高；EnemySpawner 出怪偏慢。 |
| **原因** | Player/Hero 美术默认朝向与通用 `VisualFacing` 默认方向相反；Boss `pickTarget` 会重复扫描场景目标，近战 Soldier 每帧全场找 Boss/小怪；`farSpawnInterval` 为 2.5 秒。 |
| **解决** | `VisualFacing` 增加可选反向参数，Player/Hero 移动和攻击朝向使用反向，玩家自动攻击前也面向目标；Boss 新目标扫描按 `bossTargetScanInterval` 低频补表，近战 Soldier 锁定目标并按 `soldierRetargetInterval` 重选；`farSpawnInterval` 调到 1.6 秒。 |

---

## fix-player-arrow-falloff-and-billboard-rotation — 玩家箭穿透伤害与 Billboard 旋转

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 玩家箭矢穿透后每个目标都吃满额伤害；`Billboard` 仍会在 `lateUpdate` 中改节点 rotation。 |
| **原因** | `Arrow` 只按命中数量销毁，没有按命中序号计算递减伤害；`Billboard` 每帧根据相机位置写 `setRotationFromEuler`。 |
| **解决** | `Arrow` 前 3 个命中目标造成 `playerAttackDamage`，第 4 个起按 `arrowPierceDamageFalloff` 逐次递减，仍保留 5 命中或超距销毁；`Billboard` 保留组件字段但不再修改 rotation。 |

### v2（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 多个 prefab 上仍挂着 `Billboard` 组件，即使脚本已不再旋转，也会保留多余组件绑定。 |
| **原因** | 之前批量给角色、建筑、道具、弹道 prefab 添加了 `Billboard` 组件，需求改为取消 prefab 上的该脚本挂载。 |
| **解决** | 从 22 个 prefab 中移除 `Billboard` 组件对象及对应 `cc.CompPrefabInfo`，并重映射 prefab 内部 `__id__` 引用；未修改场景。 |

---

## fix-arrow-bow-parkour-heroselect-slots — 箭矢朝向、跑酷拾弓和英雄选择槽

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | `pref_projectile_arrow` 的 Z 轴朝向还差 180 度；跑酷段仍可能拾取 `pref_item_bow`；HeroSelect 的两个槽位会随机显示 hero0/hero1。 |
| **原因** | 箭矢 `directionAngleOffset` 仍按旧贴图朝向；`BowItem` 没有检查当前 `GamePhase`；`HeroSelectUI` 会随机打乱 `_offer` 并按 heroIdx 显隐卡内图标槽。 |
| **解决** | `Arrow.directionAngleOffset` 和 `pref_projectile_arrow` 序列化值改为 180；`BowItem` 在 `RunParkour` 阶段拒绝距离/接触拾取；`HeroSelectUI` 固定 offer 顺序，slot0 显示 icon0，slot1 显示 icon1，并兼容 `HeroSlot0/HeroSlot1` 节点名。 |

---

## fix-expand-unlock-hide-list — 拓展区解锁后需要隐藏额外节点

### v1（2026-09-08）

| 项 | 说明 |
|---|---|
| **现象** | 拓展区解锁后，只显示 `Plot_Expand`，但没有统一入口隐藏其它需要收起的场景节点。 |
| **原因** | `BuildSystem._onHeroSpawned` 只负责 reveal `expandPlots`，未暴露可配置的隐藏列表。 |
| **解决** | 在 `BuildSystem` 暴露 `hideWhenExpandUnlocked: Node[]`，拓展地块 reveal 后遍历该列表并设置 `active=false`。 |

---
