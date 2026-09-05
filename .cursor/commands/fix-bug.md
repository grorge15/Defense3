---
description: Bug 修复：systematic-debugging → 读 OpenSpec/bugs → Goal 或 Plan-Build
---

Bug：{{input}}

流程：
1. 规模判断（同 `multi-agent-orchestrator.mdc`）。
2. **根因（强制）**：插件可用则遵循 superpowers `systematic-debugging`；否则仍须栈/日志/复现证据。禁止无证据盲改。有 `openspec/specs/` 相关能力或未归档 delta → **先读**；并检索 `bugs.md` 同题。
3. 小 Bug → `@goal-agent` 最小修复 + 验证 + 极简报告。
4. 根因不明或跨多文件 → `@plan-agent`：步骤第一步「根因定位」附证据；有行为回归则更新 OpenSpec delta（MODIFIED/ADDED），plan 只引用不抄 WHEN/THEN。
5. **若涉及 `.prefab` / `Main.scene` / MCP**：任务级闭环；`post-scene-save.ps1`；任务末 AC-GATE / P3 / EDITOR-MCP；`create-prefab-from-node`；可空引用脚本兜底。
6. **写入 `bugs.md`**：一点一条；现象/原因/解决；同题升版 v2/v3。
