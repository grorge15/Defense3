---
slug: <task-slug>
版本: 1
状态: draft
创建: <YYYY-MM-DD>
---

# <任务名>

## 业务目标
1–3 句话精简目标总结。

## 风险等级
低 / 中 / 高（说明是否涉及删除文件、数据库变更、接口破坏性改动）。

## 变更文件清单
- 【可写】`<path>` — 说明
- 【可新建】`<path>` — 说明
- 【仅只读参考】`<path>` — 说明

## To-dos（必填，按任务级编号）
- [ ] `<任务号.a>`：操作说明，关联文件（例：`1.4.a` 新建 `SawTrap.ts`）
- [ ] `<任务号.b>`：操作说明，关联文件（例：`1.4.b` MCP 创建 `pref_trap_saw`）

> 规则：每个 todo 必须映射 `AI_TASK_LIST.md` 的「任务 X.Y」，命名建议 `X.Y.a / X.Y.b / X.Y.c`。一个 plan 建议只覆盖 1~3 个任务，避免整 Phase 打包。

## 实施步骤（可选）
1. S1: 汇总执行链路（可引用 To-dos：`1.4.a -> 1.4.b -> 1.4.c`）
2. S2: 补充注意事项（并发限制、MCP 串行纪律等）

> 若步骤含新建 `.prefab` 或改 `Main.scene`：必须写「Defense3 工程 + Cocos CLI/MCP」；禁止「手写整份 prefab JSON / CLI 不可用则手写」。须含拆除嵌套 Canvas/Camera（若 CLI 插入）；须含 **MCP 交付门禁**（见 `defense3-workflow.mdc`）与必选 AC「编辑器打开无 missing / 无红错」。

## 校验点（必填，逐条对应 To-dos）
- [AC-1] <命令>: <预期退出码 / 输出匹配>
- [AC-2] <命令>: <预期退出码 / 输出匹配>

### MCP 资源任务必填（复制自 defense3-workflow.mdc，按需删减）
- [AC-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — 0 匹配（改 scene 时）
- [AC-S2] MCP `scene-open` 后 nodeId 均非 `Node.<数字>`（改 scene 时）
- [AC-P1] 角色/建筑 prefab 无 `"_name": "Canvas"`（新建 character/building prefab 时）
- [AC-P2] UI：`verify-mcp-gate.ps1` AC-P2-*（无 Canvas/Camera/1×1 UITransform）
- [AC-P3] MCP `assets-query-asset-info` — `invalid: false`（改 prefab 时）
- [AC-P3b] MCP `scene-query-component` — 关键 `@property` 非 Missing（改 prefab 时）
- [AC-P-FAKE] `verify-mcp-gate.ps1` — 无 `default_sprite` / `__editorExtras__` 作弊
- [AC-EDITOR] 编辑器打开资源无 missing script / 无红错 — **必选，禁止 optional**

## 回滚策略
- 基线：<git commit / 文件清单记录方式>
- 失败恢复：<如何还原>

## 修订记录
- v1（<YYYY-MM-DD>）：初始计划
- v2（<YYYY-MM-DD>）：<改/增/删了哪些步骤与校验点>
