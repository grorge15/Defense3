# Parkour Log Physics Driver - Build Report

- Date: 2026-09-15
- Plan: `.cursor/plans/parkour-log-physics-driver.md`
- Plan version: v1 (initial draft; no recorded revision history)
- Status: DONE
- Risk: High - changes runtime physics ownership, attachment lifecycle, and collision/navigation behavior.
- Continuation: No. This run started from the first unfinished todo with no prior report present.

## Baseline

- Git HEAD before the first write: `530d617510e12a8adf4e248fafbc8f95a74757be`.
- Initial unrelated worktree changes for `configurable-game-audio` and the in-progress plan/OpenSpec artifacts were preserved.
- Additional concurrent, plan-external worktree changes appeared during the run. None were reverted or edited.

## Todo Matrix

| Todo | Status | Evidence |
| --- | --- | --- |
| a. Read plan, rules, OpenSpec, bugs, report state, git state, and disk state | Done | Required sources and current artifacts reviewed before writes. |
| b. Player attachment and physics state restoration | Done | `Player.ts` snapshots/restores parent, Rigidbody2D, and Collider2D state; death detaches before GameOver. |
| c. Log sole rolling Rigidbody2D driver | Done | `Log.ts` configures Dynamic, solid, fixed-rotation physics and accepts Player intent as Log velocity. |
| d. Completion/failure lifecycle ordering | Done | Success detaches/restores before `PARKOUR_FINISHED`; failure unbinds, emits `LOG_FAILED`, fades, then emits completion. |
| e. ParkourLineZone completion handoff | Done | Zone delegates to `tryLockAtFinish()` without publishing completion itself; existing fixed-width requirement remains. |
| f. Enemy rolling AABB compensation removal | Done | Legacy Log/AABB compensation helpers and callers removed; fixed Log navigation path retained. |
| g. Nested SortingOrder2D ownership boundary | Done | Parent traversal stops at descendant nodes with their own `SortingOrder2D`. |
| h. Focused static harness and navigation test update | Done | New parkour harness added; navigation assertions updated for physics-driven rolling behavior. |
| i. Machine verification | Done | Final TypeScript gate passed on 2026-09-15; focused, contact, navigation, OpenSpec, and diff checks also pass. |
| j. `bugs.md` update after machine AC | Done | Added the required `fix-log-follow-contact` v5 entry. |

## Changed Files

- `assets/scripts/character/Player.ts`
  - Added parkour attachment snapshot/restore and guarded Player velocity writes.
  - Restores Player physics before completion/failure events and before death GameOver.
- `assets/scripts/item/Log.ts`
  - Makes Log the Dynamic, solid, fixed-rotation Rigidbody2D physics owner while rolling.
  - Uses Player input intent only as a Log velocity command.
  - Removes rolling follow transforms, line polling, and AirWall/AABB pushout behavior.
  - Orders success/failure detachment and events as required.
- `assets/scripts/game/ParkourLineZone.ts`
  - Removes early `PARKOUR_FINISHED` publication and delegates result to Log.
- `assets/scripts/enemy/EnemyMinion.ts`
  - Removes rolling Log AABB compensation and related imports/state/helpers.
- `assets/scripts/core/SortingOrder2D.ts`
  - Stops ancestor sorting traversal at nested `SortingOrder2D` boundaries.
- `.cursor/scripts/test-parkour-log-physics-driver.cjs`
  - Added focused static AC harness.
- `.cursor/scripts/test-enemy-navigation.cjs`
  - Updated assertions to ensure rolling physics does not reintroduce legacy compensation.
- `.cursor/plans/reports/parkour-log-physics-driver-report.md`
  - This report.

This run did not modify `Main.scene`, any prefab, or any meta file. No scene/prefab MCP operation was performed.

## AC Results

| Gate | Result | Notes |
| --- | --- | --- |
| AC-1 `npx --no-install tsc --noEmit --pretty false` | Pass | Final verification passed on 2026-09-15. |
| AC-2 `node .cursor/scripts/test-parkour-log-physics-driver.cjs` | Pass | All four focused static assertions passed. |
| AC-3 `node .cursor/scripts/test-log-contact-cut-projection.cjs` | Pass | Existing contact-cut projection coverage passed. |
| AC-4 `node .cursor/scripts/test-enemy-navigation.cjs` | Pass | Full navigation core test passed with temporary evidence output outside the repository. |
| AC-5 `npx openspec validate parkour-log-physics-driver --strict` | Pass | Exit code 0. OpenSpec printed its existing schema guidance warnings and reported the change valid. |
| AC-6 banned transform/compensation scan | Pass, reviewed | No legacy rolling follow/AABB compensation remains. `Log.ts` retains only fixed-point placement plus visual/shadow geometry placement; `EnemyMinion.ts` retains unrelated expansion relocation. |
| AC-7 `git diff --check` | Pass | Exit code 0. Scope-only name check cannot pass because concurrent plan-external changes are present in the worktree. |
| AC-8 `bugs.md` v5 update | Pass | Added under the existing `fix-log-follow-contact` topic. |
| AC-PLAY | Not run | Nonblocking by plan; no in-editor or device play verification was performed. |

## MCP Metrics

| Metric | Count |
| --- | ---: |
| Scene opens | 0 |
| Scene saves | 0 |
| Scene closes | 0 |
| Prefab edit sessions | 0 |
| Prefab creates | 0 |
| Asset refreshes | 0 |
| Asset reimports | 0 |

## Completion

The final TypeScript gate passed on 2026-09-15, AC-1 and AC-8 are complete, and this plan is DONE. AC-PLAY was not performed and is nonblocking; this report does not claim an in-editor or device play test.
