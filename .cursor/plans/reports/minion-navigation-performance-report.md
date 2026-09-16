# minion-navigation-performance build report

Date: 2026-09-16. Plan v2, medium risk. First execution, continued in the same build agent under coordinating-agent direction; no previous task report or accepted task artifacts. Status: completed against the reduced verification scope selected by the coordinating agent. The original v1 exhaustive measurement matrix was NOT completed or accepted.

## Implementation and baseline

Baseline HEAD: `8a255e291accb59fe657df4c8c88786cf2d9211f`. Current dirty disk was the implementation baseline. `minion-navigation-performance-evidence/baseline/` contains the workspace status, 46 dirty/untracked file hashes, binary dirty diff, and source snapshots. Final source hashes and comparisons are in `scope.json` and `release/measurements.json`.

| Todo | Result |
|---|---|
| 4.13.a | Baseline preserved; core baseline 61 tests passed. Initial custom premeasure failed; no valid before timing series. The coordinating agent reduced the five-run matrix to focused functional verification; the user did not explicitly request that reduction. |
| 4.13.b | 0.25s default decisions, stable UUID phase, one decision at most per update, cached world intent, current-frame sweep and attack checks. Target/life/body/service changes clear owned state; knockback and migration clear intent immediately. |
| 4.13.c | Four nearest-face candidates for minion selected blockers, existing commitment and bounded connectivity fallback retained. Independent staggered avoidance, <=4 neighbors and <=24 bucket visits/update; cached correction composed before current sweep. |
| 4.13.d | Global invalidation retained. Cooperative 2ms job deadline checked each 32 primitives, retaining <=4096 work/frame. A separate scheduler frame prevents body-driven bucket rebuilds buying additional slices. |
| 4.13.e | Focused runtime, existing semantic regressions, tsc and strict OpenSpec passed. Scope reduction and limitations below. |
| 4.13.f | This report, plan v2 and matching bugs entry updated. |

Production changes: `EnemyMinion.ts`, `EnemyNavigation.ts`, `FlowField.ts`, `GameConfig.ts`. No changes to `EnemyBoss.ts`, `EnemyAI.ts`, scenes, prefabs, animations or settings. The Boss continues its original decision, surface and unlimited avoidance path; only shared job scheduling receives the conservative deadline.

Test changes: new `test-minion-navigation-performance.cjs`; scoped adaptations in `test-enemy-navigation.cjs`, `test-enemy-break-blocking-log.cjs`, `test-minion-log-route-oscillation.cjs`, `test-building-spawn-minion-knockback.cjs`, and `test-expand-enemy-clear-area.cjs`. Remaining edits are this plan/report, task evidence and `bugs.md`.

## Gates

| AC | Actual result / evidence |
|---|---|
| CADENCE | PASS reduced matrix: 50@30Hz, 50@60Hz, 200@120Hz, each 10s. Maximum decisions/unit 38, 38, 39 (limit 41); initial decision and avoidance updates spread across 8, 14, 30 frames. Integration error <=2.6e-11 world units in independent lanes. 1.2s update performs <=1 decision/unit. All route/blocker/sweep methods real. |
| LOCAL | PASS existing 27 demolition and 12 commitment tests: actual movement, damage/destruction, two-sided legal surfaces, Hard detour, waypoint commitment, same-target movement, invalidation and lifecycle. New measured neighbor peak 4. The full original multi-obstacle/end-to-end combination matrix was not added. |
| GEOMETRY | PASS focused current-frame wall sweep, cancellation, existing same-frame notified edits/static notifications/topology/classification tests. No selective retention implemented or claimed. |
| BOUNDS | PASS existing core cache/admission/epoch/pending/mixed-body tests plus deadline yielding and cancellation. Zero-ms injected deadline stops at 32 work; old queued work cancelled, service destruction frees cache. Original cell/work/entries/bytes/cells/epoch/admission limits unchanged. |
| REGRESSION | PASS: core 61, demolition 27, commitment 12, focused 3 groups, knockback 4 scenarios/48 assertions, migration 4 scenarios/30 assertions. |
| MEASURE | PASS v2 descriptive evidence only. Original five-run paired baseline/final matrix NOT RUN; no measured speedup or FPS claim. |
| SCOPE | PASS source/baseline scope check, tsc, strict OpenSpec and whitespace. Unrelated dirty baseline content preserved. |

Commands and final exit codes (repository root; task-specific `NAV_EVIDENCE_DIR` used for all writing navigation harnesses):

| Command | Exit |
|---|---:|
| `node .cursor/scripts/test-minion-navigation-performance.cjs` | 0 |
| `node .cursor/scripts/test-enemy-navigation.cjs` | 0 |
| `node .cursor/scripts/test-enemy-break-blocking-log.cjs` | 0 |
| `node .cursor/scripts/test-minion-log-route-oscillation.cjs` | 0 |
| `node .cursor/scripts/test-building-spawn-minion-knockback.cjs` | 0 |
| `node .cursor/scripts/test-expand-enemy-clear-area.cjs` | 0 |
| `npx --no-install tsc --noEmit --pretty false` | 0 |
| `openspec validate minion-navigation-performance --strict` | 0 |
| `git diff --check` | 0 |

Final evidence: `release/measurements.json`, `navigation-release/`, `demolition-final/tests.json`, `oscillation-final/tests.json`. Environment overrides were scoped to command processes; the parent/user `NAV_EVIDENCE_DIR` was not changed. No unfinished commands remain.

## Measurements and limitations

One retained final descriptive run, 50 units x 180 frames, dt=1/60, deterministic node identities, actual production methods. Timings include the Node fixture's integration/safety assertions; they are neither browser frame times nor isolated engine CPU profiles.

| Fixture | Decisions | Avoidance updates | Bucket visits | Node median / p95 / max ms |
|---|---:|---:|---:|---|
| Tracking | 569 | 569 | 4736 | 0.372 / 1.000 / 9.004 |
| Dense | 569 | 569 | 4431 | 0.338 / 0.624 / 1.447 |
| Demolition | 230 | 222 | 1246 | 0.291 / 0.851 / 2.952 |
| Log removed | 567 | 563 | 4068 | 0.303 / 0.511 / 1.113 |
| Wall created | 275 | 228 | 1331 | 0.286 / 0.878 / 2.496 |

Tracking represents 9000 unit updates with 569 decisions, not a measured comparison against old production. Demolition measurements intentionally stop at attack lock; actual hit/destroy/recovery is tested by the existing demolition harness. The removal fixture disables geometry explicitly. Wall fixture: 2 jobs queued/completed, 2534 total work, 1152 peak work, 8 entries/11200 bytes peak, one deadline stop; no cancelled jobs in this fixture. Dedicated cancellation test cancels one unfinished job. Selectively retained jobs: zero, by design.

The 2ms setting is a conservative default, not a device-tuned optimum. Deadline checks occur every 32 primitives; a primitive, timer resolution, OS scheduling, or GC can overshoot. Scans, local surface/route queries, bucket rebuilds, allocations, pruning and global clear are outside this budget. Global clear still discards fields, graphs, settled/negative queries and pending jobs on effective geometry/topology changes. Repeated unchanged notifications preserve the current version using the existing equality checks. Shared cold rebuild latency and construction spikes can remain.

No browser profiling, mobile profiling, Creator play session, actual rendering/FPS measurement, or paired five-run before/after experiment was performed. Do not interpret these results as proof that the previously reported FPS drop is resolved. Existing plans' uncompleted gates remain untouched.

## Failures and harness adaptations

- Initial measurement sweep assumed every start was walkable; a newly created wall can overlap a body. Final harness checks line-clear movement from walkable starts and leaves overlap recovery to existing runtime regressions. Initial failure produced no valid baseline timing file; it is not a before sample.
- Existing `Vec2` mock lacked Cocos copy construction, causing knockback velocity assertions to inspect an object-valued x. Added the real constructor semantics. Added a Sprite class so HitFlash can find no renderer without throwing; real damage assertions remain.
- Direct fixture writes to obstacle kind/Log phase bypassed production notifications. Fixtures now explicitly invalidate after these writes; classification and stale-hit assertions remain.
- Boss recovery now uses its existing animation-finish callback. No-Visual Boss fallback finishes synchronously, so that test observes actual HP loss instead of waiting for an already-completed attack lock; exact one-hit damage assertion remains.
- Replay keeps its recorded collider envelope explicitly rather than accidentally substituting the current prefab dimensions. Initial cadence wait is represented in replay/lifecycle acquisition; all stable commitment and legal movement assertions remain.
- Knockback mock adds the new cadence/avoidance API; migration mock adds the existing `requestGeometryCheck`. No production construction/combat code changed.
- An early cadence fixture overlapped all units and therefore measured real separation rather than straight-line speed. Independent lanes now verify exact integration while dense fixtures separately measure avoidance.

No hard blocker remains; no new replan target required.

| MCP metric | Result |
|---|---|
| MCP calls / assembly gates | N/A |
| scene open/save/reimport | 0 / 0 / 0 |
| prefab creation / resource changes | 0 / 0 |
