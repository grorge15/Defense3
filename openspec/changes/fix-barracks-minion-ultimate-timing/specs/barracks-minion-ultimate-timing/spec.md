## ADDED Requirements

### Requirement: Barracks subsequent refill wave
After the initial fill, barracks SHALL spawn at most four soldiers per scheduled wave, every three seconds.

#### Scenario: Scheduled refill
- **WHEN** a scheduled barracks spawn wave runs after the initial wave
- **THEN** at most four empty mounts receive a new soldier

### Requirement: Hero shrine hit feedback
Hero shrine SHALL flash red and lightly shake when it takes damage, matching barracks feedback.

#### Scenario: Shrine damaged
- **WHEN** a living hero shrine takes damage
- **THEN** its visual flashes red and plays a short shake

### Requirement: Minions can attack shield soldiers
When a barracks melee soldier is within minion melee range, the minion SHALL be able to deal damage to that soldier (preferring the soldier over the player when both are available).

#### Scenario: Soldier in melee range
- **WHEN** a minion attack frame fires and a barracks melee soldier is in attack range
- **THEN** that soldier takes minion attack damage

### Requirement: Ultimate inter-wave delay
The second BigMove wave SHALL start only after the first wave finishes and an additional configured delay elapses.

#### Scenario: Wave handoff
- **WHEN** the first BigMove wave completes all instances
- **THEN** the system waits the configured inter-wave delay before starting the second wave and zoom

### Requirement: Player targets nearest enemy
Player bow auto-aim SHALL select the nearest living Boss or minion in attack range by world distance, without preferring Boss solely by type.

#### Scenario: Near minion vs far Boss
- **WHEN** a minion is closer than a Boss inside attack range
- **THEN** the player locks the minion for the attack fan center
