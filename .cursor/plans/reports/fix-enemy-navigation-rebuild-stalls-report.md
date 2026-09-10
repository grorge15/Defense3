# Build Report: fix-enemy-navigation-rebuild-stalls

## Status

- Plan version: v1, execution revision recorded in the plan.
- Risk: high. This was a fresh run, not a continuation.
- Starting commit: `7811e198f2c1b399a2dcd80ae1cbb2b68f88379d`.
- Final status: `verifying`. All available machine checks pass; the required fresh Creator trace was not captured.

## Todo Matrix

| Todo | Result |
|---|---|
| NAVSTALL.a | Done |
| NAVSTALL.b | Done |
| NAVSTALL.c | Done |
| NAVSTALL.d | Done |
| NAVSTALL.e | Done |
| NAVSTALL.f | Done |
| NAVSTALL.g | Pending AC-TRACE / AC-PLAY only |

## Changes

- `assets/scripts/core/FlowField.ts`: revision-snapshotted graph/field jobs, atomic publication, bounded LRU admission including pending buffers, round-robin advancement, cancellation, and job diagnostics.
- `assets/scripts/core/EnemyNavigation.ts`: one scheduler advance per service frame; immediate invalidation clears pending work and retained field IDs; diagnostics include scheduler state.
- `assets/scripts/core/GameConfig.ts`: 30-unit grid and `enemyNavWorkUnitsPerFrame = 256`.
- `.cursor/scripts/test-enemy-navigation.cjs`: retained regression suite plus pending-safe, coalescing, fairness, cancellation, config, lifecycle, and actual Minion/Boss tests. Default output is this task's evidence directory.
- `.cursor/scripts/bench-enemy-navigation.cjs`: `--construction-jobs` mode and `--evidence-dir` support. It does not overwrite prior plan evidence.
- No scene, prefab, meta, asset, MCP, or `bugs.md` changes were made by this task.

Final source SHA-256:

| File | SHA-256 |
|---|---|
| FlowField.ts | `a385b74c6f9ba5a80786dd4ef22ec5184439e11b89bf915df9ea10fbe0b2f17a` |
| EnemyNavigation.ts | `49cdf92f6627bcfc1a83bbd47a21b0555b29ee289c457da142ebcc9c7f349d97` |
| GameConfig.ts | `959b8c1099ea8940870c657d5bccecbec470ba01733b374fa16c98c9d40c5d90` |

The starting foreign dirty files were `BuildSystem.ts`, `EnemyBoss.ts`, and `bugs.md`; they remain preserved. The earlier performance evidence was restored after a temporary harness-output mistake and is clean in the final scope check.

## AC Results

| AC | Result | Evidence |
|---|---|---|
| AC-SCOPE | Pass | `git diff --check` exit 0; only plan-permitted files changed beyond starting foreign changes. |
| AC-CONFIG | Pass | Harness asserts 30 cells, 32 entries, 8 MiB, and 262144 max cells. |
| AC-TSC | Pass | `npx tsc --noEmit --pretty false` exit 0. |
| AC-LOGIC | Pass | `node .cursor/scripts/test-enemy-navigation.cjs` exit 0; all listed tests passed. |
| AC-SCHEDULER | Pass | Pending requests enqueue only; 256-unit cap, same-key coalescing, and Minion/Boss round-robin are asserted. |
| AC-SAFETY | Pass | Pending blocked routes stop, direct current-geometry routes proceed, and partial work is never published or resurrected after invalidation. |
| AC-LIFECYCLE | Pass | Cache-pressure, 10,000 mixed requests, releases, pooling, destroy, and cancellation tests pass. |
| AC-BENCH | Pass | Five construction-job runs at scene bounds; output below. |
| AC-TRACE | Blocked | No fresh Creator compile with final source/bundle hashes and no fresh construction trace were captured. Per plan, this prevents `done`. |
| AC-PLAY | Not run | No live preview observation was performed. Non-blocking, but recorded. |

## Benchmark

`node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence` exited 0.

| Cell/grid | Slice cap | Graph frames | Field frames | Completed/cancelled/coalesced | Cache peak | Five-run median/p95 |
|---|---:|---:|---:|---:|---:|---:|
| 30 / 125x127 | 256 | 489 | 241 | 4 / 1 / 100 | 5 entries / 288680 bytes | 314.865 ms / 359.900 ms |

The benchmark uses Node timing and job diagnostics, not live frame timing. It verifies two body keys (40x40 Minion and 80x80 Boss), one shared connectivity query, repeated same-body requests, atomic graph/BFS publication, and mid-job cancellation.

## Trace And Evidence

- Supplied baseline trace: SHA-256 `d60c1ad44372e068a59f8f4676b21eb32c0f1945a0ac88e09376878acc4a0111`; it is V8 CPU-profile sampling, not source instrumentation. Its plan-supplied summary is approximately 166 ms construction callback, approximately 154 ms under `_graphFor`, and approximately 21 ms `_bfs` peak.
- Fresh trace: unavailable. Exact gap: no final Creator bundle hash was established and no same-workflow construction profile was recorded. No waiting or interactive trace capture remains active.
- Evidence: `baseline.json`, baseline source copies, `supplied-trace-summary.md`, `logic-results.json`, and `construction-jobs.json` under this report's evidence directory.

## MCP Metrics

| Metric | Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | N/A |
| post-scene-save patched | N/A |
| assets-reimport-asset | 0 |
| new prefabs | 0 |
| continuation | no |

## Blocker And Replan Target

No code or machine-check blocker remains. To complete the plan, compile the final source hash in Creator, capture the same construction workflow trace, record bundle/source hashes and event summary in this evidence directory, then run AC-PLAY. Do not add `bugs.md` v6 until AC-TRACE passes.

## v2 Readiness Addendum

v2 retained all v1 safety/lifecycle implementation and changed only the centralized scheduler allowance to `4096` work units per frame plus readiness instrumentation. `npx tsc --noEmit --pretty false` and `node .cursor/scripts/test-enemy-navigation.cjs` passed. The new actual-service test queues 20 coalesced 40x40 Minion requests and one 80x80 Boss blocked request together at 125x127 scene bounds, keeps both velocities at zero while pending, and verifies both current fields become usable within the 32-frame graph and 48-frame field limits.

v2 final SHA-256: `FlowField.ts` `a385b74c6f9ba5a80786dd4ef22ec5184439e11b89bf915df9ea10fbe0b2f17a`; `EnemyNavigation.ts` `22c136dc4fdeb801c7c30028cfa904fdd18eab41c2531c325642e2eace7ab2fa`; `GameConfig.ts` `f336aa9c626debd23e2e922b731dd227acec25f72abded80855cc469f4dcc769`; test harness `a9ff05d56af7c97b141497c3dcad71c5785d476b1944de7ec7339a3e85ffa6cd`; benchmark harness `1ad5e4c457cc4fae3ea472ff03e3e4b0e176593f13c3ea79ba7780689f7ebea6`.

`AC-READY-LATENCY` is blocked by the benchmark timing ceiling. The five-run `--construction-jobs` command first measured a raw slice p95 of `33.0933 ms`. After removing only the synthetic benchmark's redundant full-rectangle walkable-polygon check while retaining current scene bounds and the blocking wall, the retry measured raw slice p95 `24.4904 ms`, still above the required `<= 8 ms` limit. The command exits nonzero before it can persist raw slice arrays; its exact failures are recorded in `v2-ready-latency-failure.md`.

The fixed 4096 cap preserves the v2 work/frame and readiness bounds, but the accepted incremental graph-edge work costs more than the permitted Node slice-time ceiling. Reducing that cost requires an algorithmic change to the accepted scheduler/graph implementation, or a changed timing policy, both forbidden by v2. Replan target: authorize a safe graph-edge/slice-cost optimization with replacement safety evidence, or revise the v2 timing AC. The plan remains `verifying`; no live trace, AC-PLAY, or `bugs.md` update was run.

## v3 Algorithm And Tri-State Addendum

- Plan version: v3. Continuation from NAVSTALL.j; risk remains high. Starting and current commit: `7811e198f2c1b399a2dcd80ae1cbb2b68f88379d`.
- Final plan status: `verifying`. NAVSTALL.j-l are complete. The only remaining plan gate is the intentionally unrun fresh Creator trace/AC-PLAY; no live trace, compilation, scene operation, or `bugs.md` update occurred in v3.

| Todo | Result |
|---|---|
| NAVSTALL.j | Done: normal blocked routes build a private, revision-keyed occupancy/edge/distance field directly; diagnostics alone request a connectivity graph. |
| NAVSTALL.k | Done: `pending`/`reachable`/`unreachable` reachability and pending/settled shared-query results prevent caching a pending negative diversion. |
| NAVSTALL.l | Done: focused logic coverage and five-run raw construction evidence were written under `evidence/v3/`. |

`FlowField.ts` removes the redundant normal-field graph dependency, retains atomic publication and round-robin scheduling, and uses a convex-region adjacent-edge fast path that still checks expanded obstacles and portal/castle constraints. `EnemyNavigation.ts` carries pending state through objective, surface, entrance, `blockingLog`, and `logRoute` decisions. The test and benchmark harnesses add diagnostic retry/cache, actual Minion/Boss readiness, job-state, and raw-slice evidence.

| AC | v3 result | Evidence |
|---|---|---|
| AC-CONFIG / AC-TSC / AC-LOGIC | Pass | Focused harness and scoped TypeScript check. |
| AC-SCHEDULER / AC-SAFETY / AC-LIFECYCLE | Pass | Shared field coalescing, 4096 cap, cancellation, cache bounds, and actual body regressions. |
| AC-TRISTATE | Pass | Pending shared diagnostics retry on the same revision; settled values cache; invalidation clears state. |
| AC-BENCH / AC-READY-LATENCY | Pass | Five scene-bound 125x127 runs: 4096 max work units, 35-frame Minion/Boss field readiness, 39-frame required diagnostic-graph readiness, slice p95 `6.0898 ms`, max `11.1440 ms`. |
| AC-TRACE / AC-PLAY | Not run | Exact remaining gap: no Creator bundle/source-hash confirmation and no fresh construction capture. |

Raw outputs: `fix-enemy-navigation-rebuild-stalls-evidence/v3/construction-jobs-v3.json` and `fix-enemy-navigation-rebuild-stalls-evidence/v3/logic-results-v3.json`. Final recorded SHA-256 values: `FlowField.ts` `a1d6c5cfed7a0ad9b161986cbf86bf852589dad410a929510754b1fea1bc9cef`; `EnemyNavigation.ts` `b6427bf912e1f76cb6b751b2e42cf2707e7936bfd228c20c9d9a703cdaa714c1`; benchmark evidence `2862b9ce778a6cc8360222c812210f4158c13ac3b5d51a096ac5edc6e81c5f3e`.

v1/v2 evidence, including v2's `24.4904 ms` failure record, was retained. Foreign dirty files `BuildSystem.ts`, `EnemyBoss.ts`, and `bugs.md` were not edited by v3. No MCP/scene/prefab operations occurred.
