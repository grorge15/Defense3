# Build Report: fix-build-cost-and-finale-timing

## Plan

- Version: v2.
- Revision summary: v2 replaces duration-based finale timing with a `CameraFollow.zoomOut` completion callback and adds zero-duration, replacement, and destruction callback requirements.
- Risk: medium; changes touch payment feedback and finale settlement sequencing.
- Continuation: no. No prior report existed and all todos began unfinished.

## Todo Completion Matrix

| Todo | Status | Result |
|---|---|---|
| timing.1 | Complete | Read plan, rules, target scripts/specs, target bug entries, prior-report state, and recorded the dirty-worktree baseline. |
| timing.2 | Complete | Build cost text now uses ceil of nonnegative remaining cost and refreshes after accepted payment. |
| timing.3 | Complete | Zoom completion is one-shot, final-state ordered, synchronous at zero duration, and invalidated by replacement or destruction. |
| timing.4 | Complete | Valid-camera finales defer BigMove to the completion callback; no-camera finales remain immediate. |
| timing.5 | Complete | Existing point filtering, synchronized start, resource/animation fallbacks, speed-aware completion, enemy clear, and victory sequencing remain covered. |
| timing.6 | Complete | Added focused real-component harness with 37 assertions across eight scenarios. |
| timing.7 | Complete | Harness, TypeScript, both relevant OpenSpec strict validations, diff check, scope inspection, bug records, evidence, and this report completed. |

## Changed Files

- `assets/scripts/building/BuildPlot.ts`: refreshes cost Label from `Math.ceil(getRemainingCost())` after accepted payment.
- `assets/scripts/game/CameraFollow.ts`: adds optional one-shot zoom completion callback, zero-duration completion, replacement invalidation, and destruction invalidation.
- `assets/scripts/game/UltimateSystem.ts`: gates BigMove behind valid-camera completion, retains no-camera immediate fallback, and rejects duplicate or invalid delayed continuation.
- `.cursor/scripts/test-build-cost-ultimate-timing.cjs`: focused TypeScript-transpiled Cocos mock regression harness.
- `openspec/changes/fix-build-cost-and-finale-timing/`: retained proposal and construction payment delta; repaired the new-delta structural issue.
- `openspec/changes/ultimate-bigmove-clear/specs/ultimate-bigmove-clear/spec.md`: minimal synchronization of the conflicting unarchived finale timing requirement.
- `bugs.md`: appended v2 for `fix-build-coin-log-boss` and v4 for `fix-advanced-towers-no-gameover` after machine AC passed.
- `.cursor/plans/reports/fix-build-cost-and-finale-timing-evidence/`: verification and scope evidence.

## AC Results

| AC | Result |
|---|---|
| AC-1 through AC-6 | Passed by focused harness. |
| AC-7 | Exit 0; 37 assertions across 8 scenarios. |
| AC-COMPILE | `npx tsc --noEmit --pretty false`: exit 0. |
| AC-OPSX | Both relevant strict validations: exit 0. |
| AC-DIFF | `git diff --check`: exit 0; scope inspection found no introduced scene, prefab, meta, GameConfig, asset, or project-setting change. |
| AC-BUGS | Passed; both existing topical entries received one versioned record. |
| AC-PLAY | Not run; non-blocking Creator hand-test remains outstanding. |

## MCP Metrics

| Metric | Count/Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| New prefabs | 0 |
| Continuation | no |
| OpenSpec change | `openspec/changes/fix-build-cost-and-finale-timing/` |

## Failures And Blockers

None. OpenSpec strict initially reported that the new construction capability could not carry a `MODIFIED` requirement; the timing prose was moved to the existing unarchived ultimate delta, after which strict validation passed. No replan is recommended.
