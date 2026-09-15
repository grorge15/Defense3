## Why

Player bow attacks currently spawn a single arrow at the locked enemy. Coverage feels narrow when enemies cluster beside the aim line.

## What Changes

- On each player bow attack frame, spawn three arrows at once.
- Arrows form a 45° fan centered on the player→primary-target direction (−22.5°, 0°, +22.5°).
- Only the center arrow keeps the attack reservation for the locked target; side arrows fly fixed directions and use existing pierce hit rules.

## Non-goals

- Tower archer volley count.
- Changing per-arrow damage, cooldown, or pierce falloff formulas.
- Prefab / Main.scene edits.

## Capabilities

### New Capabilities

- `player-arrow-fan-shot`: simultaneous three-arrow fan volley on player bow attacks.

### Modified Capabilities

- Player ranged attack presentation and coverage (still one lock target for aim).
