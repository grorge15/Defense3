## ADDED Requirements

### Requirement: Boss attack feedback occurs once per valid attack impact

The Boss SHALL play one attack VFX when a valid attack reaches its damage-impact moment. The VFX MUST be independent of the number of targets damaged by that attack.

#### Scenario: Area attack damages multiple targets
- **WHEN** one Boss attack impact damages more than one eligible target
- **THEN** exactly one Boss attack VFX is played for that attack impact.

#### Scenario: Attack is no longer valid before impact
- **WHEN** the Boss attack is cancelled, the Boss dies, or the captured attack state is invalid before the impact moment
- **THEN** no Boss attack VFX is played and no delayed VFX is created for that cancelled attack.

### Requirement: Boss attack VFX has an isolated world-space lifecycle

Each Boss attack VFX instance MUST be attached to the scene effect root at the Boss world position captured at impact, play once without following later Boss movement, and be reclaimed after playback completes.

#### Scenario: Boss moves after impact
- **WHEN** a Boss attack VFX has started and the Boss subsequently moves
- **THEN** the active VFX remains at its captured impact position until it completes.

#### Scenario: Attack VFX finishes
- **WHEN** a Boss attack VFX playback ends
- **THEN** its temporary instance is removed from the scene effect root.

### Requirement: Missing VFX configuration preserves combat resolution

Boss combat resolution MUST continue when the attack VFX binding, effect root, or playable VFX animation is unavailable.

#### Scenario: VFX binding is absent
- **WHEN** a valid Boss attack reaches its impact moment but no usable attack VFX is configured
- **THEN** existing damage resolution completes without an error or a fallback resource load.