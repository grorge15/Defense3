---
description: 基于执行报告修订计划：委派 @plan-agent 版本 +1，回到 draft
---

计划：`.cursor/plans/{{input}}.md`

先读取执行报告 `.cursor/plans/reports/{{input}}-report.md`，将失败项归类（业务冲突/环境冲突/信息不足/实现错误），再委派 @plan-agent 修订计划：版本号 +1、状态置 draft、保留已达成 AC、只改失败相关部分。主会话只输出修订摘要，提示用户确认后重新运行 `/build-plan {{input}}`。
