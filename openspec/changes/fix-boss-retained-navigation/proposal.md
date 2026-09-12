## Why

Boss can visibly stutter while a shared replacement flow field is pending. Its periodic retarget currently resets navigation even when selection returns the same node, and transient blocking-obstacle candidates can also discard its local retained state. A zero shared-field output then stops a Boss even when its previously constrained movement is still safe for the current frame.

## What Changes

- Reset Boss navigation on periodic retarget only when the selected target node changes; invalid-target replacement behavior remains intact.
- Preserve Boss-local navigation state across transient blocking-obstacle candidate changes unless the effective navigation objective changes.
- While the current shared field is pending and yields zero velocity, let a Boss reuse only its own most recent world velocity that `EnemyNavigation.constrainFinalVelocity` still accepts for the current frame. It may stop or use existing unstuck behavior when that reuse is unsafe.

## Non-goals

- Do not change Boss collision participation, `_bodySize`-derived pathing constraints, targeting priority, `bossRetargetInterval`, attack distance values, attack timing, animation behavior, speed values, or add movement/animation thresholds.
- Do not change `Main.scene`, prefabs, assets, physics layers, or resource metadata.
- Do not retain a velocity across a target/objective change, invalid lifecycle, attack movement lock, or a failed current-frame navigation safety check.

## Impact

Bosses retain safe visual movement through bounded shared-flow replacement work without weakening collision-constrained navigation. The implementation and verification are defined in `.cursor/plans/fix-boss-retained-navigation.md`.
