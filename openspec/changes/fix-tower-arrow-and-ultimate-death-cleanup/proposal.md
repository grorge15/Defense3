## Why

Tower-mounted ranged soldiers show a timed projectile but do not apply the player arrow's visible flight-direction convention. The ultimate's accepted BigMove sequence currently reaches final cleanup by hiding enemies immediately, cutting off death presentation and bypassing a deterministic completion boundary before victory.

## What Changes

- Tower-fired ranged projectiles use the player arrow's flight-direction angle and configured offset convention, with a safe visual-component fallback that preserves existing combat timing.
- After BigMove, the ultimate stops future enemy spawning and enemy action, presents the death animation for every active enemy, waits for all final-death presentations to complete or safely fall back, then removes the batch and continues the existing victory settlement.
- Final-cleanup presentation is separate from ordinary combat death, so it does not issue coins, rewards, pool-return behavior, or respawns.

## Non-goals

- Do not alter ranged Soldier targeting, attack timing, immediate damage, projectile lifetime, player Arrow collision/pierce rules, ordinary combat death, camera pullback, BigMove timing, victory result, prefabs, scenes, animations, or configuration data.
- Do not create assets, scene bindings, gameplay phases, a new enemy system, or a new camera controller.

## Capabilities

### New Capabilities

- `tower-projectile-flight-visual`
- `ultimate-final-death-cleanup`

## Impact

The change touches existing ranged projectile presentation and the ultimate completion boundary. It remains compatible with unarchived `ultimate-bigmove-clear` and `fix-build-cost-and-finale-timing`; execution scope and machine AC are in `.cursor/plans/fix-tower-arrow-and-ultimate-death-cleanup.md`.
