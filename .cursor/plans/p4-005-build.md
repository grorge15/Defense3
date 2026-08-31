---
slug: p4-005-build
版本: 2
状态: draft
创建: 2026-08-31
---

# P4-005 BuildSystem — 建造解锁链编排

## 业务目标

实现 `BuildSystem.ts` + `BuildPlotUnlock.ts`（与 `BuildPlot.ts` 同节点双组件，参考 SFK `shopping` + `shopEvent` 模式），通过**编辑器拖拽引用**配置 `nextUnlocks[]` / `unlockGroup[]`（AND 门）解锁链，串联 P2-005 建造地块与 P2-006~009 / P2-013d 建筑预制体。`BuildSystem` 负责向所有 `BuildPlot` 注入金币 getter、监听 `COIN_CHANGED`、按 `BuildPlotType` 派发建造完成副作用（生成建筑、显隐场景节点、广播事件）；解锁前置纯逻辑抽离为 `BuildUnlockLogic.ts` 并附单元测试。

**澄清结论（用户确认）**：解锁链**不走 GameConfig 数据驱动**，全部通过场景内编辑器引用（`nextUnlocks` / `unlockGroup` / `hideNodes` / `showNodes` / `spawnPrefab`）配置，与 SFK `shopping.prefab` + `shopEvent` 模式一致。

**defense3.md 解锁顺序（场景接线目标，非硬编码）**：

1. 滚木固定（`LOG_FIXED`）→ 左右 2 个墙地块 → 封楼梯 → 对应侧停刷怪（`STAIRS_SEALED` → P4-006）；**不**隐藏 `ParkourContent`
2. 两侧墙均完成 → emit `BOTH_WALLS_COMPLETE`（P4-013 `PhaseTransition` 藏跑酷物件、滚木保留）→ 同时 reveal 2 初级塔 + 1 兵营地块
3. 兵营区域后 → 英雄碑地块 → `HeroSelectUI` 钩子（P5-002 stub）
4. 英雄碑后 → 拓展区域地块
5. 拓展完成 → 显示 P2-013d 阻挡墙 + 长条阻挡、隐藏矮墙、扩侧区、揭示 2 高级塔地块
6. 两座高级塔均完成 → 广播 `ADVANCED_TOWERS_COMPLETE`（P4-011 接线，本任务仅发事件）

**范围外**：金币飞行动画（P5）、完整 `HeroSelectUI`、`EnemySpawner` 实现、终极技 — 仅事件/回调预埋。

## 风险等级

**中** — 跨多模块编排（BuildPlot / 建筑 prefab / 事件总线 / 场景接线文档）；P4-004 `CoinSystem` 未建需 stub；P2-006~009 / P2-013d 部分 prefab 可能未落盘，BuildSystem 须 `resources.load` 容错或占位跳过；不删除既有文件、不拆分 `BuildPlotController.ts`、不改写 `Main.scene` JSON。

## 变更文件清单

- 【可新建】`assets/scripts/building/BuildPlotUnlock.ts` — 解锁链伴侣组件（同节点挂 `BuildPlot`）
- 【可新建】`assets/scripts/building/BuildSystem.ts` — 全局建造编排（扣费注入、完成派发、事件广播）
- 【可新建】`assets/scripts/building/BuildUnlockLogic.ts` — 纯逻辑 AND 门/解锁评估（无 `cc` 依赖）
- 【可新建】`tests/build-unlock-logic.test.ts` — `unlockGroup` AND 门单元测试
- 【可写】`assets/scripts/core/GameEvents.ts` — 新增建造相关事件常量
- 【可写】`docs/SCENE_PLACEMENT.md` — 新增 `BuildPlots` 解锁链接线章节
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — P2-005 已完成；`onBuildComplete` / `setAvailableCoins` 接线
- 【仅只读参考】`assets/scripts/building/Wall.ts` — P2-006 `pref_wall` 生成目标
- 【仅只读参考】`assets/scripts/building/Tower.ts` — P2-007 `pref_tower_basic` / `pref_tower_advanced`
- 【仅只读参考】`assets/scripts/building/Barracks.ts` — P2-008 `pref_barracks` + `activate()`
- 【仅只读参考】`assets/scripts/building/Barrier.ts` — P2-013d `pref_barrier_wall` / `pref_barrier_long`
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — 建造费用（BuildPlot 已读，本任务禁止硬编码费用）
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — 事件派发
- 【仅只读参考】`assets/resources/prefabs/building/pref_build_plot.prefab` — 建造地块预制体
- 【仅只读参考】`AI_TASK_LIST.md` — P4-005；G3 gate（P4-005 + P2-005~009）
- 【仅只读参考】`defense3.md` — 解锁流程权威描述；§纯逻辑抽模块 + 单元测试

## 实施步骤

### S1: 解锁条件 — `BuildUnlockLogic` + `BuildPlotUnlock`

**S1a — 纯逻辑模块** `assets/scripts/building/BuildUnlockLogic.ts`

- 导出无引擎依赖函数，供组件与单元测试共用：
  - `isGroupSatisfied(completedIds: ReadonlySet<string>, groupMemberIds: readonly string[]): boolean` — AND 门：组内全部 id 均在 `completedIds` 才返回 true
  - `filterRevealable(nextIds: readonly string[], completedIds: ReadonlySet<string>, pendingGroups: ReadonlyMap<string, readonly string[]>): string[]` — 给定候选 next，过滤掉其 `unlockGroup` 未满足的项
- 每个 `BuildPlotUnlock` 实例在 `onLoad` 生成稳定 `_unlockId`（优先 `@property unlockId` 编辑器填写，否则 `node.uuid`）

**S1b — 伴侣组件** `assets/scripts/building/BuildPlotUnlock.ts`

- `@ccclass('BuildPlotUnlock')`，与 `BuildPlot` **同节点**挂载（禁止新建 `BuildPlotController.ts`）
- **编辑器引用**：
  - `buildPlot: BuildPlot` — 同节点或子节点 `BuildPlot` 引用
  - `nextUnlocks: BuildPlotUnlock[]` — 本垫完成且组门满足后 `revealPad()` 的目标
  - `unlockGroup: BuildPlotUnlock[]` — AND 门成员（全部完成后才允许 reveal `nextUnlocks`）
  - `startHidden = true` — 初始 `hidePad()`
  - `stairsSide: 'left' | 'right' | ''` — 仅 `wall` 类型地块用于 `STAIRS_SEALED` 侧别（编辑器配置，非 Wall 脚本职责）
- **完成副作用引用**（编辑器拖拽）：
  - `spawnPrefab: Prefab | null`
  - `spawnParent: Node | null`
  - `hideNodes: Node[]`
  - `showNodes: Node[]`
- **API**：
  - `hidePad()` — `node.active = false`（或 `scale = 0`，与 prefab 统一选一种）
  - `revealPad()` — 反向；仅当 AND 门满足时由链逻辑调用
  - `onComplete()` — 标记本垫完成 → 执行 `hideNodes`/`showNodes` → 评估 `nextUnlocks` → 对满足条件的项 `revealPad()`
  - `isComplete(): boolean`
- `onLoad`：若 `startHidden` 则 `hidePad()`；向 `buildPlot.onBuildComplete` 注册回调 → 转调 `BuildSystem` 统一入口（避免 Unlock 直接 instantiate）

### S2: 扣费 — `BuildSystem` 金币注入

**S2a — Coin 接口与 stub**

- 定义 `ICoinWallet` 只读接口：`getBalance(): number`（P4-004 `CoinSystem` 实现；未建时 `BuildSystem` 内置 `_StubCoinWallet`，默认余额 `Number.POSITIVE_INFINITY` 便于 G3 手测，可通过 `@property debugInfiniteCoins` 关闭）
- `BuildSystem` 在 `onLoad` 遍历注册的 `BuildPlotUnlock`，对每个 `buildPlot` 调用 `setAvailableCoins(() => this._wallet.getBalance())`
- 监听 `GameEvents.COIN_CHANGED`：BuildPlot 已 emit 负 spend；BuildSystem **不重复扣费**，仅刷新各 plot 可用余额（若 P4-004 未接管，stub 在收到负 spend 时递减内部余额）

**S2b — 注册表**

- `@property buildUnlocks: BuildPlotUnlock[]` — 场景根或 `BuildPlots` 下全部解锁垫（编辑器拖入）
- 或 `onLoad` 从 `BuildPlots` 子树 `getComponentsInChildren(BuildPlotUnlock)` 自动收集（二选一，计划推荐显式数组 + 文档说明）

### S3: 生成建筑 — 按 `BuildPlotType` 派发

`BuildSystem._onPlotComplete(unlock: BuildPlotUnlock, type: BuildPlotType)`：

| type | 行为 |
|---|---|
| `wall` | `instantiate(pref_wall)` 于 `spawnParent` 或地块世界坐标；`emit STAIRS_SEALED(stairsSide)` |
| `towerBasic` | `instantiate(pref_tower_basic)` → `Tower.setTowerType('basic')` → `activate()` |
| `towerAdvanced` | `instantiate(pref_tower_advanced)` → `setTowerType('advanced')` → `activate()` |
| `barracks` | `instantiate(pref_barracks)` → `Barracks.activate()` |
| `heroShrine` | 若 `spawnPrefab` 已配则生成碑实体；`emit HERO_SHRINE_BUILT` + 调用 `onHeroShrineBuilt` 回调 stub（P5-002） |
| `expandArea` | 执行 unlock 上 `showNodes`/`hideNodes`；激活 `showNodes` 内 Barrier（`active=true`）；`revealPad` 链到的高级塔垫；`emit EXPAND_AREA_COMPLETE` |

- 预制体路径（`resources.load`）与磁盘一致：`prefabs/building/pref_wall` 等；prefab 未存在时 `console.warn` 跳过实例化，不阻断解锁链
- 通用：`unlock.spawnPrefab` 非空时优先于类型默认 prefab；`spawnParent` 缺省用地块父节点
- 完成后调用 `unlock.onComplete()` 推进链

### S4: 事件广播

**S4a — 扩展 `GameEvents.ts`**

新增常量（命名稳定，供 P4-006 / P5-002 / P4-011 订阅）：

- `BUILD_COMPLETED` — payload: `{ type: BuildPlotType, unlockId: string, stairsSide?: string }`
- `STAIRS_SEALED` — payload: `{ side: 'left' | 'right' }`
- `BOTH_WALLS_COMPLETE` — 左右墙垫均完成时 emit（已在 `GameEvents`；P4-013 订阅）
- `HERO_SHRINE_BUILT` — payload: `{ unlockId: string }`（P5-002 stub）
- `EXPAND_AREA_COMPLETE` — payload: `{}`
- `ADVANCED_TOWERS_COMPLETE` — 当 `unlockGroup` 内两座高级塔垫均完成时 emit（P4-011 stub）

**S4b — `BuildSystem` 派发时机**

- 每次 `_onPlotComplete` 末尾 `emit BUILD_COMPLETED`
- 墙完成额外 `emit STAIRS_SEALED`（`stairsSide` 非空时）
- 检测左右墙 AND 组全部完成 → `emit BOTH_WALLS_COMPLETE`（只发一次）→ P4-013 隐藏 `ParkourContent`、保留滚木
- 检测高级塔 AND 组（由场景 `unlockGroup` 配置）全部完成 → `emit ADVANCED_TOWERS_COMPLETE`

### S5: 场景放置文档 — `docs/SCENE_PLACEMENT.md`

新增 **「建造解锁链（P4-005）」** 章节，用户编辑器任务：

- 在 `Main/BuildPlots` 下实例化多个 `pref_build_plot`，每垫同节点挂 `BuildPlotUnlock`
- 配置各垫 `BuildPlot.setBuildType`（编辑器或 Unlock 上 `@property buildType` 同步）
- 按 defense3 顺序接线表（示例）：

| 垫实例名（建议） | buildType | startHidden | nextUnlocks | unlockGroup | stairsSide | showNodes（拓展阶段） |
|---|---|---|---|---|---|---|
| `Plot_Wall_L` | wall | false | `[Plot_Tower_L, Plot_Barracks]`* | — | left | — |
| `Plot_Wall_R` | wall | false | `[Plot_Tower_R, Plot_Barracks]`* | — | right | — |
| `Plot_Tower_L/R` | towerBasic | true | — | `[Plot_Wall_L, Plot_Wall_R]` 的 next 由组门控制** | — | — |
| `Plot_Barracks` | barracks | true | `[Plot_HeroShrine]` | 两墙 AND | — | — |
| `Plot_HeroShrine` | heroShrine | true | `[Plot_Expand]` | — | — | — |
| `Plot_Expand` | expandArea | true | `[Plot_TowerAdv_L, Plot_TowerAdv_R]` | — | — | Barrier 节点组 |
| `Plot_TowerAdv_L/R` | towerAdvanced | true | — | 彼此 AND → `ADVANCED_TOWERS_COMPLETE` | — | — |

\* 实际以 `unlockGroup` AND 门表达「两墙均完成才 reveal 塔+兵营」；文档给出 Mermaid 简图与 checklist。

- `BuildSystem` 组件挂 `Main` 或 `BuildPlots`，`buildUnlocks` 拖入全部 `BuildPlotUnlock`
- **禁止 AI 改写 `Main.scene` JSON**

### S6: 单元测试与编译

- `tests/build-unlock-logic.test.ts`：覆盖 `isGroupSatisfied` — 空组、单成员、多成员全完成、缺一员失败；`filterRevealable` — 组未满足时不 reveal
- 测试运行：`npx tsx tests/build-unlock-logic.test.ts`（或 `node --import tsx --test tests/build-unlock-logic.test.ts`）；退出码 0
- 报告写入 `.cursor/plans/reports/p4-005-build-report.md`（build 阶段）

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class BuildSystem" assets/scripts/building/BuildSystem.ts`: 有匹配
- [AC-3] `rg "class BuildPlotUnlock" assets/scripts/building/BuildPlotUnlock.ts`: 有匹配
- [AC-4] `rg "nextUnlocks|unlockGroup|revealPad|hidePad" assets/scripts/building/BuildPlotUnlock.ts`: 四项均有匹配
- [AC-5] `rg "spawnPrefab|spawnParent|hideNodes|showNodes" assets/scripts/building/BuildPlotUnlock.ts`: 四项均有匹配
- [AC-6] `rg "BUILD_COMPLETED|STAIRS_SEALED|BOTH_WALLS_COMPLETE|EXPAND_AREA_COMPLETE|ADVANCED_TOWERS_COMPLETE" assets/scripts/core/GameEvents.ts`: 五项均有匹配
- [AC-6b] `rg "BOTH_WALLS_COMPLETE" assets/scripts/building/BuildSystem.ts`: 有匹配
- [AC-7] `rg "setAvailableCoins|COIN_CHANGED" assets/scripts/building/BuildSystem.ts`: 两项均有匹配
- [AC-8] `rg "pref_wall|pref_tower_basic|pref_tower_advanced|pref_barracks" assets/scripts/building/BuildSystem.ts`: 有匹配
- [AC-9] `rg "isGroupSatisfied|filterRevealable" assets/scripts/building/BuildUnlockLogic.ts`: 两项均有匹配
- [AC-10] `npx tsx tests/build-unlock-logic.test.ts`: 退出码 0
- [AC-11] `rg "BuildPlots|BuildPlotUnlock|解锁链" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-12] `test ! -f assets/scripts/building/BuildPlotController.ts`: 退出码 0
- [AC-13] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/building/BuildSystem.ts assets/scripts/building/BuildPlotUnlock.ts && exit 1 || true`: 退出码 0
- [AC-14] `rg "GameConfig\.(wallBuildCost|towerBasicBuildCost)" assets/scripts/building/BuildSystem.ts && exit 1 || true`: 退出码 0（费用由 BuildPlot 读，BuildSystem 不硬编码）

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `BuildPlotUnlock.ts`、`BuildSystem.ts`、`BuildUnlockLogic.ts`、`tests/build-unlock-logic.test.ts` 及对应 `.meta`；`git checkout` 恢复 `GameEvents.ts`、`docs/SCENE_PLACEMENT.md`；移除场景中手动挂接的 `BuildSystem` / `BuildPlotUnlock` 组件

## 依赖与后续

| 依赖 | 状态 | 本任务处理 |
|---|---|---|
| P2-005 `BuildPlot.ts` + `pref_build_plot` | ✅ done | 只读接线 `onBuildComplete` / `setAvailableCoins` |
| P2-006 `pref_wall` | draft/未建 | `resources.load` 容错 |
| P2-007 塔 prefab | 部分 done | 同上 |
| P2-008 `pref_barracks` | 部分 done | 调用 `activate()` |
| P2-009 英雄碑 | 未建 | `spawnPrefab` 编辑器可选 |
| P2-013d Barrier prefab | draft | `expandArea` 的 `showNodes` 激活 |
| P4-004 CoinSystem | 未建 | `_StubCoinWallet` + `COIN_CHANGED` 预埋 |
| P4-006 EnemySpawner | 未建 | 订阅 `STAIRS_SEALED`（接口文档化，不实现） |
| P5-002 HeroSelectUI | 未建 | `HERO_SHRINE_BUILT` + 回调 stub |
| P4-011 UltimateSystem | 未建 | `ADVANCED_TOWERS_COMPLETE` 仅 emit |
| G3 建造段手测 | P4-005 + P2-005~009 后 | 用户按 SCENE_PLACEMENT 接线后手测 |

## 修订记录

- v1（2026-08-31）：初始计划
- v2（2026-08-31）：两墙建完 emit `BOTH_WALLS_COMPLETE`（藏跑酷、滚木保留）；滚木固定不藏 `ParkourContent`；AC-6/6b 对齐
