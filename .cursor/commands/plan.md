---
description: Plan 前置入口：确保 superpowers 就绪（缺失自动 add-plugin）→ 调用 brainstorming 澄清 → 委派 @plan-agent
---

目标：{{input}}

按 `.cursor/rules/superpowers-gate.mdc` 执行：
1. 检查 superpowers 插件（`.cursor/settings.json` 的 enabled 与插件安装路径）；缺失/未启用 → 执行 `/add-plugin superpowers`（或明确提示用户手动运行），就绪前不继续。
2. 读取并调用 `using-superpowers/SKILL.md` → `brainstorming`：一次一问澄清目标（目的/约束/成功标准），用户确认后继续。
3. 委派 @plan-agent 生成 `.cursor/plans/<slug>.md`（状态 draft），只输出摘要（风险等级、文件数、步骤数、校验点数），提示用户编辑计划后运行 `/build-plan <slug>`。
