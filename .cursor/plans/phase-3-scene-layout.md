---
slug: phase-3-scene-layout
版本: 1
状态: done
创建: 2026-09-01
---

# §3.4–3.7 场景布局（战斗引导 + 建造 + 英雄拓展 + 防守拓展）

## 业务目标

按 `AI_TASK_LIST.md` **3.4 / 3.5 / 3.6 / 3.7**，经 **Defense3 + Cocos MCP** 在 `Main.scene` 完成塔防段场景摆场：弓与 Boss 出生点、建造地块 prefab 实例、英雄碑/拓展地块、阻挡物与高级塔地块；更新 `docs/SCENE_PLACEMENT.md`。

**范围约定（与 §3 章节一致）**：
- **仅场景布局**：MCP 实例化 prefab、建空挂点、设坐标与**初始 `active=false`**（待 §4.E `BuildSystem` 解锁显隐）。
- **不写** `BuildSystem`、扣费建造链、Boss 刷怪逻辑、拓展解锁逻辑（属 §4.D / §4.E / §4.F / §4.H）。
- **禁止** `onLoad` instantiate 静态布局；**允许** MCP `scene-create-node-by-asset` 批量拖入。

**前置依赖（磁盘已具备）**：`pref_item_bow`（2.8）、`pref_enemy_boss`（2.11）、`pref_build_plot`（2.12–2.15）、`pref_hero_shrine`（2.17）、`pref_barrier_wall` / `pref_barrier_long`（2.19）、`pref_tower_advanced`（2.20）、`BuildPlot.ts`。

## 风险等级

**中** — 批量改 `Main.scene`（多 prefab 实例 + 命名对齐）；须 AC-S* 与 `SceneSetup`/`PhaseTransition` 引用不被破坏；`BuildPlots` 下现有空节点可能需重命名或替换为 prefab 实例。

## 现状差距

| 任务 | 现状 | 本 plan |
|---|---|---|
| **3.4** | 无 `pref_item_bow` 实例、无 `BossSpawn_First` | MCP 摆弓 + 建 Boss 出生空节点 |
| **3.5** | `BuildPlots` 下仅 **空节点**（`Plot_Wall_*` 等），无 `pref_build_plot` | MCP 实例化 build_plot；设 `buildType`；初始 hidden |
| **3.6** | 有 `Plot_HeroShrine` 空节点；**无 `Plot_Expand`** | 实例化英雄碑地块 + 新建拓展地块 |
| **3.7** | 无 Barrier / ExpandSideWalls / 高级塔地块挂点 | 建挂点并实例化 barrier prefab；高级塔 build_plot |

**命名对齐（建议）**：

| 现有空节点 | 目标（AI_TASK_LIST） | 动作 |
|---|---|---|
| `Plot_Wall_L/R` | 墙地块 | 实例化 `pref_build_plot`，`buildType=wall` |
| `Plot_Tower_1`、`Plot_Tower_2` | `Plot_TowerBasic_L/R` | MCP 重命名或保留原名并在文档映射 |
| `Plot_Tower_3` | 高级塔之一或冗余 | 重命名为 `Plot_TowerAdvanced_L` 或保留作 Advanced 单点 |
| — | `Plot_TowerAdvanced_R` | 新建（若仅 `Plot_Tower_3` 不够） |
| `Plot_Barracks` | 兵营 | 实例化，`buildType=barracks` |
| `Plot_HeroShrine` | 英雄碑 | 实例化，`buildType=heroShrine` |
| — | `Plot_Expand` | 新建，`buildType=expandArea` |

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — MCP 摆场（禁止手写整份 JSON）
- 【可写】`docs/SCENE_PLACEMENT.md` — §3.4–3.7 放置表、命名映射、`startHidden` 约定
- 【仅只读参考】`assets/resources/prefabs/item/pref_item_bow.prefab`
- 【仅只读参考】`assets/resources/prefabs/enemy/pref_enemy_boss.prefab`
- 【仅只读参考】`assets/resources/prefabs/building/pref_build_plot.prefab`
- 【仅只读参考】`assets/resources/prefabs/building/pref_hero_shrine.prefab`（地块生成目标 prefab 由 BuildPlot 配置，非直接摆 shrine）
- 【仅只读参考】`assets/resources/prefabs/building/pref_barrier_wall.prefab`、`pref_barrier_long.prefab`
- 【仅只读参考】`assets/resources/prefabs/building/pref_tower_advanced.prefab`
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — `BuildPlotType`、费用键
- 【仅只读参考】`AI_TASK_LIST.md` §3.4–3.7

## To-dos

### 3.4 战斗引导摆场

- [ ] **3.4.a**：MCP 在跑酷末/塔防入口（建议 `GameRoot/World` 道边，坐标写入文档）实例化 `pref_item_bow` ×1
- [ ] **3.4.b**：MCP 新建 `GameRoot/World/BossSpawn_First` 空节点（屏外远端坐标，供 §4 刷 Boss）

### 3.5 建造地块

- [ ] **3.5.a**：`Plot_Wall_L/R` 下 MCP 实例化 `pref_build_plot`；MCP/补丁设 `buildType=wall`；`active=false`（滚木固定后由 BuildSystem 显示）
- [ ] **3.5.b**：`Plot_Tower_1/2`（或重命名为 `Plot_TowerBasic_L/R`）实例化 `pref_build_plot`，`buildType=towerBasic`，`active=false`
- [ ] **3.5.c**：`Plot_Barracks` 实例化 `pref_build_plot`，`buildType=barracks`，`active=false`（两墙完成后显示，文档约定）

### 3.6 英雄碑与拓展

- [ ] **3.6.a**：`Plot_HeroShrine` 实例化 `pref_build_plot`，`buildType=heroShrine`，`active=false`
- [ ] **3.6.b**：MCP 新建 `Plot_Expand` 于 `BuildPlots`；实例化 `pref_build_plot`，`buildType=expandArea`，`active=false`

### 3.7 拓展防守区

- [ ] **3.7.a**：MCP 新建 `BarrierWall_L`、`BarrierWall_R`（`World` 或拓展子根下）；各实例化 `pref_barrier_wall`，`active=false`
- [ ] **3.7.b**：MCP 新建 `BarrierLong_Center`；实例化 `pref_barrier_long`，`active=false`
- [ ] **3.7.c**：MCP 新建 `ExpandSideWalls` 空节点（占位矮墙扩展区，Sprite 可选占位）
- [ ] **3.7.d**：`Plot_TowerAdvanced_L/R`（由 `Plot_Tower_3` 改名 + 新建或两新建点）实例化 `pref_build_plot`，`buildType=towerAdvanced`，`active=false`

### 文档与门禁

- [ ] **3.x.doc**：更新 `SCENE_PLACEMENT.md` §3.4–3.7（路径、坐标、prefab、`buildType`、初始显隐、解锁时机引用 §4）
- [ ] **3.x.gate**：`scene-save` → AC-S* / AC-GATE → 编辑器无红错

## 实施步骤

1. **S1 前置门**：MCP `assets-query-path`；`scene-open` Main.scene；记录 `BuildPlots` 子节点 UUID（回滚用）。

2. **S2（3.4）**：实例化 `pref_item_bow`；创建 `BossSpawn_First`；坐标落盘文档。

3. **S3（3.5）**：对墙/初级塔/兵营挂点 `scene-create-node-by-asset` `pref_build_plot`；设 `buildType`（MCP `scene-set-property` 或允许的最小补丁）；根节点 `active=false`。

4. **S4（3.6）**：英雄碑 + `Plot_Expand` 同上。

5. **S5（3.7）**：创建 Barrier 挂点并实例化 `pref_barrier_*`；`ExpandSideWalls` 空节点；高级塔 build_plot 两点。

6. **S6**：核对未破坏 `SceneSetup` / `PhaseTransition` / 跑酷段引用；`scene-save`。

7. **S7**：更新 `SCENE_PLACEMENT.md`；跑 `verify-mcp-gate.ps1`；编辑器验收。

8. **S8（禁止）**：不实现 `BuildSystem`、不挂 `EnemySpawner` 到 `BossSpawn_First`、不改 `BuildPlot` 扣费逻辑。

## 校验点

### 3.4

- [AC-3.4-BOW] MCP/场景：`pref_item_bow` 实例存在于 `World` 子树
- [AC-3.4-BOSS] MCP 查询：`BossSpawn_First` 节点存在

### 3.5

- [AC-3.5-WALL] `Plot_Wall_L` 与 `Plot_Wall_R` 下各有 `pref_build_plot` 实例（或实例即挂点根）
- [AC-3.5-TOWER] 至少 2 个 `towerBasic` build_plot 实例
- [AC-3.5-BARRACKS] `Plot_Barracks` 有 build_plot 实例

### 3.6

- [AC-3.6-SHRINE] `Plot_HeroShrine` 有 build_plot，`buildType` 可 query 为 heroShrine
- [AC-3.6-EXPAND] `Plot_Expand` 存在且有 build_plot

### 3.7

- [AC-3.7-BARRIER] `pref_barrier_wall` ×2、`pref_barrier_long` ×1 已实例化（初始可 inactive）
- [AC-3.7-EXPAND-WALLS] `ExpandSideWalls` 节点存在
- [AC-3.7-ADV] 2 个 `towerAdvanced` build_plot 挂点存在

### MCP 门禁

- [AC-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — 0
- [AC-S2] MCP scene-open 后 nodeId 非 `Node.<数字>`
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 0
- [AC-DOC] `rg "3\\.4|3\\.5|Plot_Expand|BossSpawn_First|BarrierWall" docs/SCENE_PLACEMENT.md` — ≥4
- [AC-EDITOR] 编辑器打开 `Main.scene` — 无 missing / 红错
- [AC-SCOPE] 未新增/修改 `BuildSystem.ts`（文件不存在或 git diff 无该路径）

## 回滚策略

- **基线**：S1 导出 `BuildPlots` 子树列表；`git stash` Main.scene。
- **失败**：`git checkout -- assets/scenes/Main.scene`；MCP reimport；删除误建节点。

## 修订记录

- v1（2026-09-01）：初始计划；覆盖 3.4–3.7；仅 MCP 场景摆场 + 文档；解锁逻辑留给 §4；假定 2.8/2.19 prefab 已交付。
