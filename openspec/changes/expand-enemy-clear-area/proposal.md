# Expansion Enemy Clear Area

## Why

When the expansion is completed, enemies already standing in the newly available area remain behind the new defensive boundary. The level supplies an authored clear area and a separate safe placement area so that this transition can move those enemies predictably.

## What Changes

- On expansion completion, relocate active living minions and bosses whose collision footprint overlaps the authored clear area into valid, spaced positions in the authored placement area.
- Preserve each relocated enemy's health and ordinary target-selection behavior while cancelling stale movement and attack state before it resumes pursuit.
- Treat missing, inactive, or non-sensor authored marker colliders, and an area without sufficient placement capacity, as a safe no-relocation condition with diagnostics.

## Non-goals

- Do not modify the authored scene, prefabs, marker coordinates, marker collider geometry, physics layers, navigation obstacle definitions, enemy health, damage, target priority, spawning, or phase order.
- Do not remove, kill, pool, respawn, or retarget enemies merely because expansion completes.

## Impact

This is a runtime expansion-completion behavior. The scene-owned `ExpandAreaCollider` and `SetPos` markers remain authored data and are resolved by their exact node names at runtime.
