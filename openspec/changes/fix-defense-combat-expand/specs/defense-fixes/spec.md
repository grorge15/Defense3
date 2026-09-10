## ADDED Requirements

### Requirement: Fixed log protection and footprint
The fixed defensive log SHALL ignore player arrow damage and maintain its configured fixed collision footprint independently of visual length.

#### Scenario: Arrow crosses a fixed log
- WHEN a player arrow crosses or contacts the fixed log
- THEN log health remains unchanged and the arrow does not spend a penetration slot on the log.

#### Scenario: Fixed geometry remains stable
- WHEN the log locks or its geometry is refreshed while fixed
- THEN the configured fixed collision footprint is retained.

### Requirement: Complete ranged attack playback
A ranged soldier MUST finish its current attack animation and satisfy its cooldown before beginning another attack.

#### Scenario: Cooldown expires before playback finishes
- WHEN the attack cooldown expires during an unfinished attack
- THEN no new attack starts until playback completes.

#### Scenario: An earlier attack callback arrives late
- WHEN an earlier attack's delayed callback runs during a later attack
- THEN it does not unlock the later attack.

### Requirement: Expansion visibility timing
Objects configured to hide for expansion SHALL remain visible until the expansion is completed.

#### Scenario: Expansion purchase becomes available
- WHEN the expansion purchase plot is unlocked
- THEN the configured objects are not hidden by that unlock.

#### Scenario: Expansion appears
- WHEN construction completes and expansion content appears
- THEN the configured objects are hidden.
