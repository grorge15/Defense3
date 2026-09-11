## Why
电锯当前通过整体缩短滚木长度，无法保留未被锯到的一端；滚木固定后也没有把自身稳定放到场景中的固定点，导致视觉长度、碰撞体和玩家跟随关系在边界情况下不一致。

## What Changes
- 电锯根据 Saw 与 Player 相对滚木的本地 X 位置，截短靠近玩家的一侧并保留另一端；截短后同步 Visual 的 X 缩放/位置和滚木 BoxCollider2D 的宽度/本地 X 偏移。
- 滚木满足既有固定条件后，解除跑酷跟随并定位到 `GameRoot/World/BuildPlots/LogFixPoint`，Visual X 使用固定的 2.0 倍标定。
- 固定碰撞体使用 `GameConfig` 已有的 offset/size 配置，保持 Static、非 sensor。
- Player 不因滚木固定或单侧截短被传送，既有跑酷跟随关系只在固定完成时按现有生命周期解除。

## Non-goals
- 不修改 `Main.scene`、任何 prefab 或场景层级/坐标。
- 不新增 GameConfig 固定碰撞字段，不改变蓝线固定条件、阶段事件、敌人导航或弓箭伤害语义。

## Capabilities
### New Capabilities
- `log-one-sided-lock`：滚木单侧截短、固定点定位与固定碰撞/视觉一致性。

### Modified Capabilities
- 无已归档基线变更；与现有滚木初始长度、跟随和固定规格兼容。

## Impact
实现范围限定在 `Log.ts` 与 `SawTrap.ts` 的运行时逻辑，读取 `GameConfig` 既有固定碰撞参数，并通过稳定场景路径解析固定点；不产生场景或 prefab 序列化变更。

## Execution pointer
实现与验证步骤见 `.cursor/plans/fix-log-one-sided-lock.md`。
