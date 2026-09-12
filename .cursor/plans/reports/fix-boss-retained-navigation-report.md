# Build Report: fix-boss-retained-navigation

## Status

- Plan version: v2. Revision summary: made the plan writable for BNR.5 and resumed from BNR.1.
- Risk: medium. This was a continuation from the v1 pre-write hard block.
- Git baseline: `bf3adaf031d020c85576422e2884884e11c3f4b0`.
- Final status: complete.

## Todo Matrix

| Todo | Result |
|---|---|
| BNR.0 | Done before this continuation. |
| BNR.1 | Done: v2 permissions, OpenSpec, report, worktree, and target implementation were reconfirmed. |
| BNR.2 | Done: same-node retargets no longer call `resetUnit`; transient blocking candidates no longer reset navigation. |
| BNR.3 | Done: Boss stores only current-target, final-constrained world velocity and revalidates it only for pending zero output. |
| BNR.4 | Done: dedicated real-Boss harness coverage added and all existing navigation regressions passed. |
| BNR.5 | Done: machine AC passed; `bugs.md`, this report, and plan status updated. |

## Changed Files

- `assets/scripts/enemy/EnemyBoss.ts`: clears retained velocity on target/lifecycle/attack transitions; keeps same-target navigation ownership; reuses only a current-frame constrained safe velocity during pending zero output.
- `assets/scripts/core/EnemyNavigation.ts`: exposes `isReplacementPending(unit, target)` without changing field scheduling or body-specific constraints.
- `.cursor/scripts/test-enemy-navigation.cjs`: adds `AC-BOSS-RETAINED-NAVIGATION` for unchanged retarget, candidate jitter, safe reuse, constraint rejection, target change, and attack lock.
- `bugs.md`: adds `fix-boss-path-steer` v4.
- `.cursor/plans/fix-boss-retained-navigation.md`: status and todo completion only.

## AC Results

| AC | Result | Evidence |
|---|---|---|
| AC-1 | Pass | Dedicated Boss harness proves a same-node periodic retarget makes zero reset calls; a changed node resets once. |
| AC-2 | Pass | Alternating temporary obstacle candidates leave the reset count unchanged. |
| AC-3 | Pass | Pending zero output reuses one safe retained velocity; current-frame constraint rejection yields zero; attack lock clears it. |
| AC-4 | Pass | Existing actual Minion/Boss contact regression and body-specific collider assertions passed; no numeric, scene, prefab, animation, or collision changes. |
| AC-5 | Pass | `npx tsc --noEmit --pretty false` exit 0. |
| AC-6 | Pass | `node .cursor/scripts/test-enemy-navigation.cjs` exit 0. |
| AC-7 | Pass | `npx openspec validate fix-boss-retained-navigation --strict` exit 0; CLI emitted non-fatal configuration guidance before confirming the change valid. |
| AC-8 | Pass | `git diff --check` exit 0; `bugs.md` contains v4 with symptom, cause, solution, and verification. |
| AC-PLAY | Not run | Non-blocking by plan. |

## Non-MCP Metrics

| Metric | Value |
|---|---:|
| Same-node retarget `resetUnit` calls | 0 |
| Temporary-candidate reset calls | 0 |
| Pending zero-velocity safe reuses | 1 directed assertion |
| Pending zero-velocity rejected reuses | 1 directed assertion |
| Navigation harness result | exit 0, including `AC-BOSS-RETAINED-NAVIGATION` and existing regressions |
| Continuation | yes |
| OpenSpec change | `openspec/changes/fix-boss-retained-navigation/` |

## MCP Metrics

| Metric | Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | 0 |
| post-scene-save | 0 |
| assets-reimport-asset | 0 |

## Notes

The full harness initially refreshed a historical evidence JSON outside this plan's permitted file list. Its baseline-clean change was restored immediately; no out-of-scope artifact remains modified.
