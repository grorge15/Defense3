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

The system SHALL select pursuit routes using Hard geometry and walkable-ground constraints while omitting only eligible supported Destructible obstacles from the planning view. It SHALL select the first eligible Destructible that physically blocks the selected next route leg, approach a reachable current-geometry attack surface, damage it, and resume the original objective after its destruction. It MUST NOT traverse or attack Hard obstacles. The single-Log limit SHALL NOT make unrelated living Destructible Building/Barrier objects suppress evaluation of that Log.

#### Scenario: An alternate physical gap exists
- **WHEN** a selected Hard-safe route intersects an eligible Destructible obstacle and a physical detour around it also exists
- **THEN** the enemy preserves the selected route, reaches a legal outside attack surface, damages that obstruction, and resumes the original target after its destruction

#### Scenario: A single destructible obstruction blocks the selected route
- **WHEN** the next leg of the selected Hard-safe route is physically blocked by one reachable Destructible obstruction
- **THEN** the enemy reaches a legal outside attack surface, damages that obstruction, and resumes the original target after its destruction

#### Scenario: Unrelated living damageables coexist with the blocking Log
- **WHEN** one Log blocks the original route and unrelated living Destructible Building or Barrier objects are also present
- **THEN** the system still evaluates and selects the Log when it is the relevant reachable obstruction, rather than treating the unrelated objects as a global no-demolition condition

### Requirement: Bounded shared construction is preserved

The system SHALL retain revision-current, shared bounded navigation construction for Hard-safe planned routes, full-geometry movement validation, and destructible-obstruction decisions.

#### Scenario: Cold Minion and Boss requests compete
- **WHEN** ordinary-enemy and Boss bodies request cold normal or demolition routing after a geometry revision
- **THEN** identical work coalesces, body constraints remain distinct, work advances within the configured per-frame bound, and no synchronous full navigation or per-obstruction graph runs in a caller request

#### Scenario: Dynamic target or geometry changes during obstruction pursuit
- **WHEN** a target moves while the current geometry is unchanged
- **THEN** the enemy may retain only a bounded settled route that remains safe against that current geometry while it coalesces a replacement for the moved target
- **AND WHEN** an obstacle is inserted, removed, reclassified, or destroyed while an enemy is pursuing
- **THEN** obsolete pending and settled decisions are discarded, unsafe movement is not returned, and the enemy reevaluates its unchanged original objective against current geometry
