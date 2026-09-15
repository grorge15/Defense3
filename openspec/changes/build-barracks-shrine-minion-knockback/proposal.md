## Why

When a Barracks or Hero Shrine appears beside active minions, those minions can remain visually crowded against the new structure. The construction event needs a brief, size-aware separation response without treating units already inside the structure collider as valid displacement targets.

## What Changes

- A newly spawned Barracks or Hero Shrine applies one short outward knockback to nearby active living EnemyMinion units.
- The affected area scales from the spawned structure collider bounds plus configured padding.
- The response interrupts transient minion combat and navigation motion only for the configured knockback interval, then normal pursuit resumes.

## Non-goals

- Do not knock back EnemyBoss, dead minions, inactive minions, or minions whose collider overlaps the spawned structure collider.
- Do not change building costs, build order, spawning, damage, targeting, health, collision layers, navigation topology, prefabs, or Main.scene.
- Do not add a repeated area effect after the initial construction response.

## Capabilities

### New Capabilities

- `construction-minion-knockback`: one-time construction separation for Barracks and Hero Shrine spawns.

### Modified Capabilities

- None.

## Impact

This is a runtime construction-feedback behavior for active living EnemyMinion units. Knockback radius, speed, duration, and padding are centralized as gameplay configuration.

## Execution pointer

Implementation, file ownership, and machine acceptance criteria are in `.cursor/plans/build-barracks-shrine-minion-knockback.md`.
