## Why

Runtime enemy navigation does not yet use every physical obstacle shape, and its world-coordinate route velocities are written directly to Box2D. This lets enemies predict a small move while physics moves them 32 times farther, producing stutter, overlap stops, and missed building attacks.

## What Changes

- Navigation snapshots include `PolygonCollider2D` physical walls through their world AABBs.
- Enemy route speeds use world coordinates consistently and are converted to Box2D velocity only at the rigidbody boundary.
- An enemy overlapping an obstacle attempts bounded physical recovery toward a nearby legal location instead of permanently returning zero velocity.
- A destructible target's own collider does not invalidate an otherwise legal surface attack; other obstacles still block it.
- When a target lies in a disconnected collision component, enemies retain pursuit to the nearest reachable approach rather than treating the target as a direct route.
- Geometry notifications are treated as candidates for a snapshot check. Shared route work is cancelled only when the committed collision snapshot actually changes.

## Non-goals

- No scene, prefab, collider, numeric tuning, target-priority, or damage-value change.
- No path through, or attack against, an indestructible collider.
- No multi-obstacle demolition planner.

## Impact

Enemies follow the same collision map as physics, remain stable at configured movement speed, and can attack a reachable structure they are touching without bypassing other blockers.
