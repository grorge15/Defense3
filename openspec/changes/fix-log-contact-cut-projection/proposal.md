## Why

Saw cuts still shrink the log by a discrete logical step from the left or right end, so the cut does not match where the saw touches the log. Blue-line lock also gates on logical length, while the rolling visual and collider are real widths. A new ground-shadow child under the log must stay shorter than the visual by a fixed slack whenever length changes.

## What Changes

- Saw cuts use the saw–log contact point (or saw center) in log-local X, keep the player’s side, and discard the outer segment.
- Rolling length is the left/right edge span; visual scale/position and BoxCollider2D width/offset update from the same center and width.
- Blue-line lock requires rolling world width at least a configured minimum; fixed placement still uses LogFixPoint plus the existing fixed visual/collider calibration.
- The log shadow child’s content width stays equal to the log Visual content width minus a fixed slack and shares the visual center offset (shadow scale is not used for length).
- No corridor max-width clamp.

## Non-goals

- Main.scene edits; handwritten prefab rebuilds.
- Changing parkour phase events or fixed collider calibration constants beyond syncing the shadow to the fixed visual width.

## Capabilities

### New Capabilities

- `log-contact-cut-projection`: contact-point cut, world-width lock gate, visual/collider/shadow sync.

### Modified Capabilities

- Supersedes discrete side-shrink cut behavior from `log-one-sided-lock` for saw hits.
