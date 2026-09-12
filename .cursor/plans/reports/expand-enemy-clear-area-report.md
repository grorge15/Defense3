# expand-enemy-clear-area 执行报告

## Plan

- 计划：`expand-enemy-clear-area` v1。
- 修订：v1（2026-09-12），使用用户已在 `Main.scene` 预摆的 `ExpandAreaCollider` 与 `SetPos`；纯脚本实现，禁止修改场景和 Prefab。
- 风险等级：中。运行时迁移会接触攻击回调、刚体速度与导航缓存，但保持生命值和既有目标所有权。
- 是否续跑：否。本次没有既有执行报告；首个写入前 git 基线为 `b24aa01e115d620ec0c819c5fb1adff362c6dfab`。

## Todo Matrix

| Todo | 状态 | 证据 |
|---|---|---|
| ECEA.1 | 完成 | 只读确认 `Main.scene` 中两个精确命名节点均激活，唯一 `BoxCollider2D` 均为 `sensor=true`；核对现有扩展、敌人、导航生命周期和共享脏工作区。 |
| ECEA.2 | 完成 | `BuildSystem._onExpandComplete()` 在墙体/地块显隐和导航失效后，按精确名称解析 Sensor 标记，并只尝试一次清场。 |
| ECEA.3 | 完成 | 用单位真实 `Collider2D.worldAABB` 与清场 AABB（含边界接触）筛选；按确定性顺序规划完整位于 `SetPos` 内、间隔 2 单位的落点；容量不足时无任何候选移动。 |
| ECEA.4 | 完成 | 两类单位的 `relocateForExpansion()` 作废旧攻击，清空速度、临时障碍、冷却/保留导航速度并调用 `EnemyNavigation.resetUnit()`，不调用 `reset()`、不治疗或重设目标。 |
| ECEA.5 | 完成 | 新增实际 TypeScript 转译 mock harness，25 项断言覆盖标记防护、边界筛选、存活状态、异体型落点、容量回退和迁移生命周期。 |
| ECEA.6 | 完成 | 专项测试、TypeScript、OpenSpec strict、diff 检查均通过；追加现有拓展 Bug 条目 v3。 |

## Changed Files

| 文件 | 本任务变更 |
|---|---|
| `assets/scripts/building/BuildSystem.ts` | 运行时标记解析、候选收集、确定性落点规划和一次性清场调用。 |
| `assets/scripts/enemy/EnemyMinion.ts` | `relocateForExpansion()`，清除旧攻击、速度、冷却与导航瞬态状态。 |
| `assets/scripts/enemy/EnemyBoss.ts` | 等价 Boss 迁移接口，保留目标表和生命值。 |
| `.cursor/scripts/test-expand-enemy-clear-area.cjs` | 22 项确定性回归断言。 |
| `openspec/changes/expand-enemy-clear-area/proposal.md` | 本次玩家可见行为说明。 |
| `openspec/changes/expand-enemy-clear-area/specs/expansion-enemy-clear/spec.md` | 行为规格。 |
| `bugs.md` | `fix-expand-unlock-hide-list` v3：现象、原因、解决与验证。 |

`EnemyMinion.ts`、`EnemyBoss.ts`、`bugs.md` 在执行开始前已有其他任务的未提交改动；本任务只追加清场相关 hunks，未覆盖或回退它们。`Main.scene` 同样已脏，但本任务未写入该文件。

## AC Results

| AC | 结果 | 证据 |
|---|---|---|
| AC-1 至 AC-4 / AC-REGRESSION | 通过 | `node .cursor/scripts/test-expand-enemy-clear-area.cjs`：25 assertions，3 scenarios。 |
| AC-TSC | 通过 | `npx tsc --noEmit --pretty false`，退出码 0。 |
| AC-OPENSPEC | 通过 | `npx openspec validate expand-enemy-clear-area --strict`，退出码 0。工具输出含既有 rules/guidance schema 警告，但 change 判定为 valid。 |
| AC-DIFF | 通过 | `git diff --check`，退出码 0。 |
| AC-5 | 通过 | 未修改 `Main.scene`、Prefab、Meta 或 `EnemyNavigation`。 |
| AC-PLAY | 待手测，不阻塞 | 在 Creator 完成一次拓展，观察框内小怪/Boss 进入 `SetPos`、框外敌人不动、迁移后继续追击且旧位置不结算攻击。 |

## MCP Metrics

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 0（纯脚本） |
| post-scene-save Patched | 0（不适用） |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | no |
| OpenSpec change | `openspec/changes/expand-enemy-clear-area/` |

## Failures And Blockers

首次专项测试因共享工作区中的敌人脚本新增 `AttackReservation` 依赖而缺少 harness mock；补齐 mock 后重跑通过。无硬阻塞，无需 replan。
