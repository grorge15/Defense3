---
description: 新需求入口：自动路由 @goal-agent 直行或 Plan-Build 流水线
---

新需求：{{input}}

按 `.cursor/rules/multi-agent-orchestrator.mdc` 路由：
- 小任务（≤2 文件、无破坏性改动）→ 委派 @goal-agent 直接实现，最后输出极简执行报告（修改文件、关键改动、验收达成、验证结论）。
- 中/大任务 → 委派 @plan-agent 调研并生成 `.cursor/plans/<slug>.md`（状态 draft），主会话只输出摘要（风险等级、文件数、步骤数、校验点数），并提示：可编辑计划文件后运行 `/build-plan <slug>`。
- 超大任务 → 拒绝并建议拆分为更小目标。
