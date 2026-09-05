---
description: Plan 入口：可选澄清 → 有行为语义则 OpenSpec → 委派 @plan-agent（superpowers 不阻塞）
---

目标：{{input}}

1. **Superpowers**：插件可用且目标歧义时，可选 `brainstorming`；插件缺失/目标已清晰 → **不阻塞**，直接继续（见 `superpowers-gate.mdc`）。
2. **行为 vs 装配**：若目标含玩家可感知行为（阶段、战斗、建造链、UI 反馈等）→ 先按 `openspec.mdc` 用 `defense3-lite` 写/更新 `openspec/changes/<slug>/`（proposal + specs）；纯 MCP 挂点/prefab 装配 → **跳过** OpenSpec。
3. 委派 @plan-agent 生成 `.cursor/plans/<slug>.md`（状态 draft）：文件清单、MCP todos、AC、禁做项；有 OpenSpec 时只 **引用** change 路径，**不复述** WHEN/THEN。
4. 主会话只输出摘要，提示编辑后 `/build-plan <slug>`。
