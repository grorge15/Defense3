# Enemy Soldier Boss Combat

## ADDED Requirements

### Requirement: Minion engages a nearby shield soldier
The runtime SHALL allow an aggroed minion to use a nearby living barracks melee Soldier as a temporary combat target.

#### Scenario: Soldier intercepts a pursuing minion
- **WHEN** a living melee Soldier is within the minion's configured attack reach while the minion is pursuing its normal target
- **THEN** the minion SHALL stop, face, animate, and apply its attack damage to that Soldier
- **AND** it SHALL resume its normal target when that Soldier is no longer a valid nearby combat target.

### Requirement: Character melee range uses collider surfaces
Character melee range checks SHALL use the gap between the attacker and target collider surfaces when colliders are available.

#### Scenario: Boss contacts a shield soldier
- **WHEN** the Boss physical collider is in contact with or within configured range of a living melee Soldier
- **THEN** the Boss SHALL be allowed to attack that Soldier using the configured `attackTriggerRange`
- **AND** hidden minimum range clamps SHALL NOT override that configured value.

### Requirement: Boss attack lifecycle recovers after target loss
Boss attack recovery SHALL be owned by its attack instance, rather than by continued target validity.

#### Scenario: Boss kills its current target during an attack
- **WHEN** the currently attacked target dies, despawns, or is replaced before the attack animation recovery completes
- **THEN** that attack instance SHALL clear its attacking state on animation completion or its fallback timeout
- **AND** a stale callback SHALL NOT clear a newer attack instance
- **AND** the Boss SHALL reacquire a valid target on the following update.
