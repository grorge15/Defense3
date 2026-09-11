## ADDED Requirements

### Requirement: Moving-objective pursuit continuity

The system SHALL distinguish a current-revision pending replacement route from a settled unreachable route. While a valid original objective moves, it SHALL continue using a bounded, settled prior route or direction only when its next safe route segment and current-frame physical sweep remain safe against current geometry; it SHALL coalesce replacement requests and promptly switch to a settled current-objective route. A settled route for a recently superseded target cell MAY provide interim safe progress while a newer replacement is pending. It MUST stop when no current-safe route, direction, or direct motion is available.

#### Scenario: Target crosses flow cells while an enemy is detouring
- **WHEN** an ordinary enemy or Boss has a settled, collision-safe route and its original target continues crossing flow-field cells while a replacement field is pending
- **THEN** the enemy continues safe pursuit on the retained route instead of repeatedly stopping, and later adopts a current replacement without using partial data

#### Scenario: Geometry changes during retained pursuit
- **WHEN** an obstacle is inserted, removed, moved, reclassified, enabled, disabled, or destroyed while a prior route is retained
- **THEN** the system refreshes future routing work without globally clearing all retained directions, and each enemy continues only through its current-frame sweep and next safe route segment that pass current collision, ground, and boundary checks; it never crosses the changed obstacle

#### Scenario: A new building is distant from this frame's movement
- **WHEN** a building collider is created inside the city but does not intersect an enemy's current-frame sweep, next safe route segment, or direct movement
- **THEN** the enemy keeps making its existing safe forward progress while replacement routing updates in the background

#### Scenario: A completed route targets a recently old cell
- **WHEN** the original target crosses flow-field cells again before a completed replacement for its earlier cell is consumed
- **THEN** the enemy may use that completed route as bounded interim progress when it remains current-geometry-safe, and continues coalescing toward the newest target cell without waiting at zero velocity solely because the result is no longer the exact newest cell

#### Scenario: Target becomes invalid or no safe route exists
- **WHEN** the original target becomes invalid, or no direct or retained current-safe movement exists while route work is pending
- **THEN** the enemy stops or follows its existing target-lifecycle behavior and does not treat pending work as a valid direction

#### Scenario: A distant physical blocker lies on a direct pursuit line
- **WHEN** Hard geometry or a live physical collider blocks a direct line farther away than the enemy can travel in its current frame
- **THEN** the enemy advances only to the current-frame sweep's safe point, then uses the current route, demolition, or waiting behavior at the blocker; it does not return zero velocity solely because the full remaining direct line is blocked

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
