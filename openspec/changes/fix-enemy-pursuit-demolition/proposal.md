## Why

Enemy pursuit can stop whenever a moving target changes flow-field cells faster than a replacement field settles. In addition, the current demolition rule takes a physical detour whenever one exists, even when a fixed, attackable Log lies on the route the enemy should follow. That conflicts with the requested gameplay: continue pursuit while the player moves, and remove a destructible object encountered on the selected route instead of rerouting around it.

## What Changes

- Retain a current-geometry-safe settled pursuit field while a coalesced replacement for a moving objective is pending; distinguish pending from unreachable and bound route age/target drift.
- Preserve safe forward progress across obstacle insertions without globally discarding every unit's settled direction. A new collider only stops an enemy when its current-frame physical sweep or its next safe route segment reaches that collider.
- Treat a completed field for a recently superseded objective as useful interim work when it remains current-geometry-safe and advances pursuit; do not starve movement waiting for the newest target cell to settle.
- Select pursuit paths against Hard geometry while eligible Destructible obstacles are omitted only from the planning view. During execution, retain every collider and select the first eligible destructible that physically blocks the selected next route leg.
- Move to a legal outside attack surface, use the existing damage path, and resume the original objective after destruction. Hard geometry remains non-demolishable and continues to shape the route.
- Replace the earlier normal-route/alternate-gap demolition preference. Preserve shared incremental construction, cache limits, body-specific safety, pooling, and hit-generation protections.

## Non-goals

- No scene, prefab, asset, meta, coordinate, collider-size, damage-value, target-priority, animation-timing, or physics-layer change.
- No traversal through a live collider, demolition of Hard obstacles, synchronous per-enemy pathfinding, multi-obstacle global optimization, or stale route use after a geometry revision.
- No city-region Sprite or other scene marker is required; physical ground, collider, and per-frame sweep data remain the source of movement safety.
- No change to normal pursuit when the selected Hard-safe route contains no eligible Destructible obstacle.

## Capabilities

### New Capabilities

- `enemy-pursuit-demolition`: moving-target route continuity and selected-route destructible-obstacle handling.

### Modified Capabilities

- `enemy-unified-navigation`: replaces its normal-route/alternate-gap demolition preference with selected-route demolition semantics.
- `enemy-break-blocking-log`: replaces its alternate-path suppression rule for a fixed blocking Log.

## Impact

Minions and Bosses continue making safe progress during a target's sustained movement. A live, eligible Log or other supported Destructible on the selected route is approached and damaged even when a longer physical detour exists; real collision remains active until destruction. The execution and verification details are in `.cursor/plans/fix-enemy-pursuit-demolition.md`.
