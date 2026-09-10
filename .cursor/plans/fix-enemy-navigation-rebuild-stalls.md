---
slug: fix-enemy-navigation-rebuild-stalls
版本: 4
状态: draft
创建: 2026-09-10
---

# 修复敌人导航重建卡顿

## 业务目标

消除建造触发的敌人导航冷重建在单个动画帧内同步完成的问题，同时保留既有共享流场、障碍安全、入口、固定滚木绕行及缓存行为。将 `GameConfig` 的敌人共享流场格子从 20 调整为 30，并把连通图与距离场构建分摊到有限的跨帧工作预算中。

Trace `C:\Users\Admin\Desktop\Trace-20260910T114517.json.gz` 是本次基线证据：一个 construction-frame callback 为约 166 ms，其中约 154 ms 位于 `FlowField._graphFor`，调用链为 `EnemyNavigation.blockingLog` -> `sharedQuery`，小怪与 Boss 分别触发；另见约 21 ms `FlowField._bfs` 峰值。`fix-enemy-navigation-performance` v2 的安全、缓存、通知去重与热路径 AC 已接受；本计划只处理其报告明确保留的冷连通构建风险。

v1 已消除单帧全量重建，但其五轮 scene-bounds evidence 证明 `256` work units/frame 不可接受：30-cell、125x127 网格下，同时排队的两种 body graph 需要 489 scheduler frames，随后 fields 需要 241 frames。v2 将固定总预算提升到 `4096`，并通过 service readiness，但其五轮 Node slice p95 为 `24.4904 ms`，超过 `8 ms`。v3 仅授权在既有任务拥有的导航路径内降低每 slice 的算法成本，并修复 pending diagnostic reachability 被误缓存为 `null` 的语义风险；不重新调查、重写或降级已接受的安全和生命周期工作。

## OpenSpec 引用

- Change: `openspec/changes/fix-enemy-navigation-rebuild-stalls/`
- 行为语义以该 change 的 `specs/**` 为准；本计划不复述其 scenarios。

## v4 重新规划范围

v3 已接受的 30-cell grid、`4096` 单帧全局预算、原子发布、round-robin、公平性、LRU/bytes/max-cells 上限、入口与碰撞安全均保持有效。本次只处理新观察到的固定滚木诊断时序回归：两侧楼梯关闭、中央固定可攻击滚木、敌人在城外且原目标在城内时，冷 `blockingLog` 首次调用会因当前连通性及忽略滚木的诊断图尚未完成而返回 `null`。旧专用日志 harness 将这个合法 pending 值误作同步否定结果，且没有在断言间推进 scheduler；真实更新循环最终可以恢复，但该状态必须有可证明、无饥饿的有界完成路径。

v4 的解决目标不是恢复同步断言或把失败断言改成无条件等待：将一次固定滚木诊断表达为同一 revision、body、进入方向、目标/攻击面和候选固定滚木的可重试依赖链。首次请求必须登记所有必要的当前诊断工作；后续相同请求只能 coalesce/join，不能因请求顺序、普通 route field、LRU 逐出或临时 `null` cache 而重启、交替或永久饿死。只有所有必需依赖已 settled 时才准许缓存 terminal diversion/null；pending 仍安全停步且不形成负缓存。诊断 settled 后，合法中央滚木 diversion 必须在既有 48-frame bound 内出现，随后直接或经已有 current-safe 流场到达合法攻击面。不得将 diagnostic graph 接回 normal blocked-route field 的前置依赖。

## 风险等级

高。该改动在真实几何失效、流场共享、固定滚木阻路查询、Minion/Boss 不同体型和碰撞安全之间改变了请求时序。任何以旧 revision 或未完成数据给出移动的实现都会造成穿障或卡住回归。

## 前提与已接受基线

- 先阅读本计划、上述 OpenSpec change、`.cursor/plans/fix-enemy-navigation-performance.md`、其 report/evidence、`enemy-break-blocking-log` change/plan，以及当前 `git status --short`。从现有磁盘状态续作，不重做已接受优化。
- 当前工作区已有并行用户修改：`assets/scripts/building/BuildSystem.ts`、`assets/scripts/enemy/EnemyBoss.ts`、`bugs.md`。它们与本任务无关，必须保留；只以本计划明确许可的 hunk 进行编辑。
- 现有生产热路径：`EnemyNavigation.blockingLog` 在 `FlowField.sharedQuery` 内调用 `_graphFor`；`direction` 可调用 `_fieldFor` -> `_bfs`。当前 `_graphFor` 和 `_bfs` 均有完整网格循环，不能在任何 per-unit request 继续同步执行。

## 禁做项

- 禁止编辑 `Main.scene`、任何 `.prefab`、`.meta`、资源、动画、坐标、Inspector 绑定或静态关卡布局；不启动 Cocos MCP 写链，不执行 `scene-save`、`post-scene-save.ps1`、`assets-refresh`、`assets-reimport-asset` 或 `verify-mcp-gate.ps1`。
- 禁止新增每怪 A*、每怪 graph/field、无界队列/Map/缓存，或以减少敌人数、刷怪频率、碰撞精度、攻击范围、入口规则或障碍尺寸来掩盖卡顿。
- 禁止把 pending 状态降级成沿旧 graph/field 移动、直追穿过当前障碍、跳过 `lineClear`/sweep/ground/castle/portal/角落约束，或传送解卡。
- 禁止将 current-revision pending query 折叠为 `false`、`null` 或任意可缓存的负结论；尤其不得让 `blockingLog` 的 `?? null`、`_objectiveEntrance`、diagnostic area 或 `canReach` 把未完成连通性当作不可达。
- 禁止只把 `_graphFor`/`_bfs` 放进 `setTimeout`、Promise 或每个单位自己的队列；工作必须由服务每帧一次的共享预算推进，且能取消过期 revision。
- 禁止为缩短等待而恢复旧 revision graph/field、猜测 partial 结果、直线穿越当前障碍，或把 pending blocked 请求静默改为旧路径移动；未通过当前几何的 direct/sweep/ground/castle/portal/corner 校验时仍须安全停步。
- 禁止改动 `EnemyMinion.ts`、`EnemyBoss.ts`、`BuildSystem.ts`、`EnemySpawner.ts`、`Log.ts`、攻击/目标选择/入口配置或任何无关 OpenSpec change；Minion/Boss 仅作为真实调用方和测试夹具。
- 禁止编辑 `bugs.md`、`Main.scene`、任何 prefab/meta/asset，或重新执行已通过的 trace/AC-PLAY finalization；本 replan 仅留下 readiness 修正所需的当前 task evidence/report 更新。
- 禁止以改写 legacy assertions、增加无界 polling、提高 frame bound、预热 graph/field、模拟已 settled graph，或把 `blockingLog` 的 pending `null` 直接当作 settled no-diversion 来掩盖本回归。专用 harness 必须显式推进 scheduler，并在每个 pending/settled 断言处证明当前状态。
- 禁止为 diagnostic readiness 新增每-unit job、改变 Minion/Boss 的攻击/目标选择实现、把普通追击 field 作为诊断完成条件，或提高 `4096` cap、32-entry/8-MiB/262144-cell budget。
- 禁止提高 `4096` work-units-per-frame cap、放宽 `<= 48` frame readiness 或 `p95 <= 8 ms` / `max <= 12 ms` timing limits、增加 cache entries/bytes/max-cells，或用基准专用简化几何掩盖成本。若这些边界需要变化，停止并再次 replan。
- 禁止将 normal field creation继续依赖一个对该 field 无实际消费者的完整 connectivity graph；graph-only work 只能为真实需要已完成连通性判定的 query 保留。不得发布 partial occupancy、edge、component 或 distance data。
- 禁止重置、checkout、删除或覆盖用户现有 dirty 文件；发生范围冲突或需要额外文件时停止并 replan。

## 变更文件清单

### 可写

- `assets/scripts/core/FlowField.ts` - 仅限当前任务的 job representation/algorithm、current-revision tri-state query readiness、atomic publish、cache admission/LRU/release/diagnostics 适配。
- `assets/scripts/core/EnemyNavigation.ts` - 仅限一次/帧调度、pending diagnostic propagation、`blockingLog` cache admission 和现有安全决策适配；保持实际障碍快照、最终 sweep 和单位生命周期。
- `.cursor/scripts/test-enemy-break-blocking-log.cjs` - v4 dedicated fixed-log regression harness; replace only cold synchronous assumptions with explicit scheduler-frame assertions and add the actual entrance Minion/Boss lifecycle coverage.
- `.cursor/plans/fix-enemy-navigation-rebuild-stalls.md` - 仅更新 v3 todo、AC、状态和修订记录。
- `openspec/changes/fix-enemy-navigation-rebuild-stalls/{proposal.md,specs/enemy-navigation-construction-scheduling/spec.md}` - 同步 current-revision diagnostic readiness 语义。
- `.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-report.md` 和 `.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v4/` - 仅追加 v4 regression evidence, source/harness hashes and AC results; preserve v1/v2/v3 evidence.

### 可新建

- `.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v4/` - v4-only scheduler-frame sequence, route/readiness/caching observations and final command output; no production resource.

### 仅只读参考

- `AGENTS.md`, `.cursor/rules/{multi-agent-orchestrator,defense3-workflow,openspec,cocos-mcp}.mdc`, `.cursor/plans/_TEMPLATE.md`, `AI_TASK_LIST.md`, `defense3.md`。
- `.cursor/plans/fix-enemy-navigation-performance.md`, `.cursor/plans/reports/fix-enemy-navigation-performance-report.md`, `.cursor/plans/reports/fix-enemy-navigation-performance-evidence/`, `.cursor/plans/enemy-break-blocking-log.md`。
- `openspec/changes/enemy-shared-flow-field/`, `openspec/changes/enemy-break-blocking-log/`, `openspec/specs/`。
- `assets/scripts/enemy/{EnemyMinion,EnemyBoss,EnemyAI,EnemySpawner}.ts`, `assets/scripts/building/{BuildSystem,Building,Wall,Tower,Barracks,Barrier,BuildPlot}.ts`, `assets/scripts/item/Log.ts`, `assets/scripts/core/{GameEvents,EventManager,AirWallAabb,PathAgent}.ts`。
- `assets/scripts/core/GameConfig.ts`, `.cursor/scripts/test-enemy-navigation.cjs`, `.cursor/scripts/bench-enemy-navigation.cjs`, and all v1-v3 task evidence/harness output - accepted baseline; v4 may execute their checks but must not edit or overwrite them.
- `assets/scenes/Main.scene`, all prefabs/meta/assets, `package.json`, `tsconfig.json`, `bugs.md` (foreign dirty; v2 read-only), and `C:\Users\Admin\Desktop\Trace-20260910T114517.json.gz`.

## To-dos

- [x] NAVSTALL.a: Record the starting commit, hashes, status, supplied trace summary and existing performance-plan evidence in the new evidence directory. Confirm the current source has the synchronous `_graphFor` and `_bfs` request paths; preserve all foreign dirty changes.
- [x] NAVSTALL.b: Add a single shared, revision-keyed incremental job model in `FlowField`. A job snapshots only current immutable navigation inputs, advances by a global work-unit allowance, publishes graph/field results atomically only after completion, and exposes ready/pending/failed status without allocating a complete result per caller.
- [x] NAVSTALL.c: Route `EnemyNavigation` through a once-per-frame scheduler with one total configurable allowance across all graph and field jobs. Coalesce same revision/body/target requests; fairly round-robin distinct Minion and Boss body jobs; cancel old-revision work immediately and clear affected unit field IDs.
- [x] NAVSTALL.d: Make every request path safe under pending work. Keep a current-geometry direct route only after existing line/sweep constraints prove it; otherwise output zero movement and retain no stale result. Adapt `blockingLog`, `sharedQuery`, `direction`, approach queries, retained field release, direct-route transitions, unit reset/release and service destroy to the explicit readiness contract.
- [x] NAVSTALL.e: Update `GameConfig` to a 30-unit enemy flow cell size and add the single scheduler work budget. Preserve cache entries, bytes, max cells and LRU policy; account for pending jobs, queues and cancellation so admission stays bounded.
- [x] NAVSTALL.f: Extend unit and benchmark coverage. Test actual Minion and Boss request stacks, coalescing/fair progress, bounded per-frame work, graph/field atomic publication, pending no-cross movement, direct-safe movement, geometry changes after partial work, rapid repeated invalidation, pool release/destroy, cache/byte pressure and all existing safety regressions.
- [x] NAVSTALL.g (v2 latency): Replace the ineffective `256`-unit scheduler allowance with a fixed, centrally configured `4096` work-units-per-frame cap. Retain one shared once-per-frame scheduler, revision cancellation, round-robin fairness, atomic publication, and all cache limits. The cap is intentionally fixed so the scene-bound frame readiness is deterministic; do not add a wall-clock fallback that can silently starve progress.
- [x] NAVSTALL.h (v2 proof): Failed evidence accepted. The real service readiness assertion passes, but the five-run Node benchmark fails `AC-READY-LATENCY`: raw slice p95 is `24.4904 ms` after removing a redundant rectangular ground check (initial p95 `33.0933 ms`), exceeding the required `<= 8 ms`. Preserve this failure and its files; do not rerun or reinterpret it as v3 evidence.
- [x] NAVSTALL.i (v2 closeout): Scoped TypeScript and logic checks passed; benchmark failure evidence/report were appended and the plan remains `verifying`. AC-TRACE / AC-PLAY were not rerun and `bugs.md` was not edited.
- [x] NAVSTALL.j (v3 algorithm): Profiled v2 raw evidence: 4096-unit graph/field edge slices were the dominant cost (`24.4904 ms` p95). Normal blocked routes now create one private occupancy/edge/distance field per body/target directly, with no connectivity graph dependency; graphs remain lazy diagnostics. Adjacent-grid edge checks retain portals/obstacles/ground safety while using a no-allocation convex-region fast path.
- [x] NAVSTALL.k (v3 tri-state): `FlowField` exposes pending/reachable/unreachable reachability and pending/settled shared-query results. `EnemyNavigation` propagates pending through objective, surface, entrance, `logRoute`, and `blockingLog`; pending values are not cached and same-revision calls retry after graph completion.
- [x] NAVSTALL.l (v3 proof): Focused logic and five-run `evidence/v3/` benchmark passed. Each raw record is persisted before timing assertions; it records slice timing, frame, work units, job state, graph/field readiness, cache/job metrics, coalescing, and cancellation.
- [ ] NAVSTALL.m (v4 diagnostic orchestration): Starting from the accepted v3 scheduler, make `blockingLog`'s cold fixed-log diagnostic a revision-keyed, body-specific pending workflow rather than an accidental chain of caller-local `null` results. Register and retain the current-route and ignored-fixed-log dependencies needed for the exact central-log decision without creating normal route fields; same-key calls coalesce, current diagnostic work is not restarted/starved by request order or unrelated fields, and invalidation/release/destroy discard the whole unfinished workflow. Publish/cache only a fully settled positive diversion or fully settled negative result.
- [ ] NAVSTALL.n (v4 dedicated regression harness): Update `.cursor/scripts/test-enemy-break-blocking-log.cjs` so cold tests use a bounded helper that calls the real service once per scheduler frame, records per-frame readiness/job/cache evidence, and treats initial `blockingLog === null` as valid only while that request's current diagnostic is pending. Preserve settled negative/alternate/no-log tests, but remove every legacy immediate-positive assumption that bypasses scheduler advancement. Add the actual Main.scene entrance fixture with both side stairs closed, fixed attackable central log, outside start and inside original target for both Minion and Boss: prove bounded diversion, non-zero current-safe movement to a legal log attack surface, damage/destruction, and resume of the original target.
- [ ] NAVSTALL.o (v4 proof and closeout): Run the focused dedicated harness, TypeScript check and retained construction benchmark; persist v4 frame traces before asserting. Verify the scheduler never exceeds 4096 work units, no pending request becomes a terminal/null cache, no diagnostic workflow is repeatedly cancelled/requeued without revision change, cache/entry/byte caps remain unchanged, and all v1-v3 accepted checks remain green. Append the exact result or hard blocker to the existing report without running Creator trace/AC-PLAY or editing `bugs.md`.

## 实施步骤

### v4 execution (first unfinished work only)

1. Resume at `NAVSTALL.m`; do not rerun v1-v3 surveys, algorithm work, benchmark tuning, trace capture, or accepted AC. Inspect the existing queue only to preserve its current scheduler and cache contracts while adding the diagnostic-workflow ownership/readiness necessary to prevent sequential request starvation.
2. Complete `NAVSTALL.n` with the dedicated harness's real mocks and actual-entrance geometry. Each cold attempt must advance exactly one harness frame before retrying; capture whether the request is pending, the per-frame work consumed, diagnostic/job identities or equivalent readiness evidence, and cache admission. The bounded wait ends only when a settled diversion/null is observable, never because an arbitrary retry count elapsed.
3. Complete `NAVSTALL.o` and write only v4 evidence/report additions. Stop and replan if satisfying the regression needs a new scene/prefab, a changed cap/budget/latency boundary, a change to enemy combat/targeting, or any file outside this plan's writable list.

1. Baseline first: capture hash/status without modifying pre-existing evidence. Parse the supplied gz trace only for a reproducible summary of the 166 ms construction callback, the approximately 154 ms shared-query connectivity path, and the approximately 21 ms BFS spike. Do not present CPU-profiler sampling as exact wall-clock source instrumentation.
2. Define job ownership before implementation. Graph jobs key on the stable body envelope plus current area revision; field jobs additionally key on target cell. A request can create or join a job but cannot advance it to completion. Only `EnemyNavigation`'s once-per-frame preparation advances the scheduler, and its total work units include graph occupancy/edge/component stages and field BFS expansion. Use a deterministic round-robin queue so concurrent Minion/Boss body keys cannot serialize full cold builds in one frame.
3. Preserve atomic safety. A job may maintain private partial labels, edges, queues, distances and cursors, but no direction, reachability, approach, obstruction or retained field lookup may consume partial data. On a geometry/topology event, invalidate the active revision and cancel/remove every old job/cache result synchronously; before any later move, refresh the current obstacle snapshot and validate direct/sweep movement against it. Pending blocked or uncertain paths safely stop rather than use old movement.
4. Preserve lifecycle and cache accounting. Completed graph/field/query/approach results continue using the existing combined entry/byte LRU. Pending arrays and queues count against the same budget before allocation; refused admission is a safe pending/failed result, never an unbounded allocation or fallback to unsafe movement. Unit retain/release must remain correct if fields are evicted, invalidated, complete after no users remain, or services are destroyed.
5. Keep caller behavior scoped. `blockingLog` must neither synchronously force connectivity construction nor bypass current-obstacle safety while a diagnostic answer is pending. The normal and diversion movement paths must share the same pending safety behavior. Do not change target priorities, attacks or Log phase semantics. Exercise actual Minion and Boss bodies from existing scripts instead of inventing body fixtures only.
6. Use the existing Node harness and a new `--construction-jobs` benchmark mode. Parameterize the evidence target to the new plan directory. It must report configured cell size, grid dimensions, frame slices, maximum and total work units, completed/cancelled/coalesced jobs, body keys, cache entries/bytes, result readiness, and graph/BFS construction timing. Keep the accepted earlier benchmark output intact.
7. For runtime verification, ensure Creator has compiled the current source hash before profiling. Capture the same construction action and report fresh trace callback durations plus navigation per-frame job diagnostics separately. A stale preview bundle, a trace from an unknown source hash, or a Node-only result cannot be called live-stall resolution.

### v2 latency record (accepted failed evidence; do not repeat)

1. `4096` is the one global service scheduler cap, not a per-job/per-unit entitlement. v2 passed current service readiness but failed only the timing proof; preserve its `24.4904 ms` raw p95 failure evidence.
2. The v1 186802-work path and its 489/241-frame result are baseline evidence, not a v3 algorithm to retain. The v3 replacement may remove redundant graph stages only under NAVSTALL.j's safety and boundedness constraints.

### v3 execution (only unfinished work)

1. Resume the existing build-agent for this slug; do not create a new build-agent, new plan, or parallel implementation branch. Read this plan, current report, v1/v2 evidence, OpenSpec delta, git state and current disk state, then begin at NAVSTALL.j without rerunning survey work or rebuilding accepted artifacts.
2. Keep all work revision-keyed and private until complete. Prefer eliminating graph construction that is immediately superseded by field construction; if a normal blocked route needs a field, schedule the minimum shared occupancy/field work needed for that field. Connectivity-only work must be requested lazily and only by a query needing a settled reachability answer.
3. Make query readiness tri-state at the FlowField/EnemyNavigation boundary. Pending is neither false nor a cacheable `null`; only settled current-revision positive/negative answers may contribute to shared-query cache keys and values. On invalidation, cancel private work and discard all old readiness/results before later use.
4. Drive real service-frame requests for both production body envelopes in one frame. Graph readiness and field readiness are each measured from first request and must be current-revision completed results, not partial arrays, direct-route exceptions, or old fields. Maintain zero velocity for blocked pending routes and allow direct movement only through existing current-geometry validation.
5. Benchmark with monotonic scheduler-slice timestamps. Persist raw slice values, frame indexes, work units, job kind/state and readiness transitions in `evidence/v3/` before evaluating timing limits. The same v3 command must run five times against current Main.scene bounds without modifying the scene.

## 校验点

- [AC-SCOPE] `git status --short`, `git diff --check`, `git diff --stat`, and evidence hashes show only the permitted files changed by this task. No scene, prefab, meta, asset, foreign dirty hunk, previous-plan evidence, or unrelated OpenSpec change was altered.
- [AC-CONFIG] A focused assertion against current `GameConfig` confirms `enemyFlowCellSize` is exactly `30`; cache entries (`32`), cache bytes (`8 MiB`) and max cells (`262144`) remain unchanged unless a replan explicitly changes them.
- [AC-TSC] `npx tsc --noEmit --pretty false` exits `0`.
- [AC-LOGIC] `node .cursor/scripts/test-enemy-navigation.cjs` exits `0`, retaining prior accepted cases and adding all NAVSTALL.f cases without weakening assertions.
- [AC-SCHEDULER] The test harness proves a request only enqueues/joins incomplete graph or field work; a scheduler advance has a single global work cap; no single Minion, Boss, `blockingLog`, `sharedQuery`, `direction`, graph lookup, or BFS request consumes a full large grid. Distinct body jobs receive bounded round-robin progress, while same-key units coalesce.
- [AC-TRISTATE] Tests prove each current-revision diagnostic reachability/shared query distinguishes settled reachable, settled unreachable and pending. A pending graph/field never becomes a cached `false`/`null`; specifically, a `blockingLog` diagnostic queried while its graph is pending returns no diversion for that call, then recomputes and returns the valid fixed-log diversion after the same revision settles, without invalidation. The equivalent settled-unreachable case may cache its negative result. Geometry invalidation discards all prior tri-state/query entries.
- [AC-SAFETY] Tests prove that geometry invalidation cancels old partial/completed work before the next result, no pending blocked route returns movement through the current obstacle, direct current-geometry movement remains valid, and the existing sweep/ground/castle/portal/corner constraints still hold. Cover changes after a job has partly progressed and after a same-frame consumer.
- [AC-LIFECYCLE] Repeated revision changes, 10,000 mixed requests, field eviction, unit reset/release, Minion/Boss pool reuse and service destroy keep completed plus pending data within the existing entries/bytes/max-cell budgets; no stale field ID or async completion resurrects old data.
- [AC-BENCH] `node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v3` exits `0`. It exercises current Main.scene bounds at 30-unit cells, current-revision pending/settled diagnostic queries, first cold blocked normal route, repeated same-body units, simultaneous Minion/Boss bodies, and mid-job invalidation. It asserts one global cap, one shared job per key, tri-state cache admission, and always writes all raw run data before failure handling without overwriting v1/v2 evidence.
- [AC-READY-LATENCY] v3 blocking AC. Five independent construction runs and the actual-service regression use current Main.scene bounds (125x127 at 30-unit cells) and queue 40x40 ordinary-enemy plus 80x80 Boss blocked requests together. With no geometry invalidation: each required connectivity graph and each body’s current-revision usable field is ready within 48 scheduler frames of first request; every slice is <= 4096 work units; raw five-run slice timing has p95 <= 8 ms and max <= 12 ms. This fails on an old/partial result, direct-route-only result, body-specific serial completion, unneeded normal-field graph work, or a missing v3 raw slice record.
- [AC-TRACE] Required to mark this plan `done`: compile the current source in Creator, record a fresh construction trace from the same workflow, and store source/bundle hashes, capture command/environment and an event/profile summary. The construction callback must no longer contain a synchronous full `_graphFor` or `_bfs` completion; navigation work must be reported as bounded slices and no single slice may exceed the configured work budget. Compare the old 166 ms/154 ms/21 ms evidence as a baseline, not as an exact like-for-like CPU-sampling measurement. If fresh compile/capture cannot be performed, leave status `verifying` and record the blocker.
- [AC-PLAY] Against `openspec/changes/fix-enemy-navigation-rebuild-stalls/`, verify construction does not visibly hitch enemy movement; enemies may pause only for pending blocked navigation, never cross current obstacles, and resume after completion. This supplements AC-TRACE and is recorded in the report.
- [AC-V4-DIAGNOSTIC] In the dedicated harness's actual Main.scene geometry, with entrance 1 and 3 closed, the central fixed attackable log present, unit outside and original target inside, a first cold `blockingLog` may return `null` only while its current diagnostic workflow is pending. Explicit scheduler-frame advancement must produce one bounded, same-revision settled result within 48 frames; a settled positive returns that log and a settled negative is permitted only when the diagnostic has actually ruled the diversion out. No pending `null` is cached as a terminal value.
- [AC-V4-LIFECYCLE] Run the above cold state through the real Minion and Boss update paths. For both bodies, pending frames have zero unsafe velocity; after the diversion settles, the unit moves toward a legal, current-geometry attack surface, damages and destroys the fixed log, clears its diversion state, and resumes its original inside target. The test records body keys, scheduler work, graph/field/job lifecycle, cache entries/bytes, diversion frame and attack/resume frames.
- [AC-V4-FAIRNESS] Repeated same-key `blockingLog` calls while cold coalesce rather than allocate/restart work. Interleaving ordinary blocked requests and the two real body sizes cannot starve the required diagnostic workflow; every scheduler slice is `<= 4096`, entries stay `<= 32`, bytes stay `<= 8388608`, and invalidation before settlement cancels the old workflow without allowing it or its terminal cache entry to reappear.
- MCP resource gates are N/A: this is pure script work and must leave scene/prefab resources untouched.

## 验证命令

```powershell
git status --short
git diff --check
git diff --stat
npx tsc --noEmit --pretty false
node .cursor/scripts/test-enemy-navigation.cjs
node .cursor/scripts/test-enemy-break-blocking-log.cjs
node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v3
```

Fresh Creator trace capture uses the existing project preview/profiler workflow only after confirming compiled bundle hashes match the final `FlowField.ts`, `EnemyNavigation.ts`, and `GameConfig.ts`. Record the exact capture procedure and summary in the new report; do not save, reimport, or modify project assets to force compilation.

### 执行结果（2026-09-10）

- v3: AC-SCOPE、AC-CONFIG、AC-TSC、AC-LOGIC、AC-SCHEDULER、AC-TRISTATE、AC-SAFETY、AC-LIFECYCLE、AC-BENCH、AC-READY-LATENCY 通过。最终五轮 raw slice p95 `6.0898 ms`、max `11.1440 ms`；两种 body field 在 35 frames、所需 minion diagnostic graph 在 39 frames 完成，均在 4096 cap/48-frame limit 内。
- AC-TRACE 和 AC-PLAY 未执行。没有确认使用最终源哈希编译的 Creator bundle，也没有新 construction trace；按本计划保持 `verifying`，未更新 `bugs.md`。
- v1/v2 evidence remains historical, including v2 `24.4904 ms` failed timing record. No live trace/AC-PLAY run occurred in v3.

## 回滚策略

- Before edits, retain hashes and copies only in the new task evidence directory. Do not overwrite the accepted `fix-enemy-navigation-performance-evidence` baseline or rely on `git checkout` for currently untracked or dirty navigation files.
- On a failing AC, revert only the task-owned hunks after preserving failed benchmark/trace evidence. Do not reset the worktree or erase user changes in `BuildSystem.ts`, `EnemyBoss.ts`, or `bugs.md`.
- The v2 `4096` cap, readiness evidence and latency failure record are historical inputs, not rollback targets. If a v3 AC fails, preserve its raw evidence first and revert only unaccepted v3 algorithm/tri-state hunks. Do not restore synchronous construction, a stale-route fallback, or a pending-to-negative diagnostic conversion. A different cap, elapsed-time policy, scope expansion, or changed latency threshold requires another replan with replacement benchmark evidence.
- Restore synchronous behavior only as a last-resort local hunk rollback; do not retain partially published jobs, stale revision data, or an unsafe fallback. If the fix needs changes outside the file list, behavior scope change, cache-budget increase, or scene/resource edit, stop and replan.
- A replan is version `3+`: preserve accepted todos/AC and this OpenSpec delta, edit only failed steps/evidence/AC, and synchronize the delta if behavior changes.

## 修订记录

- v1 (2026-09-10): Initial Plan-Build handoff for trace-confirmed construction-frame connectivity/BFS stalls. No production code, resources, or bug record changed by plan creation.
- v1 execution (2026-09-10): NAVSTALL.a-f and all available blocking machine AC completed. Fresh Creator trace/AC-PLAY remain unavailable; status is `verifying`, not `done`.
- v2 (2026-09-10): Replan only the failed readiness latency. v1 construction evidence recorded 256 work units/frame, 489 graph frames and 241 field frames at 30-cell scene bounds. Preserve v1 completed work and AC; require the 4096-unit fixed cap, 32-frame graph readiness, 48-frame per-body field readiness, and slice-timing benchmark proof before returning to `verifying`.
- v2 execution (2026-09-10): 4096 cap and actual-service readiness test passed; AC-READY-LATENCY benchmark failed at 24.4904 ms raw slice p95 (limit 8 ms). Status remains `verifying`; a replan must authorize an algorithmic slice-cost reduction or revise the evidence threshold.
- v3 (2026-09-10): Replan only the v2 timing failure and the discovered pending-diagnostic cache regression risk. Preserve v1/v2 source/evidence and fixed 30-cell/4096/48-frame/8 ms/12 ms boundaries; permit a task-owned algorithmic reduction that avoids redundant normal-field connectivity work, require a tri-state current-revision query contract, and resume the same build-agent at NAVSTALL.j.
- v3 execution (2026-09-10): NAVSTALL.j-l and all machine AC passed with raw v3 evidence. The plan remains `verifying` solely because the explicitly required fresh Creator trace and AC-PLAY were not run; no `bugs.md` change was made.
- v4 (2026-09-10): Focused replan for the newly observed cold fixed-log regression. Preserve every accepted v1-v3 performance/safety result and all prior evidence. Resume at `NAVSTALL.m`; add only explicit diagnostic-workflow sequencing/coalescing/cache correctness and a scheduler-aware dedicated log harness for the closed-side-stairs central-log Minion/Boss lifecycle. Status returns to `draft`; Creator trace/AC-PLAY remain outside this replan.

## 执行报告须含（build-agent）

- Starting/final commit, source/bundle hashes, preserved dirty-state attribution, every todo/AC result, exact commands and raw output paths.
- Supplied-trace baseline summary, final fresh-runtime trace summary, and an explicit statement whether each uses CPU-profiler sampling or source instrumentation.
- Table of 30-cell grid dimensions, scheduler work cap, frame slices, job completion/cancellation/coalescing counts, Minion/Boss body keys, cache entries/bytes peaks, and five-run median/p95 benchmark values.
- v2 report addendum: the prior 256/489/241 failure, selected cap, per-body graph/field readiness frames, per-slice p95/max timing, raw evidence paths, preserved safety results, and confirmation that no stale or partial field became movement evidence.
- v3 report addendum: selected algorithm and why it removes only redundant completed work; tri-state query/cache evidence including pending `blockingLog` then same-revision diversion recovery; five-run raw slice files, p95/max, graph/field readiness frames, cap/cache/fairness metrics, and explicit preservation of all v1/v2 artifacts.
- v4 report addendum: first cold/settled scheduler-frame sequence for each body, diagnostic dependency/coalescing and cache-admission evidence, 48-frame diversion bound, legal attack-surface/movement/damage/destroy/original-target-resume evidence, invalidation/starvation observations, and confirmation that v1-v3 evidence and all numeric budgets remain unchanged.

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
| OpenSpec change | `openspec/changes/fix-enemy-navigation-rebuild-stalls/` |
