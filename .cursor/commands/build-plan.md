---
description: 执行指定计划：委派 @build-agent 严格按计划文件落地并产出执行报告
---

计划：`.cursor/plans/{{input}}.md`

先确认该文件存在且头部状态为 draft 或 active。先读取计划「修订记录」，然后委派 @build-agent 按计划执行：变更文件清单 → 编号步骤 → 校验点逐条完成，执行报告写入 `.cursor/plans/reports/{{input}}-report.md`（校验点引用 AC 编号），并在报告中说明本版相对上一版的改动（改/增/删了哪些步骤与校验点）。主会话只输出报告摘要与失败项。
