## ADDED Requirements

### Requirement: Ultimate finale synchronizes lock, camera, VFX, clear, and victory

The system SHALL execute the ultimate finale in a deterministic order: player lock and camera pullback first, synchronized BigMove playback at all valid configured points second, enemy clearing after BigMove completion, and the existing win settlement last. The system MUST keep the finale single-shot once it has started.

#### Scenario: Configured points play the ultimate VFX together

- **WHEN** the ultimate finale is triggered and `SceneSetup` provides one or more valid point nodes
- **THEN** the system locks player movement, starts the existing camera pullback, creates one `Vfx_BigMove` instance at every valid point, and starts the `BigMove` animation once on all created instances in the same finale start

#### Scenario: Enemy clearing waits for BigMove completion

- **WHEN** the synchronized BigMove playback has finished
- **THEN** the system stops future enemy spawning, deactivates all active `EnemyMinion` and `EnemyBoss` instances using the existing clearing behavior, and only then enters the existing win settlement

#### Scenario: Finale is idempotent

- **WHEN** a second ultimate trigger, duplicate tower-complete event, or duplicate animation-finished callback occurs after the finale has started
- **THEN** the system does not create another VFX wave, clear enemies twice, or schedule another win settlement

#### Scenario: Missing point or VFX data does not deadlock victory

- **WHEN** the configured point list is empty/invalid or the existing VFX/BigMove resource cannot be resolved
- **THEN** the system records a diagnostic, skips only the unavailable VFX work, and continues to the existing enemy-clear and win settlement path without leaving the player permanently locked in an unfinished finale
