## Why

Two visible progress sequences currently advance at the wrong time. Construction payment updates the fill and coin feedback but leaves the displayed cost stale. The ultimate finale starts BigMove playback immediately after requesting a camera pullback, so the intended pullback does not visually lead the attack.

## What Changes

- Make the construction cost display represent the remaining payable amount throughout a build, using an integer presentation that does not expose fractional spend values.
- Gate BigMove creation and playback behind completion of the configured camera pullback when a camera is available; preserve the immediate no-camera fallback.
- Retain the existing post-BigMove cleanup, victory settlement, missing-data completion paths, one-shot behavior, and animation-duration fallback.

## Non-goals

- Do not change build prices, coin balance semantics, payment speed, fill behavior, prefab wiring, scene structure, resources, animations, or camera movement math.
- Do not add a camera controller, prefab, scene point, or new gameplay phase.
- Do not alter unrelated dirty workspace files.

## Capabilities

### New Capabilities

- `construction-payment-progress-display`

### Modified Capabilities

- `ultimate-bigmove-clear`

## Impact

The change is limited to construction UI feedback and ultimate finale sequencing. It reuses the existing construction, coin, camera, BigMove, enemy-clear, and victory behavior. Execution scope and verification live in `.cursor/plans/fix-build-cost-and-finale-timing.md`.
