## Why

Enemy movement currently treats castle boundaries and configured entrances as mandatory navigation semantics. That prevents enemies from using real gaps in the unified purple/outside ground and couples fixed-log demolition to portal diagnostics.

## What Changes

- Navigation uses one continuous walkable space and real collider geometry rather than castle inside/outside or entrance state.
- Pursuit routes are selected against Hard geometry. Eligible destructible obstructions on that selected route are handled through existing reachable-surface demolition while their real colliders remain blocking; indestructible obstacles remain blocking.
- Obstacle classification is editor-facing on generic colliders/nodes with Ignore, Hard, and Destructible states. Existing attackable objects supply compatibility defaults only when an explicit marking is absent; non-HP Walls and nonsensor `airWall*` colliders remain Hard by default.
- Destruction invalidates navigation and resumes the original objective after the selected removable obstruction is destroyed. Only one Log exists, but unrelated living damageable Building/Barrier objects may coexist without suppressing evaluation of the relevant blocking Log.
- The accepted shared 30-cell incremental scheduler, 4096 work cap, atomic publication, cancellation, and bounded cache remain in force.

## Non-goals

- No scene, prefab, asset, coordinate, or metadata change.
- No per-enemy pathfinding, synchronous per-obstacle graph construction, unsafe partial/stale routing, or Wall demolition.
- No change to combat damage values, target-priority policy, pooling, or animation timing beyond routing a valid generic destructible target through existing damage behavior and preserving the existing hit-generation protections.

## Impact

Enemies can traverse any physically valid gap without entrance setup. When an eligible removable object lies on the selected route, they pause only as needed for bounded current navigation work, attack only legal reachable surfaces, and continue their original pursuit after each destruction.

## Execution Pointer

Implementation, verification, and rollback are in `.cursor/plans/enemy-unified-navigation.md`.
