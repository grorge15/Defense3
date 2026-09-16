## ADDED Requirements

### Requirement: Boss visual facing remains stable through local navigation corrections

A Boss SHALL derive visual left-right facing from its current effective combat objective while that objective remains valid. Local navigation, separation, or avoidance corrections MUST NOT independently reverse the Boss visual facing.

#### Scenario: Dense movement beside a structure

- **WHEN** a Boss approaches an effective structure objective while nearby units or route correction alternate its horizontal movement direction across consecutive updates
- **THEN** the Boss visual remains facing the effective objective side and does not repeatedly mirror because of those local corrections

#### Scenario: Boss approaches an actionable blocker

- **WHEN** an actionable blocker becomes the Boss effective combat objective during pursuit
- **THEN** the Boss visual faces that blocker while approaching or attacking it

### Requirement: Boss retains normal target-directed turning

A Boss SHALL turn its visual left-right direction when its valid effective combat objective moves or changes to the opposite side.

#### Scenario: Objective changes sides

- **WHEN** the Boss effective combat objective is on the opposite horizontal side from its current facing
- **THEN** the Boss visual mirrors once to face that objective while existing movement, targeting, and attack behavior continues
