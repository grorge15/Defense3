## Why
滚木开局长度仍为1；英雄选择时世界继续移动和攻击，影响选择操作。

## What Changes
- 滚木初始及重新开始长度改为3，最小长度仍1。
- 视觉X倍率改为0.4+长度*0.2，初始长度3时倍率1.0，滚动碰撞宽度同步。
- 英雄选择弹窗出现时暂停世界，弹窗仍可操作，关闭后恢复自身暂停。

## Non-goals
不改场景、prefab、滚木固定尺寸、旋转、蓝线条件或其他战斗/寻路逻辑。

## Capabilities
### New Capabilities
- `log-initial-and-selection-pause`：初始滚木长度与英雄选择世界暂停。
### Modified Capabilities
- 无已归档相关基线。

## Impact
仅改配置、滚木和英雄选择脚本；UI采用独立时间推进，以免世界暂停同时冻结按钮交互。

## Execution pointer
见`.cursor/plans/fix-log-initial-hero-select-pause.md`。用户已确认视觉公式，进入实施阶段。
