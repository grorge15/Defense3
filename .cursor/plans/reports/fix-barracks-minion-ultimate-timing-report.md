# fix-barracks-minion-ultimate-timing — report

## Status
Five-item batch implemented / verified. Barracks refill + shrine hit were already present; wired remaining gaps.

## Done
1. Barracks: interval 3s, refill cap 4 after first wave
2. HeroShrine: HitFlash + HitShake
3. Minions: EnemyAI prefers melee Soldier in range, else player
4. Ultimate: `ultimateInterWaveDelay` 0.8s before wave 2
5. Player: nearest Boss/minion by distance (no Boss-first)

## Verify
- `node .cursor/scripts/test-barracks-minion-ultimate-timing.cjs` → ok
- `npx tsc --noEmit` → 0
- `npx openspec validate fix-barracks-minion-ultimate-timing --strict` → valid
