---
slug: p2-005-build-plot
版本: 1
状态: done
创建: 2026-08-31
---

# P2-005 通用建造地块 `pref_build_plot` + `BuildPlot.ts`

## 业务目标

实现通用建造地块唯一主脚本 `BuildPlot.ts`（含 Trigger 进入扣费、绿色 vertical 填充进度、购买完成回调/销毁，以及 `setBuildType()` 配置墙/塔/兵营/英雄碑/拓展区等不同建筑类型），并产出 `pref_build_plot` 预制体。费用读 `GameConfig` 对应建造字段，禁止拆分 `BuildPlotController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，金币飞跃动画、Coin UI 同步与实际建筑实例化（P4-005、P2-006~009）不在本任务内，仅暴露 `onBuildComplete` 回调。

## 风险等级

**中** — 涉及 UI 型 prefab 多子节点装配与 Trigger 扣费进度逻辑；无动画 clip；金币全局经济系统（P4-005）尚未建立，需通过事件/回调预留接口；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/building/BuildPlot.ts` — 建造地块唯一主脚本
- 【可新建】`assets/resources/prefabs/building/pref_build_plot.prefab` — 通用建造地块预制体
- 【仅只读参考】`assets/scripts/character/Player.ts` — Trigger 进入判定（检测 Player 组件）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — wallBuildCost / towerBasicBuildCost / towerAdvancedBuildCost / barracksBuildCost / heroShrineBuildCost / expandAreaBuildCost
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `COIN_CHANGED` 派发
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位图（背景/图标/预览/绿条）
- 【仅只读参考】`AI_TASK_LIST.md` — P2-005 / P2 通用 AC
- 【仅只读参考】`defense3.md` — 建造地块 UI 结构与扣费流程

## 实施步骤

### S1: 确认占位资源

复用 `assets/resources/sprite/default_sprite.png` 作为背景、金币图标、建筑预览、绿条填充条的占位 Sprite。绿条节点使用 `Sprite.Type = FILLED`、`FillType = VERTICAL`，`fillRange` 由脚本驱动（0→1）。

### S2: 实现 `BuildPlot.ts`

路径 `assets/scripts/building/BuildPlot.ts`，`@ccclass('BuildPlot')`。

**节点引用（`@property`）**

- `backgroundSprite` — 背景
- `coinIcon` — 金币图标节点
- `costLabel` — 费用 Label（显示需求数量）
- `previewIcon` — 所建建筑预览图标
- `fillBar` — 绿色 vertical 填充 Sprite

**建造类型**

- 定义 `BuildPlotType`：`wall` | `towerBasic` | `towerAdvanced` | `barracks` | `heroShrine` | `expandArea`
- `setBuildType(type: BuildPlotType)`：切换类型并刷新 `costLabel` 与预览图
- `getBuildCost()`：按类型读 `GameConfig` 对应字段，禁止硬编码费用

**Trigger 与进度**

- 根节点挂 `Collider2D`（`isTrigger = true`）
- `onTriggerEnter` / `onTriggerExit`：检测对方节点含 `Player` 组件时标记玩家在区域内
- 玩家在区域内且未完成：按帧/按 tick 尝试扣费（扣费速率可 `@property fillSpeedPerSecond` 配置，**费用总量读 GameConfig**）
- 每成功扣除金币：累加 `_paidAmount`，更新 `fillBar.fillRange = _paidAmount / totalCost`
- 通过 `EventManager.instance.emitEvent(GameEvents.COIN_CHANGED, ...)` 通知金币变化（P4/P5 再接全局钱包与 UI）

**完成与销毁**

- `_paidAmount >= totalCost` 时调用 `_completeBuild()`
- `onBuildComplete: ((type: BuildPlotType) => void) | null` 回调，供 P4/P2-006+ 生成实际建筑
- 完成后 `node.destroy()` 或 `node.active = false`（与 defense3「购买完成后消失」一致）

**金币来源接口（P4 预埋）**

- `setAvailableCoins(getter: () => number)` 或监听 `COIN_CHANGED` 同步可用金币
- 扣费前检查余额，不足则暂停填充、不推进进度

### S3: 创建 `pref_build_plot.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`），路径 `assets/resources/prefabs/building/pref_build_plot.prefab`。

**节点层级**

```
pref_build_plot (Root)
├── 组件: BuildPlot.ts + BoxCollider2D (isTrigger=true)
├── Background (Sprite → default_sprite)
├── CoinIcon (Sprite → default_sprite)
├── CostLabel (Label)
├── PreviewIcon (Sprite → default_sprite)
└── FillBar (Sprite → default_sprite, FILLED, VERTICAL, 绿色 tint)
```

- `BuildPlot.ts` 各 `@property` 在 prefab 中绑定对应子节点
- 本 prefab **无 Animation clip**（与角色 prefab 不同）
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器确认：无 missing script、Trigger 已启用、FillBar 为 vertical filled

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-005-build-plot-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class BuildPlot" assets/scripts/building/BuildPlot.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/building/pref_build_plot.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/building/pref_build_plot.prefab`: 有匹配
- [AC-7] `rg "setBuildType|getBuildCost|onBuildComplete|BuildPlotType" assets/scripts/building/BuildPlot.ts`: 四项均有匹配
- [AC-8] `rg "GameConfig\.(wallBuildCost|towerBasicBuildCost|towerAdvancedBuildCost|barracksBuildCost|heroShrineBuildCost|expandAreaBuildCost)" assets/scripts/building/BuildPlot.ts`: 有匹配
- [AC-9] `rg "COIN_CHANGED|onTriggerEnter|fillRange" assets/scripts/building/BuildPlot.ts`: 三项均有匹配
- [AC-10] `test ! -f assets/scripts/building/BuildPlotController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `BuildPlot.ts`、`pref_build_plot.prefab` 及对应 `.meta`；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P1-002~004 基础设施 | ✅ 已存在 |
| P2-001 `Player.ts` | ✅ 已存在（Trigger 检测） |
| `default_sprite` | ✅ P2-001 已建 |
| P4-005 金币经济 | 未建；本任务派发 `COIN_CHANGED` + `setAvailableCoins` 预埋 |
| P2-006~009 实际建筑 | 未建；本任务 `onBuildComplete` 回调生成 |
| P5 Coin UI | 未建；监听 `COIN_CHANGED` |
| G3 手测 | 需 P4-005 + P2-005~009 完成后联调建造流程 |
