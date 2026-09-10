---
slug: fix-enemy-pursuit-demolition
版本: 1
状态: done
创建: 2026-09-10
---

# 修复敌人移动追踪与路径拆障

## 业务目标

消除 player 持续移动时敌人因新流场 pending 而反复停步的问题。把可拆 Log 和现有受支持的 Destructible 从“无路时才拆”的备选行为，改为“出现在已选 Hard-safe 路线时优先拆除”的执行行为，同时持续保留真实碰撞和 Hard 障碍绕行。

## OpenSpec 引用

- Change：`openspec/changes/fix-enemy-pursuit-demolition/`
- 行为语义以该 change 的 `specs/**` 为准；本计划不复述 WHEN/THEN。

## 风险等级

高。该变更同时影响共享 field 的持有/失效、移动目标调度、可拆障碍选择、Minion/Boss 临时目标和碰撞安全；不得回退已验收的 30-cell、4096 work units/frame、缓存容量和攻击生命周期保护。

## 已核实基线

- `EnemyNavigation.nextVelocity` 在新目标 field 尚未完成时把 `FlowField.direction(...).blocked` 直接输出零速度，并在目标跨 cell 后释放先前 field；这使持续移动的 player 可以持续生成未完成替换工作。
- `EnemyNavigation.blockingObstacle` 先在完整物理障碍图中证明 normal route 不可达，只有该结果为 false 才逐候选忽略 Destructible。因此“存在绕路”会压制固定 Log 拆除，和本次已授权行为冲突。
- `FlowField` 已具备 current-revision atomic publication、pending tri-state、body/area-key cache 和固定共享 scheduler。`EnemyNavigation` 已有实际碰撞 sweep、合法攻击表面、临时障碍路由和 Minion/Boss 原目标恢复路径，必须复用这些边界而非另建寻路或攻击系统。
- `enemy-unified-navigation` 与 `enemy-break-blocking-log` 已完成，但其“normal route/alternate gap prevents demolition”规格已由本次 OpenSpec 明确取代；历史 plan/report 保留为证据，不重写。
- 当前仅有用户的 `pref_hero_01.prefab` 与 `pref_hero_02.prefab` 修改；本任务不可读取后写回、重置或纳入范围。

## 禁做项

- 禁止改动 `assets/scenes/Main.scene`、任何 prefab、`.meta`、资源、动画、坐标、Inspector 引用、碰撞层/尺寸、伤害值、目标优先级、攻击帧、对象池规则或 `GameConfig` 的已接受导航预算与容量。
- 禁止启动 Cocos MCP 写链；不得执行 scene-open/save、create-prefab-from-node、post-scene-save、assets-refresh/reimport 或 verify-mcp-gate。本任务无场景或 prefab 修改。
- 禁止手写或替换 prefab/scene JSON，禁止触碰用户的两个 Hero prefab 及任何已有未关联修改。
- 禁止将 Destructible 从真实 `_area`/physics/sweep/attack LOS 中删除，禁止穿过未摧毁的 Log，禁止攻击 Hard、Ignore、失效、移动、失败、无 damage adapter 或无合法表面的对象。
- 禁止以“存在物理绕路”为由覆盖 selected-route demolition；也禁止让规划视图绕过 Hard 墙、地面边界或非 Destructible 障碍。
- 禁止同步 BFS/A*、每只敌人或每帧全场扫描/逐障碍重建、无界缓存/队列、旧 geometry revision route、partial field 或以直追/传送掩盖 pending。
- 禁止改变 `enemyFlowCellSize=30`、`enemyNavWorkUnitsPerFrame=4096`、32-entry、8-MiB、262144-cell 上限，或弱化既有安全、生命周期和性能断言。需要新数值/额外模块/资源改动时停止并 replan。
- 禁止改写已完成 plan/report 或删改其 evidence；本轮只新建自己的 report/evidence，`bugs.md` 只在所有机器 AC 通过后追加现有导航条目的 v6。

## 变更文件清单

### 可写

- `assets/scripts/core/FlowField.ts` — 在保留 field 的基础上提供按已结算 field 安全取向、受控 replacement/job 取消或合并所需的最小接口；保持 atomic publish、LRU 和 byte/cell accounting。
- `assets/scripts/core/EnemyNavigation.ts` — 保存每 unit 的 active/pending 路线状态、target update 合并、current-geometry safety validation、Hard-only planning area、selected-leg first blocker 选择与现有 surface route 衔接。
- `.cursor/scripts/test-enemy-navigation.cjs` — 增加真实 FlowField/EnemyNavigation moving-target pending、route retention、geometry invalidation、coalescing/cap/cache 断言。
- `.cursor/scripts/test-enemy-break-blocking-log.cjs` — 将“alternate path keeps original target”旧断言替换为 selected-route demolition，并覆盖 Minion/Boss、连续 blocker、Hard 绕行、真实 collider 和恢复原目标。
- `bugs.md` — 机器 AC 通过后，仅在现有 `fix-path-agent-frame-drop` 条目下追加 v6：两项现象、共同根因与解决。
- `.cursor/plans/fix-enemy-pursuit-demolition.md` — 更新 todo/AC/状态与修订记录。
- `.cursor/plans/reports/fix-enemy-pursuit-demolition-report.md` — build 完成或硬阻塞时写入范围、命令结果、行为证据、残余风险和 MCP 指标。
- `openspec/changes/fix-enemy-pursuit-demolition/{proposal.md,specs/enemy-pursuit-demolition/spec.md}` — 仅在 replan 需要时同步本轮 delta。

### 可新建

- `.cursor/plans/reports/fix-enemy-pursuit-demolition-evidence/` — 当前工作区快照、task-only diff、命令输出、route/scheduler/cache traces、source/harness hashes。

### 仅只读参考

- `AGENTS.md`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,openspec,cocos-mcp}.mdc`、`AI_TASK_LIST.md`、`.cursor/plans/_TEMPLATE.md`、`defense3.md`。
- `assets/scripts/enemy/{EnemyMinion,EnemyBoss,EnemyAI,EnemySpawner}.ts`、`assets/scripts/item/Log.ts`、`assets/scripts/core/{GameConfig,NavigationObstacle,GameEvents,AirWallAabb}.ts`、`assets/scripts/building/{Building,Barrier,Wall,Tower,Barracks}.ts`。
- `assets/scenes/Main.scene`、所有 prefab/meta/assets、当前 Hero prefab 脏修改。
- `.cursor/plans/{enemy-unified-navigation,enemy-break-blocking-log,fix-enemy-navigation-performance,fix-enemy-navigation-rebuild-stalls}.md` 及相应 reports/evidence；`openspec/changes/{enemy-unified-navigation,enemy-break-blocking-log,fix-enemy-navigation-rebuild-stalls}/`。
- `.cursor/scripts/bench-enemy-navigation.cjs` — 可执行回归基准，不修改。

## To-dos

- [x] EPD.a：记录启动 commit、`git status --short`、允许写入列表、用户 Hero prefab 哈希以及 FlowField/EnemyNavigation/两份 harness 的基线副本。确认不修改场景、资源或外部脏文件；在 evidence 中记录已验收的 30/4096/32/8MiB/262144 限制。
- [x] EPD.b：为每个 unit 设计 active settled route 与 candidate replacement 的显式状态。请求新目标时保留可安全消费的已结算 field；仅按现有 flow-cell 量化目标更新并合并同一 current-revision/body/target replacement。替换 pending、settled/unreachable、过期和释放必须可观察，不能把 pending 写为 no-route。
- [x] EPD.c：扩展 FlowField 的最小只读 settled-field direction/identity API，使 EnemyNavigation 能从当前 position 使用 active field，并在每次输出前按完整 current physical area 执行 point/line/sweep/ground 验证。若 target 无效、field 已过期、下一步不安全或无 direct current-safe 选择，清理引用并停步；geometry revision、target reassignment、reset/release/destroy 必须释放 active 与 pending ownership。
- [x] EPD.d：在 EnemyNavigation 维护稳定的 Hard-only planning area：保留 walkable ground、bounds、Hard 与不支持/失效障碍，排除仅有有效 damage adapter 的活跃 Destructible，并让 area key/version 在任一相关分类、生命周期或几何变化时原子失效。复用现有共享 scheduler/cache；不得每个查询临时分配匿名 area 或在 request 内完成工作。
- [x] EPD.e：用 planning area 得到 selected route/next leg，再用完整 physical area 做 segment intersection 与实际 body-expanded collider 判定。选择该 leg 上首先相交的有效 Destructible，调用既有合法 attack-surface/temporary-target 路径；若 Hard 或无资格对象先阻挡则不拆。移除旧 `blockingObstacle` 的“完整 physical route 不可达才诊断候选/alternate detour suppresses demolition”决策，不改 Minion/Boss 的伤害、动画、冷却、generation 或普通索敌。
- [x] EPD.f：扩展核心 harness。证明持续跨目标 cell 的 Minion/Boss 在 blocked detour 中有 non-zero、current-safe velocity；同 key 只建一次 replacement，快速连续 target 更新不会无界积压；field 切换后方向朝 current target；geometry change、target invalidation、pool reset/destroy 不使用 retained stale route；每帧 work、entry/byte/cell cap 和 cancellation/release 保持边界。
- [x] EPD.g：扩展 demolition harness。对 Minion 与 Boss，设置固定 attackable Log 在 Hard-only selected path 上且物理图存在绕路，断言到合法外侧攻击面、Log 未毁前不穿透、一次命中生命周期、destroy 后恢复原目标。另覆盖顺序两个 valid Destructible、Hard wall 必须绕而不攻击、ineligible Log/unsupported Destructible/no surface 停步或合法绕行、近旁非交叉 Log 不被攻击，以及 player 在拆除期间移动。
- [x] EPD.h：执行所有验证并先保存原始输出。所有机器 AC 通过后追加 `bugs.md` v6，更新本计划为 done 并写 report；任一 AC 失败或需要范围外文件时保留 evidence、写 hard block 并保持 plan active/replan，不用降低断言完成。

## 实施步骤

1. 从 EPD.a 开始，先对当前脏工作区建立任务基线；不得将 user prefab diff 视为任务文件或覆盖其内容。
2. 完成 EPD.b-c 后先跑 focused core harness，确认 active route 在 current geometry 不安全时立即停步，再做 EPD.d-e。Demolition route 的 planning view 只能产生意图；每一个实际 velocity、surface 和 hit 仍基于完整 physical area。
3. 完成 EPD.f-g 时更新旧“alternate detour 不拆”的测试断言，保留并重复验证旧 Hard、pooling、generation、cache pressure、fixed/rolling/failed Log、真实 body offset 与 collision regression。
4. 完成 EPD.h 后仅写本 task report/evidence 和既有 bugs entry v6。不要运行 MCP gate；纯脚本计划的机器完成不依赖 AC-PLAY，Creator 手测结果单独记录。

## 校验点

- [AC-CONTINUITY] 持续移动 target 跨 flow cells 时，已结算且 current-safe detour route 在 replacement pending 期间提供非零移动；new field settle 后切到 current target。pending、unreachable、invalid target 和 geometry-changed stale field 的行为彼此可区分。
- [AC-DEMOLITION] 对 Minion/Boss，selected Hard-safe route 上的固定可攻击 Log/支持的 Destructible 即便可物理绕行也会成为临时目标；到合法攻击面才造成一次既有伤害，未摧毁前不穿透，摧毁后恢复原目标。
- [AC-HARD] Hard/无 adapter/Inactive/rolling/charging/failed Log 不能被拆；Hard 保持路线约束，合法绕行仍工作，非相交路旁 Log 不抢占目标。
- [AC-DYNAMIC] target 变更、Log/障碍分类、几何、启用状态、摧毁、pool reset/release/service destroy 会清除或拒绝过期 active/pending route；不会伤害新生命或错误恢复旧目标。
- [AC-SHARED] 同 body/current revision/target request 共享 replacement；target churn 不让 pending job 或 cache 无界增长；每帧 work `<=4096`，并保持 cell `30`、entries `<=32`、bytes `<=8388608`、max cells `<=262144`。
- [AC-REGRESSION] 既有 core 和 dedicated navigation harness 的安全、cache pressure、body/offset、attack generation、Minion/Boss normal target 和 fixed-log lifecycle 覆盖保持通过，仅替换已废止的 alternate-detour 预期。
- [AC-SCOPE] 除可写/新建列表外无任务 diff；两个 user Hero prefab byte hash 不变；无 Main.scene/prefab/meta/asset/MCP 写操作。
- [AC-PLAY] 对照 `openspec/changes/fix-enemy-pursuit-demolition/` 手测持续追击、可绕路 Log 拆除、Hard 绕行、连续 Log 与无穿透；不阻塞 plan done，结果写 report。

## 验证命令

```powershell
git status --short
git diff --check
npx tsc --noEmit --pretty false
openspec validate fix-enemy-pursuit-demolition --type change --strict --no-interactive
openspec validate enemy-unified-navigation --type change --strict --no-interactive
openspec validate enemy-break-blocking-log --type change --strict --no-interactive
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-enemy-pursuit-demolition-evidence/core'; node .cursor/scripts/test-enemy-navigation.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-enemy-pursuit-demolition-evidence/demolition'; node .cursor/scripts/test-enemy-break-blocking-log.cjs
node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/fix-enemy-pursuit-demolition-evidence/benchmark
Remove-Item Env:NAV_EVIDENCE_DIR -ErrorAction SilentlyContinue
```

记录每个 command 的退出码、source/harness SHA-256、protected Hero prefab hashes、active/replacement field IDs、target cell transition、pending/settled state、每帧 scheduler work、job coalesced/cancelled/completed、cache peaks、first-blocker order、surface/attack/destruction/resume outcome。基准只用于回归，不得用变更 cap 或简化几何掩盖失败。

### MCP

纯脚本：不适用。不得补跑 MCP gate 或创建 prefab/scene。

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | no |
| OpenSpec change | `openspec/changes/fix-enemy-pursuit-demolition/` |

## 回滚策略

先保存失败 command 输出和 task-only diff。仅反转本计划在 FlowField、EnemyNavigation、两份 harness 与 `bugs.md` v6 的 task-owned hunk，并删除本 task report/evidence；保留用户 Hero prefab、已验收导航优化、历史 plan/report/evidence 和所有非本任务修改。不得通过恢复绕路优先、过期 field、同步构建或取消真实碰撞来回滚。若实现需要新的 numeric boundary、scene/prefab 改动或更多生产模块，停止并 replan。

## 修订记录

- v1（2026-09-10）：根据用户授权，建立移动目标连续追击与 selected-route destructible demolition 的初始 Plan-Build 计划；取代旧 OpenSpec 的 alternate-detour 语义，不修改历史实现或资源。
- v1 执行（2026-09-10）：EPD.a-h 完成；机器 AC 通过，MCP 不适用，Creator 实玩待用户验证。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/fix-enemy-pursuit-demolition/` |
