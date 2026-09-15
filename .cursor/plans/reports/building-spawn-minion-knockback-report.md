# building-spawn-minion-knockback execution report

## Plan and Risk

- Plan version: v2. v1 defined the one-time transient physics push; v2, dated 2026-09-15, added one existing red `HitFlash` per accepted pulse after the user requirement update.
- Risk: medium. The implementation crosses spawn timing, collider AABBs, Dynamic `RigidBody2D` velocity ownership, navigation, and pool lifecycle.
- Continuation: no. No prior report existed.
- Git baseline before the first write: `7eb2a8ff7320a0605e579a3088dd30ad911634ee`.

## Todo Matrix

| Todo | Status | Evidence |
|---|---|---|
| T1 | Complete | Read plan v1, the referenced OpenSpec files, related reports, `bugs.md`, rules, sources, prefab collider references, and baseline worktree. |
| T2-T7 | Complete | Added centralized values, transient Minion API/lifecycle handling, AABB filtering helper, and the two post-activation spawn calls. |
| T8 | Complete | New real-TypeScript focused harness passes 48 assertions across 4 scenarios. |
| T9 | Blocked | The first required existing regression cannot load the current pre-existing `EnemyMinion` dependency set. |

## Changed Files

- `assets/scripts/core/GameConfig.ts`: added padding `48`, fallback range `96`, physical initial speed `6`, duration `0.3`, and linear decay exponent `1`.
- `assets/scripts/enemy/EnemyMinion.ts`: added `applyBuildingSpawnKnockback()`, physical velocity precedence/decay, reset/death/disable/final-death cleanup, and one `HitFlash.flash(visualNode ?? node)` per accepted impulse.
- `assets/scripts/building/BuildSystem.ts`: after successful Barracks/HeroShrine activation, scans only same-scene live Minions; uses valid collider AABBs or root fallback, strict-overlap exclusion, and outward collider-center direction.
- `.cursor/scripts/test-building-spawn-minion-knockback.cjs`: new real TypeScript mock harness.
- `.cursor/plans/building-spawn-minion-knockback.md` and its OpenSpec proposal/spec: revised to v2 for the HitFlash requirement and marked implementation todos complete.

No prefab, scene, `.meta`, MCP, asset refresh, or reimport action occurred. `bugs.md` was not modified because all required machine checks did not pass.

## Acceptance Results

| Check | Result | Evidence |
|---|---|---|
| AC-1 through AC-5 / focused behavior | Pass | `node .cursor/scripts/test-building-spawn-minion-knockback.cjs`: 48 assertions, 4 scenarios. Covers both spawn paths, activation ordering, same-scene/live/collider filtering, padded/fallback ranges, strict overlap, Boss exclusion, no transform/hp/target mutation, decay/resume, refresh, lifecycle cleanup, and exact HitFlash calls. |
| TypeScript (intermediate) | Pass | `npx --no-install tsc --noEmit --pretty false` exited 0 before the final one-line final-death cleanup; the full ordered final gate was then blocked by the next required regression. |
| Existing expansion regression | Blocked | `node .cursor/scripts/test-expand-enemy-clear-area.cjs` exits 1 before scenarios: `Unmocked import ../core/AudioManager`. The import exists in `EnemyMinion.ts` and the missing mock exists in the read-only harness at the recorded baseline. |
| Remaining AC-CHECK commands | Not run | The plan requires the regression sequence in order; execution stopped at the first hard block. |
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
| Continuation | no |
| OpenSpec change | `openspec/changes/building-spawn-minion-knockback/` |

## Blocker and Replan Target

The plan marks `.cursor/scripts/test-expand-enemy-clear-area.cjs` read-only, but its mock table must include the already-imported `AudioManager` before the required regression can execute. Replan only the regression-harness file permission and T9/AC-CHECK, preserving T1-T8 and all current task hunks. After that, rerun the full ordered gate, update `bugs.md`, and close the plan.
