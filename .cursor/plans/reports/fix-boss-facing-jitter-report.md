# fix-boss-facing-jitter 执行报告

- 计划版本：v2；修订：2026-09-16，BFJ.d 续跑因 TypeScript 环境冲突硬阻塞。
- 风险等级：中。
- 是否续跑：yes。
- Git 基线：`6a7ad78ad3036d272301f398965f3d5984440d41`。

## Todo 完成矩阵

| Todo | 状态 | 证据 |
|---|---|---|
| BFJ.a | 完成 | 已记录初始 `git status --short`、相关 OpenSpec 和 Boss 旧路径中的局部速度覆盖。 |
| BFJ.b | 完成 | `EnemyBoss._faceEffectiveCombatObjective` 以有效阻挡优先、追击目标回退，移除攻击/移动路径中用局部导航速度覆盖 VisualFacing 的调用。 |
| BFJ.c | 完成 | `AC-FACING-STABLE` harness 覆盖连续 `+2/-2` 局部速度、普通追击、阻挡攻击面、目标换侧和物理速度不被改写。 |
| BFJ.d | 硬阻塞 | 2026-09-16 续跑的首项 TypeScript 验收失败；后续完整 harness、OpenSpec strict 和 diff 检查未执行。 |

## Changed files and diff summary

- `assets/scripts/enemy/EnemyBoss.ts`：已有本计划的有效战斗目标朝向 hunk；文件同时含并行攻击 VFX、攻击范围和碰撞距离变更。
- `.cursor/scripts/test-enemy-navigation.cjs`：已有本计划的 `AC-FACING-STABLE` hunk；文件同时含并行盾兵/攻击恢复回归。
- `.cursor/plans/fix-boss-facing-jitter.md`：标记 v2 续跑阻塞并保留失败原因。
- `bugs.md`：未改，因机器 AC 未通过。
- `.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v3/logic-results-v3.json`：未刷新，完整 harness 未执行。

## AC results

| AC | Result | Evidence |
|---|---|---|
| AC-FACING-STABLE | 已有通过证据 | 之前的无副作用 harness 已通过；本轮因 TypeScript 首项失败未重跑。 |
| AC-FACING-NORMAL | 已有通过证据 | 同一聚焦 harness 覆盖有效阻挡目标、追击目标和目标换侧。 |
| AC-PHYSICS-SCOPE | 已有通过证据 | 聚焦 harness 逐帧断言刚体速度保持导航输出。 |
| AC-REGRESSION TypeScript | 失败 | `npx --no-install tsc --noEmit --pretty false` 退出 1：`assets/scripts/enemy/EnemyBoss.ts(803,13): error TS2304: Cannot find name 'tween'.` |
| AC-REGRESSION standard navigation harness | 未执行 | 验证顺序在 TypeScript 后；没有生成新的自动证据。 |
| AC-REGRESSION OpenSpec strict | 未执行 | 验证顺序在 TypeScript 后。 |
| AC-REGRESSION diff | 未执行 | 验证顺序在 TypeScript 后。 |
| AC-PLAY | 未执行 | 计划明确不阻塞机器完成。 |

## MCP metrics

| Metric | Count/value |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | 0 |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes |
| OpenSpec change | `openspec/changes/fix-boss-facing-jitter/` |

## Failures, blockers, and recommended replan target

当前 `EnemyBoss.ts` 的并行攻击 VFX 实现在 `_playAttackVfx()` 调用 `tween(...)`，但顶部 `cc` import 未导入 `tween`。该代码在 BFJ.a-c 的朝向 hunk 之外；计划要求保留并行脏改动，且 BFJ.d 规定 TypeScript 必须通过后才可执行完整 harness、更新 `bugs.md` 或标记 done。

推荐 replan target：修复拥有攻击 VFX hunk 的计划，使其导入或移除 `tween` 的无效引用并独立通过 TypeScript；随后从 BFJ.d 继续，执行完整导航 harness（仅允许刷新列明的 `logic-results-v3.json`）、OpenSpec strict 和 diff 检查。