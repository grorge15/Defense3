---
description: Bug 修复入口：先定位根因（带证据），再按规模走 Goal 或 Plan-Build
---

Bug：{{input}}

流程：
1. 规模判断（同 orchestrator 规则）。
2. 小 Bug → 委派 @goal-agent：先复现/定位根因（报错栈、日志、调用链证据），最小改动修复，跑验证，输出极简报告。
3. 根因不明或跨多文件 → 委派 @plan-agent 出计划，实施步骤第一步必须是「根因定位」并附证据，再进入修复步骤与校验点。
4. 禁止无根因证据的盲改式修复。
5. **若涉及 `.prefab` / `Main.scene` / MCP**：遵循 `.cursor/rules/cocos-mcp.mdc` 五步 + 串行纪律；修复后跑 `verify-mcp-gate.ps1` 与 AC-S* / AC-P*；禁止 `_fix_prefabs.mjs` / `_gen_prefabs.mjs` 整文件重建；禁止并行 `assets-refresh` + `assets-reimport-asset`；禁止仅 patch 磁盘而不同步 library 后声称已修复。
6. **修复完成后写入 `bugs.md`（无则新建）**：
   - **一点一条**：用户一次提了 N 个独立问题 → 写 N 条独立条目，禁止把多点塞进同一条的 ①②③。
   - 每条写清「现象 / 原因 / 解决」。
   - **同题升版**：写入前检索 `bugs.md` 是否已有同类主题；有则在原条目下叠加 `v2`/`v3`…，勿另开同名条目；没有再新建。
