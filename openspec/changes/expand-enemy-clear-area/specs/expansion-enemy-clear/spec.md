## ADDED Requirements

### Requirement: Expansion clears authored interior enemies
When expansion completes, the game SHALL relocate every active living supported enemy whose collision footprint overlaps the authored expansion clear area.

#### Scenario: A living enemy is in the clear area at expansion completion
- WHEN expansion completes and an active living supported enemy overlaps the clear area
- THEN that enemy is relocated into the authored placement area.

#### Scenario: An enemy is outside the clear area
- WHEN expansion completes and an active living supported enemy does not overlap the clear area
- THEN that enemy remains at its current position.

#### Scenario: A dead or inactive enemy is in the clear area
- WHEN expansion completes and an inactive or dead enemy overlaps the clear area
- THEN that enemy is not relocated.

### Requirement: Authored placement remains safe and distributed
Relocated enemies MUST fit within the authored placement area and SHALL be assigned separated positions according to their collision footprints.

#### Scenario: Several enemies require relocation
- WHEN multiple supported enemies overlap the clear area at expansion completion and the placement area has capacity
- THEN each relocated enemy receives a position inside that area without overlapping another relocated enemy.

#### Scenario: A marker is unusable or placement capacity is insufficient
- WHEN either authored marker is missing, inactive, not a sensor collider, or the placement area cannot safely contain all selected enemies
- THEN the game leaves the selected enemies in place and emits a diagnostic without substituting an unconfigured destination.

### Requirement: Relocation resumes normal combat safely
Relocating an enemy SHALL preserve its health and normal combat ownership while invalidating transient movement and attack state from its former position.

#### Scenario: An enemy was moving or attacking when relocated
- WHEN a supported enemy is relocated during expansion completion
- THEN its prior movement and pending attack state cannot apply from the old location, and it resumes normal pursuit from the new position.
