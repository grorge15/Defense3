---
slug: boss-attack-vfx
版本: 1
状态: draft
创建: 2026-09-16
---

# Boss 攻击特效接入

## 业务目标
在 Boss 有效攻击的伤害命中帧播放一次现有 `BossAttack` 特效。特效固定在该帧的 Boss 世界坐标，挂入 `GameRoot/Effect`，播放结束后销毁；AoE 命中多个目标时仍只生成一次。

## OpenSpec 引用
- Change：`openspec/changes/boss-attack-vfx/`
- 行为语义以该目录的 proposal 与 `specs/boss-attack-vfx/spec.md` 为准；本计划不重复 WHEN/THEN 场景。

## 风险等级
中。

## 禁做项
- 不修改 `assets/scenes/Main.scene`、其他 scene、坐标表或静态关卡布局。
- 不新建、重建、手写或整文件覆盖 `BossAttack.prefab`、`pref_enemy_boss.prefab`、任意 `.meta` 或动画资源；既有 `BossAttack.prefab` 只能通过 Cocos MCP 作为绑定目标使用。
- 不新建 prefab；`create-prefab-from-node` 仅适用于新 prefab，本任务不适用，禁止为满足流程创建临时或重复资源。
- 不使用 `resources.load`、硬编码资源路径或攻击目标循环来加载/生成特效。
- 不改变 Boss 伤害、攻击范围、目标选择、导航、冷却、攻击动画、帧事件、对象池、死亡、受击 VFX 或 `GameRoot/Effect` 结构。
- 不为每个 AoE 目标播放一次特效；不让特效跟随 Boss 后续移动；不允许特效失败阻断伤害结算。
- 不覆盖当前工作区中 `EnemyBoss.ts`、`pref_enemy_boss.prefab`、测试脚本的无关脏改动；构建开始时审查当前磁盘和 diff，只追加本计划 hunk。

## 变更文件清单
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 增加 Inspector 攻击特效 Prefab 引用；在既有有效命中闭包中按 `EnemyHitVfx` / `AnimUtil` 的实例化、世界定位、完成回收模式触发一次特效。
- 【可写】`assets/resources/prefabs/character/enemy/pref_enemy_boss.prefab` — 仅经 Cocos MCP 为 `EnemyBoss` 新字段局部绑定 `assets/resources/prefabs/VFX/BossAttack.prefab`，保留无关字段和嵌套实例。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs` — 仅在现有 harness 可低风险覆盖时增加单次命中、多个 AoE 候选、空绑定回归；不得重写用户已有改动。
- 【可新建】`openspec/changes/boss-attack-vfx/proposal.md` — 行为变更提案。
- 【可新建】`openspec/changes/boss-attack-vfx/specs/boss-attack-vfx/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/plans/boss-attack-vfx.md` — 本计划。
- 【仅只读参考】`assets/resources/prefabs/VFX/BossAttack.prefab`、`assets/resources/animations/vfx/bossAttack.anim` — 核对默认 clip 与非自动播放配置。
- 【仅只读参考】`assets/scripts/core/EnemyHitVfx.ts`、`assets/scripts/core/AnimUtil.ts` — 复用 Effect 根解析、实例化、世界坐标、一次播放与完成清理模式。
- 【仅只读参考】`assets/scripts/core/AttackFrameRelay.ts`、`assets/scripts/core/GameConfig.ts`、`.cursor/rules/{defense3-workflow,cocos-mcp,openspec}.md`、`AI_TASK_LIST.md` — 保持命中帧、数值与工作流契约。

## To-dos
- [ ] `boss-vfx.a`：读取当前 `EnemyBoss.tryAttack()`、`_applyCircleAttack()`、`EnemyHitVfx` 与 `AnimUtil`，确认攻击命中闭包是唯一触发点；以当前脏工作区为基线，定位不冲突的最小 hunk。
- [ ] `boss-vfx.b`：在 `EnemyBoss` 增加可空 Inspector `Prefab` 引用和私有播放路径：Prefab 与 `GameRoot/Effect` 可用时实例化，捕获 Boss 当前世界坐标，播放既有攻击动画一次，完成后销毁；实例化、动画缺失或中断均安全清理。
- [ ] `boss-vfx.c`：仅在既有攻击帧 `damage()` 闭包通过有效性检查后，维持一次 `_applyCircleAttack()` 结算并触发一次特效；不得在 `_applyCircleAttack()` 或 `_dealDamageToNode()` 候选循环内触发。
- [ ] `boss-vfx.d`：经 MCP 将 `BossAttack.prefab` 局部绑定至 Boss prefab 新字段。先 `assets-query-path` 确认 Defense3；对已存在 prefab 走 query→局部 bind，不创建节点、不调用 `create-prefab-from-node`、不手写序列化文件。
- [ ] `boss-vfx.e`：同一 MCP 会话保存、关闭并执行任务级验收；不改 Main.scene，因此不运行 post-scene-save 或 reimport 链，除非 MCP 工具实际报告需要恢复。
- [ ] `boss-vfx.f`：执行静态、聚焦测试、OpenSpec strict、prefab 资源和编辑器日志检查；记录多目标仅一次、固定位置、完成回收和空绑定仍结算伤害的证据。

## 实施步骤
1. S1：复核当前脚本、目标 prefab 与 git diff。若目标 prefab 已有协作中的未提交字段变化，只用稳定组件路径查询 `EnemyBoss` 并局部更新新增引用，禁止按旧 JSON 假设覆盖。
2. S2：脚本实现沿用 `EnemyHitVfx` 的一次性 Effect 生命周期与 `AnimUtil` 的 Animation 完成监听模式；特效不保持对 Boss 的父子关系，位置在命中帧捕获后固定；动画无法播放时立即销毁临时实例。
3. S3：保留 `tryAttack()` 的 `hit`、生命代次、攻击代次和目标有效性保护；特效调用和伤害结算处于同一命中帧，且不改变攻击恢复与冷却逻辑。
4. S4：MCP：`assets-query-path` → `scene-open` Boss prefab → `scene-query-component` 稳定 `EnemyBoss` 路径 → 局部设置 Prefab 引用 → `scene-save` 一次 → `scene-close`。无新 prefab，`create-prefab-from-node` 明确不适用。
5. S5：任务末一次运行 `verify-mcp-gate.ps1`，查询目标 prefab 资产有效性，重新打开 prefab 并读取编辑器日志。禁止并行 `assets-refresh` 和 `assets-reimport-asset`；未改 Main.scene，不运行 `post-scene-save.ps1`。

## 校验点
- [AC-1] `EnemyBoss` 只在一次有效攻击帧的单点入口触发特效；`_applyCircleAttack()` 命中多个候选时，单次攻击只创建一份。
- [AC-2] 特效父节点为 `GameRoot/Effect`，位置为命中帧捕获的 Boss 世界坐标；Boss 随后移动不带动实例。
- [AC-3] `BossAttack` 播放既有攻击动画一次并在完成后销毁；动画、实例化、挂点或 Inspector 绑定不可用时，既有 `_applyCircleAttack()` 仍结算且无异常或路径加载。
- [AC-4] `pref_enemy_boss` 的新增 Prefab 引用绑定至现有 `BossAttack.prefab`，无 Missing；`BossAttack` 资源和 `.meta` 未改变。
- [AC-5] `npx --no-install tsc --noEmit --pretty false`、适用的聚焦攻击回归、`openspec validate boss-attack-vfx --strict`、`git diff --check` 均通过。
### MCP（改过 prefab 时，任务末一次）
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` 退出码 0。
- [AC-P3] MCP `assets-query-asset-info` 查询 Boss prefab 返回 `invalid: false`。
- [AC-P3b] MCP 打开 Boss prefab 并查询 `EnemyBoss` 组件，确认攻击特效引用非 null 且非 Missing。
- [AC-EDITOR-MCP] MCP 打开目标 prefab 后读取 `system-query-logs`，无本任务导致的 red error 或 missing script。
### 条件 / 不阻塞
- [AC-PLAY] 对照 `openspec/changes/boss-attack-vfx/specs/boss-attack-vfx/spec.md` 手测有效攻击、AoE 多目标、攻击取消和空绑定。玩法手测不阻塞机器 AC，但必须如实记录是否执行。

## 回滚策略
- 以构建开始时的当前工作区为基线；失败时只撤回本任务在 `EnemyBoss.ts`、Boss prefab 和测试的新增攻击特效 hunk，保留用户或其他任务已有脏修改。
- 用 Cocos MCP 局部恢复或清空新增引用；禁止手写 prefab JSON 或回退整份 prefab。
- MCP 不能确认 Defense3 或既有脏状态使目标 prefab 无法稳定查询时，停止并报告硬阻塞，不以文件编辑替代 MCP。

## 修订记录
- v1（2026-09-16）：初始计划；新增 Boss 攻击命中帧的单次攻击特效、现有 Prefab MCP 绑定和行为 OpenSpec。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| verify-mcp-gate | |
| post-scene-save Patched | 0（未改 Main.scene；若异常运行则记录实际值） |
| assets-reimport-asset | |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/boss-attack-vfx/` |