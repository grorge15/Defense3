# Fix Boss Facing Jitter

## Why

Boss visuals can rapidly mirror left and right while the Boss is settled near a structure. Local navigation and neighbor-avoidance corrections can alternate horizontal velocity even when the Boss remains focused on the same combat objective, and that transient movement is currently treated as a new visual-facing command.

## What Changes

- Keep Boss visual facing derived from its current effective combat objective throughout pursuit and obstacle approach.
- Treat local pathing and avoidance velocity as physical movement only; it no longer overrides Boss visual facing while the effective objective remains valid.
- Preserve normal visual turning when the effective objective changes sides, including when an actionable obstacle becomes the current combat objective.

## Non-goals（禁做）

- Do not change navigation, avoidance, collision, target priority, attack range, attack timing, animations, movement speed, or game balance.
- Do not alter the shared visual-facing helper or other character types.
- Do not change scenes, prefabs, assets, physics layers, or resource metadata.

## Capabilities

### New Capabilities

- `boss-facing-stability`

### Modified Capabilities

- None.

## Impact

Bosses retain a stable readable facing direction when local movement is corrected near dense structures, while existing movement and combat behavior continues. Implementation and machine validation are defined in `.cursor/plans/fix-boss-facing-jitter.md`.

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/fix-boss-facing-jitter.md`（与本 change 同名 slug）。
