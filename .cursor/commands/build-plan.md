---
description: 执行指定计划：单次连续委派 @build-agent；可续跑；产出含 MCP 指标的报告
---

计划：`.cursor/plans/{{input}}.md`

1. 确认文件存在；状态为 `draft` / `active` / `verifying`（`done` 则先说明已完成，除非用户明确要求复验）。
2. 读取「修订记录」、已有 `.cursor/plans/reports/{{input}}-report.md`（若有）与计划 To-dos 勾选状态。
3. **防碎片**：只委派 **一个** `@build-agent`。若报告/计划显示部分 todo 已完成 → **续跑**未完成项，禁止从全场景 Survey 重开。同一次命令内不得串行启动多个 build-agent。
4. build-agent：变更文件清单 → 步骤 → 校验点；`scene-save` 后若改过 Main.scene，先 `scene-close`（若仍开着）再跑 `powershell -File .cursor/scripts/post-scene-save.ps1`，按输出做 MCP reimport（若 Patched=1）→ 任务末机器 AC。
5. 报告写入 `.cursor/plans/reports/{{input}}-report.md`（须含 **MCP 指标** 节，见 `_TEMPLATE.md`）。主会话只输出报告摘要与失败项。
