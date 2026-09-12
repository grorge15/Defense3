## ADDED Requirements

### Requirement: Boss retarget preserves unchanged navigation ownership

Boss pursuit SHALL preserve its current navigation ownership when a periodic target scan selects the same valid target node. It MUST reset per-unit navigation only when the effective selected target node changes or existing lifecycle handling requires release.

#### Scenario: Periodic scan retains the same target
- **WHEN** `bossRetargetInterval` elapses and Boss selection returns the currently locked valid target node
- **THEN** the Boss retains its per-unit navigation state and continues the existing pursuit lifecycle without a reset caused solely by that scan

#### Scenario: Periodic scan selects a new target
- **WHEN** a periodic scan or invalid-target recovery selects a different valid target node
- **THEN** the Boss releases stale per-unit navigation state before pursuing the new objective

### Requirement: Transient obstacle candidates preserve Boss-local flow state

Boss pursuit SHALL NOT clear its local retained navigation state solely because a transient blocking-obstacle candidate appears, disappears, or differs, unless that change changes the effective navigation objective or existing target lifecycle requires a reset.

#### Scenario: Pending obstacle diagnostic changes candidate
- **WHEN** shared obstruction diagnostics are pending and consecutive frames produce different temporary blocking-obstacle candidates while the Boss original objective is unchanged
- **THEN** the Boss retains eligible local flow state and does not repeatedly restart navigation because of those temporary candidates

### Requirement: Boss safely retains constrained world velocity while shared flow is pending

When shared replacement flow data is pending and produces zero movement for a Boss, the Boss SHALL reuse only its own most recent nonzero world velocity that passes `EnemyNavigation.constrainFinalVelocity` against current geometry and current movement constraints. It MUST stop or use existing unstuck behavior when that velocity is absent, invalid for the current lifecycle, or cannot pass the current-frame safety check.

#### Scenario: Pending shared field has a safe retained velocity
- **WHEN** a Boss keeps the same effective objective, shared flow is pending, the current output is zero, and its prior constrained world velocity remains safe for the current frame
- **THEN** the Boss advances with that retained velocity without crossing current collision, ground, or boundary constraints

#### Scenario: Pending shared field cannot safely reuse velocity
- **WHEN** shared flow is pending and zero output is returned but the prior velocity is missing, stale, or fails the current-frame constraint
- **THEN** the Boss stops or follows its existing unstuck behavior and does not move through an obstacle

#### Scenario: Attack lock or objective change occurs while flow is pending
- **WHEN** the Boss begins an existing attack movement lock, its target becomes invalid, or its effective objective changes while shared flow is pending
- **THEN** retained velocity is not reused across that transition and existing lifecycle behavior controls movement
