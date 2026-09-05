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


