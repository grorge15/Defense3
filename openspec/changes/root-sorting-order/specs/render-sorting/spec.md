## ADDED Requirements

<!-- None. -->

## MODIFIED Requirements

### Requirement: Root-based world 2D sorting

The system SHALL derive the runtime sorting order for sortable world prefabs from the prefab root node world Y position.

#### Scenario: Root Y determines sorting
- **WHEN** a sortable world prefab is active during runtime
- **THEN** its visible 2D subtree uses a sorting order derived from the root node world Y position plus the prefab sorting offset

#### Scenario: Visual child renders from root order
- **WHEN** a sortable world prefab renders through Sprite or 2D renderer components on its Visual child or descendants
- **THEN** those renderers receive the root-derived sorting order rather than deriving order from the Visual child world Y position

#### Scenario: Different Y positions overlap
- **WHEN** sortable units or buildings at different root world Y positions visually overlap
- **THEN** their draw order remains stable according to their root world Y positions and configured offsets

#### Scenario: Non-sortable descendants are present
- **WHEN** a descendant has no Sorting2D component or equivalent writable 2D renderer order field
- **THEN** the sorting update skips that descendant without throwing errors or breaking other descendants

## REMOVED Requirements

<!-- None. -->
