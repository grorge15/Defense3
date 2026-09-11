继续

## Ten-step player guidance

`GameRoot` contains the world-only guidance presentation:

| Node or resource | Placement and responsibility |
| --- | --- |
| `GameRoot/GuideIndicator` | Hosts `GuideIndicatorUI`; references the two base instances and `DirectionArrow.prefab`. |
| `GameRoot/DirectionArrow` | Base `guideWire` instance of `resources/prefabs/VFX/DirectionArrow.prefab`. Its `Visual` uses `指向箭头-指向.png`, raw 128x196, world layer, and scale 0.35. |
| `GameRoot/TargetArrow` | Base `bigArrow` instance of `resources/prefabs/VFX/TargetArrow.prefab`. Its `Visual` uses `箭头-目标.png`, raw 91x95, world layer, and scale 0.5. |

The component positions guide wires from player to target with world-space `atan2` rotation and reuses extra prefab instances under `GameRoot`. The target root follows the actual `BuildPlot` node while its `Visual` bobs by plus or minus 15 world units. No guidance node is under `UI`, Canvas, or Camera.
