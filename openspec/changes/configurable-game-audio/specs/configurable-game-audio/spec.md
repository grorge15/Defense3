# Configurable Game Audio

## Requirement: Inspector-configurable audio cues

The game SHALL expose an AudioManager component whose BGM and sound-effect cues can each be enabled, assigned an optional clip, volume multiplier, and minimum replay interval in the Inspector. A scene editor SHALL attach the component and assign clips through the Inspector; gameplay requests SHALL safely no-op when the component is unavailable.

### Scenario: Optional cue remains silent

- **WHEN** an enabled cue has no assigned clip
- **THEN** its playback request completes without audible output or gameplay failure

### Scenario: User adjusts a configured cue

- **WHEN** a designer changes a configured cue's clip, enabled state, or volume multiplier and saves the scene
- **THEN** the changed configuration is used after reopening the scene

### Scenario: AudioManager is not attached

- **WHEN** gameplay requests an audio cue before a scene editor has attached AudioManager
- **THEN** gameplay continues without audible output or an exception

## Requirement: Confirmed feedback mapping

The game SHALL support Inspector bindings for BGM, player attack, tower volley, Hero 2 attack, normal enemy death, coin collection, build completion, and hero spawning; Hero 1 attack SHALL default to no clip. The recommended initial binding uses `bgm`, `playerAttack`, `arrowShoot`, `shandian`, `monsterDie`, `gold`, `build`, and `升级2` respectively.

### Scenario: Hero attack mapping

- **WHEN** Hero 2 successfully initializes its projectile
- **THEN** the configured Hero 2 cue is requested once

### Scenario: Hero 1 default silence

- **WHEN** Hero 1 successfully initializes its projectile with its default audio configuration
- **THEN** no hero attack audio is produced

## Requirement: Playback occurs only after successful gameplay actions

The game SHALL request player, hero, and tower attack cues only after the associated projectile or volley succeeds; it SHALL request coin audio only after collection succeeds, build audio only on build completion, and hero-spawn audio only after an instantiated hero is active.

### Scenario: Tower volley is grouped

- **WHEN** a tower launches more than one projectile in one volley
- **THEN** it requests at most one tower-volley cue

### Scenario: Spending coins does not play collection audio

- **WHEN** the player spends coins to start or complete a build
- **THEN** no coin-collection cue is requested by that balance change

## Requirement: Normal death feedback excludes finale cleanup

The game SHALL request normal enemy death audio only from normal death flows and SHALL NOT request it from the finale's `playFinalDeath` flow.

### Scenario: Finale clears enemies

- **WHEN** the UltimateSystem uses `playFinalDeath` to clear enemies
- **THEN** no normal enemy death cue is requested

## Requirement: BGM lifecycle and short-effect protections

The game SHALL start BGM only after the first user input, prevent duplicate BGM playback, pause BGM and discard active short effects while hidden, and stop all audio at GameOver or scene destruction. It SHALL apply per-cue replay intervals and a configurable short-effect concurrency cap without queuing skipped sounds.

### Scenario: Phase changes after BGM starts

- **WHEN** the game phase changes while BGM is already playing
- **THEN** it continues as one loop without a second source

### Scenario: High-frequency sound requests

- **WHEN** a cue is requested within its minimum replay interval or while the concurrency cap is full
- **THEN** the new request is skipped and is not replayed later
