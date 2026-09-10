## ADDED Requirements

### Requirement: Bounded construction-frame navigation work

The system SHALL construct shared navigation connectivity and distance data in bounded work slices across gameplay frames, using a 30-world-unit shared navigation grid.

#### Scenario: Construction starts a cold navigation query
- **WHEN** construction or another obstacle update causes an ordinary enemy or Boss to need uncached navigation data
- **THEN** the request joins or creates shared bounded work, and the complete connectivity or distance calculation does not execute in that caller's animation-frame callback

#### Scenario: Ordinary enemy and Boss require distinct body data
- **WHEN** ordinary-enemy and Boss requests require separate body-specific navigation data after the same obstacle update
- **THEN** both requests make bounded scheduler progress without serially completing either full construction in one frame, and each uses its own passability constraints

### Requirement: Scene-bound navigation readiness latency

For the current 30-world-unit scene grid, the system SHALL bound the visible wait for current blocked-route data while retaining a shared per-frame scheduler safety limit.

#### Scenario: Both production body types await a cold blocked route
- **WHEN** the ordinary-enemy body and Boss body request blocked routes together after one unchanged geometry revision on the current scene bounds
- **THEN** each receives a current-revision usable route within 48 scheduler frames of its first request, and neither uses partial or obsolete navigation data while it waits

### Requirement: Current-obstacle movement safety while work is pending

The system MUST invalidate navigation data immediately after a geometry update and MUST NOT return movement that crosses a current obstacle while replacement computation is pending.

#### Scenario: Geometry changes during pursuit
- **WHEN** an obstacle is added, removed, moved, enabled, disabled, or changes navigation topology while enemies are pursuing
- **THEN** obsolete route data is not used; an enemy either follows a route proven safe against the current geometry or waits until current data is ready, and resumes valid pursuit without crossing the obstacle

#### Scenario: Direct route remains clear
- **WHEN** an enemy has a direct route proven clear against the current geometry while shared construction is pending
- **THEN** it may continue directly subject to existing sweep, ground, portal, and boundary constraints

### Requirement: Shared bounded lifecycle is retained

The system SHALL retain the existing bounded cache, LRU, and invalidation lifecycle for completed and pending shared navigation work.

#### Scenario: Repeated construction and unit reuse
- **WHEN** geometry changes repeatedly, units are pooled, or a scene navigation service is released
- **THEN** obsolete pending work and completed results are cancelled or released, work from different body constraints is not incorrectly shared, and cache capacity remains bounded

### Requirement: Diagnostic reachability preserves pending readiness

The system SHALL distinguish current-revision pending diagnostic reachability from settled reachable and settled unreachable results. It MUST NOT cache a negative fixed-log diversion result derived from incomplete current-revision navigation data.

#### Scenario: Fixed-log diagnostic begins while connectivity is pending
- **WHEN** a fixed-log diversion diagnostic requests reachability and its current geometry connectivity data is still pending
- **THEN** it defers the diversion decision without caching a negative result, and it reevaluates the same geometry revision after the required data settles

#### Scenario: Fixed-log diversion is reachable after diagnostic completion
- **WHEN** the settled current-revision diagnostic shows that removing the fixed log enables a valid diversion
- **THEN** the system returns the fixed-log diversion without requiring another geometry invalidation

#### Scenario: Closed side stairs require the central fixed-log diversion
- **WHEN** both side entrances are closed, an attackable fixed central log is the only obstruction between an outside ordinary enemy or Boss and its original inside target, and the current diagnostic has not yet settled
- **THEN** the enemy waits without unsafe movement only while the current diagnostic is pending, identical requests join that same work, and the settled unchanged revision returns the central-log diversion within the navigation readiness bound

#### Scenario: Central-log destruction resumes the original target
- **WHEN** an ordinary enemy or Boss reaches a legal attack surface for the required central fixed log and destroys it
- **THEN** the diversion is cleared and the enemy resumes pursuit of its original target using current navigation data

#### Scenario: Diagnostic is settled unreachable
- **WHEN** every required current-revision diagnostic reachability result has settled and no valid diversion exists
- **THEN** the system may retain a bounded shared negative diagnostic result until the current geometry revision changes

## MODIFIED Requirements

### Requirement: Shared obstacle-aware pursuit

The existing shared pursuit behavior SHALL use current completed flow data for blocked routes, but it SHALL safely defer blocked movement while required shared data is pending rather than synchronously constructing it during an enemy request.

#### Scenario: Multiple enemies request an uncached blocked route
- **WHEN** multiple same-body enemies request a blocked route after the same geometry revision
- **THEN** they share one bounded construction job and do not each trigger complete graph or breadth-first-search construction

## REMOVED Requirements
