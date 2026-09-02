---
slug: p3-002-road-layers
版本: 1
状态: done
创建: 2026-09-01
---

# P3-002 道路分层

## 业务目标

在已有 `Main.scene` 空骨架上，经 Defense3 + Cocos MCP 补齐 `RoadRoot` / `ParkourContent` 子树空节点，并更新 `docs/SCENE_PLACEMENT.md`（节点名、职责、阶段显隐）。滚木挂 `LogAnchor`（不在 `ParkourContent` 下）。禁止手写 scene JSON。

**澄清结论**：与 P3-001 v2 一致 — MCP 搭建 + 文档；不合并 P3-003~006。

## 风险等级

中。MCP 改场景节点；依赖 P3-001 `Main.scene` 已存在；禁止 MCP 不可用时手写降级。

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — **仅**经 MCP：`scene-open` / `scene-create-node-by-type` / `scene-update-node` / `scene-save`
- 【可写】`docs/SCENE_PLACEMENT.md` — 道路分层与 Parkour 子节点说明、坐标建议
- 【可新建】`.cursor/plans/reports/p3-002-road-layers-report.md`
- 【仅只读参考】`AI_TASK_LIST.md` — P3-002；阶段切换规则
- 【仅只读参考】`.cursor/rules/defense3-workflow.mdc` — LOG_FIXED / BOTH_WALLS_COMPLETE；禁止手写 scene
- 【仅只读参考】`.cursor/plans/p3-001-main-scene.md` — 前置空骨架

## 实施步骤

1. S1（前置门）: Defense3 已开 + MCP 可用；`test -f assets/scenes/Main.scene`；否则终止。
2. S2: `scene-open` → 确认存在 `RoadRoot`、`ParkourContent`。
3. S3: 在 `RoadRoot` 下创建 Empty：`Road` / `SideWalls` / `Stairs` / `LogAnchor`（坐标建议写入文档，可给 LogAnchor 初值）。
4. S4: 在 `ParkourContent` 下创建 Empty：`SawTraps` / `PreSpawnEnemies` / `YellowLine` / `BlueLine`。
5. S5: `scene-save`。
6. S6: 更新 `SCENE_PLACEMENT.md`：子树职责、显隐规则、禁止滚木挂 ParkourContent。
7. S7: 写执行报告。

## 校验点

- [AC-1] `test -f assets/scenes/Main.scene`: 退出码 0
- [AC-2] MCP/编辑器确认节点存在：`RoadRoot/Road|SideWalls|Stairs|LogAnchor` 与 `ParkourContent/SawTraps|PreSpawnEnemies|YellowLine|BlueLine`
- [AC-3] `rg -n "LogAnchor|SawTraps|YellowLine|BlueLine|ParkourContent" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-4] `rg -n "勿放 ParkourContent|LogAnchor" docs/SCENE_PLACEMENT.md`: 有匹配（滚木挂点约定）

## 回滚策略

- 基线：build 前备份 Main.scene 与 SCENE_PLACEMENT.md
- 失败：MCP 删除误建子节点后重跑；禁止手写 JSON 抢救

## 修订记录

- v1（2026-09-01）：初始计划（MCP 道路分层 + 文档；依赖 P3-001）
