# fix-minion-log-route-oscillation build report

- Plan: v3, 2026-09-12. Risk: medium (shared navigation serves Boss).
- Status: done; all machine acceptance checks passed.
- Continuation: continued the parent diagnosis and baseline harness evidence; first build report, no accepted prefab/scene work repeated.
- Revision history: v1 implementation scope; v2 separated deterministic waypoint replay from known-geometry attack and made the construction benchmark optional; v3 narrowly admitted the existing demolition harness's Boss FINISHED callback adaptation, confirmed by the parent within the bug-fix authorization. Behavior specs unchanged.
- Baseline HEAD: `88ed805db0685114cba25ec041d3084dc831248d`. Existing dirty navigation/Minion diagnostics and the Boss bug entry were preserved. Snapshots and initial diff are under `fix-minion-log-route-oscillation-evidence/baseline/`.

## Todo completion

| Todo | Status | Result |
|---|---|---|
| S1 | Passed | Preserved dirty snapshots, reused parent baselines, fixed real Euclidean Vec2.length mock, captured old failing replay and opposite-side surface tests. |
| S2 | Passed | Unit-owned obstacle commitments retain original target/body/range/role/version/approach independently of route fields. |
| S3 | Passed | Nearest legal direct candidates precede shared reachable fallback; origin-cell/body/offset discriminators prevent whole-component face reuse. |
| S4 | Passed | Minion diversion changes no longer reset navigation. Lifecycle release/reset clear commitments; overlap still runs recovery. Safe terminal movement finishes outside flow arrival tolerance. |
| S5 | Passed | Dedicated 12/12, navigation 55/55, demolition 27/27; TypeScript, OpenSpec strict and diff checks pass. Bug entry and evidence updated. |

## Production changes

`EnemyNavigation.ts`: 98 added / 10 removed lines relative to the saved dirty baseline. Commitment validity checks include obstacle node validity/activity before component access. A full physical line to the current original target releases unnecessary demolition, including movement of the same Player node. Changed geometry revalidates attack-point legality and shared reachability; pending work and overlap preserve the decision while current movement remains swept. Lifecycle cleanup deletes only the owning unit's commitment. Diagnostics expose the retained commitment and decision reason.

`EnemyMinion.ts`: 1 added / 2 removed lines relative to baseline. Removed the destructive diversion-change reset; retained hysteresis adjustment and a `blockerChanged` diagnostic. Existing true-target/death/disable/reset cleanup remains in place.

`FlowField.ts` was not changed: its existing `reachability` and `sharedQueryState` APIs share bounded connectivity. Fallback ordering uses Euclidean nearest reachable candidates, not globally shortest physical path cost. No candidate-specific full fields or new routing engine were introduced. The terminal fix is in `nextObstacleVelocity`: when flow reports reached while still outside attack range, finish the directly swept segment to the legal approach point.

## Changed files

| File | Scope |
|---|---|
| `assets/scripts/core/EnemyNavigation.ts` | Commitments, surface selection/cache isolation, terminal approach, diagnostics |
| `assets/scripts/enemy/EnemyMinion.ts` | Remove diversion reset |
| `.cursor/scripts/test-enemy-navigation.cjs` | One real Vec2.length mock method |
| `.cursor/scripts/test-enemy-break-blocking-log.cjs` | Capture actual Boss animation-finished callback, preserve and strengthen stale-life assertions |
| `.cursor/scripts/test-minion-log-route-oscillation.cjs` | New focused real-script regression harness |
| `bugs.md` | v4 under existing `enemy-break-blocking-log`; all prior content retained |
| `.cursor/plans/fix-minion-log-route-oscillation.md` | v3 scope amendment and completion |
| `openspec/changes/fix-minion-log-route-oscillation/proposal.md` | Verification pointer; requirements unchanged |
| This report and `fix-minion-log-route-oscillation-evidence/**` | Task-local snapshots and machine results |

Boss production, FlowField, scenes, prefabs, meta, combat config, other reports and other evidence were not edited.

## Acceptance results

All paths below are relative to `.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/`.

| AC | Status / tests | Evidence |
|---|---|---|
| AC-REPLAY | Passed: `AC-REPLAY`. Old code: 30 switches / 60 resets; fixed: 0 / 0 in 60 frames. | `old-regression/tests.json`, `regression/tests.json` |
| AC-ATTACK | Passed: `AC-ATTACK`, `AC-ATTACK-TERMINAL`. Actual Minion collider, navigation, physics-unit conversion, movement and frame-hit damage callback. 48/623 frames, speed 128 world units/s, net/path 99.91, 1 attack, Log HP reduced by 10, final approach distance 0. | `regression/tests.json` |
| AC-SURFACE | Passed: opposite north/south queries share connected ground but retain local direct faces, including offset body. `AC-SURFACE-FALLBACK` travels 353.764 units in 46 frames around a screening wall; every step swept, one movement field, no candidate fields. | `regression/tests.json` |
| AC-LIFE | Passed: five `AC-LIFE` cases cover field-vs-unit cleanup, dual-unit isolation, same-player direct cancellation, target/body changes, actual Minion disable/death/reset/revival/destruction, pending/overlap, log phase/removal, inactive/destroyed Building, sealed topology and blocked approach. Existing Minion/Boss generation/pool/hit-safety/moving-target tests pass. | `regression/tests.json`, `demolition/tests.json` |
| AC-BUDGET | Passed: 200 units x 300 stable frames, zero additional surface scans, blocker scans, fields, graphs or cancellations. `AC-BUDGET-COLD`: 200 detour queries share one graph and one surface scan; zero full candidate fields. | `regression/tests.json` |
| AC-REGRESSION | Passed: dedicated 12/12, existing navigation 55/55, demolition 27/27, tsc exit 0, strict OpenSpec exit 0, diff check exit 0. | `regression/tests.json`, `navigation/logic-results-v3.json`, `navigation/run.log`, `demolition/tests.json`, `verification.json` |
| AC-PLAY | Not run; optional, does not block machine acceptance. | No Creator play claim |

Replay deliberately injects the two observed planning waypoints only at `FlowField.direction` for the planning area. Physical flow, selected-blocker queries, surface selection, Minion branching and reset logic remain real. The origin is held at the observed position to isolate branch oscillation; this is not a numerical simulation of missing HighPlatform wall geometry. Both fixture body and actual Minion collider are checked against 38.88 x 38.88, offset (2.88, 19.2). The independent movement fixture integrates actual physics velocity x32 and verifies every displacement against the real map before invoking the real attack-frame callback. No commitment result or hit result is mocked.

## Budget measurements

| Metric | Stable 200 x 300 | Cold 200 detour queries |
|---|---:|---:|
| Surface scans | 4 warmup, +0 | 1 |
| Blocker scans | 4 warmup, +0 | 0 (surface query) |
| Full fields | 0 | 0 |
| Connectivity graphs | 0 | 1 |
| Queued / completed / cancelled jobs | 0 / 0 / 0 | 1 / 1 / 0 |
| Peak scheduler work/frame | 0 | 1591 / 4096 cap |
| Flow cache entries / bytes | 0 / 0 | 2 / 3096 (caps 32 / 8388608) |
| Commitments after release | 0 | No unit commitments requested |
| Flow bytes after service destroy | 0 | 0 |

The existing selected-blocker cache remains bounded at its configured existing limit; the warm fixture has four cached source/body selections. Per-unit commitments live with registered units, separately from flow cache storage. Cold fixture settles in 2 frames. Construction benchmark was not needed because these budget tests exposed no budget anomaly.

## Failures and resolution

1. Initial replay setup lacked the existing diagnostic's `worldPosition` mock. Added a live position getter in the new fixture; then captured genuine old-code branch and surface failures. Old failure evidence is retained.
2. Selecting the nearest legal range-edge point exposed FlowField's existing 7.5-unit arrival tolerance. Minion and Boss could stop before attack range. The safe terminal segment fix passes a dedicated arrival test and all actual movement/damage regressions.
3. After that fix, only existing Boss AC-POOL failed: its old `.8s` death schedule no longer exists after the prior Boss animation fix. Plan v3 authorizes test-only FINISHED event capture. Old hit/recovery/death callbacks are all still invoked against a reused life; the test also verifies the old death callback cannot hide it. Boss production is unchanged.
4. A new phase fixture initially demanded movement through a collider left enabled by the fixture. Corrected it to require commitment cancellation and safe movement/waiting under that unchanged solid geometry. Removal/inactivity/destruction cases independently require resumed forward pursuit.

No remaining blocker or replan target. Limitations: no full missing-geometry HighPlatform replay, no Creator play/FPS measurement, heuristic fallback does not promise global shortest physical routes. NAV_EVIDENCE_DIR was set only in child command processes and always to this task; the parent environment remains unchanged.

## MCP metrics

| Metric | Value |
|---|---|
| MCP calls, prefab creation, scene saves | 0 |
| AC-GATE / P3 / EDITOR-MCP | N/A: pure scripts, no scene or asset changes |
