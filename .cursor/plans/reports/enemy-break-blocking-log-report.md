# Enemy Break Blocking Log Build Report

## v3 Follow-up (2026-09-10)

Machine status: done. This follow-up fixes two reproduced stopping conditions from the user's report; it does not claim complete live gameplay acceptance.

- With current Main.scene entrances, fixed Log 235x19, and prefab Minion body 32.18x35.30 at offset (2.56,19.52), unit (0,1900) targeting (0,1500) returned raw grid reachable=true, entrance usable=false, blockingLog=null, velocity=(0,0). The obstruction query now respects the same entrance obligations as actual movement and tests other usable entrances. Per-unit transition obligations persist while approaching the log across the castle edge; reset/release/target changes discard stale state.
- The prefab Visual is 128x128 at root scale 0.8. Its old overlap clamp can stop upward movement with the physical body still about 65 units from the log, beyond the 32 attack range. Fixed logs now rely on the physical navigation sweep. Rolling/charging contact behavior remains in the existing path.
- Changed production files this round: EnemyNavigation.ts and EnemyMinion.ts. Dedicated test file extended; plan/spec/bugs/report updated. No intentional scene/prefab/meta/config edit. Existing v2 implementation and evidence preserved.
- Original 44 + dedicated 39 = 83 tests pass; tsc, strict OpenSpec, and diff checks pass. Evidence: `enemy-break-blocking-log-evidence/v3/`, including red/green results, final JSON, and task diffs. The new real-geometry tests advance actual enemy methods through crossing, frame damage, destruction and resumption, including actual Visual dimensions.
- Creator official CLI build used `v3/creator-build.json`, completed with exit 36, and produced `build/codex-log-v3/web-mobile`. The output main bundle contains both `_objectiveEntrance` and the physical-body fixed-log change; bundle timestamp is later than both source timestamps. Initial project.log lock/GPU-cache messages and existing circular-dependency warnings did not prevent the successful build. Source and resource content was not patched to bypass compilation.
- Browser smoke check at `http://127.0.0.1:8766/`: Main.scene loaded and rendered, Cocos 3.8.8 initialized, and `[Log] blue line LOCK OK length=3 need>=3` was observed from the new main bundle. No script errors were observed. Sides remained open during this smoke check, so it does not verify the full closed-side-stairs demolition sequence or sustained FPS.
- The old editor preview did not refresh its script output on page reload; use the independent new build to avoid confusing old preview scripts with these fixes. No editor process was closed, and no scene save/reimport was forced.
- Original report below records the v2 baseline. Generic physics-unit/contact-overlap risks are not established as the cause of the v3 reproduction and were not expanded into a physics-system rewrite.

- Plan: enemy-break-blocking-log v2, done; OpenSpec: `openspec/changes/enemy-break-blocking-log/`.
- Revision: v2 replaces inaccessible tool-store snapshots with disk snapshots, explicitly shares Boss ordinary Log surface routing, and adds three bounded stand-off layers. No behavior AC removed or weakened.
- Risk: medium-high. Continuation: no prior build report; EBL.a and main-thread 44-test/tsc baseline accepted without a new scene survey. This run used one build-agent throughout.
- HEAD before writes: `0eaa18dc4db4a06313aed088ccd16c594ffec3a5`.
- Main-thread review accepted actual update/hit/destruction/resumption tests, ordinary Boss Log handling, narrow-slot stand-off case and readonly scene fixture; no outstanding blocking review finding.

## Baseline And Scope

All evidence paths below are relative to `enemy-break-blocking-log-evidence/` beside this report.
Before any production edit, `baseline/` received byte copies of the five dirty production scripts, original harness, plan and bugs; `manifest.json` records HEAD/status/hashes, and `dirty.diff` records the existing tracked changes. Main-thread tool-store snapshots were not misrepresented as disk files.

Task-only hunks are in `task-only.diff`; `scope-check.json` compares against that dirty baseline, not HEAD. No unrelated changes were restored. The final scope observation found no new external production edits during this run. Existing prefab/scene/meta/Log/config and other agents' source changes remain intact. 243 protected resource/old-evidence hashes match. The original 44 test call bodies are text-identical to baseline, checked structurally using the TypeScript parser.

Baseline hashing skipped Git-quoted non-ASCII paths that were not literal disk paths; tracked-change/new-file verification separately uses NUL-delimited Git output. No claim of byte-baselining every repository file is made. All task-relevant source, resource and historical evidence paths were covered.

## Todo Matrix

| Todo | Result |
|---|---|
| EBL.a | Accepted planning/baseline handoff; not repeated |
| EBL.b | Done: critical plan/spec/report/source read, HEAD/status, disk snapshots, independent regression output |
| EBL.c | Done: initial three failures preserved in tests-before.json; expanded to 31 real-method cases |
| EBL.d | Done: shared causal query, surface approach, Minion/AI/Boss integration |
| EBL.e | Done: actual HP/frame/cooldown/death/reset chain and shared-cache counters |
| EBL.f | Done: 44+31 tests, tsc, strict spec, scope and diff check; main-thread review accepted |
| EBL.g | Done: one bugs issue, plan done, this report; gameplay/FPS explicitly unverified |

## Changed Files

| File | Task Delta |
|---|---|
| assets/scripts/core/FlowField.ts | Exact reachability entry point, fixed-size shared query results in existing combined LRU/byte budget; diagnostic area identity |
| assets/scripts/core/EnemyNavigation.ts | Tracked fixed Log identity/state invalidation, causal single-Log diagnostic, body-to-surface hit checks, contact/half-range/full-range stand-off candidates, real-area movement/sweep; shared contact Log reference |
| assets/scripts/enemy/EnemyMinion.ts | Separate temporary Log, check before player hysteresis, frame and lifecycle generations, cleanup/resumption; existing player chase rules preserved |
| assets/scripts/enemy/EnemyAI.ts | Log-specific begin/frame damage using existing cooldown and configured damage; actual collider body |
| assets/scripts/enemy/EnemyBoss.ts | Temporary and ordinary Log surface routes, ordinary priority preserved, circular candidate deduplication and generation guards |
| .cursor/scripts/test-enemy-navigation.cjs | NAV_EVIDENCE_DIR support and export existing eventNode; no original case changes |
| .cursor/scripts/test-enemy-break-blocking-log.cjs | New dedicated real-source harness tests and task-local evidence |
| .cursor/plans/enemy-break-blocking-log.md | v2 revision, todo evidence and done status |
| bugs.md | One new enemy-break-blocking-log symptom/cause/solution entry, only after machine gates passed |
| This report and task evidence directory | New baseline, gate outputs, results, fixture, counters and incremental diff |

OpenSpec was read/validated, not edited. No scene/prefab/meta/Log/GameConfig/animation file was written. Old benchmark was never run.

## Machine AC

Final command outputs and exit codes: `gates.json`, `regression.txt`, `dedicated.txt`, `tsc.txt`, `spec.txt`, `diff-check.txt`. Test results: `logic-results.json` (44), `tests.json` (31). All commands exited 0.

| AC | Result / Evidence |
|---|---|
| ENTRY | PASS: complete ground/castle/three-entrance fixture, sides closed, middle endpoint occupied and middle segment blocked. Both real Minion/Boss updates advance to attack and frame damage. Ordinary locked Boss Log separately advances/hits. Main.scene bindings plus full parent quaternion/scale/position transforms and real middle reachability in scene-entrances.json |
| SAME | PASS: inside/outside same-side blocking, nonnull replacement with unreachable objective, and real Minion 32/50 early-hold counterexample |
| ALTERNATE | PASS: direct, same-side detour and alternate open entrance keep original target |
| NONLOG | PASS: no Log, second non-Log seal, closed/illegal portal and missing ground reject diversion/illegal hit; normal Boss building damage preserved |
| MOVING | PASS: actual Log rolling/charging/failed/inactive/unlocked state rejects diversion; fixed-state changes invalidate caches. Original moving-contact/sweep regression retained |
| SURFACE | PASS: long geometry, positive/negative offsets, body sizes and physical rotation/scaling, reachable other face, contact epsilon, thin non-Log line occlusion, large-dt sweep; narrow slot needs farther in-range stance when body cannot occupy contact stance |
| RESUME | PASS: actual Log.takeDamage/HP event/collider disable/removal; own and external destruction, moving/invalid original, Minion reassignment, route reset/release. Boss original target retained; normal priority and retarget code retained |
| DAMAGE | PASS: actual Minion+AI/Boss/Log classes, no damage before frame, configured per-role damage once, cooldown, Minion single target, Boss Log deduplication, no-Visual fallback, invalid/moving/out-of-range Log at frame |
| POOL | PASS: both enemies' old hit/recovery/death callbacks replayed after death/disable/reset/new attack; no old damage/unlock/pool return. Same-life old attack callbacks also rejected. Original Spawner stale callback case passes |
| SHARED | PASS: 200 units x 300 frames in three positive/negative groups; exact counts below. Original 10 blockers x 300 frames = 3000 checks still passes |
| CACHE | PASS: body/offset/component isolation, exact same-cell terminal changes, portal changes and unchanged notification; 10000 queries/1000 revisions, combined entry pressure and separate byte pressure, reset/destroy cleanup |
| REGRESSION | PASS: original 44 unchanged + 31 dedicated; tsc exit 0. Direct/overlap zero-graph/zero-field and moving-body baseline counts retained |
| SPEC | PASS: defense3-lite strict validation; change contains proposal/spec and .openspec.yaml only, no design/tasks |
| SCOPE | PASS: dirty-baseline incremental comparison, protected hashes, original test bodies and write allowlist; git diff --check exit 0 |
| PLAY | NOT RUN, nonblocking: real Creator physics/animation/gameplay/FPS not verified |

## Shared Counts

Each row warms 200 units, then performs 60000 queries across 300 further frames. Counts are totals before -> after, not timing claims. FullSceneScan = 1 -> 1 and distance fields = 0 -> 0 in every group.

| Group | Tracked Checks | Blocking Scans | Surface Scans | Connectivity Graphs | Entries / Bytes |
|---|---|---|---|---|---|
| Positive blocking Log | 1 -> 301 | 1 -> 1 | 1 -> 1 | 1 -> 1 | 2 / 4220 |
| No Log, non-Log closure | 2 -> 602 | 1 -> 1 | 0 -> 0 | 1 -> 1 | 2 / 4220 |
| Log plus non-Log closure | 2 -> 602 | 1 -> 1 | 0 -> 0 | 2 -> 2 | 3 / 7250 |

The positive fixture's diagnostic path is direct, so it builds no diagnostic graph; the non-Log negative fixture builds one additional diagnostic graph, reused thereafter. 10000 queries over 1000 geometric revisions: 1000 connectivity graphs, 1000 blocking scans, zero distance fields; peak 2 entries/4232 accounted bytes. Entry-pressure result: 8 entries/11516 bytes under an 8-entry cap. Independent byte-pressure result: 13 entries/17586 bytes under 64 entries/18000 bytes. Production remains 32 combined entries/8 MiB/262144 admitted cells; diagnostics and positive/negative query records participate in the same budget. Accounted bytes are not process RSS.

## Failures And Residual Risks

- Initial red tests failed on the absent interface, as intended. New fixture corrections: eventNode positions use getWorldPosition; CoinSystem mock must be a component class; traversal time derives from real configured speed; a same-side fixture originally admitted a legitimate detour through the other region and was sealed to express the intended counterexample.
- The first scope script misclassified Git-quoted non-ASCII tracked names as new paths. Evidence gathering identified quoting, and NUL-delimited lists fixed the check without source/resource changes.
- No outstanding machine blocker; no replan target required. Surface candidates are bounded samples using existing grid connectivity, not a general multi-obstacle demolition planner. Only one candidate Log is diagnostically ignored; all real movement retains it until destruction.
- Node harness does not prove Creator physics, attack animation visuals or current compiled-preview freshness. This run did not measure game FPS. Prior actual-bounds cold connectivity around 291ms remains a historical risk; warm sharing does not establish FPS recovery or eliminate cold stalls.
- Rollback scope: reverse task-only hunks against baseline snapshots, never restore whole files from HEAD or delete another agent's artifacts.

## MCP Metrics

| Metric | Count |
|---|---|
| scene-open / scene-save | 0 / 0 |
| assets-refresh / assets-reimport-asset | 0 / 0 |
| create-prefab-from-node / new prefab | 0 / 0 |
| post-scene-save / resource gates | N/A, pure script task |
