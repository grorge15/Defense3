---
description: 修订计划 + 同步 OpenSpec delta：只改失败步
---

计划：`.cursor/plans/{{input}}.md`

1. 读执行报告 `.cursor/plans/reports/{{input}}-report.md`，归类失败项。
2. 若计划引用 OpenSpec 或存在 `openspec/changes/{{input}}/`：先读 specs/proposal，**只改**失败相关 delta（ADDED/MODIFIED/REMOVED），勿整份重写。
3. 委派 @plan-agent：计划版本 +1、draft、保留已达成 AC/合格产物、只改失败步与 AC；修订记录写明禁做项与 OpenSpec 变更（若有）。
4. 主会话输出修订摘要 → 确认后 `/build-plan {{input}}`（续跑）。
