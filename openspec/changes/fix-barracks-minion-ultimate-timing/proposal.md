## Why

Barracks refill timing/count, shrine hit feedback parity, minions ignoring shield soldiers, ultimate wave 2 starting too soon after wave 1, and player still preferring Boss over nearer minions.

## What Changes

- Barracks subsequent waves refill at most 4 soldiers every 3s (first wave still fills empties).
- HeroShrine hit feedback matches Barracks (flash + shake).
- Minions in melee range can damage barracks melee Soldiers (prefer soldier over player when in range).
- After first BigMove wave completes, wait `ultimateInterWaveDelay` before second wave + zoom.
- Player bow lock picks the nearest enemy in range by distance only (Boss and minion equal).

## Non-goals

- Prefab/scene edits; Boss priority table; player/tower fan arrow counts.

## Capabilities

### New Capabilities

- `fix-barracks-minion-ultimate-timing`: barracks refill, shrine feedback, minion vs soldier, ultimate inter-wave delay, nearest player target.

### Modified Capabilities

- Player auto-aim no longer Boss-first.
