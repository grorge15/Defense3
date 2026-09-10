---
slug: enemy-unified-navigation
version: 2
status: done
created: 2026-09-10
---

# Unified Enemy Navigation

## Goal

Replace castle/entrance-gated enemy navigation with one unified purple/outside-ground walkable space. Enemies use any real collider-enclosed gap; they prefer a valid normal route, otherwise attack a relevant reachable destructible obstruction, never an indestructible Wall. Only one Log exists, but unrelated living Building/Barrier objects may coexist and must not suppress Log evaluation. Each decision selects at most one removal target; no serial multi-removal planner is required. After destruction enemies resume the original objective. This supersedes the unfinished v4 entrance-diagnostic work in `fix-enemy-navigation-rebuild-stalls` without changing its accepted 30-cell incremental scheduler, 4096 work-unit cap, atomic publish, or bounded cache policy.

## OpenSpec

`openspec/changes/enemy-unified-navigation/`

## Boundaries

- Preserve the current dirty `Main.scene`, `BuildSystem.ts`, `EnemyBoss.ts`, and `bugs.md`; in particular, retain the user HeroShrine-targeting hunks in `BuildSystem.ts` and `EnemyBoss.ts` untouched. Merge only task-owned navigation hunks after recording starting status.
- No `Main.scene`, prefab, `.meta`, asset, animation, coordinate, or MCP/editor write. MCP gates are N/A.
- The old entrance/castle assertions are replaced behavior and may be updated only where they encode portal/inside-outside semantics. Retain physical collision, sweep, body-size, cache, cancellation, pooling, and performance coverage.
- v4 entrance diagnostic todos are superseded, not completed or rebuilt. Retain all v1-v3 evidence and accepted AC.

## Forbidden Actions

- Do not increase `enemyNavWorkUnitsPerFrame` above `4096`, change the 30-cell grid, or increase the 32-entry, 8-MiB, or max-cell limits.
- Do not reintroduce synchronous graph/BFS work, per-enemy pathfinding, per-log synchronous diagnostics, stale/partial-route movement, teleporting, or unsafe direct motion.
- Do not make `Log` type checks the sole classification mechanism. Explicit editor-facing collider/node classification has priority; legacy `Log`/`Building`/`Wall` defaults are compatibility fallback only.
- Do not select or damage an indestructible Wall, treat arbitrary collider removal as walkable, or use a diagnostic ignore view as movement authority. Movement to an action surface remains validated against current obstacles.
- Do not retain entrance state/events, castle boundary routing, portal crossing rules, or build notifications solely for the removed navigation model.
- Do not reset, checkout, overwrite, or fold unrelated dirty changes into task hunks. Stop and replan if a scene/resource edit, changed numeric boundary, or out-of-scope module becomes necessary.

## Files

### Writable

- `assets/scripts/core/FlowField.ts`
- `assets/scripts/core/EnemyNavigation.ts`
- `assets/scripts/core/NavigationObstacle.ts` (new only if no existing equivalent supports explicit editor classification)
- `assets/scripts/core/GameEvents.ts` (remove only obsolete entrance-navigation event use)
- `assets/scripts/enemy/EnemySpawner.ts`
- `assets/scripts/enemy/EnemyAI.ts`
- `assets/scripts/enemy/EnemyMinion.ts`
- `assets/scripts/enemy/EnemyBoss.ts`
- `assets/scripts/building/BuildSystem.ts`
- `assets/scripts/building/Building.ts`
- `assets/scripts/building/Barrier.ts`
- `assets/scripts/building/Wall.ts`
- `assets/scripts/item/Log.ts`
- `.cursor/scripts/test-enemy-navigation.cjs`
- `.cursor/scripts/test-enemy-break-blocking-log.cjs`
- `.cursor/scripts/bench-enemy-navigation.cjs`
- `bugs.md`
- `.cursor/plans/enemy-unified-navigation.md`
- `.cursor/plans/reports/enemy-unified-navigation-report.md`
- `.cursor/plans/reports/enemy-unified-navigation-evidence/`
- `openspec/changes/enemy-unified-navigation/{proposal.md,specs/enemy-unified-navigation/spec.md}`

### New

- `assets/scripts/core/NavigationObstacle.ts` only if needed for explicit `Ignore` / `Hard` / `Destructible` editor classification.
- `.cursor/plans/reports/enemy-unified-navigation-report.md`
- `.cursor/plans/reports/enemy-unified-navigation-evidence/`

### Read-Only

- `AGENTS.md`, `.cursor/rules/{multi-agent-orchestrator,defense3-workflow,openspec,cocos-mcp}.mdc`, `AI_TASK_LIST.md`, `.cursor/plans/_TEMPLATE.md`
- `assets/scenes/Main.scene`, all prefabs, meta files, and assets
- `assets/scripts/core/GameConfig.ts` (assert only: accepted 30-cell/4096/cache limits remain unchanged)
- `.cursor/plans/fix-enemy-navigation-rebuild-stalls.md`, its report/evidence, and all prior OpenSpec changes

## To-dos

- [x] UNAV.1: Recorded baseline `7811e198f2c1b399a2dcd80ae1cbb2b68f88379d`, attributed pre-existing dirty scene/prefab/settings/meta work as foreign, added the editor enum classification contract, and removed runtime entrance configuration while retaining serialization compatibility.
- [x] UNAV.2: Unified normal routing, revision-keyed single-candidate diagnostics, and the component-seed label fix are implemented. The exact full-height divider regression settles unreachable.
- [x] UNAV.3: Minion, Boss, and AI use the generic actionable obstacle adapter with existing damage/lifecycle paths, including original-target resumption and hard-target exclusion.
- [x] UNAV.4: Portal tests were replaced with physical collider-gap, classification, dynamic, multi-collider, lifecycle, pooling, and locked-Building-behind-Log coverage using current prefab collider envelopes.
- [x] UNAV.5: Focused machine checks passed and raw evidence was saved. The matching `bugs.md` v3 entry and completion report were added.

## Acceptance Criteria

- `AC-UNIFIED`: navigation works with no castle polygon, entrance configuration, or entrance-state event. Real open ground and actual collider gaps are traversed under existing body/sweep safety checks.
- `AC-CLASSIFY`: explicit generic collider/node marking controls Ignore, Hard, and Destructible behavior. Legacy attackable Log/Building/Barrier, non-HP Wall, and nonsensor `airWall*` defaults work only when no explicit marking exists; Hard obstacles are never selected for demolition.
- `AC-DEMO`: for both Minion and Boss, normal route settlement prevents demolition; a blocked route chooses one relevant reachable destructible target only when its removal enables the original target, never an irrelevant dead end or Hard obstacle. A blocking Log remains selectable when unrelated living Building/Barrier objects coexist. The generic attack adapter preserves existing hit frame/generation protections, and destruction resumes the original target.
- `AC-COMPONENTS`: the exact `0..140 x 0..60` full-height Hard-divider regression in `UNAV.2` is settled unreachable for body `2` from `(30,10)` to `(90,10)`; no disconnected component aliases the seed label.
- `AC-DYNAMIC`: moving targets and runtime building/log insertion, removal, phase change, or destruction invalidate stale decisions and produce no stale target, stale cache result, or obstacle-crossing movement.
- `AC-SCHEDULER`: cold normal and candidate diagnostics use only shared revision-keyed incremental work; identical requests coalesce, cancellation is revision-safe, no synchronous per-log graph is built, the 30-cell/4096/32-entry/8-MiB/max-cell limits remain unchanged, and Minion/Boss body constraints remain isolated.
- `AC-REGRESSION`: harnesses preserve physical safety, pooling/lifecycle, attack-generation, cache-pressure, and relevant shared-field performance assertions while deliberately removing only obsolete portal/entrance semantics.
- `AC-SCOPE`: no scene/prefab/meta/asset modification; no MCP session or gate. `bugs.md` is updated exactly once after passing verification.

## Verification

```powershell
git status --short
git diff --check
npx tsc --noEmit --pretty false
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/enemy-unified-navigation-evidence/test-enemy-navigation'; node .cursor/scripts/test-enemy-navigation.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/enemy-unified-navigation-evidence/test-enemy-break-blocking-log'; node .cursor/scripts/test-enemy-break-blocking-log.cjs
node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/enemy-unified-navigation-evidence
```

Record source/harness hashes, Minion/Boss body keys, grid/cap, per-frame work, queued/completed/cancelled/coalesced counts, cache peaks, candidate order, and route/demolition/resume outcomes in the report. No MCP operation, Creator trace, or AC-PLAY is required for this pure-script plan; runtime availability is not a completion gate.

## Rollback

Preserve failed raw evidence first. Revert only task-owned unified-navigation hunks; never restore entrance routing, synchronous construction, or a stale/partial fallback. Keep accepted `fix-enemy-navigation-rebuild-stalls` v1-v3 work and all user dirty changes. Replan if the fix requires a scene/prefab edit, a new numeric budget, or a semantic change outside the OpenSpec delta.

## Revision History

- v1 (2026-09-10): New focused replacement plan for unified-ground routing and safe destructible-obstacle demolition. It supersedes only unfinished v4 entrance diagnostics and preserves accepted incremental navigation work.
- v2 (2026-09-10): User clarified that only one Log exists. Removed serial/multi-removal planning and coverage; retained generic marking plus Building/Barrier adapters as useful compatibility. Added the bounded incremental component-label regression required for the full-height Hard divider.

## MCP Metrics

| Metric | Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| new prefabs | 0 |
| OpenSpec change | `openspec/changes/enemy-unified-navigation/` |
