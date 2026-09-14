# Report: nav-build-hitch-coalesce

## Summary

Implemented wall-build navigation hitch mitigations: coalesce geometry checks, incremental obstacle commit on spawn/notify, geometry-epoch throttled unit field release, and per-frame new field-job admission. Pending motion continues on `lastSafeDirection × speed` with current-geometry constrain (not velocity-zero wait).

## Files

| File | Change |
|---|---|
| `assets/scripts/core/EnemyNavigation.ts` | requestGeometryCheck, notifyObstacleNode, incremental/full refresh, geometry epoch sync, retained pending path |
| `assets/scripts/core/FlowField.ts` | beginFrameAdmission, max new field jobs/frame, coalesce counter on pending hit |
| `assets/scripts/core/GameConfig.ts` | enemyNavMaxFieldInvalidationsPerFrame, enemyNavMaxNewFieldJobsPerFrame |
| `assets/scripts/building/BuildSystem.ts` | notify + requestGeometryCheck on build/invalidate paths |
| `.cursor/scripts/test-enemy-navigation.cjs` | AC-HITCH cases + contract updates for non-every-frame scan |
| `bugs.md` | fix-nav-build-hitch |

## Machine verification

- `node .cursor/scripts/test-enemy-navigation.cjs` — passed (includes AC-HITCH ×4)
- `npx tsc --noEmit --pretty false` — exit 0
- No Main.scene / prefab / MCP changes

## AC-PLAY (non-blocking)

Build `pref_wall` during defense with many enemies: hitch should be lower; enemies should keep coasting on last safe heading while fields rebuild, stopping only if current-frame sweep fails.
