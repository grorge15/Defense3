## ADDED Requirements

### Requirement: Moving-objective pursuit continuity

The system SHALL distinguish a current-revision pending replacement route from a settled unreachable route. While a valid original objective moves, it SHALL continue using a bounded, settled prior route only when that route is safe against current physical geometry; it SHALL coalesce replacement requests and promptly switch to a settled current-objective route. It MUST stop when no current-safe route or direct motion is available.

#### Scenario: Target crosses flow cells while an enemy is detouring
- **WHEN** an ordinary enemy or Boss has a settled, collision-safe route and its original target continues crossing flow-field cells while a replacement field is pending
- **THEN** the enemy continues safe pursuit on the retained route instead of repeatedly stopping, and later adopts a current replacement without using partial data

#### Scenario: Geometry changes during retained pursuit
- **WHEN** an obstacle is inserted, removed, moved, reclassified, enabled, disabled, or destroyed while a prior route is retained
- **THEN** the retained route is rejected immediately unless it passes current collision, ground, and boundary checks, and the enemy never crosses the changed obstacle

#### Scenario: Target becomes invalid or no safe route exists
- **WHEN** the original target becomes invalid, or no direct or retained current-safe movement exists while route work is pending
- **THEN** the enemy stops or follows its existing target-lifecycle behavior and does not treat pending work as a valid direction

### Requirement: Selected-route destructible obstacle pursuit

The system SHALL select normal pursuit routes using Hard geometry and walkable-ground constraints while omitting only eligible supported Destructible obstacles from the planning view. It MUST retain all physical obstacle colliders for movement and attack validation. When the selected next route leg is physically blocked by one or more eligible Destructible obstacles, it SHALL select the first such obstacle on that leg, approach a legal outside attack surface, damage it through the existing role-specific lifecycle, and resume the original objective after it is no longer blocking.

#### Scenario: An alternate physical detour exists around a Log
- **WHEN** a fixed attackable Log lies on the selected Hard-safe pursuit route and a longer route exists around that Log in the physical-obstacle view
- **THEN** the enemy approaches and removes the Log on the selected route rather than replacing that route with the detour

#### Scenario: Hard geometry shapes the selected route
- **WHEN** a Hard wall lies between an enemy and its original target
- **THEN** planning selects a legal route around that wall when one exists, and the enemy neither crosses nor attacks the wall

#### Scenario: The selected route has no destructible obstruction
- **WHEN** the selected next route leg does not physically intersect an eligible Destructible obstacle
- **THEN** the enemy pursues its original target without acquiring a temporary demolition target

#### Scenario: Multiple destructible obstacles occur in sequence
- **WHEN** the selected route reaches a second eligible Destructible after the first has been removed
- **THEN** the enemy reevaluates current geometry and handles the next first blocker while preserving the original objective and all real collision constraints

#### Scenario: An obstacle is ineligible or no legal attack surface exists
- **WHEN** the first physical blocker is Hard, inactive, non-damageable, moving, failed, or lacks a legal reachable attack surface
- **THEN** it is not selected for demolition, and the enemy follows a legal route or safely waits

### Requirement: Bounded shared moving-target and demolition work

The system SHALL retain revision-current, body-specific, bounded shared construction and cache limits for retained routes, target replacements, planning views, and action-surface queries. Pending target updates and demolition decisions SHALL coalesce without a per-enemy or per-frame full-scene search.

#### Scenario: Many enemies follow one moving target through a Log
- **WHEN** multiple same-body enemies pursue one moving target and encounter the same fixed eligible Log on the selected route
- **THEN** they share bounded current-revision work, keep cache and scheduler limits, and do not restart replacement construction for each target movement notification

#### Scenario: Lifecycle invalidates retained work
- **WHEN** a unit is pooled, destroyed, reset, changes original target, or the navigation service is destroyed
- **THEN** its retained references and obsolete pending requests are released without affecting another unit's current route
