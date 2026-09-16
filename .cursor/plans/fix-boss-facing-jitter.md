---
slug: fix-boss-facing-jitter
版本: 2
状态: blocked
创建: 2026-09-16
---

# 修复 Boss 左右抽搐

## 业务目标

消除 Boss 在建筑攻击面附近、被局部避让或寻路微调时因横向导航速度瞬时反转而反复镜像的可见抽搐。Boss 仍须在有效追击或攻击目标位于另一侧时正常翻转，且既有移动、索敌、攻击和碰撞语义不变。

## OpenSpec 引用

- Change：`openspec/changes/fix-boss-facing-jitter/`
- 行为规格以该 change 的 `specs/**` 为准；本计划不复述场景。

## 风险等级

中。该改动位于 Boss 每帧移动路径，必须证明它只改变视觉朝向来源，不改变物理速度、导航请求、攻击目标或攻击时机。

## 禁做项

- 不修改 `EnemyNavigation.ts`、`VisualFacing.ts`、`GameConfig.ts`、目标优先级、避让算法、流场参数、攻击距离、冷却或伤害数值。
- 不改 `Main.scene`、任意 prefab、动画资源、meta、物理层或 Cocos 序列化资源；不得运行 MCP 场景/资源写操作。
- 不以抬高全局死区、硬编码 Boss 速度阈值或新增帧率相关延迟掩盖导航输出；不改变实际 `linearVelocity`。
- 不覆盖当前工作区已有的 `EnemyBoss.ts`、测试、场景或 prefab 脏改动；实施前逐 hunk 以当前磁盘为基线。
- 未通过机器 AC 前不得更新 `bugs.md`、标记计划 done 或写成功报告。

## 变更文件清单

- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 将 Boss Visual 朝向统一绑定到当前有效追击/攻击目标，移除以最终局部导航横向速度覆盖朝向的路径。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs` — 扩展 Boss harness，断言局部横向速度反转不改变既有有效目标朝向，并断言目标换侧仍翻转。
- 【可写】`.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v3/logic-results-v3.json` — 标准导航 harness 的既有自动生成回归证据；仅允许由 BFJ.d 的完整命令刷新，不得手工编辑或改写同目录其他产物。
- 【可写】`bugs.md` — 仅在所有机器 AC 通过后，于现有 Boss/左右朝向相关条目追加一个版本记录现象、原因和解决。
- 【可写】`.cursor/plans/fix-boss-facing-jitter.md` — 执行时更新 todo、状态、修订记录和验证结果。
- 【可新建】`openspec/changes/fix-boss-facing-jitter/proposal.md` — 行为变更提案。
- 【可新建】`openspec/changes/fix-boss-facing-jitter/specs/boss-facing-stability/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/plans/reports/fix-boss-facing-jitter-report.md` — 成功或硬阻塞时的执行报告。
- 【仅只读参考】`assets/scripts/core/VisualFacing.ts` — 保持现有共享翻面 helper 的 API 和阈值不变。
- 【仅只读参考】`assets/scripts/core/EnemyNavigation.ts` — 保持导航、避让、碰撞约束和物理速度写入不变。
- 【仅只读参考】`openspec/changes/fix-boss-retained-navigation/`、`openspec/changes/fix-enemy-navigation-runtime-contract/`、`openspec/changes/minion-navigation-performance/` — 既有 Boss 导航、攻击面和避让承诺。
- 【仅只读参考】`assets/resources/prefabs/character/enemy/pref_enemy_boss.prefab`、`assets/scenes/Main.scene` — 不在本任务中修改。

## To-dos

- [x] BFJ.a：记录当前 `git status --short`、任务文件基线与相关 OpenSpec；确认现有 Boss 更新路径中，普通追击和障碍接近均会以局部最终 `velocity.x` 覆盖目标朝向。
- [x] BFJ.b：在 `EnemyBoss` 建立唯一的有效视觉目标选择点：正常追击面向锁定追击目标；正在接近或攻击可破坏阻挡时面向该有效阻挡目标。移除各路径末尾以避让/流场最终速度覆盖朝向的调用，保持既有物理速度、动画移动判定和攻击调用顺序。
- [x] BFJ.c：扩展聚焦 harness，构造建筑旁拥挤/局部修正导致连续正负横向速度的 Boss 帧，验证 Visual 保持有效目标一侧；覆盖正常追击、有效阻挡攻击面和目标换到另一侧时的翻面，并断言导航速度写入值未被朝向逻辑改写。
- [ ] BFJ.d：从既有完成的 BFJ.a-c 续跑，按既有顺序执行 TypeScript、完整标准导航 harness、OpenSpec strict 和 diff 检查。完整 harness 仅可刷新已列明的 `logic-results-v3.json` 自动证据；全部通过后更新已有 `bugs.md` 条目、计划状态为 done，并写执行报告。2026-09-16 v2 续跑时 TypeScript 在并发的攻击 VFX hunk 缺少 `tween` 导入而失败；保留失败证据，待 replan。

> 同主题纯脚本行为修复集中在本计划；不创建 prefab、场景或 MCP 子计划。

## 实施步骤

1. 从 BFJ.a 开始，保留当前并发脏工作区内容。确认现有 `VisualFacing` 的基础翻面能力正常，问题仅来自 Boss 在同一行为周期内用局部导航修正覆盖其目标朝向。
2. 完成 BFJ.b 时，以当前有效战斗目标作为朝向输入：有效阻挡存在时优先它，其他时候使用锁定追击目标。该选择仅驱动 Visual X 镜像；所有导航请求、`_velocity`、刚体写入、攻击范围和动画移动阈值继续使用原值。
3. 完成 BFJ.c 时，测试须能观察 Boss 对 `VisualFacing` 的输入或最终镜像结果，不能只断言函数被调用。回归应覆盖局部速度正负摆动、目标换侧和障碍攻击面，且证明物理速度仍与导航输出一致。
4. BFJ.d 从当前已完成的 BFJ.a-c 续跑；标准导航命令会按 harness 的默认 `NAV_EVIDENCE_DIR` 刷新已授权的既有 `logic-results-v3.json`。不得手工修改该 JSON、不得写入其余旧证据或更改 harness 输出策略。通过后再追加 bug 记录并写报告。纯脚本任务不运行 MCP gate；Creator 实玩可作为 AC-PLAY 记录，不阻塞机器完成。

## 校验点

- [AC-FACING-STABLE] 在建筑攻击面附近，局部避让或寻路造成的连续反向横向速度不得单独改变 Boss Visual 的左右镜像；有效战斗目标未换侧时 Visual 保持稳定。
- [AC-FACING-NORMAL] Boss 正常追击或攻击的有效目标换至另一侧时仍按该目标方向翻面；可破坏阻挡成为当前有效攻击目标时朝向该阻挡。
- [AC-PHYSICS-SCOPE] 朝向修复不得改变导航请求参数、最终世界速度、刚体速度换算、碰撞约束、目标选择、攻击距离、攻击锁或 walk/idle 判定。
- [AC-REGRESSION] `npx --no-install tsc --noEmit --pretty false`、`node .cursor/scripts/test-enemy-navigation.cjs`、`npx --no-install openspec validate fix-boss-facing-jitter --strict` 与 `git diff --check` 均退出 0。
- [AC-PLAY] 在 Creator 中复现 Boss 靠近红色建筑且周围有小怪的站位：根位置可因导航微调移动，但 Visual 不再左右抽搐；正常跨目标左右移动仍翻面。不阻塞 done。

### MCP

纯脚本行为修复：不适用。`scene-open`、`scene-save`、`verify-mcp-gate`、`post-scene-save.ps1`、`assets-reimport-asset` 和 `create-prefab-from-node` 均禁止执行。

## 验证命令

```powershell
npx --no-install tsc --noEmit --pretty false
node .cursor/scripts/test-enemy-navigation.cjs
npx --no-install openspec validate fix-boss-facing-jitter --strict
git diff --check
```

## 回滚策略

- 在 BFJ.b 前保存任务前 `EnemyBoss.ts` 与 harness 的逐 hunk 基线；只回退本任务新增的朝向目标选择与对应断言，不触碰并发脏改动。
- 若目标朝向使攻击视觉错误、回归改变物理输出或无法保持正常换侧翻面，撤销本任务 hunk，保留失败 harness/evidence，计划转为 replan；不以修改导航或全局阈值作为补救。

## 修订记录

- v1（2026-09-16）：基于视频与代码确认的局部导航速度覆盖 Visual 朝向问题创建初始计划。
- v1 执行中（2026-09-16）：BFJ.a-c 已完成；无副作用导航 harness、TypeScript、OpenSpec strict 与 diff 检查通过。BFJ.d 因标准 harness 将写入未列入本计划的既有证据目录而阻塞，待 replan 明确该输出路径。
- v2（2026-09-16）：仅解除 BFJ.d 的标准导航 harness 证据路径阻塞。允许该命令自动刷新既有 `fix-enemy-navigation-rebuild-stalls-evidence/v3/logic-results-v3.json`；BFJ.a-c、既有 AC、游戏实现、测试实现、报告和 OpenSpec 均保持不变。`npx --no-install tsc --noEmit --pretty false` 在 `EnemyBoss.ts(803,13)` 因并发攻击 VFX hunk 未导入 `tween` 失败，BFJ.d 保持未完成，待该并发改动修复后 replan/续跑。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | 0 |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/fix-boss-facing-jitter/` |
