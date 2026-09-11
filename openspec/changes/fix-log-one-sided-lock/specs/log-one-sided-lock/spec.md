## ADDED Requirements

### Requirement: One-sided saw cut
系统 SHALL use the saw/player position relative to the log in the log's local X axis to determine the cut side, SHALL preserve the opposite end, and SHALL update the log visual scale/position together with the rolling BoxCollider2D width/offset.

#### Scenario: Saw cuts the left side
- **WHEN** a saw hit is accepted and the Player is on the log's local left side
- **THEN** the left portion is shortened, the right/end portion remains in place, and the visual and rolling collider represent the same remaining segment.

#### Scenario: Saw cuts the right side
- **WHEN** a saw hit is accepted and the Player is on the log's local right side
- **THEN** the right portion is shortened, the left/end portion remains in place, and the visual and rolling collider represent the same remaining segment.

#### Scenario: Cut at minimum length
- **WHEN** a saw hit would reduce the log below its configured minimum
- **THEN** the log remains at the existing minimum length and no invalid or negative visual/collider width is produced.

### Requirement: Fixed-point placement
系统 SHALL, after the existing fixed-condition succeeds, place the log at the stable scene location `GameRoot/World/BuildPlots/LogFixPoint`, SHALL set the fixed visual X multiplier to 2.0, and SHALL preserve the Player world position and the existing follow relationship until the normal fixed transition releases it.

#### Scenario: Lock after the fixed condition
- **WHEN** the log reaches its existing fixed condition
- **THEN** the log is positioned at `LogFixPoint`, its fixed visual uses X multiplier 2.0, and the Player is not teleported.

#### Scenario: Fixed collider contract
- **WHEN** the log enters the fixed state
- **THEN** its BoxCollider2D uses the existing `GameConfig` fixed offset and width/height values, is Static, is non-sensor, and is applied to the physics world.

#### Scenario: Missing fixed point
- **WHEN** the stable fixed-point path cannot be resolved
- **THEN** the fixed transition does not invent a scene coordinate or alter the Player position; it reports the missing reference through the established runtime diagnostic path.
