## ADDED Requirements

### Requirement: Enemy hit VFX is source-aware

EnemyMinion and EnemyBoss SHALL accept a damage source type with each damage application and SHALL play the source-mapped hit VFX only after a valid, non-dead enemy receives damage.

#### Scenario: Hero projectile hits an enemy
- **WHEN** a Hero attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound blue hit VFX at its current world position.

#### Scenario: Player arrow hits an enemy
- **WHEN** a Player/Arrow attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound yellow hit VFX at its current world position.

#### Scenario: Soldier attacks an enemy
- **WHEN** a Soldier ranged or Soldier melee attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound yellow hit VFX at its current world position.

### Requirement: VFX lifecycle and ownership

Each spawned hit VFX instance MUST be parented under `GameRoot/Effect`, preserve the selected world position at spawn time, play once, and be released after playback completes.

#### Scenario: Hit VFX completes
- **WHEN** a hit VFX animation reaches its end
- **THEN** its temporary instance is reclaimed and no orphan effect remains under `GameRoot/Effect`.

#### Scenario: Effect binding is absent
- **WHEN** an enemy receives valid damage but its Inspector VFX binding is empty
- **THEN** damage and death processing continue without a hardcoded resource load, crash, or unrelated VFX.

### Requirement: No VFX on non-enemy damage receivers

The source propagation change MUST NOT make Player, Hero, Soldier, buildings, logs, or other non-enemy receivers play these enemy hit VFX.

#### Scenario: Non-enemy receiver is damaged
- **WHEN** a non-enemy damage receiver takes damage
- **THEN** its existing damage behavior is preserved and no enemy hit VFX is spawned by this change.
