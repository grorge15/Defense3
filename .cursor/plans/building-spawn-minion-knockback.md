---
slug: building-spawn-minion-knockback
版本: 3
状态: replan
创建: 2026-09-15
---

# 建筑生成小怪击退

## 业务目标
兵营或英雄召唤碑成功生成并激活后，立即对同一场景内、靠近新建筑的存活小怪施加一次短暂、递减的径向击退。击退仅通过小怪现有 Dynamic `RigidBody2D` 速度生效，临时压过导航写入；不伤害敌人、不移动 Boss，也不处理建造瞬间已经嵌入建筑碰撞器的小怪。

## OpenSpec 引用
- Change：`openspec/changes/building-spawn-minion-knockback/`
- 行为语义以该 change 的 `proposal.md` 与 `specs/**` 为准；本计划不重复 WHEN/THEN。

## 风险等级
中。该改动连接建造实例化、同场景筛选、二维碰撞 AABB、导航速度写入与对象池生命周期；错误的优先级或清理会造成击退失效、持续移动或复用对象被旧状态影响。

## 已核实接入点
- `BuildSystem._spawnBarracks` 和 `_spawnHeroShrine` 均在实例化后调用各自组件的 `activate()`；击退须同步放在成功激活之后，且早于后续导航失效处理。
- `EnemyMinion` 是 Dynamic `RigidBody2D`；普通移动最终由 `_applyNavigationVelocity()` 经 `EnemyNavigation.writePhysicsVelocity()` 写入，无导航时直接写 `linearVelocity`。
- `EnemyMinion` 已用 `_isDead`、`activeInHierarchy`、`_lifeGeneration`、`reset()`、`onDisable()`、`_die()` 处理死亡与对象池复用，可在这些边界清除临时状态。
- `BuildSystem` 已从 `node.scene` 收集敌人；仅收集 `EnemyMinion` 可自然排除 Boss。

## 禁做项
- 不修改 `Main.scene`、任何 prefab、动画、美术、材质、`.meta`、Inspector 绑定或节点坐标。本任务 MCP 装配为零，禁止 `scene-open`、`scene-save`、`create-prefab-from-node`、`assets-refresh`、`assets-reimport-asset`。
- 不使用 `setWorldPosition`、`setPosition`、传送、直接坐标校正或 AABB 推出；击退只能走小怪既有 Dynamic `RigidBody2D` 速度通路。
- 不处理生成时与建筑 collider 严格相交的小怪；不尝试脱嵌、修正重叠或推离该类对象。
- 不影响 `EnemyBoss`、玩家、英雄、友军、建筑血量、伤害、攻击、目标选择、对象池容量或寻路几何版本策略。
- 不增加每帧场景扫描；扫描仅发生于两种建筑成功生成并激活时。不得增加循环导入。
- 不散落数值；范围余量、初始速度、持续时间和衰减口径统一在 `GameConfig`。
- 不撤销或覆盖已有脏修改；若接入点与本计划不符，停止并 replan。

## 变更文件清单
- 【可写】`assets/scripts/building/BuildSystem.ts` — 两个成功生成+激活边界调用同一私有收集/分发逻辑；读取建筑 collider AABB 或 root 世界中心，筛选同场景有效小怪。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 窄的击退接收 API；移动速度仲裁；死亡、禁用、重置/复用清理。
- 【可写】`assets/scripts/core/GameConfig.ts` — 范围余量、速度、持续时间和衰减参数。
- 【可写】`bugs.md` — 仅在全部机器校验通过后检索同题并按一问题一条记录；已有同题则追加版本。
- 【可写】`.cursor/plans/building-spawn-minion-knockback.md` — 仅记录本次 replan 的失败门禁修复与结果，不扩大范围。
- 【可写】`.cursor/scripts/test-expand-enemy-clear-area.cjs` — 仅为已基线存在的 `../core/AudioManager` 导入补充最小 mock/module-loader 条目；不得改场景替身、断言语义、测试场景或生产代码。
- 【可写】`openspec/changes/building-spawn-minion-knockback/proposal.md`、`openspec/changes/building-spawn-minion-knockback/specs/building-spawn-minion-knockback/spec.md` — 仅在需求变更/replan 时同步。
- 【可新建】`.cursor/scripts/test-building-spawn-minion-knockback.cjs` — 最小 Cocos 替身加载真实 TypeScript 模块，验证行为与生命周期，不得只断言源码文本。
- 【可新建】`.cursor/plans/reports/building-spawn-minion-knockback-report.md` — 机器结果、AC、脏工作区归属、未做手测与 MCP 指标。
- 【仅只读参考】`assets/scripts/building/Barracks.ts`、`assets/scripts/building/HeroShrine.ts`、`assets/scripts/enemy/EnemyBoss.ts`、`assets/scripts/core/EnemyNavigation.ts`、`assets/scripts/core/FlowField.ts`、`assets/scripts/core/AirWallAabb.ts`。
- 【仅只读参考】`.cursor/scripts/test-parkour-log-physics-driver.cjs`、`.cursor/scripts/test-barracks-boss-hit-feedback.cjs`、相关 OpenSpec/report。
- 【仅只读参考】`assets/scenes/Main.scene`、`assets/resources/prefabs/building/pref_barracks.prefab`、`assets/resources/prefabs/building/pref_hero_shrine.prefab`、`assets/resources/prefabs/enemy/pref_enemy_minion.prefab` — 仅核对 collider，禁止写入。

## To-dos
- [x] T1：读取本计划、OpenSpec、相关报告、`bugs.md` 与 git 状态，记录脏工作区基线；确认 spawn 方法、`EnemyMinion` 速度出口与配置位置仍符合。续跑从首个未完成项开始。
- [x] T2：在 `GameConfig` 新增建筑生成击退参数：建筑 AABB 外扩余量、初始击退速度、短持续时间和单调递减口径。参数与 `EnemyNavigation` 世界/物理速度换算一致，逻辑不得写默认魔法数。
- [x] T3：为 `EnemyMinion` 增加公共窄 API，接收已计算的二维外推方向；拒绝无效、非 active、死亡、无 Dynamic 刚体、零长度或非有限输入。状态绑定当前生命周期代数；重复触发以最新方向和完整窗口安全刷新，不无限叠加。每次已接受脉冲恰触发一次既有 `HitFlash.flash(this.visualNode ?? this.node)` 红色受击反馈。
- [x] T4：把击退接入小怪移动决策：有效窗口内每帧计算递减速度并写入同一 `RigidBody2D` 物理速度通路，优先正常导航和无导航 `linearVelocity` 写入；朝向/行走表现匹配实际击退速度。窗口结束后立即恢复原导航控制。
- [x] T5：在 `_die()`、`onDisable()`、`reset()`/对象池复用时清除击退状态及速度；生命周期变化后的旧帧/回调不得继续写刚体。保留攻击、HP、reservation、对象池和滚木接触行为。
- [x] T6：在 `BuildSystem` 提取仅生成时调用的私有帮助逻辑。对刚成功激活的 barracks/shrine，从有效启用 collider AABB 取得中心和范围；无 collider 时回退 root 世界中心与配置回退范围。仅扫描该实例 `node.scene` 的 `activeInHierarchy && !isDead` `EnemyMinion`，要求小怪 collider 有效、中心落入建筑 AABB 外扩范围，并排除与建筑 AABB 严格相交的初始嵌入小怪。其余对象按建筑中心到小怪 collider/world 中心的单位径向方向调用 API；零向量和无效 AABB 无操作。
- [x] T7：在两条 spawn 路径将帮助逻辑置于成功 `instantiate` 且完成 `Barracks.activate()` / `HeroShrine.activate()` 后同步执行一次；不得在 `_onBuildComplete`、重复事件、延迟回调或每帧重复触发。保留 Boss 注册/首次生成、英雄选择初始化与导航失效的既有语义。
- [x] T8：新增 focused harness，加载真实 `BuildSystem`/`EnemyMinion`，覆盖两类建筑各触发一次、same-scene/live/active 筛选、范围余量、AABB 中心/root 回退、径向方向、严格嵌入跳过、Boss 排除、零/无效 collider、无伤害/无 transform 写入、导航优先级、递减/恢复、重复刷新、死亡/disable/pool reset 清理，以及每个接受脉冲恰一次既有红色 HitFlash。测试观测刚体速度、HitFlash 与调用次数，不能只匹配字符串。
- [ ] T9：仅在 `.cursor/scripts/test-expand-enemy-clear-area.cjs` 的 mock/module loader 中，为已基线存在的 `EnemyMinion.ts` `../core/AudioManager` 导入提供最小无副作用 `AudioManager` mock（含静态 `playSfx()` no-op）。不得改 production 文件、既有场景替身、断言、测试场景或行为语义；先单独重跑该 harness，确认从模块加载进入既有 scenarios。
- [ ] T10：在 T9 通过后，严格依序运行 focused harness、受影响既有 build/physics regressions、TypeScript、OpenSpec strict、差异检查。全部机器 AC 通过后更新 `bugs.md` 并写报告；Creator AC-PLAY 仅补充，未运行不得声称通过。若任一门禁失败，记录首个失败命令和输出摘要后停止，不修改已完成 T1-T8 或游戏实现。

## 校验点
- [AC-1] 每次 barracks 或 hero shrine 成功实例化并激活，恰在该 spawn 方法内同步触发一次候选扫描；失败实例化、缺失/失效建筑组件、无 scene 无副作用。两类建筑共用帮助逻辑。
- [AC-2] 只有同一 scene、`activeInHierarchy`、存活、collider 有效的 `EnemyMinion` 会进入判定；`EnemyBoss` 和其他对象绝不接收击退。建筑 collider AABB 外扩余量决定区域；无 collider 时使用 root 世界中心的配置回退范围。
- [AC-3] 与建筑 collider AABB 严格相交的初始嵌入小怪不动；AABB 仅接触边界不视作嵌入。零径向、无效/零尺寸 AABB、无刚体、非有限输入无操作。
- [AC-4] 有效小怪以建筑中心向外的单位方向获得短暂、单调递减的 Dynamic `RigidBody2D` 速度；期间导航/普通速度不可覆盖，结束后回归导航。每次接受脉冲恰触发一次既有红色 HitFlash。没有 HP、伤害、攻击目标、导航几何失效副作用，也没有 `setWorldPosition`/`setPosition`。
- [AC-5] 第二次有效脉冲刷新方向与完整时长且速度有上界；死亡、禁用、pool reset 后状态清除，旧生命周期不会推动复用对象。
- [AC-CHECK] T9 后，`node .cursor/scripts/test-expand-enemy-clear-area.cjs` 必须进入并通过其既有 scenarios（不得再因 `Unmocked import ../core/AudioManager` 失败）。随后严格依序执行 `node .cursor/scripts/test-building-spawn-minion-knockback.cjs`、`node .cursor/scripts/test-expand-enemy-clear-area.cjs`、`node .cursor/scripts/test-parkour-log-physics-driver.cjs`、`node .cursor/scripts/test-barracks-boss-hit-feedback.cjs`、`npx --no-install tsc --noEmit --pretty false`、`npx openspec validate building-spawn-minion-knockback --type change --strict --no-interactive`、`git diff --check`，均退出 0。依赖不可用时报告须区分环境阻塞与新增失败，禁止下载依赖或改编译配置。
- [AC-PLAY] 在 Creator 分别建造兵营和英雄碑：邻近非嵌入小怪仅被推离一次且快速恢复追击；Boss 不动，嵌入小怪不被纠正，重复建造刷新而非永久加速。该项不阻塞 done。
- 纯脚本文档任务：MCP 前置门、`create-prefab-from-node`、`scene-save`、`post-scene-save.ps1`、`verify-mcp-gate.ps1`、AC-P3、AC-EDITOR-MCP 均不适用。若发现必须改 prefab/scene，立即停止并 replan；不得绕过 MCP 或手写资源。

## 回滚策略
以 T1 工作区差异为基线，仅撤销本任务新增的 `BuildSystem`、`EnemyMinion`、`GameConfig`、focused harness、OpenSpec、`bugs.md` 条目和报告改动；不使用 `git reset --hard`、整文件 checkout 或覆盖其他任务修改。若范围、嵌入判定或速度单位口径变化，先修订本计划与 OpenSpec，版本加一，只调整未通过 todo/AC 并保留已通过证据。

## 修订记录
- v3（2026-09-15）：仅解除已基线 `EnemyMinion` 的 `../core/AudioManager` 导入造成的既有扩展回归 harness loader 阻塞。允许最小无副作用 mock，并将 T9 拆为 loader 修复与严格有序的机器门禁续跑；T1-T8、已接受行为 AC、游戏实现范围和 OpenSpec 均不变。
- v2（2026-09-15）：用户追加已接受建筑生成击退时一次既有红色 HitFlash；不新增资源、Prefab 或场景改动，并将其纳入 API、focused harness 与 AC-4。
- v1（2026-09-15）：初始 draft。范围限定为 barracks/hero shrine 成功生成后的同场景 minion 单次速度击退；明确不处理初始 collider 嵌入、不影响 Boss、不用 transform，且不改资源。

---

## 执行报告须含（build-agent）
- 完成 todo、每项 AC、验证命令及输出摘要、现有脏修改与本任务改动归属。
- 击退配置值、速度换算、strict-overlap 排除、重复刷新/对象池清理的测试证据。
- `bugs.md` 新增或版本化条目位置；任何未运行机器检查的具体原因。

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | 待填 |
| OpenSpec change | `openspec/changes/building-spawn-minion-knockback/` |
