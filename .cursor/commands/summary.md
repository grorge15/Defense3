---
description: 功能总结：读取该功能的计划/执行报告/git 记录，按学习笔记模板输出总结并落盘
---

功能：{{input}}

按以下步骤总结该功能：

1. 定位证据：
   - 优先读取 `.cursor/plans/<slug>.md`（计划）与 `.cursor/plans/reports/<slug>-report.md`（执行报告）。slug 由功能名推断（全小写，下划线/横杠）；推断不出时先列出候选计划文件让用户确认。
   - 无计划/报告时，用 `git log` / `git diff` 按功能关键词定位改动文件与 commit。
2. 按 `.cursor/summaries/_TEMPLATE.md` 结构输出：
   - 需求：一句话
   - 改动文件：只列承载核心逻辑的脚本与必要配置字段（如 GameConfig）；Prefab、Editor 工具、场景搭建性改动不列
   - 核心知识：| 我的文字逻辑 | 代码映射 | 表格
   - 踩过的坑：从报告失败项/返工记录提炼
   - 值得记住的点：2~4 条可复用知识
3. 保存到 `.cursor/summaries/<slug>-summary.md`（UTF-8），并在会话输出全文。
4. 只写核心可复用知识，不写完整实现记录。
