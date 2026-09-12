## ADDED Requirements

### Requirement: Ultimate final cleanup waits for enemy death presentation

After the accepted BigMove sequence completes, the system SHALL stop future enemy spawning and quiesce every active minion and boss enemy before starting its death presentation. It MUST wait until every selected enemy's death presentation has completed or safely resolved before removing the enemy batch and continuing the existing victory settlement.

#### Scenario: Active enemies present death during final cleanup

- **WHEN** the ultimate enters final cleanup with active minion or boss enemies
- **THEN** each selected enemy stops moving, attacking, navigating, and taking further combat action, remains visible for its death presentation, and the batch is removed only after all selected presentations resolve

#### Scenario: A final-cleanup death presentation is unavailable or interrupted

- **WHEN** a selected enemy lacks a usable death visual, animation, or clip, or becomes disabled or destroyed while its presentation is pending
- **THEN** that enemy resolves exactly once without blocking the remaining batch or victory settlement

#### Scenario: Final cleanup does not use ordinary combat rewards

- **WHEN** an enemy is removed through ultimate final cleanup
- **THEN** no coin, reward, ordinary pool-return, respawn, or ordinary-combat death side effect is issued

#### Scenario: Repeated finale signals do not repeat cleanup

- **WHEN** duplicate ultimate triggers or duplicate death-presentation completion signals arrive during or after final cleanup
- **THEN** the system starts no second cleanup batch, removes no enemy twice, and schedules no second victory settlement
