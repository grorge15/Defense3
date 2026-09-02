---
slug: p2-007-tower
版本: 1
状态: done
创建: 2026-08-31
---

# P2-007 箭塔 `pref_tower_basic` / `pref_tower_advanced` + `Tower.ts`

## 业务目标

实现箭塔唯一主脚本 `Tower.ts`（含初级/高级塔类型、塔顶 3 个远程小兵挂载与生成、激活与攻击协调接口），并产出 `pref_tower_basic`、`pref_tower_advanced` 两个预制体。小兵血量与攻击行为由 `Soldier.ts`（P2-011）负责，读取 `GameConfig.soldierMaxHp`；箭塔本身不拆分 `TowerController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，不合并 P2-011 Soldier 实现；Tower 负责挂载点与生成协调，小兵战斗逻辑在 Soldier 侧。

## 风险等级

**中** — 双 prefab + 单脚本；依赖 P2-011 `pref_soldier_ranged` 与 `Soldier.ts`（若尚未 build，Tower 需用占位子节点 + 接口预埋，待 P2-011 后联调）；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/building/Tower.ts` — 箭塔唯一主脚本
- 【可新建】`assets/resources/prefabs/building/pref_tower_basic.prefab` — 初级箭塔
- 【可新建】`assets/resources/prefabs/building/pref_tower_advanced.prefab` — 高级箭塔
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — 建造完成生成箭塔（若已建）
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts` — 小兵索敌目标类型参考
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — soldierMaxHp（小兵侧读取）
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §soldier_ranged clip 约定（小兵用）
- 【仅只读参考】`AI_TASK_LIST.md` — P2-007 / P2-011 / P2 通用 AC
- 【仅只读参考】`defense3.md` — 塔顶 3 小兵远程攻击、可被 Boss 秒杀

## 实施步骤

### S1: 确认占位资源

复用 `default_sprite` 作为塔身 Visual 占位。本 prefab **无塔身 Animation clip**（塔为静态建筑；小兵动画在 P2-011）。

### S2: 实现 `Tower.ts`

路径 `assets/scripts/building/Tower.ts`，`@ccclass('Tower')`。

**塔类型**

- 定义 `TowerType`：`'basic' | 'advanced'`
- `setTowerType(type: TowerType)`：区分初级/高级（视觉 scale 或 `@property` 配置差异；数值差异可后续扩展，本任务不硬编码）

**挂载点与小兵生成**

- `@property` 绑定 3 个 `soldierMount` 节点（塔顶左/中/右或等距分布）
- `@property soldierPrefab`：指向 `pref_soldier_ranged`（`resources` 路径与磁盘名一致）
- `spawnSoldiers()`：在 3 个 mount 点实例化远程小兵；对每个实例调用 `Soldier.setDeployment('tower')` 或等价接口（P2-011 定义），使小兵进入**远程攻击**模式
- `clearSoldiers()` / `reset()`：销毁或回收塔顶小兵，供重建或对象池

**激活与攻击协调**

- `activate()`：塔建成后调用；执行 `spawnSoldiers()` 并启用小兵索敌/攻击（由 Soldier 驱动，Tower 仅协调生命周期）
- `deactivate()`：禁用塔顶小兵
- 不在 Tower 内实现弹道与伤害计算；远程攻击、投射物由 Soldier + P2-013 `pref_projectile_arrow` 承接

**节点引用**

- `@property visualNode` — 塔身 Visual（Sprite + Billboard + SortingOrder2D）
- 根节点可选 `Collider2D`（非必须，按场景阻挡需求）

### S3: 创建 `pref_tower_basic` 与 `pref_tower_advanced`

通过 Cocos CLI 分别创建两个 prefab，路径：
- `assets/resources/prefabs/building/pref_tower_basic.prefab`
- `assets/resources/prefabs/building/pref_tower_advanced.prefab`

**节点层级（两 prefab 结构相同，高级塔 Visual scale 可更大）**

```
pref_tower_* (Root)
├── 组件: Tower.ts
├── Visual (Sprite + Billboard + SortingOrder2D)
├── SoldierMount_0
├── SoldierMount_1
└── SoldierMount_2
```

- `Tower.ts` 的 `soldierMount` 数组与 `setTowerType` 在 prefab 中预配置（basic / advanced 各一份）
- `soldierPrefab` 引用 `pref_soldier_ranged`（P2-011 未建时 prefab 字段留空，build 阶段用占位节点验证挂载逻辑）
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器确认：3 个 mount 点可见、Tower 脚本绑定正确；若 P2-011 已存在则手测 spawn 3 小兵

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-007-tower-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Tower" assets/scripts/building/Tower.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/building/pref_tower_basic.prefab && test -f assets/resources/prefabs/building/pref_tower_advanced.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/building/pref_tower_basic.prefab`: 有匹配
- [AC-7] `rg "setTowerType|spawnSoldiers|activate|TowerType" assets/scripts/building/Tower.ts`: 四项均有匹配
- [AC-8] `rg "soldierMount|soldierPrefab" assets/scripts/building/Tower.ts`: 有匹配
- [AC-9] `test ! -f assets/scripts/building/TowerController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `Tower.ts`、两个 prefab 及对应 `.meta`；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-005 `BuildPlot` | 计划/实现中；`onBuildComplete` 生成箭塔 |
| P2-011 `Soldier.ts` + `pref_soldier_ranged` | 未建；Tower `spawnSoldiers()` 依赖 |
| P2-013 `pref_projectile_arrow` | 未建；小兵远程弹道 |
| G3 手测 | 建墙→塔→兵营；塔顶 3 小兵远程攻击 |
