# Enemy Navigation Runtime Contract Report

## Result

Completed. Revision v2 is a pure script/test/documentation change; no scene, prefab, metadata, or MCP operation was required.

## Changes

- `EnemyNavigation` now snapshots active `PolygonCollider2D` walls by world AABB, using the existing obstacle-classification and lifecycle rules.
- Navigation uses world-space velocity. `EnemyMinion` and `EnemyBoss` convert that velocity to the Cocos Box2D 32-pixels-per-meter scale immediately before writing `RigidBody2D.linearVelocity`.
- An overlapping start now receives a speed-bounded recovery vector to a nearby legal point. A disconnected hard-collider target uses a shared connected-component boundary approach only after the normal field has settled blocked.
- Destructible-target surface checks ignore only the target's own navigation rectangles. Other hard obstacles still deny the attack.
- The harness covers polygon walls, physics conversion, target-self overlap, third-party blocking, hard-component approach, and actual Minion/Boss boundary behavior.
- `transform-changed` and active-state notifications now only request a snapshot check. `EnemyNavigation` cancels shared fields only after that check observes an actual AABB, active/classification, collider-membership, or topology change.
- The harness reproduces repeated static-body transform synchronization: unchanged notifications preserve the obstacle revision and pending shared route work; a changed AABB commits once and discards old route data.

## Verification

- `git diff --check`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `openspec validate fix-enemy-navigation-runtime-contract --strict`: passed.
- `node .cursor/scripts/test-enemy-navigation.cjs`: passed, 49 tests, 0 failures.
- Evidence: `.cursor/plans/reports/fix-enemy-navigation-runtime-contract-evidence/logic-results-v3.json`.

## Manual Check

- In Creator, place a Boss against an arrow tower and verify it attacks immediately rather than idling.
- In the HighPlatform3 passage, verify Minions route around the polygon wall and do not push directly into it.
- Increase Boss speed in the existing config and verify physical movement remains smooth at the same world distance expected by the route.
- With the log fixed and side walls absent, verify enemies begin routing before the player approaches and continue to use the available side gaps.

## MCP Metrics

| Metric | Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| new prefabs | 0 |
| OpenSpec change | `openspec/changes/fix-enemy-navigation-runtime-contract/` |

## Revision v2

| Item | Result |
|---|---|
| Plan | Reopened v2 and completed NRTC.5 |
| Root cause | Cocos static-body synchronization emits transform notifications even when collision geometry is unchanged; the prior listener called `FlowField.invalidate()` directly. |
| Fix | Listener marks the snapshot dirty. The existing committed-snapshot comparison is the only path that increments obstacle revision and clears shared flow work. |
| Scope | `EnemyNavigation`, navigation harness, OpenSpec, plan/report, and bug tracking only. |
