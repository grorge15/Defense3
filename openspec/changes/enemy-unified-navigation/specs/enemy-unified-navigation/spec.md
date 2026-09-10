## ADDED Requirements

### Requirement: Unified physical navigation space

The system SHALL determine enemy movement from current walkable ground and obstacle geometry without requiring castle regions, entrance configuration, or entrance-state notifications.

#### Scenario: A real gap connects the objective
- **WHEN** an ordinary enemy or Boss has a current collision-safe route through a real gap in the ground obstacles
- **THEN** it follows that route regardless of former castle or entrance boundaries

### Requirement: Explicit obstacle classification

The system SHALL support editor-facing obstacle states Ignore, Hard, and Destructible, with explicit marking taking precedence over compatibility defaults.

#### Scenario: A hard enclosure blocks an enemy
- **WHEN** current Hard obstacles fully enclose the route to the original target
- **THEN** the enemy does not cross or attack those obstacles and waits safely for a valid geometry change

#### Scenario: Explicit marking overrides a legacy object type
- **WHEN** a generic collider/node or an obstacle with a legacy compatibility type has an explicit navigation marking
- **THEN** routing and demolition use the explicit marking instead of the compatibility default

### Requirement: Destructible obstruction pursuit

The system SHALL prefer a settled normal route over demolition and SHALL select at most one relevant Destructible obstruction per decision only when removing it enables the original objective. It MUST NOT traverse Hard obstacles, and its selected current-geometry attack surface MUST be reachable. The single-Log limit SHALL NOT make unrelated living Destructible Building/Barrier objects suppress evaluation of that Log.

#### Scenario: An alternate gap avoids demolition
- **WHEN** a normal route exists around one or more Destructible obstacles
- **THEN** the enemy pursues the original target and does not attack those obstacles

#### Scenario: A single destructible obstruction blocks the route
- **WHEN** no normal route exists and removing one reachable Destructible obstruction enables the original target
- **THEN** the enemy reaches a legal outside attack surface, damages that obstruction, and resumes the original target after its destruction

#### Scenario: Unrelated living damageables coexist with the blocking Log
- **WHEN** one Log blocks the original route and unrelated living Destructible Building or Barrier objects are also present
- **THEN** the system still evaluates and selects the Log when it is the relevant reachable obstruction, rather than treating the unrelated objects as a global no-demolition condition

### Requirement: Bounded shared construction is preserved

The system SHALL retain revision-current, shared bounded navigation construction for normal and destructible-obstruction decisions.

#### Scenario: Cold Minion and Boss requests compete
- **WHEN** ordinary-enemy and Boss bodies request cold normal or demolition routing after a geometry revision
- **THEN** identical work coalesces, body constraints remain distinct, work advances within the configured per-frame bound, and no synchronous full navigation or per-obstruction graph runs in a caller request

#### Scenario: Dynamic geometry changes during obstruction pursuit
- **WHEN** a target moves or an obstacle is inserted, removed, reclassified, or destroyed while an enemy is pursuing
- **THEN** obsolete pending and settled decisions are discarded, unsafe movement is not returned, and the enemy reevaluates its unchanged original objective against current geometry
