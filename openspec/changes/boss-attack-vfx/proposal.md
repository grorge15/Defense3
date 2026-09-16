## Why

Boss 攻击伤害在攻击帧结算，但没有对应的攻击特效反馈。需要在有效命中帧播放一次特效，并避免 AoE 按受击目标重复播放。

## What Changes

- Boss 的每次有效攻击命中播放一次已配置攻击特效。
- 特效在效果根节点的 Boss 出招位置播放，结束后回收。
- 攻击取消、失效或特效不可用时，既有伤害结算保持可用。

## Non-goals

- 不改变 Boss 伤害、范围、目标、冷却、攻击动画或命中判定。
- 不新增特效资源，不改其他单位特效，不改 Main.scene。

## Capabilities

### New Capabilities

- `boss-attack-vfx`: Boss 攻击命中帧的单次世界空间视觉反馈。

## Impact

一次 Boss 群体攻击只生成一份临时攻击特效，独立于实际受击目标数量，并会在播放后移除。

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/boss-attack-vfx.md`。