## ADDED Requirements

### Requirement: Eligible construction separates nearby minions
The system SHALL apply one outward knockback to each active living EnemyMinion near a newly spawned Barracks or Hero Shrine. The affected area MUST be derived from that structure's active collider bounds plus configured padding.

#### Scenario: A minion is near a newly spawned Barracks
- **WHEN** a Barracks is spawned and an active living EnemyMinion is within its padded collider area without overlapping its collider
- **THEN** that minion receives one outward knockback away from the Barracks.

#### Scenario: A minion is near a newly spawned Hero Shrine
- **WHEN** a Hero Shrine is spawned and an active living EnemyMinion is within its padded collider area without overlapping its collider
- **THEN** that minion receives one outward knockback away from the Hero Shrine.

### Requirement: Construction knockback respects excluded units and collider overlap
The system MUST NOT apply this construction knockback to EnemyBoss, dead EnemyMinion, inactive EnemyMinion, or an EnemyMinion whose collider overlaps the newly spawned structure collider.

#### Scenario: A minion is already inside the structure collider
- **WHEN** a newly spawned Barracks or Hero Shrine collider overlaps an EnemyMinion collider
- **THEN** that minion is not knocked back by the construction response.

#### Scenario: A boss or unavailable minion is nearby
- **WHEN** an EnemyBoss, dead EnemyMinion, or inactive EnemyMinion is within the padded collider area
- **THEN** it remains unaffected by the construction response.

### Requirement: Knocked-back minions resume ordinary pursuit
The system SHALL use the configured short knockback interval to override normal minion movement, canceling stale transient attack motion before ordinary navigation resumes.

#### Scenario: A minion was moving or attacking at construction time
- **WHEN** an eligible EnemyMinion receives construction knockback while moving or attacking
- **THEN** its prior transient attack and navigation motion cannot continue during the knockback interval, and normal pursuit resumes afterward.
