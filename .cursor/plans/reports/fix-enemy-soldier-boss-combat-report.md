# Fix Enemy Soldier Boss Combat Report

Date: 2026-09-16

## Delivered
- `EnemyAI` now measures character melee range from collider surfaces for Box/Circle combinations, with a root-position fallback only when a collider is unavailable.
- `EnemyMinion` samples a living barracks melee Soldier on its existing 0.2-0.3 second navigation decision cadence and uses it as a temporary intercept target for facing, animation, and hit-frame damage. Its normal Player target remains unchanged and resumes after the Soldier is invalid.
- `EnemyBoss` now honors the Inspector `attackTriggerRange` directly for character stopping, attacking, and circular hit checks. The old runtime clamps were removed. Obstacle attacks continue to use `EnemyNavigation.canAttackObstacle`.
- Boss attack recovery is guarded by life and attack generation only. A killed/despawned target can cancel damage safely but cannot keep `_isAttacking` true. Invalid destroyed diversions are discarded before retargeting.
- The current Boss `attack.anim` is 1.3 seconds at speed 2, or about 0.65 seconds actual playback. The existing prefab cooldown of 0.8 seconds was retained because it leaves about 0.15 seconds recovery without a visible post-animation idle gap.

## Verification
- Passed: `npx --no-install tsc --noEmit --pretty false`
- Passed: `node .cursor/scripts/test-enemy-navigation.cjs`
- Passed: `node .cursor/scripts/test-enemy-break-blocking-log.cjs`
- Passed: `openspec validate fix-enemy-soldier-boss-combat --strict`
- Passed: `git diff --check`

## Notes
- `test-barracks-boss-hit-feedback.cjs` was not used as a completion gate: before this task it asserts `playerParkourChargeDecelDuration=0.5`, while the current project configuration is 1. This is unrelated to the combat changes.
- No scene, resource structure, animation, or MCP operation was performed. Existing concurrent dirty scene/prefab/VFX changes were preserved. Two verification-generated old evidence files were restored after testing.
