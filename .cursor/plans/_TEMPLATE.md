---
slug: <task-slug>
版本: 1
状态: draft
创建: <YYYY-MM-DD>
---

# <任务名>

## 业务目标
1–3 句话精简目标总结。

## OpenSpec 引用（有玩家可感知行为时必填；纯 MCP 装配整节删除）
- Change：`openspec/changes/<slug>/`
- 勿在此复述 WHEN/THEN；行为以该目录 `specs/**` 为准。
- 无行为语义（仅挂点/prefab/坐标）→ **删除本节**，且不要创建 OpenSpec change。

## 风险等级
低 / 中 / 高。

## 禁做项（必填）
- 本次不要新建/改动的 prefab 或步骤。

## 变更文件清单
- 【可写】`<path>` — 说明
- 【可新建】`<path>` — 说明
- 【仅只读参考】`<path>` — 说明

## To-dos（必填）
- [ ] `<任务号.a>`：…
- [ ] `<任务号.b>`：…

> 同主题 MCP 合并本 plan；纯脚本 ≤2 文件走 goal-agent。

## 实施步骤（可选）
1. S1: …
2. S2: 须 MCP 绑 vs `_resolveRefs`；prefab 用 `create-prefab-from-node`

## 校验点
- [AC-1] …
### MCP（改过 prefab/scene 时，任务末一次）
- [AC-GATE] `verify-mcp-gate.ps1` exit 0
- [AC-P3] 本任务 prefab `invalid: false`
- [AC-EDITOR-MCP] open + error 日志空
### 条件 / 不阻塞
- [AC-P3b] / [AC-S2] 按需
- [AC-PLAY] 对照 OpenSpec scenarios（若有）— 不阻塞 done

## 回滚策略
- 基线 / 失败恢复

## 修订记录
- v1（<YYYY-MM-DD>）：初始

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| verify-mcp-gate | |
| post-scene-save Patched | 0/1 |
| assets-reimport-asset | |
| 本任务新建 prefab 数 | |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | path / none |
