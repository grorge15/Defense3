## ADDED Requirements

### Requirement: Boss spawns on first barracks complete
The system SHALL spawn the first Boss when the first barracks build completes. Completing both basic towers SHALL unlock barracks plots but SHALL NOT spawn the Boss.

#### Scenario: Two basic towers only
- **WHEN** both basic tower plots complete and barracks plots are revealed
- **THEN** no Boss is spawned yet

#### Scenario: First barracks built
- **WHEN** the first barracks build completes
- **THEN** the Boss spawns once at the configured spawn point

### Requirement: Hero disappears after death animation
The system SHALL hide the Hero node after the death animation finishes. If no usable death clip exists, the Hero node SHALL hide immediately.

#### Scenario: Death clip present
- **WHEN** the Hero dies and a die animation is available
- **THEN** the Hero node becomes inactive only after that animation finishes

### Requirement: Yellow-line charge speed pulse
When the rolling log touches the yellow line, the parkour forward speed SHALL decelerate to the configured charge speed over the configured duration, then SHALL instantly restore parkour forward speed until the blue line. Blue-line lock SHALL still require the fixed minimum rolling width; on success the log SHALL flash red; on failure it SHALL fade out as before.

#### Scenario: Yellow-line pulse
- **WHEN** the log enters the yellow charge zone
- **THEN** forward speed lerps to charge speed over the configured duration and then snaps back to parkour forward speed

#### Scenario: Blue-line lock success
- **WHEN** the log crosses the blue line and rolling width meets the fixed minimum
- **THEN** the log locks and plays a red hit flash

#### Scenario: Blue-line lock fail
- **WHEN** the log crosses the blue line and rolling width is below the fixed minimum
- **THEN** the log fades out without locking

### Requirement: Hit feedback and archer single shot
Soldier, Log (when attackable), Boss, and Minion SHALL flash red on damage. Barracks SHALL flash red and lightly shake on damage. Tower ranged soldiers SHALL select at most one ranged target per attack.

#### Scenario: Barracks hit
- **WHEN** barracks takes damage while alive
- **THEN** its visual flashes red and plays a short position shake

#### Scenario: Archer volley size
- **WHEN** a tower-deployed soldier fires
- **THEN** it attacks at most one ranged target
