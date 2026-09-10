# Defense Combat And Expansion Fixes

## Why
Friendly arrows damage the fixed defensive log, ranged attacks restart before their animation ends, and expansion-related objects disappear before the expansion is built.

## What Changes
- Fixed logs ignore player arrows and use a stable, explicitly configured collision footprint.
- Ranged soldiers complete each attack animation before beginning another attack.
- Expansion hide-list objects remain until expansion completion.

## Scope
Script-only fixes. Preserve damage values, visual log growth, serialized references, and navigation behavior.
