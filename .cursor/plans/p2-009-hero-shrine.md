---
slug: p2-009-hero-shrine
版本: 1
状态: active
创建: 2026-08-31
---

# P2-009 英雄召唤碑 `pref_hero_shrine` + `HeroShrine.ts`

## 业务目标

实现英雄召唤碑唯一主脚本 `HeroShrine.ts`（含解锁后请求英雄二选一 UI、选择结果回调、在道路生成英雄接口），并产出 `pref_hero_shrine` 预制体。UI 展示由 P5-002 `pref_ui_hero_select` 负责，英雄实体由 P2-010 `pref_hero_01` / `pref_hero_02` 负责；召唤碑不拆分 `HeroShrineController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，不合并 P5-002 UI 与 P2-010 Hero 实现；召唤碑负责触发选择与生成协调。

## 风险等级

**中** — 单 prefab + 单脚本；跨 UI/英雄 prefab 依赖需事件或回调预埋；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/building/HeroShrine.ts` — 英雄召唤碑唯一主脚本
- 【可新建】`assets/resources/prefabs/building/pref_hero_shrine.prefab` — 召唤碑预制体
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — 建造完成触发生成召唤碑（若已建）
- 【仅只读参考】`assets/scripts/building/Barracks.ts` — `activate()` 模式参考（P2-008）
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — 事件派发（可选 `HERO_SELECT_REQUESTED` 等）
- 【仅只读参考】`assets/scripts/core/GameEvents.ts` — 扩展或复用事件名约定
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — `heroShrineBuildCost`（BuildPlot 侧）
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite
- 【仅只读参考】`AI_TASK_LIST.md` — P2-009 / P5-002 / P2-010
- 【仅只读参考】`defense3.md` — 解锁弹 UI、选择后生成英雄

## 实施步骤

### S1: 确认占位资源

复用 `default_sprite` 作为召唤碑 Visual 占位。本 prefab **无 Animation clip**（静态建筑）。

### S2: 实现 `HeroShrine.ts`

路径 `assets/scripts/building/HeroShrine.ts`，`@ccclass('HeroShrine')`。

**节点引用**

- `@property visualNode` — Visual（Sprite + Billboard + SortingOrder2D）
- `@property heroSpawnPoint` — 英雄生成位置（道路旁空节点）
- `@property heroPrefab01` / `heroPrefab02` — 分别指向 `pref_hero_01`、`pref_hero_02`（P2-010 未建时可留空）

**激活与 UI 请求**

- `activate()`：`BuildPlot` 解锁召唤碑后调用（仅执行一次）
- `_requestHeroSelect()`：派发事件（如扩展 `GameEvents.HERO_SELECT_REQUESTED`）或调用 `onHeroSelectRequested` 回调，参数含本 `HeroShrine` 引用，供 P5-002 UI 弹出二选一界面
- `_isActivated` / `_hasSelected` 防止重复弹窗与重复生成

**选择结果与生成英雄**

- `onHeroSelected(heroIndex: 0 | 1)`：由 P5-002 UI 在用户确认后调用
  - `0` → 实例化 `pref_hero_01` 于 `heroSpawnPoint`
  - `1` → 实例化 `pref_hero_02`
- 生成后可选：隐藏/销毁召唤碑节点（defense3：选择完后在道路生成英雄）
- `onHeroSpawned: ((heroNode: Node) => void) | null` 回调供 P4 跟随玩家等系统接入

**边界**

- 不在 HeroShrine 内实现 UI 布局与英雄战斗逻辑
- 英雄跟随玩家由 P2-010 `Hero.ts` 实现

### S3: 创建 `pref_hero_shrine.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`），路径 `assets/resources/prefabs/building/pref_hero_shrine.prefab`。

**节点层级**

```
pref_hero_shrine (Root)
├── 组件: HeroShrine.ts
├── Visual (Sprite + Billboard + SortingOrder2D)
└── HeroSpawnPoint (空节点，道路生成位置)
```

- `HeroShrine` 各 `@property` 在 prefab 中绑定
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器确认：无 missing script、`HeroSpawnPoint` 已配置

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-009-hero-shrine-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class HeroShrine" assets/scripts/building/HeroShrine.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/building/pref_hero_shrine.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/building/pref_hero_shrine.prefab`: 有匹配
- [AC-7] `rg "activate|onHeroSelected|heroSpawnPoint|heroPrefab" assets/scripts/building/HeroShrine.ts`: 四项均有匹配
- [AC-8] `rg "onHeroSelectRequested|HERO_SELECT|_requestHeroSelect" assets/scripts/building/HeroShrine.ts`: 有匹配（UI 请求接口）
- [AC-9] `test ! -f assets/scripts/building/HeroShrineController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `HeroShrine.ts`、`pref_hero_shrine.prefab` 及对应 `.meta`；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-005 `BuildPlot` | 计划/实现中；解锁后 `activate()` |
| P5-002 `pref_ui_hero_select` | 未建；监听请求并调用 `onHeroSelected()` |
| P2-010 `pref_hero_01` / `pref_hero_02` | 未建；生成目标 prefab |
| P4-009 英雄系统 | 未建；跟随玩家等 |
