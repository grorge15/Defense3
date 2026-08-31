---
slug: p2-008-barracks
版本: 1
状态: done
创建: 2026-08-31
---

# P2-008 兵营 `pref_barracks` + `Barracks.ts`

## 业务目标

实现兵营唯一主脚本 `Barracks.ts`（含解锁后立即出兵、8 个放置点各生成近战小兵、按 `GameConfig.barracksSpawnInterval` 周期重复出兵、激活/停用接口），并产出 `pref_barracks` 预制体。小兵血量与近战攻击由 `Soldier.ts`（P2-011）负责，读取 `GameConfig.soldierMaxHp`；兵营不拆分 `BarracksController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，不合并 P2-011 Soldier 实现；兵营负责放置点与出兵调度，小兵战斗逻辑在 Soldier 侧。

## 风险等级

**中** — 单 prefab + 单脚本；8 放置点调度与周期出兵；依赖 P2-011 `pref_soldier_melee`（未建时占位子节点 + 接口预埋）；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/building/Barracks.ts` — 兵营唯一主脚本
- 【可新建】`assets/resources/prefabs/building/pref_barracks.prefab` — 兵营预制体
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — 建造完成触发生成兵营（若已建）
- 【仅只读参考】`assets/scripts/building/Tower.ts` — 建筑生成/激活模式参考（P2-007）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — `barracksSpawnInterval` / `soldierMaxHp`（小兵侧）
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §soldier_melee clip 约定（小兵用）
- 【仅只读参考】`AI_TASK_LIST.md` — P2-008 / P2-011 / P2 通用 AC
- 【仅只读参考】`defense3.md` — 解锁立即出兵、8 放置点、周期出兵

## 实施步骤

### S1: 确认占位资源

复用 `default_sprite` 作为兵营 Visual 占位。本 prefab **无兵营 Animation clip**（静态建筑；小兵动画在 P2-011）。

### S2: 实现 `Barracks.ts`

路径 `assets/scripts/building/Barracks.ts`，`@ccclass('Barracks')`。

**放置点与出兵**

- `@property` 绑定 **8 个** `soldierMount` 节点（`SoldierMount_0` ~ `SoldierMount_7`）
- `@property soldierPrefab`：指向 `pref_soldier_melee`（路径与磁盘名一致）
- `spawnWave()`：在 8 个 mount 点各实例化 1 名近战小兵；对每个实例调用 `Soldier.setDeployment('barracks')` 或等价接口（P2-011 定义），使小兵进入**近战攻击**模式
- 禁止硬编码出兵间隔；周期读 `GameConfig.barracksSpawnInterval`

**激活与周期调度**

- `activate()`：兵营被 `BuildPlot` 解锁后调用
  1. **立即**执行一次 `spawnWave()`（defense3：解锁立即出兵）
  2. 启动周期调度：`schedule(spawnWave, GameConfig.barracksSpawnInterval)` 或等价 `setInterval` 封装
- `deactivate()`：停止调度，可选清理场上由本兵营生成的小兵引用
- `reset()`：供对象池复用，重置调度状态与 mount 占用

**节点引用**

- `@property visualNode` — 兵营 Visual（Sprite + Billboard + SortingOrder2D）
- 根节点可选 `Collider2D`（按场景需求）

**边界**

- 不在 Barracks 内实现近战伤害与索敌；由 Soldier 承接
- 单波最多 8 名（每 mount 1 名）；若 mount 上已有存活小兵，可跳过该点或先回收（build 阶段二选一并在报告注明）

### S3: 创建 `pref_barracks.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`），路径 `assets/resources/prefabs/building/pref_barracks.prefab`。

**节点层级**

```
pref_barracks (Root)
├── 组件: Barracks.ts
├── Visual (Sprite + Billboard + SortingOrder2D)
├── SoldierMount_0
├── SoldierMount_1
├── …
└── SoldierMount_7
```

- `Barracks.soldierMount` 数组长度 = 8，在 prefab 中全部绑定
- `soldierPrefab` 引用 `pref_soldier_melee`（P2-011 未建时可留空，build 阶段验证 mount 逻辑）
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器确认：8 个 mount 可见、脚本绑定正确；若 P2-011 已存在则手测 `activate()` 立即 8 兵 + 3 秒后再波

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-008-barracks-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Barracks" assets/scripts/building/Barracks.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/building/pref_barracks.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/building/pref_barracks.prefab`: 有匹配
- [AC-7] `rg "spawnWave|activate|deactivate|reset" assets/scripts/building/Barracks.ts`: 四项均有匹配
- [AC-8] `rg "soldierMount|soldierPrefab" assets/scripts/building/Barracks.ts`: 有匹配
- [AC-9] `rg "GameConfig\.barracksSpawnInterval" assets/scripts/building/Barracks.ts`: 有匹配
- [AC-10] `test ! -f assets/scripts/building/BarracksController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `Barracks.ts`、`pref_barracks.prefab` 及对应 `.meta`；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-005 `BuildPlot` | 计划/实现中；解锁后 `activate()` 兵营 |
| P2-011 `Soldier.ts` + `pref_soldier_melee` | 未建；`spawnWave()` 依赖 |
| G3 手测 | 建墙→塔→兵营；解锁立即 8 兵 + 周期出兵 |
