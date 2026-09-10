## ADDED Requirements

### Requirement: Navigation reflects physical collision geometry
Enemy navigation SHALL represent supported Box and Polygon 2D obstacle colliders from the active scene with the same active/enabled and obstacle-classification policy.

#### Scenario: Static physics synchronization does not discard route work
- **WHEN** a static obstacle receives repeated transform notifications while its active state, collider classification, and world collision geometry are unchanged
- **THEN** navigation SHALL retain its current shared flow jobs and obstacle revision
- **AND WHEN** a later snapshot observes a changed obstacle geometry, active state, classification, or navigation topology
- **THEN** navigation SHALL commit one new obstacle revision and discard route work from the old revision

#### Scenario: Polygon wall blocks a direct pursuit line
- **WHEN** an active nonsensor polygon `airWall` lies between an enemy and its target
- **THEN** navigation SHALL not return direct velocity through that wall and SHALL use a legal route when one exists

### Requirement: Navigation and physics velocity agree
Enemy route prediction SHALL use world-coordinate velocity, while Box2D receives velocity in its physics coordinate scale.

#### Scenario: Faster Boss movement remains collision-safe
- **WHEN** Boss movement speed is increased
- **THEN** the predicted navigation sweep and the rigidbody movement SHALL represent the same world displacement and the Boss SHALL not overshoot its route solely due to coordinate-scale mismatch

### Requirement: Obstruction pursuit remains actionable
Enemy navigation SHALL preserve safe behavior at collision boundaries without making a valid destructible target unattackable merely because the enemy is touching that target's own collider.

#### Scenario: Boss reaches a tower surface
- **WHEN** a Boss is within attack range of a destructible tower and overlaps only that tower's navigation collider
- **THEN** the Boss SHALL be permitted to attack the tower

#### Scenario: Target is disconnected by hard collision
- **WHEN** an enemy target is enclosed by an indestructible collision component
- **THEN** the enemy SHALL pursue a nearest reachable approach point without crossing or selecting the hard collider for demolition

#### Scenario: Enemy begins overlapped after a collision correction
- **WHEN** an enemy begins a navigation update overlapping an obstacle
- **THEN** it SHALL receive only bounded recovery movement toward a nearby legal position, or remain stopped if none exists
