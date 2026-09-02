# Defense3 — AI 可执行任务清单 v4.1

> **用途**：供 Cursor / Agent 按顺序勾选执行；一次只做一个 `- [ ]` 任务。  
> **权威设计**：`[defense3.md](defense3.md)` · **动画帧**：`[docs/ANIM_MANIFEST.md](docs/ANIM_MANIFEST.md)` · **场景放置**：`[docs/SCENE_PLACEMENT.md](docs/SCENE_PLACEMENT.md)`  
> **引擎**：Cocos Creator **3.8.8**，TypeScript · **启动场景**：`assets/scenes/Main.scene`  
> **管线**：`/plan-task` → 审阅 plan `## To-dos` → `/build-plan <slug>` → `/verify-plan <slug>`

### Agent 执行约定

1. 一次只做一个 `- [ ]` 任务；完成后勾选并简述改动文件。
2. 每条任务含：**目标 / 依赖 / 改动文件 / 验收 / 复用提示 / slug**。未满足依赖不要跳做。
3. 数值一律读 `[GameConfig.ts](assets/scripts/core/GameConfig.ts)`，禁止魔法数散落。
4. **脚本唯一性**：玩家仅 `Player.ts`，滚木仅 `Log.ts`（禁止 `*Controller.ts` 分裂）。
5. prefab / `Main.scene` 须经 **Defense3 + Cocos MCP** 创建与装配；禁止手写整份 JSON（见 `.cursor/rules/defense3-workflow.mdc`）。
6. 已有 prefab/脚本标 `[x]` 或「仅接线」时，**不要重复建资源**；只开缺口任务或合并 slug。
7. plan 必须含 `## To-dos`（`X.Y.a/b/c`）与 AC；模板见 `[.cursor/plans/_TEMPLATE.md](.cursor/plans/_TEMPLATE.md)`。

### 滚木与跑酷隐藏约定


| 时机                           | 行为                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 蓝线滚木固定（`LOG_FIXED`，跑酷段结束）    | 玩家全方向移动；**仅隐藏** `ParkourContent/SawTrap_1~3` 与滚木加长道具（`LogExtendItemRoot` 下实例）；**不**隐藏预置怪、黄蓝线；**不**对 `ParkourContent` 整棵 `active=false`                     |
| 两墙都建完（`BOTH_WALLS_COMPLETE`） | 隐藏跑酷段**剩余**物件（`PreEnemy_1~8`、`YellowLine`、`BlueLine`）；电锯/加长道具已在滚木固定时隐藏；**禁止** `ParkourContent.active=false`；滚木在 `RoadRoot/LogAnchor`（永不在 ParkourContent 下） |


> 场景挂点：`SawTrap_*` / `LogExtendItemRoot` / `PreEnemy_*` / `YellowLine` / `BlueLine` 均在 `ParkourContent` 下；隐藏逻辑按**子节点**执行，勿关整棵父节点。

### slug 规范


| 类型   | 规则                        | 示例                     |
| ---- | ------------------------- | ---------------------- |
| 任务实现 | `phase-<章>-<任务号>-<topic>` | `phase-2-2-7-bow-item` |
| 阶段验收 | `phase-<章>-g<门禁>-verify`  | `phase-1-g1-verify`    |
| Bug  | `bug-<scope>-<topic>`     | `bug-phase2-bow-bind`  |


> **编号说明**：章号 1~~6 对应下文 `## 1~~## 6`；任务号如` 2.7`→ slug`phase-2-2-7-bow-item`。

---

## 1. 项目初始化与基础架构

- **1.1 配置目录结构**
  - **目标**：`assets/` 下脚本、prefab、sprite、animations、docs 目录齐全。
  - **依赖**：无
  - **改动文件**：`assets/scenes/`、`assets/scripts/{core,game,ui,character,building,enemy,item,trap}/`、`assets/resources/prefabs/{character,building,enemy,item,trap,projectile,ui}/`、`assets/resources/sprite/frames/`、`assets/resources/animations/`、`docs/`
  - **验收**：目录存在；项目启用 2D 物理
  - **复用提示**：Phase 0 bootstrap 已交付
  - **slug**：`phase-1-1-1-dirs`（归档）
- **1.2 创建主场景骨架**
  - **目标**：`Main.scene` 含 Camera、GameRoot/World、RoadRoot、ParkourContent、刷怪点、UI、GameManager。
  - **依赖**：1.1
  - **改动文件**：`assets/scenes/Main.scene`、`docs/SCENE_PLACEMENT.md`
  - **验收**：编辑器打开无 missing script；启动场景指向 Main
  - **复用提示**：见 SCENE_PLACEMENT §Phase 0 层级树
  - **slug**：`phase-0-bootstrap`（done）
- **1.3 单例基类与事件通信**
  - **目标**：`Singleton`、`EventManager`、`GameEvents` 可用。
  - **依赖**：1.1
  - **改动文件**：`assets/scripts/core/Singleton.ts`、`EventManager.ts`、`GameEvents.ts`
  - **验收**：`GameManager` 可 emit/listen `PHASE_CHANGED` 等事件
  - **复用提示**：事件名与 defense3 阶段链一致
  - **slug**：`phase-1-1-3-events`（归档）
- **1.4 SortingOrder2D 与 Billboard**
  - **目标**：§P0 渲染约定：Root(物理) → Visual(Sprite+Animation+Billboard+SortingOrder2D)。
  - **依赖**：1.2
  - **改动文件**：`assets/scripts/core/SortingOrder2D.ts`、`Billboard.ts`
  - **验收**：`sortingOrder = round(-visual.worldY * 100)`；Sprite `anchorY=0`；Billboard 仅绕 Y 轴
  - **复用提示**：相机透视 (0,15,15) 俯角约 45°
  - **slug**：`phase-1-1-4-render`（归档）
- **1.5 GameConfig 与 GameManager**
  - **目标**：集中数值；阶段枚举与切换。
  - **依赖**：1.3
  - **改动文件**：`assets/scripts/core/GameConfig.ts`、`assets/scripts/game/GamePhase.ts`、`GameManager.ts`
  - **验收**：`npx tsc --noEmit` 通过；可手动切阶段
  - **复用提示**：后续任务只扩展 GameConfig 字段，不硬编码
  - **slug**：`phase-1-1-5-game-core`（归档）
- **1.6 AnimUtil 占位动画**
  - **目标**：空 clip 可播放；美术到位后按 ANIM_MANIFEST 替换。
  - **依赖**：1.1
  - **改动文件**：`assets/scripts/core/AnimUtil.ts`、`assets/resources/animations/`
  - **验收**：`playAnim(node, clipName)` 不报错
  - **复用提示**：clip 名与脚本调用不得改
  - **slug**：`phase-1-1-6-anim`（归档）
- **1.7 MCP 交付门禁（可选）**
  - **目标**：Defense3 工程 + Cocos MCP 可用；`verify-mcp-gate.ps1` 可跑。
  - **依赖**：1.2
  - **改动文件**：`.cursor/scripts/verify-mcp-gate.ps1`（只读参考）
  - **验收**：MCP `assets-query-path` 指向本仓库；改 scene/prefab 后门禁退出码 0
  - **复用提示**：见 `cocos-mcp.mdc` 五步交付
  - **slug**：—（环境检查）

---

## 2. 核心游戏对象与预制体

> 本章只做 **prefab + 主脚本**；系统串联见 §4，场景实例见 §3，UI 见 §5。

- **2.1 玩家 `pref_player`**
  - **目标**：§P0-A 结构 + `Player.ts`（跑酷/防守移动、后续攻击扩展）。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/character/pref_player.prefab`、`assets/scripts/character/Player.ts`
  - **验收**：prefab 无嵌套 Canvas；`visualNode` 已绑；动画 clip 占位 idle/walk/parkour/meleeAttack/skill/die
  - **复用提示**：归档 `p2-001-player`；子节点 `HpBarAnchor` 供 §5 血条
  - **slug**：`phase-2-2-1-player`（done，仅补齐时开 plan）
- **2.2 滚木 `pref_log`**
  - **目标**：`Log.ts` 唯一滚木脚本：推动、变长/砍短、黄蓝线、固定/淡出。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/item/pref_log.prefab`、`assets/scripts/item/Log.ts`
  - **验收**：实例挂 `RoadRoot/LogAnchor`，勿放 ParkourContent
  - **复用提示**：归档 `p2-002-log`
  - **slug**：`phase-2-2-2-log`（done）
- **2.3 小怪 `pref_enemy_minion`**
  - **目标**：`EnemyMinion.ts` + 碰撞/刚体/动画占位。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/enemy/pref_enemy_minion.prefab`、`assets/scripts/enemy/EnemyMinion.ts`
  - **验收**：idle/walk/attack/die clip 占位；血条锚点存在
  - **复用提示**：归档 `p2-003-enemy-minion`
  - **slug**：`phase-2-2-3-minion`（done）
- **2.4 电锯 `pref_trap_saw`**
  - **目标**：Trigger + `SawTrap.ts`：伤玩家、砍滚木。
  - **依赖**：1.4、2.1、2.2
  - **改动文件**：`assets/resources/prefabs/trap/pref_trap_saw.prefab`、`assets/scripts/trap/SawTrap.ts`
  - **验收**：AC-P1 无 Canvas；碰 Player/Log 逻辑可读 GameConfig
  - **复用提示**：场景实例 `ParkourContent/SawTrap_1~3`
  - **slug**：`phase-2-2-4-trap-saw`（done）
- **2.5 滚木加长道具 `pref_item_log_extend`**
  - **目标**：`LogExtendItem.ts` → `Log.extend()`。
  - **依赖**：2.2
  - **改动文件**：`assets/resources/prefabs/item/pref_item_log_extend.prefab`、`assets/scripts/item/LogExtendItem.ts`
  - **验收**：Trigger 拾取后道具销毁/隐藏
  - **复用提示**：—
  - **slug**：`phase-2-2-5-log-extend`（done）
- **2.6 虚拟摇杆 `pref_joystick`**
  - **目标**：`Joystick.ts`；跑酷段仅左右输出。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/ui/pref_joystick.prefab`、`assets/scripts/ui/Joystick.ts`
  - **验收**：AC-P2 无 Canvas/Camera；Knob 非 1×1
  - **复用提示**：归档 `p2-014-joystick`
  - **slug**：`phase-2-2-6-joystick`（done）
- **2.7 摇杆提示 UI `pref_ui_joystick_hint`**
  - **目标**：`JoystickHintUI.ts`；3s 无输入显示；防守阶段不显示。
  - **依赖**：2.6
  - **改动文件**：`assets/resources/prefabs/ui/pref_ui_joystick_hint.prefab`、`assets/scripts/ui/JoystickHintUI.ts`
  - **验收**：与实操摇杆互斥；跑酷段提示左右
  - **复用提示**：倒 8 字动画可 §6 精修
  - **slug**：`phase-2-2-7-joystick-hint`（done）
- **2.8 弓箭道具 `pref_item_bow`**
  - **目标**：`BowItem.ts`；拾取后 `Player.setHasBow(true)`。
  - **依赖**：2.1
  - **改动文件**：`assets/resources/prefabs/item/pref_item_bow.prefab`、`assets/scripts/item/BowItem.ts`（新建）
  - **验收**：prefab 存在；Trigger 拾取；未拾弓 Player 不可攻击（§4.D）
  - **复用提示**：可参考归档 `p2-012-items` draft
  - **slug**：`phase-2-2-8-bow-item`
- **2.9 箭矢 `pref_projectile_arrow`**
  - **目标**：`Arrow.ts`；飞向目标，命中伤害。
  - **依赖**：2.1
  - **改动文件**：`assets/resources/prefabs/projectile/pref_projectile_arrow.prefab`、`assets/scripts/projectile/Arrow.ts`（新建）
  - **验收**：可实例化飞行；伤害读 GameConfig
  - **复用提示**：英雄弹道 `pref_projectile_hero_01/02` 结构可参考
  - **slug**：`phase-2-2-9-arrow`
- **2.10 金币 `pref_item_coin`**
  - **目标**：`Coin.ts`；可被吸附拾取。
  - **依赖**：1.5
  - **改动文件**：`assets/resources/prefabs/item/pref_item_coin.prefab`、`assets/scripts/item/Coin.ts`（新建）
  - **验收**：拾取 emit `COIN_CHANGED` 或交 CoinSystem 处理
  - **复用提示**：抛物线表现 §6
  - **slug**：`phase-2-2-10-coin`
- **2.11 Boss `pref_enemy_boss`**
  - **目标**：`EnemyBoss.ts`；动画占位；索敌框架。
  - **依赖**：1.4、1.5
  - **改动文件**：`assets/resources/prefabs/enemy/pref_enemy_boss.prefab`、`assets/scripts/enemy/EnemyBoss.ts`
  - **验收**：bossMaxHp/Attack/MoveSpeed 读 GameConfig；归档 `p2-004` done
  - **复用提示**：本 Phase 简化为靠近玩家；完整优先级 §4.C
  - **slug**：`phase-2-2-11-boss`（done，仅接线/刷怪时引用）
- **2.12 通用建造地块 `pref_build_plot`**
  - **目标**：费用 Label、绿条、预览、`BuildPlot.ts`。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/building/pref_build_plot.prefab`、`assets/scripts/building/BuildPlot.ts`
  - **验收**：玩家进入扣费→生成建筑→地块消失
  - **复用提示**：归档 `p2-005-build-plot`
  - **slug**：`phase-2-2-12-build-plot`（done）
- **2.13 城墙 `pref_wall`**
  - **目标**：`Wall.ts`；封楼梯、停刷怪、受击闪红占位。
  - **依赖**：2.12
  - **改动文件**：`assets/resources/prefabs/building/pref_wall.prefab`、`assets/scripts/building/Wall.ts`
  - **验收**：建墙后对应 SpawnPoint 停刷
  - **复用提示**：归档 `p2-006-wall`
  - **slug**：`phase-2-2-13-wall`（done）
- **2.14 初级箭塔 `pref_tower_basic`**
  - **目标**：`Tower.ts`；塔顶 3× 远程兵。
  - **依赖**：2.15、2.12
  - **改动文件**：`assets/resources/prefabs/building/pref_tower_basic.prefab`、`assets/scripts/building/Tower.ts`
  - **验收**：塔可放置；士兵远程攻击
  - **复用提示**：归档 `p2-007-tower`
  - **slug**：`phase-2-2-14-tower-basic`（done）
- **2.15 兵营 `pref_barracks`**
  - **目标**：`Barracks.ts`；解锁出兵 + 周期近战兵。
  - **依赖**：2.16、2.12
  - **改动文件**：`assets/resources/prefabs/building/pref_barracks.prefab`、`assets/scripts/building/Barracks.ts`
  - **验收**：8 放置点近战兵循环
  - **复用提示**：归档 `p2-008-barracks`
  - **slug**：`phase-2-2-15-barracks`（done）
- **2.16 小兵 `pref_soldier_melee` / `pref_soldier_ranged`**
  - **目标**：`Soldier.ts`；近战/远程动画占位。
  - **依赖**：1.4
  - **改动文件**：`assets/resources/prefabs/character/pref_soldier_*.prefab`、`assets/scripts/character/Soldier.ts`
  - **验收**：ANIM_MANIFEST §soldier clip 占位
  - **复用提示**：归档 `p2-011-soldier`
  - **slug**：`phase-2-2-16-soldier`（done）
- **2.17 英雄召唤碑 `pref_hero_shrine`**
  - **目标**：`HeroShrine.ts`；解锁弹选英雄 UI。
  - **依赖**：2.12
  - **改动文件**：`assets/resources/prefabs/building/pref_hero_shrine.prefab`、`assets/scripts/building/HeroShrine.ts`
  - **验收**：购买后触发选英雄流程（§4.F）
  - **复用提示**：归档 `p2-009-hero-shrine`
  - **slug**：`phase-2-2-17-hero-shrine`（done）
- **2.18 英雄 `pref_hero_01` / `pref_hero_02`**
  - **目标**：`Hero.ts` + 弹道 prefab。
  - **依赖**：1.4
  - **改动文件**：`pref_hero_01/02.prefab`、`pref_projectile_hero_01/02.prefab`、`assets/scripts/character/Hero.ts`
  - **验收**：跟随玩家、远程攻击框架
  - **复用提示**：归档 `p2-010-hero`
  - **slug**：`phase-2-2-18-hero`（done）
- **2.19 阻挡物 `pref_barrier_wall` / `pref_barrier_long`**
  - **目标**：`Barrier.ts`；带血条挡怪。
  - **依赖**：1.4、1.5
  - **改动文件**：`assets/resources/prefabs/building/pref_barrier_*.prefab`、`assets/scripts/building/Barrier.ts`（新建）
  - **验收**：可被怪攻击；有血条锚点
  - **复用提示**：归档 `p2-013` draft
  - **slug**：`phase-2-2-19-barrier`
- **2.20 高级箭塔 `pref_tower_advanced`**
  - **目标**：高级塔逻辑；两塔建完 emit `BOTH_ADVANCED_TOWERS_COMPLETE`。
  - **依赖**：2.14
  - **改动文件**：`assets/resources/prefabs/building/pref_tower_advanced.prefab`、扩展 `Tower.ts` 或子类
  - **验收**：prefab 存在；事件可触发（§4.H）
  - **复用提示**：—
  - **slug**：`phase-2-2-20-tower-advanced`（prefab done，系统接线待做）
- **2.21 玩家大招 `pref_skill_ultimate`**
  - **目标**：大招表现 prefab；清场触发接口。
  - **依赖**：2.1
  - **改动文件**：`assets/resources/prefabs/skill/pref_skill_ultimate.prefab`（路径按项目定）
  - **验收**：prefab 可挂接 UltimateSystem
  - **复用提示**：—
  - **slug**：`phase-2-2-21-ultimate-prefab`

---

## 3. 场景搭建与布局

> 静态关卡物须 **MCP/编辑器预先摆入**；禁止 `onLoad` instantiate 布局（`EnemySpawner` 运行时刷怪除外）。

- **3.1 主场景分区与挂点**
  - **目标**：GameRoot/World 下 RoadRoot、ParkourContent、SpawnPoint_*、PlayerSpawn、BuildPlots、UI、Effect。
  - **依赖**：1.2
  - **改动文件**：`assets/scenes/Main.scene`、`docs/SCENE_PLACEMENT.md`
  - **验收**：层级与 SCENE_PLACEMENT §Phase 0 一致；AC-S1 无 `Node.*` 非法 _id
  - **复用提示**：phase-0-bootstrap done
  - **slug**：`phase-3-3-1-scene-skeleton`（done）
- **3.2 跑酷段实例化（玩家/滚木/陷阱/预置怪/UI）**
  - **目标**：按放置表实例化 pref_player、pref_log、电锯×3、小怪×7~8、摇杆、提示、加长道具。
  - **依赖**：2.1~2.7、3.1
  - **改动文件**：`Main.scene`、`docs/SCENE_PLACEMENT.md`
  - **验收**：AC-SCENE-INST/BIND；SceneSetup 六引用非 null
  - **复用提示**：phase-1-parkour done；用户可微调坐标
  - **slug**：`phase-3-3-2-parkour-layout`（done）
- **3.3 黄蓝线与刷怪点组件**
  - **目标**：YellowLine/BlueLine 挂 `ParkourLineZone`；Far 挂 `EnemySpawner`；PhaseTransition 绑定。
  - **依赖**：3.2、§4.B、§4.C
  - **改动文件**：`Main.scene`、`ParkourLineZone.ts`、`EnemySpawner.ts`、`PhaseTransition.ts`
  - **验收**：黄线蓄力、蓝线固定/失败；远端刷怪；滚木固定后 Left/Right 激活
  - **复用提示**：—
  - **slug**：`phase-3-3-3-lines-spawn`（done）
- **3.4 战斗引导场景布置**
  - **目标**：跑酷末/塔防入口放 `pref_item_bow`；`BossSpawn_First` 空节点。
  - **依赖**：2.8、2.11、§4.D
  - **改动文件**：`Main.scene`、`docs/SCENE_PLACEMENT.md`
  - **验收**：弓可拾取；Boss 首次从屏外生成
  - **复用提示**：仅摆场+绑引用，不重建 Boss prefab
  - **slug**：`phase-3-3-4-combat-layout`
- **3.5 建造地块摆放（墙/塔/兵营）**
  - **目标**：Plot_Wall_L/R、Plot_TowerBasic_L/R、Plot_Barracks 坐标与费用键。
  - **依赖**：2.12~2.15、3.1
  - **改动文件**：`Main.scene`、`docs/SCENE_PLACEMENT.md`
  - **验收**：滚木固定后出现墙地块；两墙后出现塔+兵营地块
  - **复用提示**：见旧 Phase 3 任务 3.6 表
  - **slug**：`phase-3-3-5-build-plots`
- **3.6 英雄碑与拓展区地块**
  - **目标**：Plot_HeroShrine、Plot_Expand 及解锁顺序挂点。
  - **依赖**：2.17、3.5
  - **改动文件**：`Main.scene`
  - **验收**：兵营后解锁英雄碑；选英雄后出现拓展地块
  - **复用提示**：—
  - **slug**：`phase-3-3-6-hero-expand-plots`
- **3.7 拓展防守区布局**
  - **目标**：BarrierWall_L/R、BarrierLong_Center、ExpandSideWalls、Plot_TowerAdvanced_L/R。
  - **依赖**：2.19、2.20、3.6
  - **改动文件**：`Main.scene`
  - **验收**：拓展解锁后阻挡物与高级塔地块可见
  - **复用提示**：—
  - **slug**：`phase-3-3-7-defense-expand`

---

## 4. 核心游戏系统实现

### 4.A 输入与玩家

- **4.1 虚拟摇杆输入**
  - **目标**：触屏驱动 `Joystick`；跑酷段仅左右；输出方向给 `Player`。
  - **依赖**：2.6、2.1
  - **改动文件**：`Joystick.ts`、`Player.ts`
  - **验收**：松手速度归零；`SceneSetup` 调用 `bindPlayer`
  - **复用提示**：—
  - **slug**：`phase-4-4-1-joystick`（done）
- **4.2 摇杆提示（3s 无操作）**
  - **目标**：跑酷段空闲显示提示；触屏隐藏；防守不显示。
  - **依赖**：4.1、2.7
  - **改动文件**：`JoystickHintUI.ts`、`GameConfig.joystickHintDelay`
  - **验收**：3s 规则生效
  - **复用提示**：倒 8 字 §6.2
  - **slug**：`phase-4-4-2-joystick-hint`（done）
- **4.3 跑酷段移动（推滚木）**
  - **目标**：摇杆左右 + 自动向前推滚木；`parkour` 动画态。
  - **依赖**：4.1、2.1、2.2
  - **改动文件**：`Player.ts`、`Log.ts`
  - **验收**：G1：玩家自动向前；仅左右摇杆
  - **复用提示**：—
  - **slug**：`phase-4-4-3-parkour-move`（done）
- **4.4 防守段全方向移动**
  - **目标**：蓝线固定后 `Defense` 态；全方向摇杆。
  - **依赖**：4.3、§4.G
  - **改动文件**：`Player.ts`、`Joystick.ts`
  - **验收**：固定后不再限制左右；预置怪/黄蓝线仍可见；电锯/加长道具已在滚木固定时隐藏
  - **复用提示**：—
  - **slug**：`phase-4-4-4-defense-move`（done）
- **4.5 相机跟随玩家**
  - **目标**：透视主相机全程跟随玩家移动（跑酷推滚木 + 防守全向），保持俯角约 45° / 高度约 Y=15 的相对偏移；平滑跟随，不改物理根节点旋转。
  - **依赖**：2.1、3.1、4.3
  - **改动文件**：
    - 【可新建】`assets/scripts/game/CameraFollow.ts`（或扩 `CameraController.ts`：跟随 + 后续拉远共用）
    - 【可写】`assets/scripts/core/GameConfig.ts` — `cameraFollowOffset` / `cameraFollowSmooth`（或等价）
    - 【可写】`assets/scenes/Main.scene` — Camera 节点挂脚本；`target` 绑玩家实例（MCP）
    - 【可写】`SceneSetup.ts`（可选）— `onLoad` 补绑 `CameraFollow.target` 若 Inspector 未绑
  - **验收**：
    - Play：玩家沿道路前进时相机同步跟移；左右摇杆时相机 X 也跟随
    - 防守全向移动时相机持续跟随，不锁死开局坐标
    - 相机仍为透视；Billboard 精灵朝向正常
    - 偏移/平滑读 GameConfig，无魔法数
  - **复用提示**：只平移相机世界位置（或跟 lookAt 点），**不要**把 Camera 挂成 Player 子节点（避免继承物理旋转）；大招拉远见 **4.34**（同脚本扩展 `zoomOut` 即可，勿再建第二套相机控制）
  - **slug**：`phase-4-4-4a-camera-follow`
- **4.6 玩家射箭攻击**
  - **目标**：有弓才可攻击；发射 `pref_projectile_arrow`；读攻击间隔/伤害。
  - **依赖**：2.8、2.9、§4.D.1
  - **改动文件**：`Player.ts`、`CombatSystem.ts`
  - **验收**：未拾弓 return；拾弓后可击杀小怪
  - **复用提示**：—
  - **slug**：`phase-4-4-5-player-shoot`
- **4.7 玩家受击与死亡**
  - **目标**：碰怪/电锯扣血；emit `HP_CHANGED`；死亡处理。
  - **依赖**：§4.D.2、2.1
  - **改动文件**：`Player.ts`、`HealthSystem.ts`
  - **验收**：伤害读 GameConfig；血条联动 §5
  - **复用提示**：电锯伤害已在 SawTrap
  - **slug**：`phase-4-4-6-player-hurt`

### 4.B 跑酷与滚木

- **4.7 滚木推动与滚动表现**
  - **目标**：随玩家前进；程序旋转 + `roll` clip。
  - **依赖**：2.2、4.3
  - **改动文件**：`Log.ts`
  - **验收**：滚木与玩家同步前进
  - **复用提示**：—
  - **slug**：`phase-4-4-7-log-roll`（done）
- **4.8 电锯砍断与加长道具**
  - **目标**：SawTrap 缩短；LogExtendItem 延长。
  - **依赖**：2.4、2.5
  - **改动文件**：`SawTrap.ts`、`LogExtendItem.ts`、`Log.ts`
  - **验收**：G1 电锯/加长道具行为
  - **复用提示**：—
  - **slug**：`phase-4-4-8-log-trap-extend`（done）
- **4.9 黄蓝线区域检测**
  - **目标**：黄线减速蓄力；蓝线够长固定/不够淡出。
  - **依赖**：2.2、3.3
  - **改动文件**：`ParkourLineZone.ts`、`Log.ts`、`GameConfig`
  - **验收**：G1 黄蓝线全套；固定后激活左右刷怪点
  - **复用提示**：—
  - **slug**：`phase-4-4-9-line-zones`（done）
- **4.10 开局与阶段串联 SceneSetup**
  - **目标**：`RunParkour` 开局；绑玩家/滚木/摇杆；`LOG_FIXED`→`CombatGuide`。
  - **依赖**：3.2、3.3、1.5
  - **改动文件**：`SceneSetup.ts`、`GameManager.ts`
  - **验收**：不 instantiate 静态物；引用全绑
  - **复用提示**：—
  - **slug**：`phase-4-4-10-scene-setup`（done）

### 4.C 刷怪与敌人 AI

- **4.11 远端持续刷小怪**
  - **目标**：`SpawnPoint_Far` + `EnemySpawner`；上限读 GameConfig。
  - **依赖**：2.3、3.3
  - **改动文件**：`EnemySpawner.ts`、`EnemyMinion.ts`
  - **验收**：G1 远端刷怪；跑酷段预置怪+动态刷怪并存
  - **复用提示**：—
  - **slug**：`phase-4-4-11-far-spawn`（done）
- **4.12 滚木固定后左右刷怪点**
  - **目标**：`LOG_FIXED` 后激活 Left/Right Spawner。
  - **依赖**：4.9、4.11
  - **改动文件**：`EnemySpawner.ts`、`Log.ts`
  - **验收**：固定前左右不刷；固定后刷
  - **复用提示**：—
  - **slug**：`phase-4-4-12-side-spawn`（done）
- **4.13 小怪简版 AI**
  - **目标**：朝玩家移动；攻击玩家（伤害占位）。
  - **依赖**：2.3、4.3
  - **改动文件**：`EnemyMinion.ts`
  - **验收**：小怪会追击玩家
  - **复用提示**：金币掉落 §4.D.3 待补
  - **slug**：`phase-4-4-13-minion-ai`（done）
- **4.14 Boss 首次生成与靠近**
  - **目标**：屏外 `BossSpawn_First` 首次生成；朝玩家移动。
  - **依赖**：2.11、3.4、4.4
  - **改动文件**：`EnemyBoss.ts`、刷怪管理脚本（新建或扩 EnemySpawner）
  - **验收**：G2：Boss 从远处靠近；**不重建** pref_enemy_boss
  - **复用提示**：归档 p2-004 只读引用
  - **slug**：`phase-4-4-14-boss-spawn`
- **4.15 Boss 索敌优先级（完整）**
  - **目标**：建筑 > 英雄 > 玩家。
  - **依赖**：4.14、§4.E、§4.F
  - **改动文件**：`EnemyBoss.ts`
  - **验收**：多目标时优先级正确
  - **复用提示**：EnemyBoss 已有注册接口
  - **slug**：`phase-4-4-15-boss-ai`
- **4.16 建墙后停刷怪**
  - **目标**：单侧墙完成→该侧 SpawnPoint 停刷。
  - **依赖**：2.13、§4.E
  - **改动文件**：`Wall.ts`、`EnemySpawner.ts`
  - **验收**：G3 单侧停刷
  - **复用提示**：—
  - **slug**：`phase-4-4-16-wall-stop-spawn`

### 4.D 战斗、血量与金币

- **4.17 战斗系统 CombatSystem**
  - **目标**：统一玩家射箭入口；实例化箭矢；命中结算。
  - **依赖**：2.9、4.5
  - **改动文件**：`assets/scripts/game/CombatSystem.ts`（新建）
  - **验收**：命中 EnemyMinion 扣血
  - **复用提示**：—
  - **slug**：`phase-4-4-17-combat-system`
- **4.18 血量系统 HealthSystem**
  - **目标**：`takeDamage`/`heal`/死亡；emit `HP_CHANGED`。
  - **依赖**：1.5
  - **改动文件**：`assets/scripts/game/HealthSystem.ts`（新建）
  - **验收**：玩家/怪/Boss/墙/阻挡物可复用
  - **复用提示**：数值全 GameConfig
  - **slug**：`phase-4-4-18-health-system`
- **4.19 敌人攻击与 EnemyAI**
  - **目标**：小怪单体攻击玩家；与 HealthSystem 对接。
  - **依赖**：4.18、4.13
  - **改动文件**：`assets/scripts/enemy/EnemyAI.ts`（新建）、`EnemyMinion.ts`
  - **验收**：玩家持续受伤；HP_CHANGED 触发
  - **复用提示**：—
  - **slug**：`phase-4-4-19-enemy-ai`
- **4.20 金币系统 CoinSystem**
  - **目标**：怪死掉落金币→吸附玩家→逻辑加币。
  - **依赖**：2.10、4.18
  - **改动文件**：`assets/scripts/game/CoinSystem.ts`（新建）、`Coin.ts`
  - **验收**：G2 金币吸附+UI 增加
  - **复用提示**：抛物线 §6.3
  - **slug**：`phase-4-4-20-coin-system`
- **4.21 拾取弓箭流程**
  - **目标**：弓道具拾取→Player 持弓→引导攻击。
  - **依赖**：2.8、3.4、4.5
  - **改动文件**：`BowItem.ts`、`Player.ts`、`SceneSetup` 或引导脚本
  - **验收**：G2 未拾弓不能攻击
  - **复用提示**：—
  - **slug**：`phase-4-4-21-bow-pickup`

### 4.E 建造系统

- **4.22 建造流程 BuildSystem**
  - **目标**：滚木固定解锁墙地块；墙完成解锁塔+兵营；费用扣 CoinSystem。
  - **依赖**：2.12~2.15、3.5、4.20
  - **改动文件**：`assets/scripts/building/BuildSystem.ts`（新建）、`BuildPlot.ts`
  - **验收**：扣费→绿条→生成建筑→地块消失
  - **复用提示**：归档 p4-005-build draft
  - **slug**：`phase-4-4-22-build-system`
- **4.23 墙建造与楼梯封闭**
  - **目标**：Wall 实例对齐楼梯；触发停刷与阶段事件。
  - **依赖**：2.13、4.16、4.22
  - **改动文件**：`Wall.ts`、`BuildSystem.ts`
  - **验收**：G3 单侧墙与停刷
  - **复用提示**：—
  - **slug**：`phase-4-4-23-wall-build`
- **4.24 塔与兵营建造**
  - **目标**：塔顶远程兵；兵营周期出兵。
  - **依赖**：2.14、2.15、4.22
  - **改动文件**：`Tower.ts`、`Barracks.ts`、`Soldier.ts`
  - **验收**：G3 塔兵射击、营兵近战
  - **复用提示**：—
  - **slug**：`phase-4-4-24-tower-barracks`
- **4.25 跑酷物件分阶段隐藏（PhaseTransition）**
  - **目标**：`LOG_FIXED`→隐藏 `SawTrap_1~3` + 滚木加长道具；`BOTH_WALLS_COMPLETE`→隐藏 `PreEnemy_1~8`、黄蓝线；**禁止** `ParkourContent.active=false`；滚木保持可见。
  - **依赖**：3.1、2.2、2.4、2.5
  - **改动文件**：`PhaseTransition.ts`、`GameEvents.ts`、`docs/SCENE_PLACEMENT.md`、`.cursor/rules/defense3-workflow.mdc`
  - **验收**：G1 滚木固定后电锯/加长道具消失、预置怪/黄蓝线仍在；G3 两墙后预置怪/黄蓝线消失；LogAnchor 滚木仍在
  - **复用提示**：见 `defense3.md` 阶段 1/2 与 SCENE_PLACEMENT「阶段显隐规则」
  - **slug**：`phase-4-4-25-parkour-hide`（done）

### 4.F 英雄与拓展

- **4.26 英雄二选一 UI 流程**
  - **目标**：HeroShrine 解锁→弹 UI→生成选中英雄。
  - **依赖**：2.17、2.18、§5.4
  - **改动文件**：`HeroShrine.ts`、`HeroSelectUI.ts`、`Hero.ts`
  - **验收**：G4 选英雄并跟随攻击
  - **复用提示**：—
  - **slug**：`phase-4-4-26-hero-select`
- **4.27 英雄跟随与攻击**
  - **目标**：英雄跟随玩家；远程攻击最近敌人。
  - **依赖**：2.18、4.17
  - **改动文件**：`Hero.ts`
  - **验收**：英雄可击杀怪
  - **复用提示**：弹道 pref 已有
  - **slug**：`phase-4-4-27-hero-combat`
- **4.28 拓展区域解锁**
  - **目标**：Plot_Expand 购买后激活 §3.7 布局。
  - **依赖**：3.6、4.22
  - **改动文件**：`BuildSystem.ts`、`Main.scene`
  - **验收**：G4 拓展地块可解锁；进入 Phase 5 内容
  - **复用提示**：—
  - **slug**：`phase-4-4-28-expand-unlock`

### 4.G 阶段切换与 GameManager

- **4.29 阶段枚举与事件链**
  - **目标**：`RunParkour`→`CombatGuide`→`BuildPhase*`→`DefensePhase`→`Ultimate`→`GameOver`。
  - **依赖**：1.5、4.10
  - **改动文件**：`GamePhase.ts`、`GameManager.ts`、`GameEvents.ts`
  - **验收**：`PHASE_CHANGED` 可监听；与 defense3 主流程一致
  - **复用提示**：—
  - **slug**：`phase-4-4-29-game-phases`（部分 done，后续阶段待接线）
- **4.30 战斗引导阶段 CombatGuide**
  - **目标**：滚木固定后引导拾弓、射箭、金币、Boss。
  - **依赖**：4.21、4.20、4.14、4.29
  - **改动文件**：引导脚本或 `SceneSetup` 扩展
  - **验收**：G2 全流程
  - **复用提示**：可先做无 UI 箭头版
  - **slug**：`phase-4-4-30-combat-guide`

### 4.H 大招与游戏结束

- **4.31 阻挡物防守**
  - **目标**：拓展区阻挡物挡怪；带血条可摧毁/无限按设计。
  - **依赖**：2.19、3.7、4.18
  - **改动文件**：`Barrier.ts`
  - **验收**：G5 阻挡有效
  - **复用提示**：—
  - **slug**：`phase-4-4-31-barrier-defense`
- **4.32 高级箭塔完成事件**
  - **目标**：两座高级塔建完 emit `BOTH_ADVANCED_TOWERS_COMPLETE`。
  - **依赖**：2.20、3.7、4.22
  - **改动文件**：`Tower.ts`、`BuildSystem.ts`
  - **验收**：事件可触发 §4.33
  - **复用提示**：—
  - **slug**：`phase-4-4-32-advanced-towers`
- **4.33 大招 UltimateSystem**
  - **目标**：监听高级塔完成→玩家可放大招→清全场怪。
  - **依赖**：2.21、4.32
  - **改动文件**：`UltimateSystem.ts`（新建）、`Player.ts`
  - **验收**：G6 大招清怪
  - **复用提示**：—
  - **slug**：`phase-4-4-33-ultimate`
- **4.34 相机拉远与游戏结束**
  - **目标**：大招后镜头拉远→结束 UI。
  - **依赖**：§5.8、4.33、**4.4a**
  - **改动文件**：扩展 `CameraFollow`/`CameraController`（拉远 API）、`GameOverUI.ts`、`UIManager.ts`
  - **验收**：G6 结束界面；拉远期间可暂停跟随或缓动到固定俯视；`/summary defense3-full-flow`
  - **复用提示**：复用 4.4a 相机脚本，禁止再写第二套相机控制类
  - **slug**：`phase-4-4-34-game-over`

---

## 5. UI 系统实现

- **5.1 金币数量 UI `pref_ui_coin`**
  - **目标**：图标+数量 Label；监听 `COIN_CHANGED`。
  - **依赖**：4.20
  - **改动文件**：`assets/resources/prefabs/ui/pref_ui_coin.prefab`、`assets/scripts/ui/CoinUI.ts`（新建）
  - **验收**：开局 0；增减实时刷新
  - **复用提示**：defense3 §UI 金币条
  - **slug**：`phase-5-5-1-coin-ui`
- **5.2 虚拟摇杆 UI（实操）**
  - **目标**：底盘/摇杆头尺寸可用；挂场景 Canvas 下。
  - **依赖**：2.6、4.1
  - **改动文件**：`pref_joystick.prefab`
  - **验收**：AC-P2；非 1×1 触摸区
  - **复用提示**：done
  - **slug**：`phase-5-5-2-joystick-ui`（done）
- **5.3 摇杆提示 UI**
  - **目标**：提示预制体；跑酷段左右滑动文案/动效占位。
  - **依赖**：2.7、4.2
  - **改动文件**：`pref_ui_joystick_hint.prefab`
  - **验收**：3s 显示规则
  - **复用提示**：done
  - **slug**：`phase-5-5-3-hint-ui`（done）
- **5.4 英雄二选一 UI `pref_ui_hero_select`**
  - **目标**：40% 黑遮罩+两卡片+英雄图标；HeroShrine 触发二选一后弹出，点选后关闭并生成英雄。
  - **参考来源（只读，禁止迁移/复制）**：源 `chooseView.prefab` 与其根脚本 `chooseView.ts`（`C:/Users/Admin/Documents/WXWork/1688854586792200/Cache/File/2026-08/3条试玩打包/H-9011-SFK塔防模拟经营/assets/prefab/chooseView.prefab`、同目录 `../scripts/chooseView.ts`）。仅参考节点结构、动画参数与规则；**不复制** .prefab/.ts/.meta，不引用源 uuid/资源路径。
  - **依赖**：2.18（`pref_hero_01/02` 已建）、4.26（`HERO_SELECT_REQUESTED` → 本 UI → `shrine.onHeroSelected(0|1)`）
  - **改动文件**：`assets/resources/prefabs/ui/pref_ui_hero_select.prefab`、`assets/scripts/ui/HeroSelectUI.ts`（均新建）
  - **执行规则**：
    - 结构对齐源：子节点[0]=黑遮罩（源 alpha≈130≈51%，任务书 40%≈102，按任务书）、[1][2]=两卡片、每卡下 2 个英雄 Sprite 槽按下标显隐（当前只用 2）、卡牌底图按英雄切换、引导手指节点。
    - 脚本等价重写：BlockInputEvents、点选后淡出回调；动画参数参考 `chooseView.ts` 注释。源依赖 oops-framework（`db://oops-framework`），一律用本项目 EventManager/GameEvents 替换，禁止 import 源代码。
    - 素材默认占位并暴露 `@property`（禁止用 `default_sprite` 交差，可用新建 1×1 纯色图染色或图标留空待美术）；如需原样搬源美术（`textures/新角色/*.png`、`textures/card/1~4.png`、`道具素材/引导鼠标手.png`）须用户明确授权，并连同 .meta 拷入后重新指定。
  - **验收**：编辑器打开无 missing script/红错；触发 `HERO_SELECT_REQUESTED` 弹出两张不同英雄卡；点选后 UI 关闭并生成选中英雄；`npx tsc --noEmit` 通过；无 oops/source uuid 残留。
  - **复用提示**：卡牌动效 §6.7（§5.4 原文 §6.1 为序列帧导入，疑为笔误）
  - **slug**：`phase-5-5-4-hero-select-ui`
- **5.5 玩家血条 `pref_ui_hp_bar_player`**
  - **目标**：黑底绿条；跟随 `HpBarAnchor`；`HP_CHANGED`。
  - **依赖**：4.18、4.6
  - **改动文件**：`pref_ui_hp_bar_player.prefab`、血条跟随脚本
  - **验收**：受伤比例正确
  - **复用提示**：—
  - **slug**：`phase-5-5-5-hp-player`
- **5.6 小怪血条 `pref_ui_hp_bar_enemy`**
  - **目标**：白底红条；满血隐藏。
  - **依赖**：4.18
  - **改动文件**：`pref_ui_hp_bar_enemy.prefab`
  - **验收**：受伤显示；死亡隐藏
  - **复用提示**：挂敌人血条锚点
  - **slug**：`phase-5-5-6-hp-enemy`
- **5.7 Boss 血条 `pref_ui_hp_bar_boss`**
  - **目标**：黑底红条+白条缓冲+数值 Label。
  - **依赖**：4.18、4.14
  - **改动文件**：`pref_ui_hp_bar_boss.prefab`
  - **验收**：G2 缓冲条；扣血红条即时、白条缓动
  - **复用提示**：精细缓动 §6.5
  - **slug**：`phase-5-5-7-hp-boss`
- **5.8 游戏结束 UI `pref_ui_game_over`**
  - **目标**：遮罩+标题+Next Level 按钮。
  - **依赖**：4.34
  - **改动文件**：`pref_ui_game_over.prefab`、`GameOverUI.ts`、`UIManager.ts`
  - **验收**：G6 可弹出
  - **复用提示**：—
  - **slug**：`phase-5-5-8-game-over-ui`
- **5.9 UIManager 统一入口**
  - **目标**：各 UI prefab 显示/隐藏与阶段联动。
  - **依赖**：5.1~5.8
  - **改动文件**：`assets/scripts/ui/UIManager.ts`（新建）
  - **验收**：阶段切换时 UI 状态正确
  - **复用提示**：—
  - **slug**：`phase-5-5-9-ui-manager`

---

## 6. 动画与视觉效果

> 美术到位前允许空 clip + 程序 tween；**不改 clip 名与脚本调用**。

- **6.1 导入序列帧替换空 clip**
  - **目标**：按 `ANIM_MANIFEST` 将 `temp_frames/` 切片到 `sprite/frames/`。
  - **依赖**：2.x 各角色 prefab 已建
  - **改动文件**：`assets/resources/sprite/frames/`、`assets/resources/animations/`
  - **验收**：编辑器播 clip 有帧；脚本 `playAnim` 名不变
  - **复用提示**：player/minion/boss/hero/soldier 优先
  - **slug**：`phase-6-6-1-import-frames`
- **6.2 摇杆提示倒 8 字动画**
  - **目标**：提示手指路径平滑循环；触屏即停。
  - **依赖**：5.3、4.2
  - **改动文件**：`JoystickHintUI.ts`
  - **验收**：跑酷段可见；防守段倒 8（若需求启用）
  - **复用提示**：TweenUtil 或 Animation
  - **slug**：`phase-6-6-2-hint-figure8`
- **6.3 金币与道具抛物线**
  - **目标**：怪→金币落地；金币→玩家；道具拾取弧线。
  - **依赖**：4.20、2.10
  - **改动文件**：`TweenUtil.ts`（新建或扩）、`CoinSystem.ts`
  - **验收**：三种轨迹可区分；落点正确
  - **复用提示**：可先直线后改贝塞尔
  - **slug**：`phase-6-6-3-coin-parabola`
- **6.4 滚木蓄力与淡出**
  - **目标**：黄线减速蓄力反馈；蓝线不够长滚出淡出。
  - **依赖**：4.9
  - **改动文件**：`Log.ts`
  - **验收**：G1 视觉反馈可感知
  - **复用提示**：程序 scale/alpha tween
  - **slug**：`phase-6-6-4-log-vfx`
- **6.5 Boss 血条缓冲条缓动**
  - **目标**：红条即时、白条跟随缓动。
  - **依赖**：5.7
  - **改动文件**：Boss 血条 UI 脚本
  - **验收**：连续扣血不穿帮
  - **复用提示**：—
  - **slug**：`phase-6-6-5-boss-hp-buffer`
- **6.6 城墙/阻挡物受击闪红**
  - **目标**：受击短闪红；无血条或按设计。
  - **依赖**：2.13、2.19
  - **改动文件**：`Wall.ts`、`Barrier.ts`
  - **验收**：受击可见闪白/闪红
  - **复用提示**：Sprite color tween
  - **slug**：`phase-6-6-6-hit-flash`
- **6.7 英雄选卡动效（可选增强）**
  - **目标**：出现/选中/渐隐动画。
  - **依赖**：5.4
  - **改动文件**：`HeroSelectUI.ts`
  - **验收**：与 defense3 UI 描述一致
  - **复用提示**：—
  - **slug**：`phase-6-6-7-hero-card-vfx`
- **6.8 全流程视觉回归**
  - **目标**：手测 G1~G6 在替换美术后仍通过。
  - **依赖**：6.1~6.7、附录 A
  - **改动文件**：—
  - **验收**：附录 A 全勾
  - **复用提示**：边界：金币不足、滚木不够长
  - **slug**：`phase-6-g6-visual-verify`

---

## 附录 A. 阶段手测门禁（G0~G6）


| 门禁     | 覆盖任务                          | 检查项                                                                     |
| ------ | ----------------------------- | ----------------------------------------------------------------------- |
| **G0** | §1                            | Main 可打开；GameManager 切阶段                                                |
| **G1** | §3.2~~3.3、§4.A~~B（含 **4.4a**） | 跑酷链：摇杆左右、推滚木、**相机跟随**、刷怪、电锯、加长、黄蓝线、固定后全向移动；**固定后**仅电锯/加长道具隐藏，预置怪/黄蓝线仍可见 |
| **G2** | §3.4、§4.D、§5.1/5.7            | 拾弓→射箭→金币→Boss；血条变化                                                      |
| **G3** | §3.5、§4.E                     | 墙/塔/兵营建造；**两墙后**预置怪/黄蓝线隐藏（非整棵 ParkourContent）；滚木保留                      |
| **G4** | §3.6、§4.F、§5.4                | 英雄碑→二选一→拓展解锁                                                            |
| **G5** | §3.7、§4.H.31~32               | 阻挡物+高级塔防守                                                               |
| **G6** | §4.H.33~34、§5.8               | 大招→清怪→拉远→结束 UI；**§1~5 全流程**                                             |


验收 slug 建议：`phase-<N>-g<N>-verify`（如 `phase-1-g1-verify` 已用于跑酷段）。

### G1 清单（跑酷）

- 开局：玩家、滚木、7~8 怪、3 电锯、摇杆均可见
- 摇杆仅左右；自动向前推滚木
- 相机跟随玩家前进/左右移动（透视俯角保持）
- 远端持续刷怪
- 碰电锯：玩家受伤、滚木变短
- 拾加长道具：滚木变长
- 过黄线：减速+蓄力反馈
- 过蓝线：够长→固定+左右刷怪；不够→滚出淡出
- 固定后全方向移动；**电锯/加长道具已隐藏**；预置怪/黄蓝线仍可见；滚木在 LogAnchor

### G2~G6 清单

- **G2**：未拾弓不能攻击；拾弓射杀；怪死金币+UI；Boss 靠近；血条变化
- **G3**：墙地块出现；扣费建墙停刷；两墙后预置怪/黄蓝线隐藏；塔+兵营出兵
- **G4**：英雄碑→二选一→跟随攻击；拓展地块解锁
- **G5**：阻挡挡怪；两高级塔可建并攻击
- **G6**：高级塔完成→大招→清怪→镜头拉远→结束 UI

---

## 附录 B. 执行波次建议


| 波次     | 任务范围                                            | 产出                          |
| ------ | ----------------------------------------------- | --------------------------- |
| **W0** | §1 全勾                                           | 工程可编译、场景骨架、事件与渲染约定          |
| **W1** | **4.4a 相机跟随** + §2 缺口（2.8~2.10、2.19、2.21）+ §3.4 | 相机跟手 + 战斗道具 prefab + 战斗场景摆场 |
| **W2** | §4.A~~D（4.5~~4.21、4.14）+ §5.1/5.5~5.7           | G2 战斗循环                     |
| **W3** | §3.5、§4.E（4.22~4.25）+ §5 其余                     | G3 建造链                      |
| **W4** | §3.6~~3.7、§4.F~~H + §5.4/5.8/5.9                | G4~G6                       |
| **W5** | §6 + 附录 A 全量回归                                  | 美术与特效替换                     |


---

## 附录 C. 旧版 Phase / p2 对照


| 旧                               | 新章节                                            |
| ------------------------------- | ---------------------------------------------- |
| Phase 0 / BASE                  | §1                                             |
| Phase 1 预制体                     | §2.1~2.7                                       |
| Phase 1 场景+系统                   | §3.2~~3.3、§4.A~~B（含 4.4a 相机跟随）、§4.C.11~13、§4.G |
| Phase 2 战斗                      | §2.8~~2.10、§3.4、§4.D、§4.C.14、§5.1/5.5~~5.7     |
| Phase 3 建造                      | §2.12~2.16、§3.5、§4.E                           |
| Phase 4 英雄                      | §2.17~2.18、§3.6、§4.F、§5.4                      |
| Phase 5 拓展防守                    | §2.19~~2.20、§3.7、§4.H.31~~32                   |
| Phase 6 结束                      | §2.21、§4.H.33~34、§5.8                          |
| Phase 7 美术                      | §6                                             |
| `p2-`* / `phase-1-parkour` plan | 归档；新工作按 § 任务号 + slug                           |


---

## 附录 D. plan / build 快速命令

```
/plan-task 执行 AI_TASK_LIST 任务 4.20，slug=phase-4-4-20-coin-system
→ 打开 .cursor/plans/<slug>.md，确认 ## To-dos
→ /build-plan <slug>
→ /verify-plan <slug>
```

**跳过规则**：任务已 `[x]` 且磁盘产物存在 → 不单独开 plan；合并到下一个「接线/串联」任务，plan 内写【仅只读参考】。

---

*v4.1 | 2026-09-02 | 新增 4.4a 相机跟随玩家；4.34 复用同一相机脚本做拉远*