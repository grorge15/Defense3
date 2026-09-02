# phase-3-scene-layout 执行报告

| 项 | 值 |
|---|---|
| slug | phase-3-scene-layout |
| 计划版本 | **1**（首版，无修订记录改动） |
| 计划状态（本报告后） | **done** |
| 风险等级 | 中 |
| 执行日 | 2026-09-01 |

## 修订记录摘要

- v1 首版：覆盖 §3.4–3.7 MCP 场景摆场 + `SCENE_PLACEMENT.md`；无相对上一版步骤/AC 增删。

## To-dos 完成矩阵

| todo | 状态 |
|---|---|
| 3.4.a pref_item_bow | **完成** |
| 3.4.b BossSpawn_First | **完成** |
| 3.5.a Plot_Wall_L/R build_plot wall | **完成** |
| 3.5.b Plot_Tower_1/2 towerBasic | **完成** |
| 3.5.c Plot_Barracks barracks | **完成** |
| 3.6.a Plot_HeroShrine heroShrine | **完成** |
| 3.6.b Plot_Expand expandArea | **完成** |
| 3.7.a BarrierWall_L/R pref_barrier_wall | **完成** |
| 3.7.b BarrierLong_Center pref_barrier_long | **完成** |
| 3.7.c ExpandSideWalls 空节点 | **完成** |
| 3.7.d Plot_TowerAdvanced_L/R towerAdvanced | **完成**（`Plot_Tower_3` 已改名 L；新建 R） |
| 3.x.doc SCENE_PLACEMENT | **完成** |
| 3.x.gate AC-S* / 编辑器 | **完成**（见下表） |

## 修改文件列表

| 文件 | 变更摘要 |
|---|---|
| `assets/scenes/Main.scene` | MCP 实例化弓/9×build_plot/3×barrier；新建 BossSpawn/Plot_Expand/Barrier 挂点/ExpandSideWalls/Plot_TowerAdvanced_R；`Plot_Tower_3`→`Plot_TowerAdvanced_L`；build_plot/barrier 初始 inactive；**最小补丁**：46 处 `Node.*` `_id` 替换；7 处 `_buildType` propertyOverride |
| `docs/SCENE_PLACEMENT.md` | 新增 §3.4–3.7 放置表、命名映射、startHidden / 解锁时机 |
| `.cursor/plans/phase-3-scene-layout.md` | 状态 → done |

**未改动**：`BuildSystem.ts`（不存在）；`BuildPlot.ts`（只读）。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-3.4-BOW | **通过** | MCP `scene-open` nestedPrefab：`GameRoot/World/Canvas/pref_item_bow_001` |
| AC-3.4-BOSS | **通过** | MCP `scene-query-node`：`GameRoot/World/BossSpawn_First` nodeId `44/e+JEay0irZmnWmSc7vg` |
| AC-3.5-WALL | **通过** | `Plot_Wall_L/R/Canvas/pref_build_plot` 存在于 nestedPrefabInstanceRoots |
| AC-3.5-TOWER | **通过** | `Plot_Tower_1/2` 各 1 个 build_plot；scene 中 `towerBasic` override ×2 |
| AC-3.5-BARRACKS | **通过** | `Plot_Barracks/Canvas/pref_build_plot`；override `barracks` |
| AC-3.6-SHRINE | **通过** | `Plot_HeroShrine/Canvas/pref_build_plot`；MCP prefab propertyOverrides 含 `_buildType`→`heroShrine` |
| AC-3.6-EXPAND | **通过** | `Plot_Expand` + build_plot；override `expandArea` |
| AC-3.7-BARRIER | **通过** | `pref_barrier_wall` ×2、`pref_barrier_long` ×1（inactive） |
| AC-3.7-EXPAND-WALLS | **通过** | `ExpandSideWalls` 节点存在 |
| AC-3.7-ADV | **通过** | `Plot_TowerAdvanced_L/R` + build_plot；override `towerAdvanced` ×2 |
| AC-S1 | **通过** | `verify-mcp-gate.ps1` PASS（patch 后 0 处 `Node.*` `_id`） |
| AC-S2 | **通过** | `scene-open` 新节点 nodeId 均为合法压缩 UUID（如 `z4ecGP6APk2FerUSBOubTQ`） |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` 退出码 0 |
| AC-DOC | **通过** | `SCENE_PLACEMENT.md` 含 §3.4/3.5、`Plot_Expand`、`BossSpawn_First`、`BarrierWall`（≥4） |
| AC-EDITOR | **通过** | `scene-open` Main 后 `system-query-logs` error 空；无 missing 报告 |
| AC-SCOPE | **通过** | `BuildSystem.ts` 不存在；git 无该路径 diff |

## 风险与已知副作用

- **中**：MCP `scene-create-node-by-asset` 对 build_plot / barrier / bow 插入了 **`Canvas` 包装层**（`…/Canvas/pref_*`）。属 CLI 已知副作用；实例功能不受影响，后续可选编辑器拆包装。
- **低**：`Plot_Tower_1/2` 保留原名（文档已映射 `Plot_TowerBasic_L/R`）。
- **低**：弓位于 `World/Canvas/` 而非 `World` 直接子节点；仍在 World 子树且坐标已设。

## 失败项与障碍

无阻塞项。
