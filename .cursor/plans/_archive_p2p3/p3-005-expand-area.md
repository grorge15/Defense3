---
slug: p3-005-expand-area
版本: 1
状态: draft
创建: 2026-09-01
---

# P3-005 拓展区

## 业务目标

经 MCP 在场景中布置拓展区相关空节点/占位（拓展建造地块、高级箭塔地块、`pref_barrier_wall` / `pref_barrier_long` 挂点），并更新 `SCENE_PLACEMENT.md`。与阶段四「拓展解锁后出现阻挡墙与高级塔」对齐。禁止手写 scene JSON。

**澄清结论**：MCP 搭建 + 文档；默认 `startHidden`，由 P4 拓展流程 reveal。

## 风险等级

中。依赖 P3-001/004 与 barrier/tower prefab；布局影响 G4 手测。

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — MCP 建拓展区节点 / 可选挂 prefab
- 【可写】`docs/SCENE_PLACEMENT.md` — 拓展区放置表
- 【可新建】`.cursor/plans/reports/p3-005-expand-area-report.md`
- 【仅只读参考】`assets/resources/prefabs/building/pref_barrier_wall.prefab`、`pref_barrier_long.prefab`、`pref_tower_advanced.prefab`、`pref_build_plot.prefab`
- 【仅只读参考】`AI_TASK_LIST.md` — P3-005；defense3 第四阶段
- 【仅只读参考】`.cursor/plans/p2-013-traps-projectiles.md` — Barrier 与 pref_wall 边界

## 实施步骤

1. S1（前置门）: MCP + Main.scene；相关 prefab 尽量已存在。
2. S2: 建 `ExpandArea`（或挂在 `BuildPlots`/`RoadRoot` 下约定节点）及子节点：拓展地块、高级塔地块×2、BarrierWall×2、BarrierLong×1 挂点。
3. S3: 可选 `scene-create-node-by-asset` 挂 barrier/地块；默认 inactive/`startHidden`。
4. S4: `scene-save`；文档写清 reveal 时机（拓展地块解锁后）。
5. S5: 写报告。

## 校验点

- [AC-1] `test -f assets/scenes/Main.scene`: 退出码 0
- [AC-2] `rg -n "Expand|expand|barrier|高级|pref_barrier|towerAdvanced" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-3] 场景存在拓展相关空节点或挂点（MCP/Hierarchy 确认）
- [AC-4] 文档注明与 `pref_wall` 区别：barrier 带血条受击（引用 P2-006/013）

## 回滚策略

- 删除拓展区节点；还原文档；禁止手写 scene JSON

## 修订记录

- v1（2026-09-01）：初始计划（MCP 拓展区 + 文档）
