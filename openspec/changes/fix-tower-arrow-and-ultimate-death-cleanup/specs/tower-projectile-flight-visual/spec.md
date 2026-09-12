## ADDED Requirements

### Requirement: Tower projectile visuals follow their flight direction

The system SHALL present each tower-fired ranged projectile using the same XY flight-direction angle and configured artwork offset convention as a player arrow. The presentation MUST not alter tower target selection, damage timing, immediate damage behavior, movement duration, or projectile lifetime.

#### Scenario: A tower projectile has the standard arrow presentation

- **WHEN** a ranged tower attack creates a projectile toward a target at a non-zero XY offset
- **THEN** the projectile visual faces its immutable initial flight direction using the standard arrow offset while the existing timed movement and immediate attack damage continue unchanged

#### Scenario: The initial projectile direction is zero length

- **WHEN** the projectile start and target positions have no meaningful XY separation
- **THEN** the visual uses the same deterministic upward fallback direction as a player arrow and the existing projectile lifetime still applies

#### Scenario: A tower projectile lacks standard visual components

- **WHEN** the created tower projectile lacks arrow behavior but has a resolvable sprite
- **THEN** it uses the default arrow visual offset without changing combat behavior

- **WHEN** the created tower projectile lacks both arrow behavior and a resolvable sprite
- **THEN** the system records a diagnostic and continues the existing unrotated timed projectile behavior without an error or a combat delay
