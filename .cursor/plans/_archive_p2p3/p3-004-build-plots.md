---
slug: p3-004-build-plots
版本: 1
状态: draft
创建: 2026-09-01
---

# P3-004 建造地块放置

## 业务目标

经 MCP 在 `BuildPlots` 下建立建造地块空节点（或挂入 `pref_build_plot` 实例），并更新 `SCENE_PLACEMENT.md`（墙/初级塔/兵营/英雄碑等类型、坐标、`setBuildType` 建议、`startHidden` 约定）。禁止手写 scene JSON。

**澄清结论**：MCP 搭建 + 文档；实际建造逻辑属 P2-005/P4-005。

## 风险等级

中。MCP 节点/实例化 prefab；依赖 P3-001 与 `pref_build_plot`；类型配置错误会导致后续建造顺序错乱。

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — MCP：`scene-create-node-by-type` 和/或 `scene-create-node-by-asset`（`pref_build_plot`）
- 【可写】`docs/SCENE_PLACEMENT.md` — 建造地块放置表
- 【可新建】`.cursor/plans/reports/p3-004-build-plots-report.md`
- 【仅只读参考】`assets/resources/prefabs/building/pref_build_plot.prefab`
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — BuildPlotType
- 【仅只读参考】`AI_TASK_LIST.md` — 建造阶段顺序（墙→塔→兵营→英雄碑→拓展）

## 实施步骤

1. S1（前置门）: MCP + Main.scene + `pref_build_plot` 存在。
2. S2: 在 `BuildPlots` 下按流程建节点（命名建议）：左右墙地块、初级塔地块、兵营地块、英雄碑地块等；可用 Empty 占位或直接实例化 prefab。
3. S3: 若实例化 prefab：`scene-create-node-by-asset`；属性 `buildType` / 显隐若可 MCP 设置则设，否则文档写明用户在 Inspector 补绑。
4. S4: `scene-save`；更新 `SCENE_PLACEMENT.md`（路径、坐标、类型、startHidden）。
5. S5: 写报告。

## 校验点

- [AC-1] `test -f assets/scenes/Main.scene`: 退出码 0
- [AC-2] `test -f assets/resources/prefabs/building/pref_build_plot.prefab`: 退出码 0
- [AC-3] `rg -n "BuildPlots|wall|towerBasic|barracks|heroShrine|pref_build_plot" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-4] Hierarchy/`scene-query` 确认 `BuildPlots` 下至少有墙侧地块相关子节点

## 回滚策略

- 删除误挂地块节点；还原文档；禁止手写 scene JSON

## 修订记录

- v1（2026-09-01）：初始计划（MCP 建造地块 + 文档）
