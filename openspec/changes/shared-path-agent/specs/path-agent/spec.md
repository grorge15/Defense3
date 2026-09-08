## ADDED Requirements

### Requirement: Obstacle-aware pursuit movement

The system SHALL make pursuing combat units move around airWall and static blocking obstacles when a direct line to their active objective is blocked.

#### Scenario: Pursuer routes around a blocker
- **WHEN** a pursuing unit has a live movement objective and an airWall or static obstacle blocks the direct path
- **THEN** the unit moves through reachable intermediate positions around the obstacle instead of pushing into the blocked edge for a long duration

#### Scenario: Route is unavailable
- **WHEN** a pursuing unit cannot find a usable route around the obstacle
- **THEN** the unit continues using existing local steering behavior and does not break its combat, collision, or animation state

### Requirement: Low-frequency pursuit refresh

The system SHALL refresh pursuit paths at a bounded low frequency rather than recalculating a full route every frame.

#### Scenario: Target moves while pursued
- **WHEN** a pursued target remains valid but changes position enough to invalidate the current pursuit route
- **THEN** the pursuing unit refreshes its route on the next allowed refresh and continues toward the target

#### Scenario: Target dies or becomes invalid
- **WHEN** a pursuing unit's active target dies, despawns, or otherwise becomes invalid
- **THEN** the unit stops movement or switches target according to its existing targeting rules without continuing toward a stale point indefinitely

#### Scenario: Target switches
- **WHEN** existing targeting rules choose a different valid target
- **THEN** the unit abandons stale intermediate movement points and follows a route toward the newly selected target

### Requirement: Boss pursuit semantics

The system SHALL preserve boss target priority, retarget cadence, and attack conditions while improving movement around blockers.

#### Scenario: Boss selects among multiple targets
- **WHEN** multiple valid targets are present
- **THEN** the boss uses the same target priority as before and only changes movement routing toward the selected target

#### Scenario: Boss reaches attack range
- **WHEN** the boss is within its existing attack range and attack conditions are satisfied
- **THEN** the boss attacks under the same conditions as before instead of continuing path movement

### Requirement: Minion pursuit semantics

The system SHALL preserve minion aggro, barrier priority, peer/player separation, and rolling-log blocking behavior while improving movement around blockers.

#### Scenario: Minion has special movement constraints
- **WHEN** minions pursue under aggro, barrier priority, separation, or rolling-log blocking constraints
- **THEN** those constraints remain active while obstacle-aware pursuit contributes only to reaching the current objective

#### Scenario: Minion reaches attack range
- **WHEN** a minion reaches its existing attack range against its selected target
- **THEN** it attacks using the same attack timing and hit behavior as before

### Requirement: Hero follow and attack movement semantics

The system SHALL preserve hero follow offset/leash behavior and stop movement during ranged attacks while improving follow movement around blockers.

#### Scenario: Hero follows the player
- **WHEN** a hero is following the player toward its intended offset position
- **THEN** the hero moves around blockers while still respecting its existing follow offset and leash behavior

#### Scenario: Hero attacks
- **WHEN** a hero begins or performs its existing ranged attack
- **THEN** the hero stops movement as before and does not path-follow through the attack

### Requirement: Soldier movement scope

The system SHALL apply obstacle-aware pursuit only to melee soldiers and SHALL keep ranged soldiers in their existing stationary tower behavior.

#### Scenario: Melee soldier pursues
- **WHEN** a melee soldier has a valid nearest enemy target outside attack range
- **THEN** it pursues that target around blockers while keeping existing melee attack behavior

#### Scenario: Ranged soldier attacks from tower
- **WHEN** a ranged soldier has enemies available
- **THEN** it remains in its existing stationary ranged role and does not roam or path-follow toward enemies

## MODIFIED Requirements

<!-- No archived baseline requirement exists yet; this change defines the shared movement behavior delta. -->

## REMOVED Requirements

<!-- None. -->
