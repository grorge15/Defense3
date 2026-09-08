---
slug: shared-path-agent
版本: 1
状态: draft
创建: 2026-09-08
---

# 共享 PathAgent 寻路移动

## 业务目标

给 boss、小怪、Soldier melee 和英雄接入共享 `PathAgent + 低频重算 + waypoint 跟随` 的类 AStar 寻路逻辑，让追击/跟随时能绕开 airWall 和静态阻挡物，并保留各单位现有索敌、攻击、分离、滚木挡穿、英雄停步出手和远程兵站桩语义。

本 plan 只规划后续 build，不实现代码；当前工作区有大量未提交改动，build-agent 必须增量处理，不得回退 unrelated dirty changes。

## OpenSpec 引用（有玩家可感知行为时必填；纯 MCP 装配整节删除）

- Change：`openspec/changes/shared-path-agent/`
- 勿在此复述 WHEN/THEN；行为以该目录 `specs/**` 为准。

## 风险等级

中。

影响 boss、小怪、英雄和 melee soldier 的每帧移动路径，但目标选择、攻击条件和碰撞特殊处理必须保持不变；`Soldier.ts`、`GameConfig.ts`、`EnemyMinion.ts` 等文件当前已有未提交改动，合并风险高于普通单文件改动。

## 禁做项（必填）

- 禁止修改 `assets/scenes/Main.scene` 或任何 `.prefab`；除非编译或编辑器导入确实缺少 Cocos 自动生成的 `.meta`，且需在报告说明原因。
- 禁止手写、整文件生成或重建 scene/prefab JSON；如后续意外改到 scene/prefab，必须按 MCP 流程保存、post-scene、gate。
- 禁止改攻击数值、血量、金币/经济、阶段切换、建造流程或刷怪规则。
- 禁止引入重型 navmesh、第三方寻路依赖或运行时资源加载来解决静态布局。
- 禁止让 ranged soldier 离开塔位追敌；本任务只允许 barracks/melee soldier 移动接入寻路。
- 禁止删除现有 `AirWallAabb` 特殊处理；失败/无路时应降级到现有 `steerDirection` 逻辑。
- 禁止重做 6.1 动画导入、攻击帧事件、动画 clip、prefab 绑定或视觉资源。
- 禁止回退 unrelated dirty changes，包括但不限于 6.1 动画/计划/报告、prefab、scene、`GameConfig.ts`、`EnemyMinion.ts`、`EnemySpawner.ts`、`Log.ts`、`bugs.md` 等当前未提交改动。
- 禁止新增 `*Controller.ts` 分裂对象主脚本职责；共享逻辑只能放在 core/system 类脚本。

## 变更文件清单

- 【可新建】`assets/scripts/core/PathAgent.ts` — 共享路径缓存、低频重算、waypoint 跟随、直线可达判断、A* 或 AABB 通道采样 fallback。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 追当前目标时调用 `PathAgent`，保留 aggro、屏障优先、peer/player 分离、滚木 sensor 挡穿和 `EnemyAI` 攻击路径。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — boss 追目标移动接入 `PathAgent`，保留索敌优先级、5s retarget、攻击范围和卡住侧向滑行兼容。
- 【可写】`assets/scripts/character/Hero.ts` — 跟随玩家 offset/leash 的移动接入 `PathAgent`，攻击期间继续停步远程出手。
- 【可写】`assets/scripts/character/Soldier.ts` — 仅 barracks/melee soldier 追最近敌人时接入 `PathAgent`；ranged/tower soldier 维持站桩远程攻击。
- 【可写】`assets/scripts/core/GameConfig.ts` — 仅新增或调整 path 重算间隔、grid/probe、最大节点数、waypoint 到达阈值等非战斗数值。
- 【可选可写】`tests/**` 或 `scripts/**` — 仅当仓库已有本地 TS/typecheck/test 入口且需要补轻量验证脚本时使用；不得引入新测试框架。
- 【仅只读参考】`assets/scripts/core/AirWallAabb.ts` — airWall BoxCollider2D 收集、AABB overlap、`steerDirection` 绕障兜底。
- 【仅只读参考】`assets/scripts/enemy/EnemyAI.ts` — 小怪攻击入口、命中时机和伤害结算。
- 【仅只读参考】`assets/scripts/character/Player.ts` — 英雄 follow 目标、玩家位置与战斗交互参考。
- 【仅只读参考】`assets/scripts/item/Log.ts` — 滚木 sensor 挡穿与碰撞行为参考。
- 【仅只读参考】`assets/scripts/building/Barrier.ts`、`assets/scripts/building/Building.ts`、`assets/scripts/building/Tower.ts`、`assets/scripts/building/Barracks.ts` — 可攻击目标、屏障/建筑、士兵来源与 tower/ranged 语义参考。
- 【仅只读参考】`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/cocos-mcp.mdc`、`.cursor/rules/openspec.mdc`、`AI_TASK_LIST.md` — 工作流、MCP 和行为规格约束。
- 【仅只读参考】`openspec/changes/shared-path-agent/` — 行为 AC 来源；build-agent 不应改 OpenSpec，除非 replan 要求同步 delta。

## To-dos（必填）

- [ ] `SPA.1`：Survey 当前 dirty worktree 和允许文件 diff；确认未提交改动来源，记录不得回退的文件列表。
- [ ] `SPA.2`：读取 `AirWallAabb.ts`、四个调用方和 `GameConfig.ts`，确认世界坐标轴、移动速度、攻击停步、目标有效性和现有 fallback 调用点。
- [ ] `SPA.3`：新建 `PathAgent.ts`，提供每单位可复用实例、缓存目标、低频 repath、waypoint 数组、直线可达检查、AABB/栅格 fallback 和现有 steering 降级。
- [ ] `SPA.4`：在 `GameConfig.ts` 增加 path 相关非战斗参数，避免在调用方散落魔法数。
- [ ] `SPA.5`：`EnemyMinion.ts` 接入 `PathAgent`，只替换追击移动向量来源；保留 aggro、屏障优先、分离、滚木挡穿、死亡/攻击逻辑。
- [ ] `SPA.6`：`EnemyBoss.ts` 接入 `PathAgent`，只替换追击移动向量来源；保留目标优先级、5s retarget、攻击条件、卡住侧滑兼容逻辑。
- [ ] `SPA.7`：`Hero.ts` 接入 `PathAgent`，只作用于 follow offset/leash 移动；远程攻击期间继续停住。
- [ ] `SPA.8`：`Soldier.ts` 接入 `PathAgent`，仅 melee/barracks 追最近敌人使用；显式确认 ranged/tower soldier 未出现追敌位移。
- [ ] `SPA.9`：做轻量性能/分配检查，确认路径数组/Vec 在对象内复用，逐帧只跟随当前 waypoint，不做每帧 full A*。
- [ ] `SPA.10`：运行项目既有 TypeScript 检查命令 `npx tsc --noEmit -p tsconfig.json`；若环境缺依赖或命令失败，记录完整错误并按实际原因处理。
- [ ] `SPA.11`：用 `rg` 验证四类调用方均引用或调用 `PathAgent`，并确认 ranged soldier 分支未接入 roaming path-follow。
- [ ] `SPA.12`：对照 OpenSpec 行为 AC 手测或列出 AC-PLAY 待用户项；报告说明 AC-PLAY 不阻塞 done。
- [ ] `SPA.13`：若未改 scene/prefab，跳过 MCP 表；若意外改过 scene/prefab，按 MCP 流程完成 save/post-scene/gate 并记录证据。
- [ ] `SPA.14`：写 `.cursor/plans/reports/shared-path-agent-report.md`，包含 dirty worktree 保护说明、PathAgent 参数、调用点、OpenSpec path 和验证命令输出。

> 同主题 MCP 合并本 plan；纯脚本 ≤2 文件走 goal-agent。本任务跨 5 个脚本且改玩家可见移动行为，已按 Plan-Build 处理。

## 实施步骤（可选）

1. S1: 前置调查。读取 git status、允许文件、当前移动逻辑和 OpenSpec change；报告中记录本次开始时 dirty 文件，不得用 reset/checkout 回退无关改动。
2. S2: 设计 `PathAgent` 数据流。以 world XY 作为 2D 寻路平面，缓存目标点和 waypoints；每个单位持有自己的 agent 状态；路径重算受 `GameConfig` 间隔和目标位移阈值限制。
3. S3: 实现路线生成。优先直线可达；不可达时使用栅格 A* fallback 或 AABB 通道采样，采样/网格尺寸、最大扩展节点、探测半径均读 `GameConfig`。
4. S4: 实现跟随与兜底。逐帧只朝当前 waypoint 移动；waypoint 到达后前进到下一点；无路径、超预算或目标不可达时返回现有 `AirWallAabb.steerDirection` 方向。
5. S5: 接入四类单位。只替换追击/跟随方向计算，不改攻击、死亡、伤害、索敌规则或动画事件；每个调用点保留目标为空/死亡/攻击中时的原有停步行为。
6. S6: 验证。按 `package.json` 可用脚本执行 TS 编译/类型检查；使用 `rg` 确认调用点；运行行为检查；确认没有 scene/prefab diff。

### MCP 流程（仅意外改过 prefab/scene 时启用）

1. 前置门：MCP `assets-query-path` 确认绑定 Defense3 工程。
2. 若必须创建 prefab：只能 `scene-open` → `scene-create-node-by-type` 搭树 → 设置组件/尺寸 → `create-prefab-from-node` → 删除临时节点；本 plan 默认不需要此步骤。
3. 若改 `Main.scene`：单次 open session 内完成所有变更，`scene-save` 一次，`scene-close`，运行 `powershell -File .cursor/scripts/post-scene-save.ps1`。
4. 若 `post-scene-save.ps1` 报 `Patched=1`：MCP `assets-reimport-asset`，重新 `scene-open`，再跑任务级 gate。
5. 任务末只跑一次 `powershell -File .cursor/scripts/verify-mcp-gate.ps1`，并补 AC-EDITOR-MCP 日志检查。

## 校验点

- [AC-OSPEC] `openspec/changes/shared-path-agent/proposal.md` 和 `openspec/changes/shared-path-agent/specs/path-agent/spec.md` 存在；plan 只引用 OpenSpec，不复述 scenario 作为实现 AC。
- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 退出码 0。
- [AC-PATHAGENT-FILE] `rg "class PathAgent|PathAgent" assets/scripts/core/PathAgent.ts` 有匹配。
- [AC-PATHAGENT-CONFIG] `rg "path|Path|repath|waypoint|grid|probe" assets/scripts/core/GameConfig.ts` 显示 path 相关非战斗配置。
- [AC-CALLERS] `rg "PathAgent" assets/scripts/enemy/EnemyMinion.ts assets/scripts/enemy/EnemyBoss.ts assets/scripts/character/Hero.ts assets/scripts/character/Soldier.ts` 四类调用方均有匹配。
- [AC-RANGED-SOLDIER] `Soldier.ts` diff 或代码检查显示 ranged/tower soldier 仍站桩远程攻击，未被改为追敌 path-follow。
- [AC-MINION-PRESERVE] `EnemyMinion.ts` diff 或代码检查显示 aggro、屏障优先、分离、滚木 sensor 挡穿和 `EnemyAI.beginAttack/applyAttackDamage` 路径仍存在。
- [AC-BOSS-PRESERVE] `EnemyBoss.ts` diff 或代码检查显示目标优先级、retarget cadence、攻击范围和攻击帧事件仍存在。
- [AC-HERO-PRESERVE] `Hero.ts` diff 或代码检查显示 follow offset/leash 和攻击停步仍存在。
- [AC-PERF] 代码检查确认 full path 重算不在每帧无条件执行，waypoint/Vec/数组尽量由对象成员复用。
- [AC-SCOPE] `git diff --name-only` 只包含允许文件和必要自动 `.meta`；不得包含 `Main.scene` 或 `.prefab`，除非报告解释并跑 MCP gate。
- [AC-PLAY] 对照 `openspec/changes/shared-path-agent/specs/path-agent/spec.md` 做玩法检查；AC-PLAY 可作为手测证据，不阻塞机器 done。

### MCP（改过 prefab/scene 时，任务末一次）

- 默认跳过：本 plan 预期纯脚本改动，不改 prefab/scene。
- [AC-GATE] 如实际改过 prefab/scene：`powershell -File .cursor/scripts/verify-mcp-gate.ps1` exit 0。
- [AC-P3] 如实际新建/改过 prefab：MCP `assets-query-asset-info` 显示目标 prefab `invalid: false`。
- [AC-EDITOR-MCP] 如实际改过 `Main.scene` 或 prefab：MCP open 目标资源并检查 error 日志无由本资源产生的红错/missing script。

### 条件 / 不阻塞

- [AC-P3b] / [AC-S2] 仅在实际改过 prefab 关键引用或 scene 且触发 `_id` patch/reimport 时执行。
- [AC-PLAY] 对照 OpenSpec scenarios — 不阻塞 done，但报告必须列出已测/未测项。

## 回滚策略

- 脚本回滚：只回退本任务对 `assets/scripts/core/PathAgent.ts`、允许调用方和 `GameConfig.ts` 的增量改动；不得回退任务开始前已存在的 dirty changes。
- 若 `PathAgent.ts` 新增后失败且无法修复：删除新文件并撤销四类调用点的接入增量，恢复到现有 `AirWallAabb.steerDirection` 路径。
- 若意外产生 scene/prefab diff：优先确认是否由 Cocos 自动导入造成；未经用户确认不得手动重写 JSON，必要时走 replan 或 MCP gate 后报告。

## 修订记录

- v1（2026-09-08）：初始计划；创建 OpenSpec change；范围限定为共享寻路脚本和四类单位接入，不改 scene/prefab。

---

## 执行报告须含（build-agent）

- Dirty worktree 保护说明：开始时 `git status --short` 摘要、哪些 dirty 文件被保留、哪些文件是本任务增量。
- `PathAgent` 参数说明：repath interval、目标位移阈值、grid/probe、最大节点/预算、waypoint 到达阈值、fallback 条件。
- 调用点说明：`EnemyMinion.ts`、`EnemyBoss.ts`、`Hero.ts`、`Soldier.ts` 各自接入位置和保留的旧语义。
- OpenSpec path：`openspec/changes/shared-path-agent/`。
- 验证命令输出：编译/类型检查、`rg` 调用点检查、scope diff 检查；如跳过命令需说明仓库缺少脚本或环境原因。
- 如未改 scene/prefab：明确写 MCP 表跳过。若实际改过 scene/prefab：粘贴 MCP gate、post-scene、editor log 证据。

### MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| verify-mcp-gate | |
| post-scene-save Patched | 0/1 或 skipped |
| assets-reimport-asset | |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/shared-path-agent/` |
