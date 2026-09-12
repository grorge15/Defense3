---
slug: fix-build-cost-and-finale-timing
版本: 2
状态: draft
创建: 2026-09-12
---

# 建造余款显示与大招拉远时序修复

## 业务目标

修复两项玩家可见时序：建造地块费用文本按已支付金额同步显示剩余款项；有相机时，大招 BigMove 必须在拉远的最终相机状态已于 `lateUpdate` 应用后才同帧启动。保留既有经济、清场和胜利结算语义，不改场景或资源。

## OpenSpec 引用

- Change：`openspec/changes/fix-build-cost-and-finale-timing/`
- 行为规格仅以该 change 为准；计划不复述 WHEN/THEN。
- 执行时须以 `npx openspec validate fix-build-cost-and-finale-timing --strict` 检查该 delta；若现有未归档 `ultimate-bigmove-clear` 与其发生时序冲突，仅同步该冲突的 OpenSpec 文字，不扩展实现范围。

## 风险等级

中。两处改动小但都处于生命周期和结算链：付款显示不能改变扣币语义，延迟回调不能在销毁或重复触发后再启动/结算。

## 禁做项

- 不修改 `Main.scene`、任何 prefab、动画、`.meta`、`GameConfig.ts`、项目设置或用户现有脏文件。
- 不新建或接线 BigMove 点位，不调用 MCP，不执行 `scene-open/save`、`create-prefab-from-node`、`post-scene-save.ps1` 或 MCP gate。
- 不改变费用数值、支付速率、`CoinSystem.addCoins` 参数、CoinUI 飞币、fill bar、已有完成销毁、敌人清理范围、胜利入口或动画速度兜底算法。
- 不新增相机控制器、事件、资源加载通路、预制体、场景节点或广泛测试框架。
- 不使用 `git reset --hard`、`git checkout --`、全局格式化或任何会覆盖无关工作区修改的操作。

## 变更文件清单

- 【可写】`assets/scripts/building/BuildPlot.ts` — 在现有付款进度更新中刷新费用 Label；显示策略为 `Math.ceil(getRemainingCost())`。
- 【可写】`assets/scripts/game/UltimateSystem.ts` — 在已有 finale guard 内把 BigMove 路径安排在可用相机完成拉远后，并保护完成回调生命周期。
- 【可写】`assets/scripts/game/CameraFollow.ts` — 为既有 `zoomOut` 增加可选一次性完成回调；仅在最终 `_zoomExtraZ` 已应用且 `_zooming` 清除后调用，零时长同步调用，新 zoom 会丢弃旧回调。
- 【可写】`bugs.md` — 仅在全部机器 AC 通过后，为 `fix-build-coin-log-boss` 追加新版本，并为 `fix-advanced-towers-no-gameover` 追加新版本；每项写现象、原因、解决和验证。
- 【可新建】`.cursor/scripts/test-build-cost-ultimate-timing.cjs` — 只使用 Node 内置断言、TypeScript transpile 和最小 Cocos mock 的定向回归；不得成为新的通用测试框架。
- 【可新建】`openspec/changes/fix-build-cost-and-finale-timing/proposal.md` — defense3-lite 提案。
- 【可新建】`openspec/changes/fix-build-cost-and-finale-timing/specs/construction-payment-progress-display/spec.md` — defense3-lite 行为 delta。
- 【可新建】`.cursor/plans/reports/fix-build-cost-and-finale-timing-report.md` — build 结束或硬阻塞报告。
- 【可新建】`.cursor/plans/reports/fix-build-cost-and-finale-timing-evidence/` — 本次 harness、`tsc`、OpenSpec 和 diff 的结果摘要；不复制无关历史证据。
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — 读取既有费用、`ultimateZoomDuration` 和既有结算延迟；本次禁止修改。
- 【仅只读参考】`assets/scripts/game/GameManager.ts`、`assets/scripts/character/Player.ts`、`assets/scripts/game/CoinSystem.ts`、`assets/scripts/ui/CoinUI.ts` — 保持既有调用契约。
- 【仅只读参考】`openspec/changes/ultimate-bigmove-clear/` — 检查未归档的旧 delta 是否需要最小文字同步。
- 【仅只读参考】`AI_TASK_LIST.md`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,openspec,cocos-mcp}.md` — 路由与项目约束。

## To-dos

- [ ] `timing.1`：重新读取本计划、OpenSpec、目标脚本、相关旧 delta、git status 和 `bugs.md` 目标条目；记录基线，确认所有既有脏文件均不在本任务 diff。
- [ ] `timing.2`：在 `BuildPlot.ts` 将现有费用刷新统一为非负余款的 `Math.ceil` 文本，并在每一次已接受 payment 后、与已有 fill 更新同一 update 周期刷新；不更改 `_paidAmount`、扣币、飞币或完成路径。
- [ ] `timing.3`：在 `CameraFollow.ts` 为既有 `zoomOut` 提供可选一次性 onComplete。非零时长必须在 `lateUpdate` 写入最终 `_zoomExtraZ`、清除 `_zooming` 后调用；零时长必须在最终值写入后同步调用；下一次 zoom 和销毁均须使旧回调不可执行。
- [ ] `timing.4`：在 `UltimateSystem.ts` 把 BigMove 路径绑定到 `zoomOut` 的完成回调。无相机时立即进入该路径；回调必须检查组件有效性、正在收尾状态和已结算状态，复用已有 one-shot guard。
- [ ] `timing.5`：保留 BigMove 对有效点去重、同帧启动、资源/点位/动画缺失兜底、按动画速度换算的完成兜底，以及完成后清敌再胜利的既有顺序；验证空点位或资源失败也在有相机时等待最终相机状态。
- [ ] `timing.6`：新增定向 harness，覆盖初始、分数付款、整额付款、完成、类型变化与新生命周期的余款文本；覆盖 onComplete 的最终状态、零时长同步、覆盖旧 zoom 回调、有相机完成后启动、无相机立即、空点位/资源失败完成后结算、同步有效点启动、重复触发、重复完成和销毁/失效回调。
- [ ] `timing.7`：运行 TypeScript、定向 harness、OpenSpec strict、diff 与范围检查；通过后更新两个既有 bugs 条目、写报告和证据。若任一机器 AC 失败，保留证据并停止，不更新 bugs.md 为已修复。

## 实施步骤

1. S1：仅调研并记录当前目标脚本和脏工作区基线；不触碰 scene、prefab 或配置。
2. S2：最小修改 `BuildPlot` 的单一显示刷新路径，并把付款后的显示刷新放在既有 progress path 中。
3. S3：最小扩展 `CameraFollow.zoomOut` 的可选完成通知，证明回调发生在最终相机状态写入之后。零时长同步完成；覆盖/销毁不得留下陈旧回调。
4. S4：最小修改 `UltimateSystem` 的触发编排。相机存在时将 BigMove 接到 zoom 完成通知；无相机维持立即路径。回调不得绕过 `_finishing`/`_finaleSettled` 或在无效组件上执行。
5. S5：以最小 mock harness 从目标 TypeScript 加载真实组件，断言调用顺序和数值显示，尤其验证最终相机状态完成边界。
6. S6：全部机器验证通过后才更新已有 bug 条目的版本、报告和本计划 todo/status；OpenSpec 严格验证若指出旧 delta 矛盾，则只同步相同的时序要求。

## 校验点

- [AC-1] 建造费用文本初始等于完整费用；每笔 accepted payment 后等于 `Math.ceil(max(0, total - paid))`，包括分数 payment、整额边界和完成前的零。
- [AC-2] 建筑类型变更按当前费用/已付款状态显示正确余款；新生命周期从所选类型的完整费用开始。付款、CoinSystem、CoinUI、fill 与原有完成语义不发生额外调用或数值变化。
- [AC-3] `CameraFollow.zoomOut` 的可选完成回调只在最终 `_zoomExtraZ` 已写入且 `_zooming=false` 后执行；零时长在最终值写入后同步完成；后续 zoom 或销毁使旧回调不再执行。
- [AC-4] 有有效相机时：锁玩家、设 Ultimate 阶段并调用 zoom 后，在相机完成回调前没有 BigMove 创建/播放、清敌或胜利结算；完成回调帧中所有有效点位 BigMove 同帧启动。
- [AC-5] 无有效相机时 BigMove 路径不等待；有相机但零有效点、资源失败、缺少 Animation/clip 时，保留诊断并且只在相机完成回调后走既有清敌和胜利兜底。
- [AC-6] 重复塔完成/大招触发、重复动画完成以及失效或销毁后的完成回调不会产生第二个 VFX 波次、第二次清敌或第二次胜利结算；既有 animation speed fallback 仍在。
- [AC-7] `node .cursor/scripts/test-build-cost-ultimate-timing.cjs` 退出码 0，且报告列出断言数和所有场景。
- [AC-COMPILE] `npx tsc --noEmit --pretty false` 退出码 0。
- [AC-OPSX] `npx openspec validate fix-build-cost-and-finale-timing --strict` 退出码 0；任何同步的旧 ultimate delta 也通过 strict 验证。
- [AC-DIFF] `git diff --check` 退出码 0；任务 diff 仅包含本计划允许的文件，无 `Main.scene`、prefab、`.meta`、`GameConfig.ts` 或无关脏文件被修改。
- [AC-BUGS] 仅在 AC-1 至 AC-DIFF 全通过后，两个既有 bugs 条目各有一个新版本记录和验证证据。
- [AC-PLAY] 非阻塞：手测建造余款按整数减少；触发大招后先完整拉远、再同帧播放所有已配点位效果、效果结束后清敌并获胜。

## 验证命令 / 检查

```powershell
node .cursor/scripts/test-build-cost-ultimate-timing.cjs
npx tsc --noEmit --pretty false
npx openspec validate fix-build-cost-and-finale-timing --strict
git diff --check
git diff --name-only
git status --short
rg -n "Math\.ceil|getRemainingCost|_refreshCostDisplay|zoomOut|onComplete|_zoomExtraZ|_zooming|_playBigMoveAndFinish|_finishFinale|_finishing|_finaleSettled" assets/scripts/building/BuildPlot.ts assets/scripts/game/CameraFollow.ts assets/scripts/game/UltimateSystem.ts
```

MCP checks are intentionally N/A: this task changes no scene or prefab. Do not run MCP merely to produce metrics.

## 回滚策略

Use the recorded baseline and reverse only this task's hunks in `BuildPlot.ts`, `CameraFollow.ts`, `UltimateSystem.ts`, `bugs.md`, the focused harness, OpenSpec delta, evidence and report. Never reset, checkout, stash-pop over, or otherwise overwrite the existing dirty workspace. On failed AC, retain the evidence, leave the plan in `replan`, and revise only failed todos and related OpenSpec text.

## 修订记录

- v1（2026-09-12）：初始计划；覆盖建造余款文本刷新与相机拉远后 BigMove 时序，明确纯脚本边界、focused harness 和既有 bug 条目版本追加。
- v2（2026-09-12）：以 `CameraFollow.zoomOut` 完成回调替代 duration 定时，保证 BigMove 只在最终相机状态应用后的同帧启动；加入零时长、覆盖和销毁回调契约。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---:|
| scene-open | 0（纯脚本） |
| scene-save | 0（纯脚本） |
| create-prefab-from-node | 0（未建 prefab） |
| verify-mcp-gate | 0（未改 scene/prefab） |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/fix-build-cost-and-finale-timing/` |

### 非 MCP 证据

| 指标 | 值 |
|---|---|
| focused harness | exit code / assertion count |
| TypeScript | exit code |
| OpenSpec strict | exit code |
| diff check | exit code |
| AC-PLAY | run / not run（不阻塞） |
