## Why

Current combat units move mostly by direct target vectors with lightweight obstacle steering. When airWall or static blockers sit between a unit and its target, visible units can spend too long pushing into the blocker instead of finding a nearby route.

This change defines shared, low-frequency path following behavior for enemies, melee soldiers, and heroes so pursuit remains readable while preserving each unit type's existing targeting, attack, and special-case rules.

## What Changes

- Pursuing units route around airWall/static obstacles instead of repeatedly pushing into them.
- Units refresh their route at a low frequency when targets move, die, or switch.
- Units follow intermediate points between recalculations and degrade gracefully if no route is available.
- Boss, minion, hero, and soldier-specific combat and target semantics remain intact.

## Non-goals（禁做）

- Do not change attack damage, health, economy, stage transitions, or build flow.
- Do not change ranged soldier tower behavior into roaming pursuit.
- Do not introduce heavy navmesh systems or third-party dependencies.
- Do not remove existing special handling for separation, barrier priority, rolling-log sensors, hero attack stop, or boss targeting priority.
- Do not change scene or prefab structure as part of the behavior specification.

## Capabilities

### New Capabilities

- `path-agent`

### Modified Capabilities

- Enemy pursuit movement
- Boss pursuit movement
- Hero follow movement
- Melee soldier pursuit movement

## Impact

The main player-visible impact is that combat units should look less stuck when a blocker intersects their direct path. Existing combat timing, target selection, and stationary ranged soldier behavior should remain consistent with the prior design.

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/shared-path-agent.md`（与本 change 同名 slug）。
