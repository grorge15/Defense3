# phase-0-bootstrap 执行报告

- **计划版本**：v1（首版，无修订记录改动）
- **风险等级**：高
- **计划状态**：`done`（机器 AC 全通过；AC-EDITOR / AC-PHASE-MANUAL 待用户）

## 修订记录摘要（相对 v1）

首版执行，无计划步骤/校验点增删。

## Git 基线（build 前）

- 分支含大量未提交 P2/P3 资产与脚本；`Main.scene` 为 P3 扁平结构（无 GameRoot 落盘）
- 关键可写文件：`GameEvents.ts`、`SortingOrder2D.ts`、`AnimUtil.ts`、`GamePhase.ts`、`GameManager.ts`、`Main.scene`、`docs/SCENE_PLACEMENT.md`

## 执行摘要

| 步骤 | 结果 |
|---|---|
| S1 MCP 前置门 | `assets-query-path` → `C:\Users\Admin\Defense3\assets` ✓ |
| S2 目录 | `resources/sprite/frames/` 已存在 |
| S3–S4 脚本 | 均已存在，无需补写 |
| S5–S7 场景 MCP | GameRoot/World/UI/Effect/GameManager、刷怪点、SawTrap/PreEnemy、Camera 重命名、GameManager 组件 |
| S6 reparent | **MCP `scene-update-node` 无 reparent API**；`scene-save` 后一次性 surgical patch（`_parent`/`_children` + `Node.*`/`Comp.*` _id 修复） |
| S8 文档 | `docs/SCENE_PLACEMENT.md` 已更新 Phase 0 层级与迁移表 |
| S9 启动场景 | 须用户在编辑器设为 `Main.scene` |
| S10 门禁 | 见下表 |

## 修改文件

| 文件 | 变更摘要 |
|---|---|
| `assets/scenes/Main.scene` | Phase 0 层级：GameRoot/World 迁移、刷怪点/跑酷子节点对齐、GameManager 组件、非法 `Node.*` _id 已修复 |
| `docs/SCENE_PLACEMENT.md` | Phase 0 根层级图、迁移映射表、刷怪点路径更新 |
| `.cursor/plans/phase-0-bootstrap.md` | 状态 `active` → `done` |

**脚本**：`GameEvents.ts`、`SortingOrder2D.ts`、`AnimUtil.ts`、`GamePhase.ts`、`GameManager.ts` 构建前已满足 AC，本 build 未改。

## 障碍与处置

1. **MCP reparent 不可用**：`scene-update-node` 的 `newParentPath`/`parentPath` 等参数返回 200 但不改父子关系。经 `scene-save` 后对 `Main.scene` 做最小 `_parent`/`_children` patch（报告记录，非整文件重写）。
2. **GameManager 组件**：须 `assets-reimport-asset` 后以脚本 UUID `1aa1d5e0-886b-4a4f-aaec-33ab572a65ad` 挂载。
3. **UI 子 Camera**：MCP 创建 Canvas 时自动插入子 Camera；patch 已移除，Canvas `_cameraComponent` 置 null（UI 空容器）。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-COMPILE | **通过** | `npx tsc --noEmit -p tsconfig.json` 退出码 0 |
| AC-EVENTS | **通过** | `GameEvents.ts` 含 `BUILD_COMPLETE`、`BOTH_ADVANCED_TOWERS_COMPLETE` |
| AC-GAMEPHASE | **通过** | `GamePhase.ts` 含 `RunParkour`、`GameOver` 等 |
| AC-GAMEMGR | **通过** | `GameManager.ts` 含 `setPhase`、`PHASE_CHANGED` |
| AC-HIER-1 | **通过** | MCP：`GameRoot/World/RoadRoot`、`GameRoot/World/ParkourContent`、`GameManager` 存在 |
| AC-HIER-2 | **通过** | MCP：`SpawnPoint_Far/Left/Right` 在 `GameRoot/World` 下，子刷怪点已迁入 |
| AC-HIER-3 | **通过** | MCP：`Camera` position.y = 15 |
| AC-S1 | **通过** | `Main.scene` 无 `"_id": "Node.` 匹配 |
| AC-S2 | **通过** | MCP `scene-open` 后 nodeId 均为压缩 UUID（如 `ZRu_hTcRtE1zhxlSefMwyA`），无 `Node.<数字>` |
| AC-S3 | **跳过** | AC-S1/S2 已通过，无需 library 同步 |
| AC-GATE | **通过** | AC-S1 + AC-P1（character/building 无 Canvas）+ AC-P2（pref_joystick 无 Canvas） |
| AC-EDITOR | **待用户** | 须在 Defense3 编辑器打开 `Main.scene`：无 missing script、无红错 |
| AC-PHASE-MANUAL | **待用户** | Play 或 Inspector 触发 `GameManager.setPhase`，Console 应见 `[GameManager] phase_changed: ...` |

**机器 AC 通过：11/11**（不含 AC-EDITOR、AC-PHASE-MANUAL）

## 用户待办

1. **项目设置 → 项目数据 → 启动场景** → `Main.scene`
2. **项目设置 → 功能裁剪** → 确认 2D 物理已启用
3. 编辑器打开 `Main.scene` 验收（AC-EDITOR）
4. Play 测试 `setPhase` 日志（AC-PHASE-MANUAL）
5. 若 `PhaseTransition` 等脚本有 `@property` 仍指向旧路径，按 `SCENE_PLACEMENT.md` 迁移表重绑 `GameRoot/World/...`

## 回滚

```powershell
git checkout -- assets/scenes/Main.scene docs/SCENE_PLACEMENT.md
```

脚本新建项可删除 `GameManager.ts`/`GamePhase.ts` 单独回滚。
