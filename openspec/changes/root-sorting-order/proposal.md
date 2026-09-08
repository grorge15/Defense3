## Why

Runtime 2D sorting currently follows the visual child position, but the desired gameplay read is that each logical prefab root decides the shared draw order for its visible subtree. This avoids mismatches when the visible Sprite lives under `Visual` while movement, collision, and placement are represented by the root node.

This change updates the rendering behavior source of truth from Visual-Y to root-Y for sortable world prefabs.

## What Changes

- Sortable world prefabs derive their runtime order from the prefab root node world Y.
- Visible 2D descendants receive the root-derived base order plus the prefab-level offset.
- Sprites under `Visual` remain valid render targets even though `SortingOrder2D` is mounted on the root.
- Descendants without sortable 2D render state are skipped safely.

## Non-goals（禁做）

- Do not change combat, movement, animation, pathfinding, phase transitions, economy, or build flow.
- Do not move rendering responsibility to a root-only `Sorting2D` component when the root itself does not render.
- Do not require one `SortingOrder2D` per Sprite.
- Do not rewrite prefab JSON by hand or rebuild unrelated prefab node trees.
- Do not modify `Main.scene` structure for this behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `render-sorting`

## Impact

Player-visible overlap between units and buildings becomes stable around the logical ground position represented by each prefab root. Existing prefab layouts with `Root -> Visual -> Sprite` continue to render through child Sprite or Sorting2D components, but their shared order is driven by the root transform.

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/root-sorting-order.md`（与本 change 同名 slug）。
