---
slug: fix-enemy-navigation-runtime-contract
version: 2
status: done
created: 2026-09-10
---

# Enemy Navigation Runtime Contract

## Goal

Align enemy navigation with Cocos 2D physics and all scene wall shapes so Minions and Bosses no longer collide with invisible-to-navigation walls, stutter from unit mismatch, or fail to attack a structure at its surface.

## OpenSpec

`openspec/changes/fix-enemy-navigation-runtime-contract/`

## Boundaries

- Pure script/test/documentation change. No scene, prefab, `.meta`, asset, animation, or numeric-configuration edit; MCP gates are N/A.
- Keep the accepted 30-cell, 4096-work-unit shared scheduler, cache limits, one-obstacle demolition rule, target priority, and existing damage paths.
- Preserve all unrelated dirty worktree changes.

## Forbidden Actions

- Do not make hard obstacles attackable, permit motion through colliders, add per-enemy A*, or add a serial demolition planner.
- Do not alter `GameConfig`, collider dimensions, target priorities, attack damage, prefabs, or `Main.scene`.
- Do not use a visual sprite bound in place of the physics collider AABB.

## Files

### Writable

- `assets/scripts/core/EnemyNavigation.ts`
- `assets/scripts/core/FlowField.ts`
- `assets/scripts/enemy/EnemyMinion.ts`
- `assets/scripts/enemy/EnemyBoss.ts`
- `.cursor/scripts/test-enemy-navigation.cjs`
- `openspec/changes/fix-enemy-navigation-runtime-contract/{proposal.md,specs/enemy-navigation-runtime-contract/spec.md}`
- `.cursor/plans/fix-enemy-navigation-runtime-contract.md`
- `.cursor/plans/reports/fix-enemy-navigation-runtime-contract-report.md`
- `bugs.md`

### Read-only

- `assets/scripts/core/{FlowField.ts,GameConfig.ts,NavigationObstacle.ts}`
- `assets/resources/prefabs/building/platform/HighPlatform3.prefab`
- `assets/scenes/Main.scene`

## To-dos

- [x] NRTC.1: Include PolygonCollider2D snapshots and retain current classification/lifecycle behavior.
- [x] NRTC.2: Make navigation world velocity explicit at Minion/Boss rigidbody boundaries, including recovery and fixed-log postprocessing.
- [x] NRTC.3: Permit only target-self overlap for destructible surface attack; route disconnected targets to a reachable approach and recover boundedly from overlap.
- [x] NRTC.4: Add focused regressions, typecheck, run navigation harness, record results, and update bug tracking.
- [x] NRTC.5: Defer transform-event invalidation until the obstacle snapshot confirms an actual navigation geometry or topology change; add a static-body regression and rerun the script gates.

## Acceptance Criteria

- `AC-GEOMETRY`: active PolygonCollider2D `airWall` is added to the navigation obstacle snapshot and blocks a direct route.
- `AC-VELOCITY`: a navigation velocity of 160 world units/sec writes as Box2D velocity 5; Minion and Boss pass world velocity into routing and physics velocity into rigidbody.
- `AC-BOUNDARY`: a target's own collider may be touched for an attack, another collider still prevents it, and an overlapped unit receives a bounded recovery vector only when a nearby legal point exists.
- `AC-APPROACH`: a walkable target in a disconnected component resolves to a reachable approach without a route through the hard divider.
- `AC-REGRESSION`: `git diff --check`, `npx tsc --noEmit --pretty false`, and `.cursor/scripts/test-enemy-navigation.cjs` pass.
- `AC-SCOPE`: no scene/prefab/meta/asset modification; `bugs.md` has one matching update.
- `AC-STATIC-TRANSFORM`: repeated static-body transform notifications leave the obstacle version and pending shared flow job intact; a changed collider AABB still commits one new revision and invalidates the old job.

## Verification

```powershell
git diff --check
npx tsc --noEmit --pretty false
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-enemy-navigation-runtime-contract-evidence'; node .cursor/scripts/test-enemy-navigation.cjs
```

## Rollback

Revert only the NRTC-owned hunks after saving failed evidence. Keep all unrelated dirty changes and prior shared-flow-field work.

## Revision History

- v2 (2026-09-10): Reopened after runtime analysis found Cocos static-body transform synchronization repeatedly cancelled shared flow jobs. Scope is limited to deferred snapshot validation and regression coverage.
- v1 (2026-09-10): Initial runtime contract repair.
