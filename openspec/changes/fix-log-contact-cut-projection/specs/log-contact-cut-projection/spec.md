## ADDED Requirements

### Requirement: Contact-point saw cut
The system SHALL cut the rolling log at the saw–log contact local X when a saw hit is accepted, or at the saw center local X when no contact point is available. It SHALL keep the segment on the player’s side of the cut and remove the outer segment. Visual length and the rolling collider SHALL use the same center and width after the cut.

#### Scenario: Cut keeps the player side
- **WHEN** a saw hit is accepted and the player lies on one side of the cut local X
- **THEN** that side’s edge is preserved, the opposite edge moves to the cut, and visual width matches collider width

#### Scenario: Cut at minimum width
- **WHEN** a cut would leave less than the configured minimum rolling width
- **THEN** the log remains at least that minimum width and does not produce a non-positive visual or collider width

### Requirement: World-width blue-line lock
The system SHALL allow blue-line lock only when the rolling world width is at least the configured fixed minimum width. On success it SHALL place the log at the stable fixed point and apply the existing fixed visual and collider calibration. On failure it SHALL use the existing failed fade-out path.

#### Scenario: Wide enough at the blue line
- **WHEN** the log crosses the blue line and rolling width meets the fixed minimum
- **THEN** the log locks at the fixed point with calibrated fixed geometry

#### Scenario: Too narrow at the blue line
- **WHEN** the log crosses the blue line and rolling width is below the fixed minimum
- **THEN** the log fails and fades out without locking as a barrier

### Requirement: Shadow tracks visual width
The system SHALL keep the log ground-shadow contentSize.width equal to the current log Visual content width minus a fixed slack, SHALL NOT use shadow scale to express length, and SHALL align the shadow’s local X center with the visual center whenever rolling or fixed length geometry refreshes.

#### Scenario: Rolling length changes
- **WHEN** the log extends, cuts, or otherwise refreshes rolling geometry
- **THEN** shadow contentSize.width equals log Visual content width minus the configured slack

#### Scenario: Fixed geometry applied
- **WHEN** the log enters the fixed state and fixed visual calibration is applied
- **THEN** shadow contentSize.width equals that fixed log Visual content width minus the configured slack
