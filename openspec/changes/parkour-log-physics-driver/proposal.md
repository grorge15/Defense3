## Why

The parkour log currently follows the Player by writing its world position, then applies a manual air-wall AABB push. This makes a moving object appear physical while bypassing the 2D physics solver, leaves Player and Log with competing motion ownership, and requires enemy-only compensation for a rolling sensor log.

## What Changes

- The rolling Log becomes the sole Dynamic RigidBody2D movement owner during parkour, with rotation locked and normal solid collision enabled.
- Player temporarily becomes a world-position-preserving child of the Log while its own rigidbody and collider states are disabled; its existing parkour input produces the Log velocity instead of Player velocity.
- Blue-line completion performs the Player detach/physics restoration and the Log fixed-or-failed transition before publishing the parkour-complete event.
- Rolling position-follow, air-wall AABB push-out, and enemy rolling-log AABB carry compensation are removed; fixed-log navigation and demolition behavior remain intact.
- SortingOrder2D isolates nested sorting roots so a parent ordering component does not co-own a descendant subtree with its own ordering component.

## Non-goals

- Do not modify `Main.scene`, any prefab, meta file, placement table, channel measurement, or log growth limit.
- Do not change fixed-log collision calibration, world-width lock eligibility, saw contact cutting, yellow-line speed values, first-effective-input semantics, damage values, or fixed-log enemy demolition behavior.
- Do not introduce a second Player or Log controller script, runtime static-layout instantiation, or a manual rolling-position fallback.

## Capabilities

### New Capabilities

- `parkour-log-physics-driver`: physics-owned rolling log, Player attachment lifecycle, ordered parkour completion, and nested sorting isolation.

### Modified Capabilities

- `log-contact-cut-projection`: preserve its rolling world-width gate, cut geometry, and fixed geometry while changing only rolling movement ownership.
- `enemy-break-blocking-log`: preserve fixed, attackable Log routing and demolition while removing compensation used only for a rolling Log.
- `render-sorting`: preserve root-derived ordering while preventing nested ordering roots from writing the same renderer subtree.

## Impact

The implementation is script-only and is expected to touch Player, Log, ParkourLineZone, EnemyMinion, SortingOrder2D, and focused regression harnesses. Execution scope and verification are defined in `.cursor/plans/parkour-log-physics-driver.md`.
