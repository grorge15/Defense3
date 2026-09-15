## ADDED Requirements

### Requirement: Player bow fires a three-arrow fan
When the player bow attack hit frame fires, the system SHALL spawn three arrows on the same frame. The arrows SHALL be aimed as an evenly spaced fan totaling 45 degrees centered on the direction from the player to the locked primary target. Only the center arrow SHALL carry the attack reservation for that locked target.

#### Scenario: Fan volley on attack frame
- **WHEN** a player bow attack reaches its projectile spawn frame and a valid primary target is locked
- **THEN** three arrows spawn at the player position with directions −22.5°, 0°, and +22.5° relative to the player→target vector

#### Scenario: Center reservation only
- **WHEN** the fan volley spawns
- **THEN** only the center arrow holds the AttackReservation for the locked enemy; the side arrows do not reserve that enemy
