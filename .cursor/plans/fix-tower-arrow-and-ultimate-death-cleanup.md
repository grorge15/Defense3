---
slug: fix-tower-arrow-and-ultimate-death-cleanup
版本: 1
状态: draft
创建: 2026-09-12
---

# 塔兵箭矢朝向与大招死亡收尾修复

## 业务目标

令塔载远程 Soldier 的可见箭矢沿飞行方向旋转，完全沿用玩家 Arrow 的朝向约定，并保留攻击时机、即时伤害、目标选择和 0.2 秒弹道寿命。BigMove 后的最终清场改为停刷/停行动、播放全部活跃小怪与 Boss 的死亡动画、等待完成后统一移除并走既有胜利结算，且不发放硬币或奖励。

## OpenSpec 引用

- Change：`openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/`
- 行为语义只以该 delta 的 `specs/**` 为准；本计划不复述 WHEN/THEN。
- 该 delta 与未归档 `openspec/changes/ultimate-bigmove-clear/` 共同生效；已接受的相机、BigMove、单次触发和 VFX 缺失兜底必须保留，本任务只扩展最终清场。

## 风险等级

中。箭矢修复不能改变 Soldier 战斗路径；最终清场跨对象池、Animation 回调、禁用/销毁生命周期和胜利延迟，错误汇聚会导致提前隐藏、重复结算或死锁。

## 禁做项

- 不修改 `assets/scenes/Main.scene`、任何 prefab、动画/clip、SpriteFrame、`.meta`、`GameConfig.ts`、项目设置或静态场景接线。
- 不新建或重建 projectile/enemy/VFX prefab；不改 `pref_projectile_arrow` 序列化偏移，不新增场景节点、事件、相机控制器、资源加载通路或敌人系统。
- 不改变 Soldier 索敌、攻击锁/冷却、攻击帧、即时 `takeDamage`、飞行插值、0.2 秒寿命或销毁；不得将塔弹道改为玩家 Arrow 的碰撞/穿透伤害流程。
- 不改变普通战斗死亡的掉币、对象池返回、重生或 Boss 既有 `die` FINISHED 等待修复和 lifecycle generation 保护。
- 最终清场不得调用 `takeDamage`、普通 `_die()` 或 `onReturnedToPool` 来发放金币、奖励或重生；final-death 敌人不得移动、攻击或寻路。
- 不调用 MCP，也不执行 `scene-open/save`、`create-prefab-from-node`、`post-scene-save.ps1`、`verify-mcp-gate.ps1`、assets refresh/reimport。
- 不使用 `git reset --hard`、`git checkout --`、stash 覆盖、全局格式化或覆盖当前脏工作区的操作。

## 变更文件清单

### 可写

- 【可写】`assets/scripts/character/Soldier.ts` — 仅在现有塔载 projectile spawn 内计算 start-to-target 方向、调用 Arrow 复用 API，并实现无 Arrow 的 Sprite 兜底。
- 【可写】`assets/scripts/projectile/Arrow.ts` — 将既有玩家方向角计算提炼为 Soldier 可复用的最小 API；保留 `init`、碰撞、穿透和寿命。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 新增仅供最终清场调用的无奖励死亡演出及一次完成通知；普通 `_die()` 的 0.5 秒对象池路径不变。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 新增仅供最终清场调用的无奖励死亡演出及一次完成通知；普通 Boss death FINISHED 等待逻辑不回退。
- 【可写】`assets/scripts/game/UltimateSystem.ts` — 拆分停止刷怪、开始 final-death、完成汇聚、统一 deactivate 和既有胜利结算；保留 BigMove、相机完成与 finale guards。
- 【可写】`bugs.md` — 全部阻塞机器 AC 通过后，给 `fix-build-plot-background-arrow-and-shrine` 追加 v4，给 `fix-advanced-towers-no-gameover` 追加 v5；均包含现象、原因、解决、验证。

### 可新建

- 【可新建】`.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` — Node 内置断言、TypeScript transpile 和最小 Cocos mock 的 focused harness；不是通用测试框架。
- 【可新建】`openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/proposal.md` — defense3-lite 提案。
- 【可新建】`openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/specs/tower-projectile-flight-visual/spec.md` — 箭矢视觉行为 delta。
- 【可新建】`openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/specs/ultimate-final-death-cleanup/spec.md` — 最终清场行为 delta。
- 【可新建】`.cursor/plans/reports/fix-tower-arrow-and-ultimate-death-cleanup-report.md` — build 成功或硬阻塞报告。
- 【可新建】`.cursor/plans/reports/fix-tower-arrow-and-ultimate-death-cleanup-evidence/` — harness、tsc、OpenSpec、diff 和范围检查摘要。

### 仅只读参考

- 【仅只读参考】`assets/scripts/game/CombatSystem.ts` — 玩家 Arrow instantiate/init 边界。
- 【仅只读参考】`assets/scripts/game/EnemySpawner.ts` — 停刷必须覆盖 update、side tick 和 pending respawn；复用 Ultimate 当前 disable/unschedule 行为。
- 【仅只读参考】`assets/scripts/game/CameraFollow.ts`、`assets/scripts/game/GameManager.ts`、`assets/scripts/character/Player.ts`、`assets/scripts/core/{AnimUtil,EnemyNavigation,GameConfig}.ts` — 已接受的相机、结算、动画、导航和配置契约。
- 【仅只读参考】`openspec/changes/ultimate-bigmove-clear/`、`openspec/changes/fix-build-cost-and-finale-timing/`、`.cursor/plans/{ultimate-bigmove-clear,fix-build-cost-and-finale-timing}.md`、`.cursor/plans/reports/fix-build-cost-and-finale-timing-report.md` — 已有 finale 范围；除 replan 明确发现矛盾外不改。
- 【仅只读参考】`bugs.md` 目标条目、`AGENTS.md`、`AI_TASK_LIST.md`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,cocos-mcp,openspec}.md` — 基线与硬约束。

## 实现契约

### 塔载箭矢视觉朝向

- Soldier 仅在 spawn 时计算一次 `end - start`；零长度使用玩家 Arrow 相同的 `(0, 1, 0)` 回退，既有直线插值不做 target 跟随。
- `Arrow.ts` 是唯一角度约定：XY `atan2` 加 `directionAngleOffset`，Z 轴 rotation 写入朝向节点。玩家 Arrow 仍用同一逻辑。
- projectile 根有 Arrow 时，Soldier 必须使用该实例已序列化的 `directionAngleOffset` 并朝向根。无 Arrow 但根/后代可解析 Sprite 时，使用 Arrow 默认偏移朝向 projectile 根；二者都缺失时只输出一次可诊断 warning，保留无旋转移动和定时销毁，不抛错、不延寿、不取消伤害、不创建替代组件。

### 最终死亡完成回调

- Minion/Boss 各提供 public final-death 入口并接收完成回调：入口作废旧攻击/普通延迟回调、释放导航、停止刚体与攻击、禁用 collider、使其不可再受伤/行动；不调用奖励、掉币、对象池或普通 `_die()`。
- 每个有效请求有一个 lifecycle-bound once completion。可播放 `die` 时监听匹配 clip FINISHED 并设速度感知超时兜底；visual/Animation/state/clip 缺失立即完成；disable、destroy、重复请求、旧事件、旧超时和 reset 至多通知一次且不得阻塞 Ultimate。
- completion 只报告已完成，不自行 `active=false`。Ultimate 调用前先登记 pending；所有登记敌人完成后才统一 deactivate。同步回调、回调抛错、组件无效和重复回调必须由 per-entry once 收敛；之后才安排一次既有胜利延迟。

## To-dos

- [ ] `arrow-finale.1`：重读本计划、相关旧计划/报告、目标脚本、OpenSpec、bugs 与 `git status --short`；记录脏文件基线并确保不覆盖现有 `UltimateSystem.ts`、场景、资源和旧 delta 修改。
- [ ] `arrow-finale.2`：在 `Arrow.ts` 提炼现有玩家 Z 轴朝向 helper；在 `Soldier.ts` 的 tower spawn 按实现契约接入 Arrow/Sprite/无视觉三分支，不改 schedule、damage 或 target 读取。
- [ ] `arrow-finale.3`：为 Minion/Boss 分别实现 final-death quiesce 与 once completion，复用已有 animation/lifecycle 字段；确认普通 `_die()` 的奖励/回池和 Boss FINISHED 行为保持不变。
- [ ] `arrow-finale.4`：在 `UltimateSystem.ts` 保持 BigMove 完成边界，先停止 spawner 与 future callbacks，对开始时活跃敌人汇聚 final-death 回调，全部完成后统一 deactivate，再按当前 `ultimateGameOverDelay` 调用既有 `setGameOver('win')`。
- [ ] `arrow-finale.5`：新增 focused harness，加载真实 TypeScript Arrow/Soldier/EnemyMinion/EnemyBoss/UltimateSystem，覆盖方向偏移、三种 fallback、攻击语义、animation/缺失/禁用/销毁/重复回调、混合汇聚、无奖励、停刷、重复 finale 和 BigMove 后边界。
- [ ] `arrow-finale.6`：运行全部机器检查；通过后才更新两个 bugs 条目、报告和证据，并推进状态。失败保留证据且不写 bugs 已修复版本。

## 实施步骤

1. S1：只读核对 Player Arrow root rotation、Soldier 手写飞行、Minion 普通奖励死亡、Boss FINISHED 修复、Ultimate 相机到 BigMove 到清场顺序。
2. S2：集中 Arrow 数学并最小接入 Soldier；严格保留 0.2 秒 schedule 生命周期。
3. S3：并行增加两种敌人的 final-death API；普通死亡不委托到会改变 timing/reward 的新 API，只可抽取无可观察差异的静止/导航/动画基础动作。
4. S4：将 Ultimate 立即隐藏分为阶段式编排；每实例 once + 全局 one-shot guard，失效、缺 clip、重复事件均向前收敛。
5. S5：用 focused harness 回归普通/最终死亡分离、所有死亡完成前不 deactivate、最终结算至多一次。
6. S6：机器检查通过后再写 bugs、evidence 和 report。无 scene/prefab 写入，MCP 流程不适用。

## 校验点

- [AC-1] 塔 projectile root 在非零和零方向均与玩家 Arrow 角度/偏移约定一致，且 Arrow 实例的序列化偏移优先。
- [AC-2] 无 Arrow 有 Sprite 时以默认 Arrow 偏移朝向；Arrow/Sprite 都无时只诊断，保留飞行、0.2 秒销毁、索敌、攻击帧和即时伤害，不抛错。
- [AC-3] Tower 的攻击锁、冷却、目标筛选、发射帧、`enemy.takeDamage` 次数/时机、插值和寿命保持；玩家 Arrow init、穿透、碰撞和寿命回归通过。
- [AC-4] BigMove 后活跃敌人立即停止移动、攻击、寻路和未来生成，保持可见播放 die；普通死亡仍独立掉币/回池，普通 Boss 死亡仍等 `die` FINISHED。
- [AC-5] 仅当最终清场开始时登记的每个活跃 minion/boss 都完成通知后才统一 deactivate，再按既有延迟结算；缺 visual/Animation/state/clip、disabled/destroyed、抛错、同步/重复回调、超时均不提前结算、不重复结算、不死锁。
- [AC-6] final-death 不发金币/奖励、不回池/重生；spawner update、side schedules 和 pending respawn 不能生出新敌人；重复 tower/ultimate/callback 不产生第二批处理或结算。
- [AC-7] `node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` 退出 0，报告列出断言数与场景数，并使用真实目标组件加载。
- [AC-COMPILE] `npx tsc --noEmit --pretty false` 退出 0。
- [AC-OPSX] `npx openspec validate fix-tower-arrow-and-ultimate-death-cleanup --strict` 和 `npx openspec validate ultimate-bigmove-clear --strict` 均退出 0；不修改旧 delta，除非 replan 明确授权。
- [AC-DIFF] `git diff --check` 退出 0；本任务 diff 仅在允许文件内，无 scene/prefab/动画/`.meta`/`GameConfig.ts`/settings 或既有无关脏文件变化。
- [AC-BUGS] AC-1 至 AC-DIFF 通过后，目标 `bugs.md` 条目分别有 v4/v5 和验证证据。
- [AC-PLAY] 非阻塞：观察多方向塔箭与玩家箭一致；最终大招敌人停住并保留到死亡演出完成后才清空且只结算一次；缺 death clip 不阻塞。

## 验证命令 / 检查

```powershell
node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs
npx tsc --noEmit --pretty false
npx openspec validate fix-tower-arrow-and-ultimate-death-cleanup --strict
npx openspec validate ultimate-bigmove-clear --strict
git diff --check
git diff --name-only
git status --short
rg -n "directionAngleOffset|setRotationFromEuler|Sprite|_spawnProjectile|final.*death|Animation\.EventType\.FINISHED|clearAllEnemies|EnemySpawner|setGameOver" assets/scripts/character/Soldier.ts assets/scripts/projectile/Arrow.ts assets/scripts/enemy/EnemyMinion.ts assets/scripts/enemy/EnemyBoss.ts assets/scripts/game/UltimateSystem.ts
```

MCP checks are N/A: this pure script/documentation task must not open/save scenes, assemble prefabs, call `create-prefab-from-node`, run post-scene processing, or run MCP gate.

## 回滚策略

Use the dirty baseline and reverse only this task's hunks in the five permitted scripts, `bugs.md`, harness, new OpenSpec delta, evidence and report. Never reset, checkout, stash-pop, reimport, or overwrite `Main.scene`, existing prefab/animation changes, pre-existing `UltimateSystem.ts` timing work, earlier `bugs.md` versions, or existing OpenSpec changes. On failure retain evidence, mark replan, and change only failed todos/AC and directly related new delta text.

## 修订记录

- v1（2026-09-12）：初始中任务计划；定义塔箭共享朝向/三层 fallback，以及最终清场无奖励死亡演出、once completion 和全量汇聚契约。

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
| OpenSpec change | `openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/` |

### 非 MCP 证据

| 指标 | 值 |
|---|---|
| dirty baseline | `git status --short` 摘要 |
| focused harness | exit code / assertion count / scenario count |
| TypeScript | exit code |
| OpenSpec strict | both change exit codes |
| diff and scope | exit code / allowed file list |
| bugs versions | v4 / v5 or not written on failure |
| AC-PLAY | run / not run（不阻塞） |
