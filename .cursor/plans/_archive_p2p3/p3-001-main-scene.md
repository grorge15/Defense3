---
slug: p3-001-main-scene
版本: 2
状态: done
创建: 2026-09-01
---

# P3-001 创建 Main.scene

## 业务目标

经已打开的 Defense3 工程 + `user-cocos-cli` MCP 创建并保存空骨架 `assets/scenes/Main.scene`（根节点 + 相机/灯光），并更新 `docs/SCENE_PLACEMENT.md` 标注 MCP 创建与用户验证 checklist。禁止手写/脚本生成整份 Main.scene JSON。本 plan **不覆盖** P3-002~006（刷怪点/建造地块细节等）。

## 风险等级

中。经 MCP 新建场景资产与空节点（非手写 JSON）；不删业务脚本/预制体；无接口/数据库变更。若 MCP 不可用须终止等待，禁止降级手写 scene。

## 变更文件清单

- 【可写】`docs/SCENE_PLACEMENT.md` — 标注 Main.scene 由 MCP 创建；checklist 改为「用户验证打开/无 missing」；核对已有相机表/节点模板（v1 已达成，仅核对）
- 【可新建】`assets/scenes/Main.scene`（及编辑器自动生成的 `.meta`）— **仅**经 Defense3 + Cocos MCP：`scene-create` / `scene-open` / `scene-create-node-by-type` / `scene-update-node` / `scene-set-component-property` / `scene-save`
- 【可新建】`.cursor/plans/reports/p3-001-main-scene-report.md` — build/verify 报告（引用 AC；可覆写 v1 报告）
- 【仅只读参考】`AI_TASK_LIST.md` — P3-001 边界与 §P0-A #5 相机约定
- 【仅只读参考】`.cursor/rules/defense3-workflow.mdc` — 禁止手写/大规模改写 Main.scene JSON；合法路径为编辑器/MCP
- 【仅只读参考】`docs/SCENE_PLACEMENT.md`（现有）— v1 已含相机表与根节点模板

> **禁止**：手写或用 Node/脚本生成整份 `Main.scene` JSON 落盘；CLI/MCP 不可用时不得降级手写。本 plan 不新建/装配 P3-002~006 子内容。

## 用户澄清结论（v2）

- **业务冲突修订**：取消 v1「仅文档 + 用户自建 Main.scene」；改为 **Cocos MCP 搭建空场景骨架**。
- 保留 v1 文档成果（相机表 / 节点模板 / checklist 文案基础）；checklist 语义改为验证而非从零自建。
- 仍禁止手写/脚本整份 Main.scene JSON。
- 仍不覆盖 P3-002~006。

## 实施步骤

1. S1（已完成，仅核对）: 对照 `AI_TASK_LIST.md` §P0-A #5，确认 `docs/SCENE_PLACEMENT.md` 相机参数表仍含：透视；禁止正交；俯角约 45°；position ≈ `(0, 15, 15)`；lookAt 道路中心。关联：`docs/SCENE_PLACEMENT.md`。对应 **AC-1**。
2. S2（已完成，仅核对）: 确认文档空场景根节点模板仍含 `Camera` / `DirectionalLight` / `RoadRoot` / `ParkourContent` / `PlayerSpawn` / `SpawnPoints` / `BuildPlots`；不展开道路/刷怪/地块子树（P3-002+）。关联：`docs/SCENE_PLACEMENT.md`。对应 **AC-2**。
3. S3（已完成，仅核对）: 确认文档仍有 checklist 区块；本 build 在 S9 再改语义。关联：`docs/SCENE_PLACEMENT.md`。对应 **AC-3**（文档存在性；语义在 S9 更新）。
4. S4（前置门）: 确认 Cocos Creator 已打开 **Defense3** 工程，且 `user-cocos-cli` MCP 可用（如 `scene-query-current` / `scene-create` 可响应）。不可用 → **终止**，等待用户就绪后 `/build-plan` 或 replan；**禁止**手写 Main.scene。关联：MCP `user-cocos-cli`。
5. S5: MCP `scene-create`：`options.dbURL` = `db://assets/scenes`，`baseName` = `Main`，`templateType` 建议 `3d`（透视相机场景）。成功后磁盘应出现 `assets/scenes/Main.scene`。关联：MCP；产物 `assets/scenes/Main.scene`。
6. S6: MCP `scene-open` 打开 `Main.scene`（db 路径以 create 返回的 `assetUrl` 为准，通常 `db://assets/scenes/Main.scene`）。关联：MCP。
7. S7: 用 `scene-create-node-by-type` 建空骨架（`path: "/"` 为场景根下；`workMode: "3d"` 如适用）：
   - `Camera`（`nodeType: Camera`）— 若 3d 模板已有相机则跳过创建，仅后续配置；
   - `DirectionalLight`（`nodeType: Light-Directional`）— 模板已有则跳过；
   - `RoadRoot` / `ParkourContent` / `PlayerSpawn` / `SpawnPoints` / `BuildPlots`（`nodeType: Empty`）。
   不创建刷怪点实例、不放置建造地块预制体（属 P3-002~006）。关联：MCP。
8. S8: 配置相机：透视 Projection；`position` ≈ `(0, 15, 15)`；朝向道路中心（俯角约 45°）。使用 `scene-update-node`（位置/旋转）与/或 `scene-set-component-property`（Camera 组件 projection 等）。然后 `scene-save`。关联：MCP。
9. S9: 更新 `docs/SCENE_PLACEMENT.md`：明确标注 **Main.scene 由 Defense3 + Cocos MCP 创建**；将 checklist 从「用户从零自建」改为「用户验证：编辑器可打开、无 missing script」。关联：`docs/SCENE_PLACEMENT.md`。
10. S10: 写入/覆写 `.cursor/plans/reports/p3-001-main-scene-report.md`，引用 AC-1～AC-6 达成情况。关联：报告文件。

## 校验点

- [AC-1]（保留，v1 已通过）文档含相机参数：`rg -n "0,\s*15,\s*15|position.*15|透视|正交|lookAt|俯角" docs/SCENE_PLACEMENT.md` — 预期：命中透视/禁止正交、约 `(0, 15, 15)`、俯角或 lookAt（退出码 0）
- [AC-2]（保留，v1 已通过）文档含节点模板：`rg -n "RoadRoot|ParkourContent|Camera|PlayerSpawn|BuildPlots" docs/SCENE_PLACEMENT.md` — 预期：上述名称均出现（退出码 0）
- [AC-3]（保留，v1 已通过；S9 后语义为验证）文档含 checklist：`rg -n "checklist|Main\.scene|missing script|编辑器|MCP" docs/SCENE_PLACEMENT.md` — 预期：有可勾选的验证步骤且体现 MCP/验证（退出码 0）
- [AC-4] 场景文件存在：`test -f assets/scenes/Main.scene`（Windows 可用 `Test-Path assets/scenes/Main.scene` 等价）— 预期：退出码 0 / True
- [AC-5] 场景内存在根骨架节点名：MCP `scene-open` 后 `scene-query-node`（或 `scene-query-current`）确认存在 `Camera`、`DirectionalLight`（或模板等价名）、`RoadRoot`、`ParkourContent`、`PlayerSpawn`、`SpawnPoints`、`BuildPlots` — 预期：各节点可查；也可由执行方在编辑器 Hierarchy 目视确认并记入报告
- [AC-6]（可选）用户确认：编辑器打开 `Main.scene` 无 missing script — 记入报告；非机器强制命令

## 回滚策略

- 基线：记录 build 前是否存在 `assets/scenes/Main.scene`；备份 `docs/SCENE_PLACEMENT.md`（git 或副本）。
- 失败恢复：若 MCP 半成品场景异常，可在编辑器删除 `Main.scene` 及其 `.meta` 后重新 `/build-plan`（再次仅经 MCP 创建）；还原 `SCENE_PLACEMENT.md` 至基线。**禁止**用手写 JSON 抢救场景文件。

## 修订记录

- v1（2026-09-01）：初始计划（仅文档；相机表 + 节点模板引用 + checklist；排除 P3-002~006 与 Main.scene AI 写入）
- v2（2026-09-01）：业务冲突 replan — 取消「禁止 AI 创建 / 仅用户自建」；改为 Defense3 + `user-cocos-cli` MCP（`scene-create`/`open`/`create-node-by-type`/`update-node`/`set-component-property`/`save`）搭建空骨架；保留 AC-1～3；S1～S3 标为已完成仅核对；新增 S4 前置门与 S5～S10 MCP/文档/报告步骤；AC-4 改为 `Main.scene` 文件存在；AC-5 改为骨架节点存在；AC-6 可选用户打开验证；风险调为中
