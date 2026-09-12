---
slug: fix-boss-retained-navigation
版本: 2
状态: done
创建: 2026-09-12
---

# 修复 Boss 保留导航移动卡顿

## 业务目标
消除 Boss 在共享流场重建 pending 期间因无效重置与零速度输出造成的“一顿一顿”，同时维持当前碰撞约束、索敌和攻击数值语义。大体型寻路已核查为通过 `_bodySize` 进入 body-specific 导航；攻击距离数值在未确认数值设计前不得调整。

## OpenSpec 引用
- Change：`openspec/changes/fix-boss-retained-navigation/`
- 行为合同以该目录 `specs/**` 为准；本计划不复述 WHEN/THEN。

## 风险等级
中：涉及 Boss 物理移动与共享导航 pending 生命周期，但不改变场景、资源或数值。

## 禁做项
- 不改 `assets/scenes/Main.scene`、任意 `.prefab`、动画资源、碰撞体、物理层、`.meta` 或资源坐标。
- 不创建 prefab、节点、组件或场景挂点；不调用 Cocos MCP，不运行 scene-save、post-scene-save、reimport 或 MCP gate。
- 不修改 `GameConfig` 的 `bossRetargetInterval`、移动速度、攻击距离、攻击伤害、冷却，或新增速度/动画阈值机制。
- 不改变 Boss 目标优先级、目标扫描节奏、攻击锁、既有脱困策略或普通 EnemyMinion 行为。
- 不绕过 `EnemyNavigation.constrainFinalVelocity` 复用速度；不允许跨当前碰撞、地面或边界约束移动。
- 不手写或重建 scene/prefab 序列化内容。

## 变更文件清单
- 【可写】`.cursor/plans/fix-boss-retained-navigation.md` — 仅允许 build-agent 在 BNR.5 所有阻塞性校验通过后将计划状态更新为 `done`；本次 replan 保留为 `draft`。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 仅修正同节点重选/临时候选的 reset 时机，并保存和受约束地复用 Boss 自己的安全世界速度。
- 【可写】`assets/scripts/core/EnemyNavigation.ts` — 仅暴露或收紧复用速度所需的现有最终速度约束契约，不改变 body-specific 碰撞与共享字段调度语义。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs` — 扩展现有导航回归，覆盖 Boss 同节点重选、候选抖动与 pending 零速度保留/拒绝路径。
- 【可写（完成后）】`bugs.md` — 在既有 Boss 共享导航卡顿主题下添加下一版本记录；若执行时检索发现更精确的同题条目，则升级该条而非重复建条。
- 【可新建】`openspec/changes/fix-boss-retained-navigation/proposal.md` — 本次最小行为变更提案。
- 【可新建】`openspec/changes/fix-boss-retained-navigation/specs/boss-retained-navigation/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/plans/reports/fix-boss-retained-navigation-report.md` — build-agent 的完成或硬阻塞报告。
- 【仅只读参考】`assets/scripts/core/GameConfig.ts`、`assets/scripts/enemy/EnemyMinion.ts` — 核对既有数值与普通敌人行为，不改动。
- 【仅只读参考】`openspec/changes/fix-enemy-pursuit-demolition/`、`openspec/changes/fix-enemy-navigation-rebuild-stalls/`、`openspec/changes/enemy-shared-flow-field/` — 保持既有共享流场、安全与 Boss 语义合同。
- 【仅只读参考】`.cursor/plans/fix-enemy-pursuit-demolition.md`、`.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-report.md` — 核对已有验证命令与已接受边界。

## To-dos
- [x] BNR.0：已完成基线调查：读取计划、相关 OpenSpec、现有报告与 git 状态；确认此前因计划自身未列为可写而在实现前硬阻塞，未改动业务代码、OpenSpec 或资源。
- [x] BNR.1：从实现前确认续跑：读取本计划、相关 OpenSpec、现有报告、git 状态及目标脚本；确认实现现状仍与计划假设一致后继续 BNR.2，否则停止并请求 replan。
- [x] BNR.2：在 `EnemyBoss.ts` 将周期性 `resetUnit` 限定为有效目标节点实际更换；将阻挡物候选变化与有效导航目标变化分离，保留既有失效目标、攻击锁和对象池 release 行为。
- [x] BNR.3：在 `EnemyBoss.ts` 与 `EnemyNavigation.ts` 接入 Boss 私有的、最近一次已通过最终约束的世界速度；仅在共享字段 pending 且本帧输出零速度时尝试复用，并在当前约束失败后维持既有停移/脱困分支。
- [x] BNR.4：扩展现有导航 harness，证明同节点周期重选不 reset、临时阻挡候选抖动不清局部状态、安全 retained velocity 继续前进、不安全/攻击锁/目标变更时不复用，并回归 body-specific 和碰撞安全。
- [x] BNR.5：运行全部校验；通过后按同题升版规则更新 `bugs.md`，写入报告并把计划状态更新为 done。失败仅记录证据，走 replan。

## 校验点
- [AC-1] Boss 每次 `bossRetargetInterval` 扫描若返回同一有效 `Node`，不调用 `resetUnit`；返回不同目标或失效恢复时仍释放旧状态。
- [AC-2] 阻挡物诊断候选在 pending 帧间短暂变化时，不会单独清掉 Boss 局部流场/保留速度状态；有效导航目标变更仍按既有生命周期处理。
- [AC-3] pending 共享字段输出零速度时，Boss 只复用其上一次经 `constrainFinalVelocity` 验证、且本帧再次验证通过的世界速度；验证失败、目标变更、攻击锁或无历史速度时不复用。
- [AC-4] Boss 的 `_bodySize` body-specific 导航、真实碰撞参与、攻击距离值、攻击锁和现有脱困路径保持不变。
- [AC-5] `npx tsc --noEmit --pretty false` exit 0。
- [AC-6] `node .cursor/scripts/test-enemy-navigation.cjs` exit 0，包含本次 Boss retained-navigation 定向断言与既有回归。
- [AC-7] `npx openspec validate fix-boss-retained-navigation --strict` exit 0；若本仓库使用不同已存在的 OpenSpec CLI 包装，报告实际等价命令及 exit 0。
- [AC-8] `git diff --check` 无错误；完成后 `bugs.md` 有一条同题 vN 记录，含现象、原因、解决和验证状态。
- [AC-PLAY] 在 Creator 中让 Boss 追逐同一目标、触发共享字段 pending 与临时阻挡物诊断抖动，观察连续移动且不穿透；不阻塞 done。

## 验证命令/检查
- `npx tsc --noEmit --pretty false`
- `node .cursor/scripts/test-enemy-navigation.cjs`
- `npx openspec validate fix-boss-retained-navigation --strict`
- `git diff --check`

## 回滚策略
仅回滚本任务对 `EnemyBoss.ts`、`EnemyNavigation.ts`、导航 harness 和 `bugs.md` 的实现/记录改动；保留已创建 OpenSpec 与计划作为问题和行为证据。不得回滚或改写用户已有工作树变更，且不涉及 scene/prefab 恢复链。

## 修订记录
- v1（2026-09-12）：初始最小 OpenSpec 与无 MCP 执行计划；范围限定为 Boss retained navigation bug。
- v2（2026-09-12）：最小 replan；状态回 `draft`，将本计划加入可写文件以满足 BNR.5 的状态更新要求；保留已完成基线调查，下一次 build 从 BNR.1 实现前确认续跑。

---

## 执行报告须含（build-agent）

### 非 MCP 指标
| 指标 | 次数/值 |
|---|---|
| 同节点 retarget resetUnit 调用 | |
| 临时候选变更导致的 resetUnit 调用 | |
| pending 零速度安全复用次数 | |
| pending 零速度拒绝复用次数 | |
| 导航 harness 断言数/结果 | |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/fix-boss-retained-navigation/` |

### MCP 指标
不适用：本计划禁止改动 `Main.scene`、prefab 和任何资源装配；`scene-open`、`scene-save`、`verify-mcp-gate`、`post-scene-save` 与 `assets-reimport-asset` 均应为 0。
