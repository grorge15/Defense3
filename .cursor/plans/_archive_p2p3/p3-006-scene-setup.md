---
slug: p3-006-scene-setup
版本: 1
状态: draft
创建: 2026-09-01
---

# P3-006 `SceneSetup.ts`

## 业务目标

实现 `assets/scripts/game/SceneSetup.ts`：在 `onLoad` 缓存场景关键节点引用；**仅**负责动态对象实例化入口（敌人、金币等），静态布局以 MCP/编辑器场景为准。可选经 MCP 将脚本挂到 Main.scene 根或指定节点。更新 `SCENE_PLACEMENT.md` 说明绑定方式。

**澄清结论**：以脚本为主；MCP 仅做组件挂载/核对，不替代静态摆放。

## 风险等级

中。新增运行时引导脚本；`find`/`getChildByName` 必须限制在 `onLoad`；依赖 P3-001~005 节点命名稳定。

## 变更文件清单

- 【可新建】`assets/scripts/game/SceneSetup.ts` — 场景引导脚本
- 【可写】`assets/scenes/Main.scene` — **仅** MCP `scene-add-component` / 属性绑定（可选）
- 【可写】`docs/SCENE_PLACEMENT.md` — SceneSetup 职责与节点引用表
- 【可新建】`.cursor/plans/reports/p3-006-scene-setup-report.md`
- 【仅只读参考】`AI_TASK_LIST.md` — P3-006 AC
- 【仅只读参考】`.cursor/rules/defense3-workflow.mdc`
- 【仅只读参考】`assets/scripts/core/EventManager.ts` / `GameEvents.ts`

## 实施步骤

1. S1: 实现 `SceneSetup.ts`：`@property` 或 `onLoad` 内 `getChildByName`/`find` 缓存 `RoadRoot`、`ParkourContent`、`PlayerSpawn`、`SpawnPoints`、`BuildPlots`、`LogAnchor` 等。
2. S2: 提供动态生成 API 占位（如 `spawnEnemy`/`spawnCoin`）供 P4 调用；**禁止**在 update 里反复 find。
3. S3（可选 MCP）: 打开 Main.scene，`scene-add-component` 挂 SceneSetup，绑定引用后 `scene-save`。
4. S4: 更新 `SCENE_PLACEMENT.md`：脚本路径、须绑定字段、动态 vs 静态边界。
5. S5: 写报告。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class SceneSetup" assets/scripts/game/SceneSetup.ts`: 有匹配
- [AC-3] `rg "find\(|getChildByName" assets/scripts/game/SceneSetup.ts` — 仅出现在 `onLoad`（或构造/缓存函数被 onLoad 唯一调用）；报告中说明检查方式
- [AC-4] `rg -n "SceneSetup|动态|静态" docs/SCENE_PLACEMENT.md`: 有匹配
- [AC-5] `test ! -f assets/scripts/game/SceneSetupController.ts`: 退出码 0

## 回滚策略

- 删除 SceneSetup.ts 及 .meta；还原场景组件挂载与文档

## 修订记录

- v1（2026-09-01）：初始计划（SceneSetup 脚本 + 可选 MCP 挂载 + 文档）
