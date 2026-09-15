## ADDED Requirements

### Requirement: Building spawn pushes eligible nearby minions once
The system SHALL evaluate nearby EnemyMinion instances once immediately after a barracks or hero shrine successfully instantiates and activates. Only active, live EnemyMinion instances in the same scene whose valid collider centers fall within the configured building-area range SHALL receive a radial outward push from the building collider center, or from the building world center when no valid collider is available.

#### Scenario: Barracks creates space for nearby minions
- **WHEN** a barracks successfully instantiates and activates with eligible active minions nearby in the same scene
- **THEN** each eligible minion receives one short outward push using the configured range and strength

#### Scenario: Hero shrine uses the same behavior
- **WHEN** a hero shrine successfully instantiates and activates with eligible active minions nearby in the same scene
- **THEN** the same one-time outward push behavior is applied without waiting for later hero selection

### Requirement: Initial embedding and non-minion targets are excluded
The system SHALL NOT push an EnemyMinion that is already strictly overlapping the new building collider at the evaluation instant. The system SHALL NOT push EnemyBoss instances or other non-minion objects.

#### Scenario: Embedded minion remains untouched
- **WHEN** an active live EnemyMinion is initially strictly overlapping the new building collider
- **THEN** no building-spawn push or position correction is applied to that minion

#### Scenario: Boss is nearby
- **WHEN** an EnemyBoss is within the configured building-area range at building spawn
- **THEN** the Boss receives no building-spawn push

### Requirement: Push uses bounded transient physical movement
The system SHALL apply the push through the minion's Dynamic rigidbody velocity rather than transform positioning. During the configured transient window, the push velocity SHALL temporarily take precedence over normal navigation velocity, SHALL decay over time, and SHALL return control to normal movement after expiry. A later valid push SHALL safely refresh the bounded transient state.

#### Scenario: Navigation resumes after decay
- **WHEN** an eligible minion receives a building-spawn push while navigation is writing movement velocity
- **THEN** the minion moves outward during the configured decay window and resumes ordinary navigation movement after that window ends

#### Scenario: Repeated building pushes and lifecycle end
- **WHEN** an eligible minion receives another valid building-spawn push before the first expires
- **THEN** the transient push refreshes without unbounded stacking
- **AND WHEN** that minion dies, becomes inactive, or is returned for reuse
- **THEN** the transient push stops and cannot affect the later lifecycle

### Requirement: Building spawn push does not change combat state
The system SHALL NOT apply damage, alter health, change combat targeting, or move an eligible minion by direct world/local position assignment as part of the building-spawn push.

#### Scenario: Eligible minion is pushed
- **WHEN** an eligible minion receives a building-spawn push
- **THEN** its health and combat target remain unchanged and no direct position assignment is used

### Requirement: Accepted pushes show existing red hit feedback once
The system SHALL invoke the existing EnemyMinion red HitFlash exactly once for each accepted building-spawn push. Rejected candidates SHALL NOT receive this feedback, and the behavior SHALL NOT add visual assets, prefab changes, or scene changes.

#### Scenario: An eligible minion is pushed
- **WHEN** an eligible EnemyMinion accepts a building-spawn push
- **THEN** its existing red HitFlash plays once for that accepted impulse
