# building-spawn-minion-knockback execution report

## Plan and Risk

- Plan version: v4. v1 defined the one-time transient physics push; v2, dated 2026-09-15, added one existing red `HitFlash` per accepted pulse; v3 added the `AudioManager` loader mock; v4 permits only the adjacent no-op `HitFlash` loader mock and then the ordered gates.
- Risk: medium. The implementation crosses spawn timing, collider AABBs, Dynamic `RigidBody2D` velocity ownership, navigation, and pool lifecycle.
- Continuation: yes. T1-T8 were accepted before this v4 run.
- Git baseline before the v4 write: `8a255e291accb59fe657df4c8c88786cf2d9211f`.

## Todo Matrix

| Todo | Status | Evidence |
|---|---|---|
| T1 | Complete | Read plan v1, the referenced OpenSpec files, related reports, `bugs.md`, rules, sources, prefab collider references, and baseline worktree. |
| T2-T7 | Complete | Added centralized values, transient Minion API/lifecycle handling, AABB filtering helper, and the two post-activation spawn calls. |
| T8 | Complete | New real-TypeScript focused harness passes 48 assertions across 4 scenarios. |
| T9 | Blocked | Added the permitted adjacent no-op `HitFlash.flash()` mock. The harness loaded both prior imports and completed three existing scenarios, then failed in scenario four because its pre-existing navigation mock lacks `requestGeometryCheck()`. v4 permits no further changes. |
| T10 | Not run | The ordered gate sequence may begin only after T9 passes; stopped at the first remaining T9 failure. |

## Changed Files

- `assets/scripts/core/GameConfig.ts`: added padding `48`, fallback range `96`, physical initial speed `6`, duration `0.3`, and linear decay exponent `1`.
- `assets/scripts/enemy/EnemyMinion.ts`: added `applyBuildingSpawnKnockback()`, physical velocity precedence/decay, reset/death/disable/final-death cleanup, and one `HitFlash.flash(visualNode ?? node)` per accepted impulse.
- `assets/scripts/building/BuildSystem.ts`: after successful Barracks/HeroShrine activation, scans only same-scene live Minions; uses valid collider AABBs or root fallback, strict-overlap exclusion, and outward collider-center direction.
- `.cursor/scripts/test-building-spawn-minion-knockback.cjs`: new real TypeScript mock harness.
- `.cursor/plans/building-spawn-minion-knockback.md` and its OpenSpec proposal/spec: revised to v2 for the HitFlash requirement and marked implementation todos complete.
- `.cursor/scripts/test-expand-enemy-clear-area.cjs`: added only the adjacent `{ HitFlash: { flash() {} } }` no-op loader mock; the previously accepted `AudioManager` mock remains unchanged.
- `.cursor/plans/reports/building-spawn-minion-knockback-report.md`: recorded the v4 continuation result and hard block.

No prefab, scene, `.meta`, MCP, asset refresh, or reimport action occurred. `bugs.md` was not modified because all required machine checks did not pass.

## Acceptance Results

| Check | Result | Evidence |
|---|---|---|
| AC-1 through AC-5 / focused behavior | Pass | `node .cursor/scripts/test-building-spawn-minion-knockback.cjs`: 48 assertions, 4 scenarios. Covers both spawn paths, activation ordering, same-scene/live/collider filtering, padded/fallback ranges, strict overlap, Boss exclusion, no transform/hp/target mutation, decay/resume, refresh, lifecycle cleanup, and exact HitFlash calls. |
| TypeScript (intermediate) | Pass | `npx --no-install tsc --noEmit --pretty false` exited 0 before the final one-line final-death cleanup; the full ordered final gate was then blocked by the next required regression. |
| Existing expansion regression after T9 | Blocked | `node .cursor/scripts/test-expand-enemy-clear-area.cjs` loads `HitFlash` and passes its first three scenarios, then exits 1 in scenario four: `TypeError: nav.requestGeometryCheck is not a function` at `assets/scripts/building/BuildSystem.ts:866`, called via `_onExpandComplete`. The prior `AudioManager` and `HitFlash` loader errors are both resolved. |
| Remaining AC-CHECK commands | Not run | The plan requires the regression sequence in order; execution stopped at the first remaining T9 hard block. |
| AC-PLAY | Not run, non-blocking | No Creator/MCP interaction is permitted by this plan. |

## Workspace Ownership

Pre-existing dirty paths were preserved: `.cursor/plans/ultimate-two-wave-finale.md`, two ultimate test scripts, `assets/scenes/Main.scene`, `assets/scripts/core/GameConfig.ts`, `assets/scripts/game/UltimateSystem.ts`, `bugs.md`, the duplicate `build-barracks-shrine-minion-knockback` draft/change, and the ultimate report. The task added only the dedicated GameConfig block; unrelated concurrent GameConfig changes were not overwritten.

## MCP Metrics

| Metric | Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| New prefabs | 0 |
| Continuation | yes |
| OpenSpec change | `openspec/changes/building-spawn-minion-knockback/` |

## Blocker and Replan Target

The v4-authorized `HitFlash` mock was added and removes the second loader failure. The regression now executes its existing scenarios and first fails at a separate missing `nav.requestGeometryCheck()` mock. Replan only T9/AC-CHECK to authorize the smallest navigation mock addition, preserving T1-T8, the two accepted loader mocks, gameplay, and OpenSpec artifacts. Then rerun the full ordered gate, update `bugs.md` only if all checks pass, and close the plan.
