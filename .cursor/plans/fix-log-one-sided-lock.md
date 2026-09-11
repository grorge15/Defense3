---
slug: fix-log-one-sided-lock
版本: 1
状态: done
创建: 2026-09-11
---

# 修复：滚木单侧截短与固定点定位

## 业务目标
电锯按 Player 相对滚木的本地 X 侧向截短，只移动保留段对应的 Visual 与滚动碰撞盒，确保未截短端不漂移。滚木满足现有固定条件后定位到稳定的 `LogFixPoint`，固定视觉 X 为 2.0 倍，固定碰撞体使用既有 `GameConfig` 配置并保持 Static/non-sensor；Player 不传送，跑酷跟随只在正常固定切换时解除。

## OpenSpec 引用
- Change：`openspec/changes/fix-log-one-sided-lock/`
- 行为真相以 `openspec/changes/fix-log-one-sided-lock/specs/log-one-sided-lock/spec.md` 为准；本计划不重复 WHEN/THEN。

## 风险等级
中：运行时改变滚木几何与固定定位，可能影响电锯重复命中、跟随边界和敌人导航读取的世界 AABB；不改场景/prefab 序列化资源。

## 禁做项
- 禁止修改 `assets/scenes/Main.scene`，包括 `BuildPlots/LogFixPoint` 坐标、层级、名称和引用。
- 禁止修改任何 `.prefab` 或 `.meta`，禁止手写/生成 prefab 或 scene JSON。
- 禁止新增 `LogController`、`SawController` 等职责分裂脚本；滚木职责留在 `Log.ts`，电锯职责留在 `SawTrap.ts`。
- 禁止修改 `Player.ts` 的移动/跟随实现，禁止通过 `setPosition`/`setWorldPosition` 传送 Player；只允许验证现有 `bindLog`/解除时序。
- 禁止修改 `GameConfig.ts` 固定碰撞常量；必须复用已有 `logFixedColliderOffsetX/Y`、`logFixedColliderWidth/Height`。
- 禁止改变既有蓝线/长度固定条件、`PARKOUR_FINISHED`/目标注册事件、弓箭伤害和敌人导航语义。
- 禁止用固定视觉长度覆盖滚动阶段的动态长度公式；固定状态与滚动状态必须分开处理。

## 变更文件清单
- 【可写】`assets/scripts/item/Log.ts` — 维护截短段的本地 X 边界，按固定条件解析并定位 `GameRoot/World/BuildPlots/LogFixPoint`，同步滚动 Visual/BoxCollider2D；固定后使用 2.0 倍 Visual X，并保留 Static/non-sensor 固定碰撞契约。
- 【可写】`assets/scripts/trap/SawTrap.ts` — 取得 Player 相对 Log 的位置并把单侧截短请求传给 `Log`，保持现有命中轮询、冷却和玩家受伤行为。
- 【可新建】`openspec/changes/fix-log-one-sided-lock/proposal.md` — 行为变更提案。
- 【可新建】`openspec/changes/fix-log-one-sided-lock/specs/log-one-sided-lock/spec.md` — `defense3-lite` Requirement/Scenario。
- 【可新建】`.cursor/plans/fix-log-one-sided-lock.md` — 本执行计划。
- 【仅只读参考】`assets/scripts/character/Player.ts` — 核对 Dynamic、`bindLog`、跟随/解除时序，禁止改动。
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — 核对固定 collider 与滚木长度配置，禁止改动。
- 【仅只读参考】`assets/scenes/Main.scene` — 核对稳定路径 `GameRoot/World/BuildPlots/LogFixPoint`，禁止改动。
- 【仅只读参考】`bugs.md` — 已有 `fix-log-fixed-collider-visual`、`fix-log-visual-length-scale`、`fix-log-follow-contact`、`fix-log-blue-line-direct-fixed` 等历史约束；实现通过后由 build-agent 按 bug 工作流更新对应条目，不在本计划阶段修改。
- 【仅只读参考】`AI_TASK_LIST.md`、`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/openspec.mdc`、`.cursor/rules/cocos-mcp.mdc` — 项目约束与任务映射。

## To-dos
- [x] `1.a`：`Log.ts` — 设计并实现一个按滚木本地 X 边界保留未截短端的截短入口；让 SawTrap 不再调用无方向的整体 `shrink()`，并在最小长度下保持宽度/偏移有效。
- [x] `1.b`：`Log.ts` — 让滚动阶段的 Visual X、Visual 本地位置、BoxCollider2D width/offset.x 使用同一保留段几何；不破坏现有 Y/Z 缩放、最小/最大长度和 `apply()` 同步。
- [x] `1.c`：`SawTrap.ts` — 在 AABB/距离命中路径中解析 Saw 与 Player 的世界位置，转换到 Log 本地坐标后比较两者相对 X 位置选择左/右截短方向；保留命中冷却和空引用防护。
- [x] `1.d`：`Log.ts` — 在既有固定条件成功分支中解析稳定路径 `GameRoot/World/BuildPlots/LogFixPoint` 并定位 Log；固定 Visual X 设为 2.0 倍，Player 世界坐标不得被写入或间接改变。
- [x] `1.e`：`Log.ts` — 固定时统一写入 `GameConfig` 的 offset/size，设置 RigidBody2D Static、BoxCollider2D non-sensor，并调用 collider apply；确保后续长度刷新不覆盖固定值。
- [x] `1.f`：静态检查变更范围、TypeScript 编译、OpenSpec 结构与行为回归；确认 `Main.scene`/prefab 无 diff，并按本计划 AC 记录证据。

## 实施步骤
1. S1：从当前 `Log.ts`、`SawTrap.ts` 与已读历史 bug 约束建立基线；确认固定条件和 `LogFixPoint` 路径解析方式，不改只读资源。
2. S2：在 `Log.ts` 内集中维护滚木当前保留段的长度与本地 X 几何；让单侧截短和滚动刷新共享该几何，固定态使用独立的 2.0 倍视觉与 `GameConfig` collider。
3. S3：在 `SawTrap.ts` 调用方向明确的 Log API；方向依据 Saw 与 Player 在 Log 本地 X 轴的相对位置，Player 缺失时不得猜测或传送。
4. S4：固定成功后先完成 Log 定位/视觉/碰撞状态切换，再按现有生命周期解除 Player 绑定；不得给 Player 写位置。
5. S5：运行 `tsc`、diff 范围与 OpenSpec 校验；若存在行为测试则覆盖左右两侧、最小长度、固定点、Player 不传送和固定 collider 状态。

## 校验点
- [AC-1] `npx tsc --noEmit` 退出码为 0，且无新增 TypeScript 类型错误。
- [AC-2] 左侧命中与右侧命中分别只截短对应一侧；未截短端的世界位置保持稳定，Visual X/position.x 与滚动 BoxCollider2D width/offset.x 一致。
- [AC-3] 截短至 `GameConfig.logMinLength` 时不产生负数/零宽度异常，重复命中不会绕过现有冷却或最小长度保护。
- [AC-4] 满足既有固定条件后，Log 解析并定位到 `GameRoot/World/BuildPlots/LogFixPoint`；固定 Visual X 为 2.0 倍，Player 世界位置前后不变且跟随关系仅按既有固定流程解除。
- [AC-5] 固定 Log 的 BoxCollider2D 使用 `GameConfig.logFixedColliderOffsetX/Y` 与 `logFixedColliderWidth/Height`，`sensor === false`；RigidBody2D 为 Static，并已调用 `apply()`。
- [AC-6] `git diff --check` 通过；`git diff --name-only` 仅包含计划允许的脚本/计划/OpenSpec 文件，`Main.scene` 与所有 prefab 无变更。
- [AC-7] OpenSpec change 目录包含 `proposal.md` 和 `specs/log-one-sided-lock/spec.md`，符合 `defense3-lite`，且计划仅引用规格路径、不复制 Scenario 文本。
- [AC-PLAY] 运行流程手测：Player 推木、左/右电锯、最短滚木、蓝线固定定位；固定期间 Player 不跳位，固定木为实际 Static 非 sensor 阻挡物。此项不阻塞机器 AC，除非本计划后续明确提升。

## 验证命令/检查
- `npx tsc --noEmit`
- `git diff --check`
- `git diff --name-only`
- `rg -n "Main\.scene|\.prefab" --glob '!AI_TASK_LIST.md' --glob '!bugs.md'`（仅用于确认本任务未把资源列入实际修改；以 git diff 为准）
- `rg -n "GameRoot|World|BuildPlots|LogFixPoint|logFixedCollider|sensor|Static|shrink" assets/scripts/item/Log.ts assets/scripts/trap/SawTrap.ts`
- 检查 OpenSpec 文件结构、Requirement/Scenario 存在性及计划中的 OpenSpec 引用。

## 回滚策略
- 基线：执行前记录 `Log.ts`、`SawTrap.ts` 与 `git status --short`；保留用户已有工作区改动，不使用 reset/checkout 清理无关文件。
- 失败：仅回退 build-agent 本次对两个脚本的局部改动与本 change/plan 文件；不得触碰 `Main.scene`、prefab、`.meta` 或用户已有修改。
- 若固定点解析失败：保持现有固定流程的资源安全行为，记录缺失路径作为阻塞证据并走 replan，不硬编码坐标或改场景。

## 修订记录
- v1（2026-09-11）：根据用户需求创建最小 Plan-Build 任务与 `defense3-lite` OpenSpec；限定为 `Log.ts`/`SawTrap.ts`，禁止 scene/prefab/GameConfig 修改。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | 0（本任务禁止改 scene/prefab；如仅只读核验则记录实际次数） |
| scene-save | 0 |
| verify-mcp-gate | 0（纯脚本任务，按 workflow 跳过） |
| post-scene-save Patched | 0 |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/fix-log-one-sided-lock/` |
