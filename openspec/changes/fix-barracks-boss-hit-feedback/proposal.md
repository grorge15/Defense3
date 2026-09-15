## Why

Boss currently spawns when both basic towers finish, which is too early relative to barracks unlock. Several combat feedback and parkour timing bugs remain: hero corpse stays after die anim, several units lack hit flash, tower archers fire three-target volleys, barracks has no hit feedback, and yellow-line charge holds slow speed until the blue line.

## What Changes

- Spawn Boss once when the first barracks build completes (not when both basic towers complete).
- Hide the Hero node after the death animation finishes.
- Apply red HitFlash on Soldier, Log (barrier damage), Boss, and Minion hits; Barracks also flashes and lightly shakes.
- Tower archers fire a single ranged shot (`soldierRangedTargetCount = 1`).
- On yellow-line touch, decelerate to charge speed over 0.5s then snap back to parkour forward speed; blue-line lock success flashes red; insufficient width still fades out.

## Non-goals

- Changing advanced-tower ultimate chain, Boss target priority, or blue-line width threshold formula.
- Reducing tower soldier mount count from three archers to one.
- Prefab / Main.scene handwritten rebuilds.

## Capabilities

### New Capabilities

- `barracks-boss-hit-feedback`: barracks-timed Boss spawn, death/hit feedback, archer single shot, yellow-line charge pulse.

### Modified Capabilities

- Parkour yellow-line charge speed is a timed pulse instead of sustained charge until blue.
