---
description: 新需求入口：路由 Goal 或 Plan-Build；有行为语义则走 OpenSpec + plan
---

新需求：{{input}}

按 `.cursor/rules/multi-agent-orchestrator.mdc` 路由：
- **强制小任务** / 小任务 → `@goal-agent`（纯脚本勿为凑 AC 开 plan）。
- 中任务 → 有玩家可感知行为则先 OpenSpec（`defense3-lite`），再 `@plan-agent` 出 `.cursor/plans/<slug>.md`；纯 MCP 装配可只出 plan。主会话只输出摘要 → `/build-plan <slug>`。
- 超大任务 → 拒绝并拆分。
- Superpowers 不阻塞（见 `superpowers-gate.mdc`）。
