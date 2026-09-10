## Why

Construction-time obstacle changes can still make enemy navigation synchronously build a complete connectivity map or flow field during one animation-frame callback. The supplied trace shows a 166 ms construction frame, with approximately 154 ms under the shared connectivity lookup reached by both ordinary-enemy and Boss blocking-log checks, plus a 21 ms flow-field breadth-first search spike. This stalls visible enemy movement and the construction interaction.

## What Changes

- Enemy shared-flow navigation uses a 30-world-unit cell size.
- Cold connectivity and distance-field construction becomes shared, bounded frame work rather than a synchronous request-path operation.
- For the current scene bounds, an ordinary-enemy body and Boss body that request blocked navigation together receive current shared flow data within a bounded brief wait, rather than a multi-second pause; the scheduler retains a per-frame safety cap.
- Geometry changes immediately invalidate obsolete navigation results. Until current work is ready, navigation only permits movement that is already proven safe against the current obstacle snapshot; otherwise it waits and resumes after construction.
- Fixed-log diagnostic routing distinguishes current-revision pending reachability from settled unreachable reachability, so an incomplete diagnostic cannot become a durable negative diversion result.
- A cold fixed-log diagnostic retains and coalesces its current-revision dependencies across scheduler frames. It cannot be starved, restarted by identical requests, or converted into a terminal no-diversion result before the required diagnostic work settles.
- Ordinary enemies and Bosses participate in the same bounded scheduler while retaining their distinct physical body constraints and the existing bounded cache policy.

## Non-goals（禁做）

- Do not change enemy targeting, attack timing, damage, spawn counts, collision geometry, entrance semantics, or the fixed-log diversion behavior.
- Do not add per-enemy pathfinding, relax obstacle, ground, portal, sweep, or corner-safety rules, or use stale navigation after an obstacle update.
- Do not edit scenes, prefabs, meta files, assets, or build placement.

## Capabilities

### New Capabilities

- `enemy-navigation-construction-scheduling`: bounded, obstacle-current shared navigation construction during gameplay.

### Modified Capabilities

- `enemy-flow-navigation`: shared obstacle-aware pursuit now waits safely for bounded construction rather than synchronously completing it in a caller frame.
- `enemy-break-blocking-log`: the obstruction query participates in the same scheduling and current-geometry safety guarantees.

## Impact

The first route request following construction may intentionally pause an enemy briefly instead of producing a frame hitch or unsafe movement. A fixed-log diversion diagnostic may likewise defer its answer while current reachability is pending, but it must retry after completion rather than cache a negative answer. Direct routes that remain valid continue to move. Existing cache capacity, LRU behavior, body-specific passability, invalidation, entrances, and collision-constrained movement remain in force.

For the closed-side-stairs state, that bounded deferment is an observable combat contract: an outside ordinary enemy or Boss waits safely only while the current central-log diagnostic remains pending, then diverts to attack the fixed log when it is the sole legal way to the original inside target. Destroying that log resumes the original objective.

## Execution pointer

Implementation, file permissions, verification, and rollback are in `.cursor/plans/fix-enemy-navigation-rebuild-stalls.md`.
