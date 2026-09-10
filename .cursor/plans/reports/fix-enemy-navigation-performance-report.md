# Enemy Navigation Performance Build Report

- Plan: fix-enemy-navigation-performance v2 (2026-09-09).
- Revision: v2 permits conditional Minion/Boss safety/body fixes; game FPS evidence is non-blocking. Log/resources/OpenSpec/combat draft remain read-only.
- Status: done (machine build). Game FPS: pending; Creator preview had stale intermediate compiled scripts, not the final patch.
- Risk: medium-high. Continuation: no; NAVPERF.a already accepted and skipped.
- Git HEAD baseline: 0eaa18dc4db4a06313aed088ccd16c594ffec3a5.
- Existing report: absent. Existing dirty/untracked code and assets retained.
- Baseline snapshots/hashes and raw measurements: fix-enemy-navigation-performance-evidence/.
- Communication: send_input unavailable in this tool inventory; progress via shared report and commentary.

| Todo | State |
|---|---|
| a | accepted before build |
| b | complete: baseline/manifest.json, original TS and dirty.diff saved before production edits; scene bindings resolved structurally |
| c | machine baseline complete: five rounds of core/default/actual bounds and service; body/post-processing probe saved |
| d | complete: direct/blocked fast paths, connectivity, approach cache and bounded eviction verified |
| e | complete: blocker candidates, structure/component listeners, selective geometry listeners, frame latch and coalesced commits verified |
| f | complete: 44 logic cases, stress, actual Minion/Boss/Log integration, five-round benchmark; game measurement limitations recorded |
| g | complete: bugs topic fix-path-agent-frame-drop receives separate v4 log-contact and v5 building entries after machine checks passed |

## AC

Machine gates passed. Initial TypeScript check found ES2015 flatMap incompatibility; fixed using loops. Existing logical suite exposed thin-corner LOS sampling, fixed by exact inflated-rectangle segment intersection. Old cache tests now use blocked paths so their original shared-field/ref assertions remain meaningful. The old same-cell fixture was itself outside bounds; made its movement fixture valid and added explicit invalid-start coverage. Two new fixture errors (wrong boundary coordinate and incomplete mock node API) were corrected without weakening their assertions.

| AC | Result / Evidence |
|---|---|
| SCOPE | PASS, diff check exit 0; initial dirty hashes retained; parallel changes attributed below and in scope-check.json |
| TSC | PASS, final `npx tsc --noEmit --pretty false`, exit 0, empty output |
| LOGIC | PASS, `node .cursor/scripts/test-enemy-navigation.cjs`, 44 passing cases; logic-results.json |
| FAST | PASS, 200 direction + approach requests: zero fields/graphs/retained fake IDs; detour-to-direct ownership released |
| UNREACHABLE | PASS, cold one connectivity graph / zero target fields; 200 other starts reuse graph and negative approach cache |
| LOG-CONTACT | PASS, overlap and contact +/- epsilon zero graphs; exact point with blocked cell center safely connects and moves; real Minion/Boss and readonly Log phase methods exercised, large dt and separation recovery retained |
| INVALIDATE | PASS, 300 frames x 200 units x 10 blockers: 3000 additional blocker checks, no additional full-scene scans or signatures; unchanged notifications zero commits; notified same-frame second transaction, component/structure/active/animation/portal/bounds changes covered |
| CACHE | PASS, 10000 requests / 1000 revisions; retained-ID eviction, entry and separate byte pressure, release/destroy cleanup; real Minion/Boss 600 translating frames with changing targets and swept AABBs: one graph / zero fields |
| BENCH | PASS, default command runs original four samples plus warm, moving-body/target and service groups; five rounds each, counts asserted |
| PERF-GAME / PLAY | PENDING, nonblocking under v2; final compiled preview unavailable, no comparable final FPS measurement |

Baseline medians (ms), five independent cold rounds per case: default clear200 24.729, unreachable 1616.912, invalidate5 65.468, overlap 2823.794; actual 35717-cell bounds clear200 32.572, unreachable 3595.904, invalidate5 137.111, overlap 6018.033. Unreachable/overlap each built 289 target fields. Stable service 300 frames scanned the scene 300 times; five unchanged invalidations advanced revision by five.

Final benchmark is saved in after.json. **Actual-bounds cold connectivity remains approximately 291ms** with rectangular ground, a residual potential stall. Warm results do not erase that cost, and no game FPS recovery is claimed. Initial optimization still repeated per-candidate access/geometry checks; final code uses one label set and bounded component/exact-target approach caching. Stable area serialization is cached by complete service revision.

Main-thread preview evidence: localhost:7456 exposes an FPS overlay. LOCK FAIL length=1 need>=3 followed by fade-out; combat_guide screenshot 55 FPS / game logic 5.09ms. Later instantaneous samples included 2 FPS / logic 293.02ms, 1 FPS / logic 1054ms, and 47 FPS / logic 10.34ms followed by 4 FPS / logic 252.53ms. These are **intermediate cached-build** samples: main thread confirmed EnemyNavigation preview chunk f5/f5c33be4f8651dd76f710ba1a5eec5dae964c10c.js timestamp 18:13:30 and FlowField e5/e5977a4648dee8cf39f5f551b76d26e7b9cdce63.js 18:07:40, missing newer EnemyNavPerf diagnostics. They do not establish final-patch performance or fixed-log-contact reproduction. Main thread closed the temporary preview tab; no temp compiler output, scene or import operation was modified. Creator must finish recompiling current disk sources before final gameplay comparison. Diagnostic logging is delivered OFF (when enabled, aggregated at most once per second).

## Benchmark Evidence

Environment: same Windows x64 machine, Node v22.17.0, TypeScript 5.4.5; actual TS transpiled and loaded in Node VM. Grid 20, lookahead 20; actual scene bounds resolved from Spawner navBoundsMin/navBoundsMax references and parent transforms, 187x191=35717 cells. Original four samples retain their exact input geometries; overlap deliberately has no ground/castle. Extended warm/moving cases also isolate the core without ground/castle and must not be conflated with a live Cocos frame.

Each cell below is median / p95 milliseconds (five rounds, empirical p95=max of five). Extended warm/body baselines were subsequently replayed from the preserved original TS, not claimed as historical pre-edit runs. before-replay.json is an additional instrumented replay of all original samples with the preview tab closed; before.json remains the untouched original pre-edit sample set. Tiny overlap timings are below useful wall-clock resolution; the zero-work counts are the meaningful proof.

| Bounds / Sample | Before | Final |
|---|---:|---:|
| Default CLEAR-200 | 24.729 / 35.687 | 5.137 / 11.083 |
| Default UNREACHABLE-COLD | 1616.912 / 1647.402 | 131.177 / 144.995 |
| Default INVALIDATE-5 | 65.468 / 66.273 | 0.308 / 0.406 |
| Default LOG-OVERLAP-COLD | 2823.794 / 2854.134 | 0.0027 / 0.0112 |
| Scene CLEAR-200 | 32.572 / 33.071 | 4.840 / 8.919 |
| Scene UNREACHABLE-COLD | 3595.904 / 3613.492 | 290.820 / 292.134 |
| Scene INVALIDATE-5 | 137.111 / 144.161 | 0.109 / 0.113 |
| Scene LOG-OVERLAP-COLD | 6018.033 / 6099.280 | 0.0019 / 0.0037 |
| Default WARM-UNREACHABLE-200 | 201.503 / 210.676 | 8.782 / 9.370 |
| Default MOVING-BODY-TARGET-200 | 1629.102 / 1647.424 | 9.992 / 10.880 |
| Scene WARM-UNREACHABLE-200 | 206.010 / 207.192 | 8.194 / 8.362 |
| Scene MOVING-BODY-TARGET-200 | 3293.052 / 3449.675 | 9.819 / 9.916 |

Moving sample: original 646 cached fields, 357 additional builds after warm-up; final one graph, zero fields, zero additional graph builds and five bounded graph/approach entries. Warm negative result is reused across starts: 288 candidates examined once, rather than per unit/query. Service-only 300-frame time is approximately unchanged within noise (before median 11.635ms; final 11.783ms), despite scan/notification counts improving; do not claim a service wall-clock speedup from that tiny fixture. Service counts are 300->1 full scans and 5->0 unchanged-notification version increments. Raw CPU timings (BFS, graph, approach, prepareFrame), visits, candidates, hits, entries and accounted bytes are retained in JSON.

Commands (all exit 0): `node .cursor/scripts/bench-enemy-navigation.cjs --baseline` (initial only), `--baseline --service` (initial only), `--before-source` (preserved-source replay), `--extended --before-source`, `--extended`, `--service`, and final `node .cursor/scripts/bench-enemy-navigation.cjs`.

FlowField SHA256 before: `7de6085c3d32e941355f352bf49200f328e2358b0227f7cbd3830fd01c37c508`; final: `f5ab38b4339431118902690695abe247e1e2f2507ba55c378e4d9bbf1d0bdad9`. Other source hashes, scene hash, original git diff and Node/TS versions are in baseline/manifest.json and final scope-check.json; final benchmark includes its harness hash.

## Cache Budget

Production budget: 32 combined graph/field/positive-or-negative approach entries, 8 MiB accounted persistent bytes, maximum 262144 admitted cells. Graph uses 5 bytes/cell (component labels + four-direction edge bits), field 4 bytes/cell; each flood queue is a temporary Int32Array, at most 1 MiB, never retained. New graph arrays plus queue require at most 2.25 MiB transient storage above the existing cache; field construction needs at most 2 MiB. Accounting includes UTF-16 key length and a fixed per-entry allowance, not a claim of exact process RSS or GC overhead. LRU can evict retained identifiers; units re-query and cannot hold stale arrays. No per-unit search or unbounded negative cache remains.

Final benchmark observed peak accounted bytes 180341. Stress with an 8-entry/256KiB budget reached 8 entries and 11796 bytes; separate 64-entry/8KiB byte-pressure case forces eviction before the entry limit. See logic-results.json for exact peaks. Destroy clears caches, tracked colliders, node listeners and unit ownership.

## Changes

Production changes in FlowField, EnemyNavigation, GameConfig (cache budget only), BuildSystem/EnemySpawner (notification deduplication only), conditional Minion/Boss body envelopes and Minion final velocity safety. Test and benchmark harnesses expanded. All scene/prefab/meta/Log/OpenSpec/combat-plan files remain untouched by this agent.

Conditional-write evidence: body-postprocess-before.json records actual Minion method sampling under translation and a zero navigation velocity overwritten to Y=5 by rolling-log post-processing. Physical body uses collider size/offset, world scale and the same quaternion-to-2D-angle conversion as local Cocos 3.8.8 Box2D; it does not treat a swept fixture AABB as a new shape. Physical 80-unit geometry remains exactly 80 for an 80-unit stair. Only the missing-geometry fallback uses an outward-rounded envelope consistently for key and geometry. Tests vary translation, swept AABBs, positive/negative offsets, scale and rotation; final sweep preserves legal rolling carry speed while enforcing map constraints. This is code/mock evidence, not an observed live-game body trace.

Local engine evidence: scene-graph/node-event.ts defines child-added/removed, component-added/removed, transform-changed, active-in-hierarchy-changed and node-destroyed; node.ts actually emits component events at 1135/1408. Box2D box-shape-2d.ts derives fixtures from size/offset and absolute scale; rigid-body.ts uses Quat.toEulerInYXZOrder for 2D rotation. Only blocker/ancestor/marker transforms are watched. Silent collider size/offset/enabled changes are checked once per frame; a second transaction after a same-frame consumer must emit its existing explicit invalidation, as covered by tests. No promise of observing arbitrary silent intra-frame property mutations is made.

Parallel attribution: final scope initially observed external Log and combat-plan hash changes plus newly dirty Soldier/Arrow/HeroSelectUI and another plan/spec. Read both fix-defense-combat-expand-report.md and fix-log-initial-hero-select-pause-report.md and preserved their work. In GameConfig only the four enemy cache/diagnostic constants are task-owned; in BuildSystem only removal of the redundant direct invalidate is task-owned. Expansion hiding and all log constants remain external. scope-first-observation.json preserves that initial finding; scope-check.json records attribution. No rollback or resource writes occurred.

## MCP Metrics

| Metric | Count |
|---|---|
| Read queries / scene open / scene save | 0 / 0 / 0 |
| Refresh / reimport / prefab creation | 0 / 0 / 0 |
| Resource gates / post-scene-save | N/A |

## Failures And Blockers

No remaining machine blocker. Game verification is pending solely as documented above; no save/reimport/temp-edit workaround was attempted. If cold-build stalls remain in a freshly compiled gameplay trace, the recommended follow-up is a narrowly scoped cold-connectivity scheduling/geometry-query performance plan, preserving the accepted safety and warm-cache work. Do not reopen prefab/scene assembly or infer FPS recovery from Node timing.
