# Build Report: fix-tower-arrow-and-ultimate-death-cleanup

## Plan

- Version: v1, initial revision; no prior report existed.
- Risk: medium.
- Continuation: no.
- Git baseline: `b24aa01e115d620ec0c819c5fb1adff362c6dfab`; the initial dirty worktree was preserved.

## Todo Completion Matrix

| Todo | Status | Result |
|---|---|---|
| arrow-finale.1 | Complete | Read the plan, rules, old finale plan/report/delta, target scripts, test, bugs, and recorded the dirty baseline. |
| arrow-finale.2 | Complete | Extracted Arrow rotation math and applied immutable tower projectile direction with Arrow, Sprite, and no-visual fallbacks. |
| arrow-finale.3 | Complete | Added Minion/Boss final-death presentation APIs with quiescence, lifecycle-bound once completion, and normal-death separation. |
| arrow-finale.4 | Complete | Final cleanup now stops spawners, aggregates selected enemy presentation completion, deactivates the batch, then schedules one existing win settlement. |
| arrow-finale.5 | Complete | Added a real-TypeScript-component focused harness covering the required fallback, completion, and aggregation cases. |
| arrow-finale.6 | Complete | All blocking machine AC passed; bugs v4/v5, evidence, and this report were written afterward. |

## Changed Files

- `assets/scripts/projectile/Arrow.ts`: centralized the XY-to-Z rotation convention and default offset.
- `assets/scripts/character/Soldier.ts`: oriented tower projectiles once at spawn without changing targeting, immediate damage, interpolation, or lifetime.
- `assets/scripts/enemy/EnemyMinion.ts`: added reward-free final-death presentation and once completion.
- `assets/scripts/enemy/EnemyBoss.ts`: added reward-free final-death presentation while retaining normal `die` FINISHED behavior.
- `assets/scripts/game/UltimateSystem.ts`: staged final cleanup after BigMove completion.
- `.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs`: added the focused regression harness.
- `bugs.md`: appended `fix-build-plot-background-arrow-and-shrine` v4 and `fix-advanced-towers-no-gameover` v5.
- `openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/`: target proposal/specs were validated and left within the planned delta scope.
- `.cursor/plans/reports/fix-tower-arrow-and-ultimate-death-cleanup-evidence/`: machine and scope evidence.

## AC Results

| AC | Result |
|---|---|
| AC-1 to AC-6 | Passed by the focused harness. |
| AC-7 | Exit 0; 40 assertions across 8 scenarios. |
| AC-COMPILE | `npx tsc --noEmit --pretty false`: exit 0. |
| AC-OPSX | New target delta and `ultimate-bigmove-clear` strict validation: exit 0. |
| AC-DIFF | `git diff --check`: exit 0; no task scene/prefab/animation/meta/GameConfig/settings write. |
| AC-BUGS | Passed; target existing topics received v4 and v5 after machine AC. |
| AC-PLAY | Not run; Creator play-test is non-blocking and was not performed. |

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
| OpenSpec change | `openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/` |

## Failures And Blockers

No blocking failures. The first harness execution exposed a circular mock-loader dependency and then a missing Component mock method; both were local harness defects corrected before the final passing run. An unrelated dirty `pref_enemy_minion.prefab` appeared after baseline and was not touched. No replan is recommended.
