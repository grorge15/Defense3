## ADDED Requirements

### Requirement: Construction payment display shows remaining payable amount

The construction payment display SHALL present the remaining payable amount from the configured total less all accepted payment progress. The displayed value MUST use `Math.ceil` of the non-negative remaining amount so partial payments remain readable as integers.

#### Scenario: Initial and changed construction costs are displayed

- **WHEN** a construction option is first presented or its configured cost changes
- **THEN** its display shows the current remaining amount for that option rather than a stale previous total

#### Scenario: Payment progress refreshes the visible remaining amount

- **WHEN** a payment increment is accepted during construction
- **THEN** the cost display is refreshed in the same progress update and equals the integer policy applied to the new remaining amount

#### Scenario: Completed or reset construction does not retain stale cost text

- **WHEN** payment reaches the full cost or a construction item begins a new lifecycle
- **THEN** the completed item displays zero remaining before its existing completion handling, and the new lifecycle begins at its configured full remaining cost
