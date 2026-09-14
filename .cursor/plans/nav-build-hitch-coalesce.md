# nav-build-hitch-coalesce

Status: **done**

## Goal

Cut the wall-build FPS spike by coalescing geometry checks, committing new obstacles incrementally, and throttling post-invalidate field rebuilds — without defaulting pending motion to zero velocity.

## Delivered

1. `EnemyNavigation.requestGeometryCheck` / `notifyObstacleNode` — same-frame coalesce; incremental ops; full scan for discover / transform / destroy.
2. `BuildSystem._invalidateEnemyNavigation(node?, fullScan?)` — notify + single request on spawn paths.
3. Geometry epoch + per-frame unit field release cap; `FlowField.beginFrameAdmission` + `enemyNavMaxNewFieldJobsPerFrame`.
4. Pending / throttled units keep `lastSafeDirection * speed` with current-frame constrain.
5. Tests `AC-HITCH:*`; `bugs.md` entry; this plan + report.

## Config

- `enemyNavMaxFieldInvalidationsPerFrame = 8`
- `enemyNavMaxNewFieldJobsPerFrame = 2`
- `enemyNavWorkUnitsPerFrame` remains **4096**
