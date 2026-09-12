## ADDED Requirements

### Requirement: Parkour begins with visible joystick guidance and locked movement

At the beginning of the parkour phase, the joystick hint SHALL be visible immediately and Player movement input SHALL remain locked until the first effective joystick direction is produced.

#### Scenario: New parkour phase starts before any directional drag

- **WHEN** a new parkour phase begins and no effective joystick direction has been produced
- **THEN** the hint is visible immediately and Player does not receive movement input from touch start, touch end, or a zero joystick vector

### Requirement: Effective joystick input drives onboarding

An effective joystick input MUST contain a meaningful movement direction after the active mode's constraints are applied. In parkour, a drag that yields only a constrained zero horizontal direction is not effective input.

#### Scenario: First effective directional drag

- **WHEN** the player first drags the joystick far enough to produce an effective movement direction
- **THEN** Player movement input unlocks, the direction is delivered to Player, and the hint hides immediately

#### Scenario: Global touch without movement direction

- **WHEN** a global touch start, move, or end does not produce an effective joystick direction
- **THEN** it does not unlock Player movement and does not reset or hide the onboarding hint as though movement occurred

### Requirement: Idle hint recurrence uses effective input

After movement is unlocked, the joystick hint SHALL hide while effective joystick direction is present and SHALL reappear after the configured three-second idle delay without effective directional input. Phase suppression rules for ultimate and game-over remain in force.

#### Scenario: Player stops providing directional joystick input

- **WHEN** no effective joystick direction has been present for `GameConfig.joystickHintDelay` after movement was unlocked
- **THEN** the hint becomes visible using the existing phase-appropriate motion

#### Scenario: Phase changes or input is disabled

- **WHEN** parkour ends, a later supported phase begins, or input is disabled by ultimate or game-over
- **THEN** the existing mode and suppression behavior remains authoritative and stale touches cannot unlock movement or reveal a suppressed hint
