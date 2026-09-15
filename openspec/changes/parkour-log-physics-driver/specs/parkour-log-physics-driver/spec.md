## ADDED Requirements

### Requirement: Physics-owned rolling log

During parkour, the Log SHALL be the only object that receives the combined constrained horizontal input and automatic forward motion as Dynamic RigidBody2D velocity. Its rotation SHALL remain locked and it SHALL participate in ordinary solid 2D collision. Player SHALL be attached to the Log with its world transform preserved while its own rigidbody and collider participation are disabled.

#### Scenario: First effective parkour input begins physical movement

- **WHEN** parkour is active and the first effective constrained joystick direction is produced
- **THEN** the Log begins moving with the existing forward and horizontal behavior, Player remains visually aligned as its child, and Player does not independently drive a physics body

#### Scenario: Yellow-line charge reduces forward motion

- **WHEN** the rolling Log enters the yellow-line zone
- **THEN** the Log continues as the sole physics mover using the existing charge-speed behavior and Player remains attached

#### Scenario: Rolling Log meets world geometry or an enemy

- **WHEN** the Dynamic rolling Log contacts a solid world collider or enemy collider
- **THEN** the 2D physics solver determines the collision response without a per-frame Log world-position assignment, manual air-wall AABB push-out, or enemy rolling-log carry compensation

### Requirement: Parkour exit restores Player before publication

The system SHALL complete the Player detach and restoration lifecycle before publishing parkour completion. It SHALL restore the recorded parent and recorded rigidbody/collider state without changing Player world transform. A successful lock SHALL move the Log to LogFixPoint only after detach; failed lock and Player death SHALL detach without moving the Log to LogFixPoint.

#### Scenario: Blue-line lock succeeds

- **WHEN** the Log reaches the blue line and satisfies the existing world-width fixed requirement
- **THEN** Player detaches and regains its recorded physics state, the Log uses the existing fixed geometry at LogFixPoint, and parkour completion is published only after those transitions finish

#### Scenario: Blue-line lock fails

- **WHEN** the Log reaches the blue line and does not satisfy the existing world-width fixed requirement
- **THEN** Player detaches and regains its recorded physics state, the Log enters its existing failure fade path without using LogFixPoint, and parkour completion is published only after the transition finishes

#### Scenario: Player dies during parkour

- **WHEN** Player dies before blue-line completion while attached to the Log
- **THEN** Player is detached and its recorded physics state is restored before game-over handling pauses the world

### Requirement: Fixed-log enemy behavior remains authoritative

The system SHALL remove rolling Log-specific AABB velocity compensation from ordinary enemies. Existing navigation, collision, and demolition behavior for a fixed, attackable Log SHALL remain the authority after the Log has completed its transition.

#### Scenario: Enemy encounters a fixed attackable log

- **WHEN** an enemy encounters a fixed attackable Log on a selected route
- **THEN** it continues to use the existing fixed-log navigation and demolition contract rather than the removed rolling-log compensation path

### Requirement: Nested ordering roots do not conflict

SortingOrder2D SHALL use the existing root-derived sorting rule while treating a descendant with its own SortingOrder2D as a separate ordering boundary. A parent ordering root SHALL not create or update sorting targets inside that nested subtree.

#### Scenario: Nested sortable child is active

- **WHEN** a sortable root contains a descendant subtree with another active SortingOrder2D component
- **THEN** the outer component updates only its own renderer subtree and the nested component remains the sole owner of its descendant renderer order
