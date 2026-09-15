# player-arrow-fan-shot — report

## Status
Implemented. Machine checks passed.

## Changes
- `GameConfig.playerArrowFanCount = 3`, `playerArrowFanTotalAngleDeg = 45`
- `Arrow.initWithDirection` for fixed flight dirs; `init(target)` delegates to it
- `CombatSystem._spawnArrowFan`: same-frame 3 arrows at −22.5° / 0° / +22.5°; center keeps reservation

## Verify
- `node .cursor/scripts/test-player-arrow-fan-shot.cjs`
- `npx tsc --noEmit`
- `npx openspec validate player-arrow-fan-shot --strict`

## AC-PLAY
One bow attack should spawn three spreading arrows (~45° fan) toward the locked target.
