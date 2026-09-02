---
slug: p3-003-spawn-points
版本: 1
状态: done
创建: 2026-09-01
---

# P3-003 刷怪点

## 业务目标

经 MCP 在 `Main.scene` 的 `SpawnPoints`（及跑酷预置怪挂点）下建立刷怪空节点，写入 `SCENE_PLACEMENT.md`（节点名、坐标建议、关联 `pref_enemy_minion` / boss 等）。左右侧楼梯生成点需可被墙建完后停刷（侧别由场景节点名/父级表达，非 Wall.ts）。禁止手写 scene JSON。

**澄清结论**：MCP 搭建 + 文档；不合并 P3-004~006。

## 风险等级

中。MCP 场景节点；依赖 P3-001/002；刷怪逻辑属 P4，本任务只放空节点与文档。

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — 仅 MCP 建 Empty 刷怪点节点
- 【可写】`docs/SCENE_PLACEMENT.md` — 刷怪点表（名/坐标/关联 prefab/侧别）
- 【可新建】`.cursor/plans/reports/p3-003-spawn-points-report.md`
- 【仅只读参考】`AI_TASK_LIST.md` — P3-003；defense3 左右侧刷怪
- 【仅只读参考】`assets/resources/prefabs/enemy/pref_enemy_minion.prefab` — 关联路径参考
- 【仅只读参考】`.cursor/plans/p3-002-road-layers.md`

## 实施步骤

1. S1（前置门）: MCP + `Main.scene` + 建议已有 `SpawnPoints` / `ParkourContent/PreSpawnEnemies`。
2. S2: 在 `SpawnPoints` 下建侧别空节点（如 `SpawnLeft` / `SpawnRight` / `SpawnFar`）及若干 `SpawnPoint_*` Empty；在 `PreSpawnEnemies` 下预留跑酷预置怪挂点（空节点即可，实例化可后续）。
3. S3: 为关键点设建议世界坐标（沿道路前进轴分布），`scene-update-node` + `scene-save`。
4. S4: 更新 `SCENE_PLACEMENT.md` 刷怪点表：节点路径、坐标、关联 prefab、与封墙停刷的侧别映射说明（供 P4）。
5. S5: 写报告。

## 校验点

- [AC-1] `test -f assets/scenes/Main.scene`: 退出码 0
- [AC-2] 场景存在刷怪相关空节点（MCP query 或 Hierarchy）：至少含左右侧生成点命名
- [AC-3] `rg -n "SpawnPoints|SpawnLeft|SpawnRight|pref_enemy" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-4] 文档含坐标建议列或等价表：`rg -n "坐标|position|SpawnPoint" docs/SCENE_PLACEMENT.md`: 有匹配

## 回滚策略

- 删除 MCP 新建的刷怪子节点；还原文档；禁止手写 scene JSON

## 修订记录

- v1（2026-09-01）：初始计划（MCP 刷怪空节点 + 文档）
