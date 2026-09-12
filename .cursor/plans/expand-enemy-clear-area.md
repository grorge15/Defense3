---
slug: expand-enemy-clear-area
版本: 1
状态: draft
创建: 2026-09-12
---

# 拓展完成后的敌人清场与安全落点

## 业务目标

拓展区完成时，将 `ExpandAreaCollider` 覆盖范围内的存活小怪和 Boss 移动到 `SetPos` 内分散且完整容纳的落点。两个节点已经由用户放置；运行时按精确节点名解析，绝不修改 `Main.scene` 或新增 Inspector 引用。

## OpenSpec 引用

- Change：`openspec/changes/expand-enemy-clear-area/`
- 行为规格以该目录 `specs/expansion-enemy-clear/spec.md` 为准。

## 风险等级

中：扩展完成与敌人攻击、刚体移动、导航缓存处于同一帧时，必须取消旧位置的瞬态状态，同时保留生命值与既有索敌所有权。

## 禁做项

- 禁止修改 `assets/scenes/Main.scene`、任何 `.prefab`、`.meta`、场景坐标、`ExpandAreaCollider`/`SetPos` 的节点或组件配置；禁止调用 Cocos MCP 做场景操作。
- 禁止新增 `@property(Node)`、Inspector 绑定或运行时创建/复制标记节点；只能按精确名称解析现有 `BoxCollider2D`。
- 禁止将标记碰撞体加入 `NavigationObstacle`、改为非 Sensor，或改动 `EnemyNavigation` 的障碍识别规则。
- 禁止杀死、对象池回收、重生、满血重置、重设目标优先级，或因容量不足把敌人传送到未配置的备用位置。
- 禁止改动伤害、生命、刷怪、阶段顺序、物理层、碰撞矩阵、寻路数值或其他建造流程。
- 禁止手写场景/Prefab JSON、覆盖或回退现有脏工作区改动。

## 变更文件清单

- 【可写】`assets/scripts/building/BuildSystem.ts` — 扩展完成后解析标记、选择敌人、规划落点并协调迁移。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 增加仅供清场调用的存活单位迁移接口，清除旧位置的攻击、刚体速度与导航瞬态状态而保留生命/目标。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 增加等价的 Boss 迁移接口，保留生命/目标表并取消旧位置的攻击、速度与导航状态。
- 【可写】`bugs.md` — 验证通过后，在既有拓展主题条目下追加一个版本或新建单一条目，记录现象、原因、解决与验证。
- 【可新建】`openspec/changes/expand-enemy-clear-area/proposal.md` — 本次玩家可见行为变更说明。
- 【可新建】`openspec/changes/expand-enemy-clear-area/specs/expansion-enemy-clear/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/scripts/test-expand-enemy-clear-area.cjs` — 加载实际 TypeScript 的确定性回归测试；不写入场景或资源。
- 【可新建】`.cursor/plans/reports/expand-enemy-clear-area-report.md` — 执行结果、命令输出摘要、变更范围和 MCP 指标。
- 【仅只读参考】`.cursor/rules/multi-agent-orchestrator.mdc`、`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/cocos-mcp.mdc`、`.cursor/rules/openspec.mdc` — 路由、场景纪律、验收与规格约束。
- 【仅只读参考】`assets/scenes/Main.scene` — 仅用于确认现有标记已存在；本任务不得写入。
- 【仅只读参考】`assets/scripts/core/EnemyNavigation.ts`、`assets/scripts/enemy/EnemyAI.ts`、`assets/scripts/core/AirWallAabb.ts`、`assets/scripts/enemy/EnemySpawner.ts` — 复用当前导航/攻击/对象池约定，不扩大实现范围。
- 【仅只读参考】`openspec/changes/fix-defense-combat-expand/`、`bugs.md` 的既有拓展记录 — 保持既有拓展显隐语义并避免重复 Bug 条目。

## To-dos

- [ ] `ECEA.1`：在开始写实现前复核当前工作区、既有拓展 OpenSpec、`BuildSystem` 触发顺序、两类敌人的攻击/对象池/导航生命周期；若已预摆标记名称或 Sensor 状态与假设不符，停止并报告，不改场景补救。
- [ ] `ECEA.2`：在 `BuildSystem` 中实现精确名称的运行时标记解析与一次性清场编排；仅接受有效、激活的 `ExpandAreaCollider` 与 `SetPos` Sensor `BoxCollider2D`，并在结构激活及导航失效后执行。
- [ ] `ECEA.3`：以敌人实际 Collider 世界 AABB 与清场框相交筛选活动、存活的 `EnemyMinion`/`EnemyBoss`；按确定性顺序为每个单位使用其实际碰撞尺寸在 `SetPos` 内规划不重叠、完全包容的位置。无有效标记或总容量不足时诊断并原地保留全部候选敌人。
- [ ] `ECEA.4`：为小怪和 Boss 实现受限迁移接口：保持生命值、活动状态及正常目标所有权；清空线速度、旧攻击代次/冷却、阻挡目标和保留的导航速度，重置该单位导航缓存，再写入新世界位置。
- [ ] `ECEA.5`：新增实际 TypeScript 测试，覆盖名称解析与 Sensor 防护、范围边界相交、存活/非存活筛选、不同体型的分散完整落点、容量不足的全量不移动、旧攻击失效、速度/导航清理，以及生命值和目标语义保持。
- [ ] `ECEA.6`：执行 TypeScript、专项测试、OpenSpec 严格验证和 diff 检查；通过后更新 `bugs.md`、写执行报告并保留 AC-PLAY 为不阻塞的手测项。

> 本任务跨建造编排、两种敌人生命周期和回归测试，采用 Plan-Build；不适用纯脚本两文件的 `goal-agent` 路由。

## 实施步骤

1. `S1`：复查当前磁盘和场景只读状态。使用场景根的后代 `BoxCollider2D` 查询精确匹配 `ExpandAreaCollider`、`SetPos` 的节点，拒绝缺失、失效、非激活或 `sensor !== true` 的标记；不引入序列化字段。
2. `S2`：在 `_onExpandComplete()` 完成既有 Barrier/侧墙激活、地块显示、隐藏列表和导航失效之后，收集当前场景的两种敌人组件。仅选择 `activeInHierarchy`、`!isDead`、本体有效碰撞框与清场 AABB 相交的单位；每次扩展完成只运行一轮。
3. `S3`：从 `SetPos.worldAABB` 生成确定性候选格位。按每个敌人的世界碰撞尺寸缩入边界并基于已保留落点检测 AABB 相交，确保目标框完整在 `SetPos` 内且互不重叠。先规划完全部候选，再开始移动；无法容纳所有候选时输出可诊断警告并不移动任何候选，避免半次清场或穿墙式兜底。
4. `S4`：两种敌人的迁移接口使用现有刚体、动画攻击代次和 `EnemyNavigation.resetUnit()` 约定，消除从旧位置遗留的帧伤害、速度、阻挡承诺和路径缓存；不调用 `reset()`，从而不治疗、不清空 Boss 目标表、不改变小怪目标。写入世界坐标后由下一个既有更新周期恢复追击。
5. `S5`：测试通过加载真实脚本的 Cocos mock harness 断言业务边界和生命周期，不用纯文本 grep 代替行为验证。仅此任务所需的脚本与文档可以改动。

## 校验点

- [AC-1] `ExpandAreaCollider` 与 `SetPos` 均以精确节点名和 Sensor `BoxCollider2D` 解析；缺失、停用或非 Sensor 时不发生敌人移动且有诊断。
- [AC-2] 扩展完成后，清场框相交的活动存活小怪和 Boss 都进入 `SetPos`；框外、死亡或停用敌人不移动。
- [AC-3] 对有效且容量足够的 `SetPos`，每个迁移后敌人的实际碰撞 AABB 都完全位于该框内，迁移批次内任意两者不相交；容量不足时候选整体保持原位。
- [AC-4] 已迁移敌人不再使用旧位置的攻击/速度/导航瞬态状态，生命值和既有普通索敌语义保持。
- [AC-5] 没有 `Main.scene`、Prefab、Meta、导航障碍规则或数值改动；现有工作区改动不被覆盖。
- [AC-TSC] `npx tsc --noEmit --pretty false` 退出码为 0。
- [AC-REGRESSION] `node .cursor/scripts/test-expand-enemy-clear-area.cjs` 退出码为 0，并覆盖 AC-1 至 AC-4 的确定性分支。
- [AC-OPENSPEC] `npx openspec validate expand-enemy-clear-area --strict` 退出码为 0。
- [AC-DIFF] `git diff --check` 退出码为 0，且任务新增/修改内容只落在本计划允许清单内。

### MCP（本任务不改 prefab/scene）

- MCP 会话、`scene-save`、`verify-mcp-gate.ps1`、`post-scene-save.ps1`、`assets-reimport-asset` 均不执行；本任务不适用 AC-GATE、AC-P3、AC-EDITOR-MCP。

### 条件 / 不阻塞

- [AC-PLAY] 在 Creator 中完成拓展：确认两类敌人从 `ExpandAreaCollider` 被一次性移动到 `SetPos`、边界外敌人不动、迁移后可继续追击且没有旧位置伤害。此项不阻塞 done。

## 回滚策略

仅回滚本任务在 `BuildSystem.ts`、`EnemyMinion.ts`、`EnemyBoss.ts`、专项测试、`bugs.md` 与本 OpenSpec/计划/报告中的任务归属 hunks；保留用户和其他任务已存在的脏改动。若运行时标记不可用、容量无法满足或机器 AC 失败，保持场景和现有敌人行为不变，报告证据并进入 replan，不以场景编辑或未配置坐标替代。

## 修订记录

- v1（2026-09-12）：基于用户已预摆 `ExpandAreaCollider` 清场范围和 `SetPos` 安全落点的初始计划；明确纯脚本实现，不改 `Main.scene`。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 0（纯脚本） |
| scene-save | 0（纯脚本） |
| verify-mcp-gate | 0（不适用） |
| post-scene-save Patched | 0（不适用） |
| assets-reimport-asset | 0（不适用） |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/expand-enemy-clear-area/` |
