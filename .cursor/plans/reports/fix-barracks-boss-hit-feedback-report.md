# fix-barracks-boss-hit-feedback — report

## Status
Machine AC scripts passed. No prefab/scene edits.

## Done
1. Boss spawn moved to first barracks complete (`_trySpawnBossAfterBarracks`).
2. Hero hides after die `FINISHED` (or immediately if no clip).
3. HitFlash on Soldier / Log `takeDamage` / Boss / Minion.
4. `soldierRangedTargetCount = 1`.
5. Barracks `HitFlash` + `HitShake`.
6. Yellow-line 0.5s charge decel pulse then forward speed; lock success HitFlash.

## Verify
- `node .cursor/scripts/test-barracks-boss-hit-feedback.cjs` → ok
- `npx tsc --noEmit` → exit 0
- `npx openspec validate fix-barracks-boss-hit-feedback --strict` → valid

## AC-PLAY (user)
- Two basic towers: no Boss; first barracks: Boss appears
- Yellow line: slow for ~0.5s then back to forward; lock flashes red / short fades
- Tower archer: one shot per attack
- Units/barracks flash on hit; Hero vanishes after death anim
