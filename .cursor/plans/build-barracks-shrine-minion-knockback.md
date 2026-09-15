---
slug: build-barracks-shrine-minion-knockback
版本: 1
状态: draft
创建: 2026-09-15
---

# 兵营与英雄碑建成击退附近小怪

## 业务目标

Barracks 或 HeroShrine 生成时，对其自身碰撞范围附近、但未与建筑碰撞范围重叠的存活活动 EnemyMinion 执行一次短暂向外击退。范围按实际生成建筑的 collider bounds 外扩配置 padding 计算，以适配不同建筑尺寸；Boss 不参与。

## OpenSpec 引用

- Change：`openspec/changes/build-barracks-shrine-minion-knockback/`
- 行为规格以该 change 的 `specs/construction-minion-knockback/spec.md` 为准；本计划不复述 WHEN/THEN。

## 风险等级

中：新建筑生成、动态刚体速度、攻击回调与共享导航可能在相邻帧相遇；击退必须仅覆盖短时运动状态，并在结束后恢复已有导航。

## 禁做项

- 禁止修改 `assets/scenes/Main.scene`、任何 `.prefab`、`.meta`、场景坐标、Inspector 绑定、物理层或碰撞矩阵；禁止调用 Cocos MCP 做场景或 prefab 操作。
- 禁止对 EnemyBoss、死亡、非 `activeInHierarchy` 的 EnemyMinion，或 collider 与新建筑 collider 重叠的 EnemyMinion 施加击退；用户明确排除建筑 collider 内的小怪。
- 禁止把范围写成固定建筑半径、节点坐标或 prefab 专属尺寸；必须从本次生成的 Barracks/HeroShrine 有效 collider 的 `worldAABB` 外扩 `GameConfig` padding 推导。
- 禁止每帧扫描、持续光环、重复 schedule、传送、伤害、死亡/回收、重生、改目标优先级、改建造解锁/费用/出兵/Boss 生成顺序，或改导航障碍定义。
- 禁止新增 `EnemyMinionController.ts`、`BuildSystem` 平行控制器、通用物理系统或新资源；复用 `EnemyMinion` 作为唯一小怪移动入口。
- 禁止覆盖、回退或格式化现有脏工作区内容。尤其保留当前 `BuildSystem.ts`、`EnemyMinion.ts`、`GameConfig.ts`、`Main.scene` 与 `bugs.md` 的并行改动；只编辑本计划允许的 task-owned hunks。
- 禁止手写 scene/prefab JSON，或用测试文本匹配替代实际 TypeScript 行为测试。

## 变更文件清单

- 【可写】`assets/scripts/building/BuildSystem.ts` — 仅在 `_spawnBarracks` 与 `_spawnHeroShrine` 成功生成、激活及既有导航失效编排后，调用一次共享的建筑碰撞范围筛选与 EnemyMinion 击退入口。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 增加受限公开击退接口和短时移动 override；取消旧攻击瞬态、写入正确物理速度，并在结束时清理 override、复位导航瞬态以恢复既有追击。
- 【可写】`assets/scripts/core/GameConfig.ts` — 仅增加 construction knockback 的 padding、速度与持续时长常量，禁止散落玩法数值。
- 【可新建】`.cursor/scripts/test-build-barracks-shrine-minion-knockback.cjs` — 加载真实 TypeScript 的 Cocos mock harness，验证建造筛选与 Minion 生命周期；不得写入资源或场景。
- 【可新建】`openspec/changes/build-barracks-shrine-minion-knockback/proposal.md` — `defense3-lite` 行为变更说明。
- 【可新建】`openspec/changes/build-barracks-shrine-minion-knockback/specs/construction-minion-knockback/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/plans/reports/build-barracks-shrine-minion-knockback-report.md` — build-agent 执行结果、验证摘要、任务归属 diff 与 MCP 指标。
- 【仅只读参考】`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,cocos-mcp,openspec}.mdc`、`AI_TASK_LIST.md`、`.cursor/plans/_TEMPLATE.md` — 路由、约束与计划模板。
- 【仅只读参考】`assets/scripts/building/{Barracks,HeroShrine,Building,BuildPlot}.ts`、`assets/scripts/core/{EnemyNavigation,GameEvents}.ts`、`assets/scripts/enemy/{EnemyBoss,EnemyAI,EnemySpawner}.ts` — 复用既有生命周期；不得改动。
- 【仅只读参考】`assets/resources/prefabs/building/{pref_barracks,pref_hero_shrine}.prefab`、`assets/resources/prefabs/character/enemy/pref_enemy_minion.prefab`、`assets/scenes/Main.scene` — 仅核对 collider 与现有装配，不得写入。

## To-dos

- [ ] `BMSMK.1`：开始前记录 git status 和本计划三个共享脚本的任务前 diff；复读引用 OpenSpec、BuildSystem 的两条 spawn 路径、EnemyMinion 的攻击 generation/刚体/导航生命周期与实际 prefab collider。若 Barracks 或 HeroShrine 缺少可用 active collider，停止并报告，不以固定半径或资源改动兜底。
- [ ] `BMSMK.2`：在 `GameConfig` 集中增加 padding、击退速度、击退时长三个 tunable；在 `EnemyMinion` 增加只接受有效外推方向的公共 construction-knockback 接口。接口须拒绝死/非活动单位，清除旧攻击 generation、攻击状态、速度与短暂导航所有权，并以既有速度单位转换写入刚体；override 结束后清零速度、重置单位导航状态，让下一次既有 update 恢复追击。
- [ ] `BMSMK.3`：在 `BuildSystem` 形成一个聚焦共享 helper，由已生成建筑的 active non-sensor `BoxCollider2D.worldAABB` 得到建筑 bounds 和 padding 外扩候选范围。它仅枚举 active living EnemyMinion，先排除其实际 collider AABB 与建筑 AABB 重叠者，再以候选范围筛选、从建筑中心向小怪 collider 中心计算外推方向并调用公开接口；不扫描或影响 EnemyBoss。两个指定 spawn 路径各在一次成功构造后调用一次，且不对其他建筑接线。
- [ ] `BMSMK.4`：新增真实脚本 harness，构造不同大小的 Barracks/HeroShrine colliders，验证两条 spawn 调用、bounds-plus-padding 选择、向外速度、一次性 override、攻击/导航清理及结束恢复；覆盖 inside-overlap skip、边界外 skip、死/停用 minion skip、EnemyBoss 不受影响、无有效建筑 collider 安全 no-op 与 `GameConfig` 常量使用。
- [ ] `BMSMK.5`：运行 TypeScript、专项 harness、OpenSpec 严格验证和 diff 检查。所有机器 AC 通过后写报告；这是功能工作而非 bug fix，不更新 `bugs.md`。保留 AC-PLAY 为不阻塞手测。

> 本任务涉及三个共享运行时模块、玩家可见建造反馈与真实脚本测试，因此采用 Plan-Build；不适用纯脚本两文件的 `goal-agent` 路由。

## 实施步骤

1. `S1`：以 `BuildSystem` 的当前 `_instantiateAt` 和两个目标 spawn 完成点为唯一编排入口。生成节点、组件、有效 collider 或 scene 无效时安全 no-op；不得添加 serialized `@property` 或改变已存在调用顺序之外的建造副作用。
2. `S2`：共享 helper 获取新建筑的 collider bounds，以 `GameConfig` padding 得到扫描 bounds。Minion collider 必须存在、有效、已启用；实际 AABB 与建筑 AABB 有重叠的候选立即跳过，随后再判断是否落在 padding 区域。方向来自两 AABB 中心的 outward vector，避免按根节点/固定资源尺寸判断。
3. `S3`：`EnemyMinion` 以定时短期 velocity override 优先于正常 `_updateMovement` 写入线速度。开始时使旧攻击异步命中失效并清掉当前 transient navigation velocity；结束时只移除该 override、清零残余速度并 reset unit navigation，保留生命值、目标引用、对象池 generation、碰撞配置及所有普通移动/攻击数值。
4. `S4`：专项 test 从源码 transpile 并实例化实际 `BuildSystem`/`EnemyMinion`，使用 mock colliders/rigidbodies 验证边界，不依赖 grep。测试不得写入证据目录或改变全局配置。

## 校验点

- [AC-1] Barracks 与 HeroShrine 各自在成功 spawn 后仅触发一次 task helper；Tower、Wall、Barrier、advanced tower、expand flow 和 Boss spawn 不调用它。
- [AC-2] 选择区域随每个实际 spawned building collider `worldAABB` 和 `GameConfig` padding 改变；无有效 active non-sensor building collider 时 no-op，不以固定距离替代。
- [AC-3] 仅 active living EnemyMinion 且其 collider AABB 位于 padding 范围、并且不与建筑 collider AABB 重叠时获得 outward knockback；EnemyBoss、死亡/停用/边界外 Minion 和建筑 collider 内 Minion 均保持不变。
- [AC-4] 合格 Minion 在配置时间内只接受一次短期 knockback velocity override；开始时旧攻击/导航瞬态不能继续，结束后速度清零、导航重置并由原有目标和 update 恢复普通追击。生命值、目标、碰撞、对象池与普通数值保持。
- [AC-5] 全部新增玩法 tunable 仅定义于 `GameConfig`；无 magic padding、速度或时长，无 `Main.scene`、Prefab、Meta、Inspector 或 MCP 资产改动。
- [AC-TSC] `npx tsc --noEmit --pretty false` 退出码为 0。
- [AC-REGRESSION] `node .cursor/scripts/test-build-barracks-shrine-minion-knockback.cjs` 退出码为 0，并覆盖 AC-1 至 AC-4 的确定性分支。
- [AC-OPENSPEC] `npx openspec validate build-barracks-shrine-minion-knockback --strict` 退出码为 0。
- [AC-DIFF] `git diff --check` 退出码为 0；任务 diff 只包含计划允许清单中的 task-owned hunks，既有共享文件并行改动未被覆盖。

### MCP（本任务不改 prefab/scene）

- MCP 会话、`scene-save`、`verify-mcp-gate.ps1`、`post-scene-save.ps1`、`assets-reimport-asset` 均不执行；本任务不适用 AC-GATE、AC-P3、AC-EDITOR-MCP。

### 条件 / 不阻塞

- [AC-PLAY] 在 Creator 中分别完成 Barracks 与 HeroShrine 建造：确认仅建筑 collider 外侧 padding 区的活跃小怪向外短暂击退、建筑 collider 内小怪不受影响、Boss 不动，且击退结束后小怪继续按原目标追击。此项不阻塞 done。

## 回滚策略

只回滚 `BuildSystem.ts`、`EnemyMinion.ts`、`GameConfig.ts` 中本任务归属 hunks，以及本任务新增 test、OpenSpec、plan/report；绝不 reset 整个 worktree 或撤销并行用户修改。若有效 building collider 不存在、专项测试显示 velocity 单位/导航恢复不安全，移除 task hunks并保留原建造行为，记录证据后进入 replan；不以 scene/prefab 改动或固定坐标替代。

## 修订记录

- v1（2026-09-15）：初始计划；仅覆盖 Barracks/HeroShrine spawn 的一次性 size-aware Minion 击退，明确排除已在建筑 collider 内的小怪。

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
| OpenSpec change | `openspec/changes/build-barracks-shrine-minion-knockback/` |
