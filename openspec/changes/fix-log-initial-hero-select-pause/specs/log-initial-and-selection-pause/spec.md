## ADDED Requirements

### Requirement: Initial log length
系统 SHALL 在滚木初始和重新开始跑酷时设置逻辑长度为3，保留最小长度1、最大长度10与蓝线固定门槛3。

#### Scenario: Start and restart
- **WHEN** 滚木首次初始化或重新开始跑酷
- **THEN** 当前逻辑长度为3，随后仍可增长和缩短至既有上下限

### Requirement: Visual and collision consistency
系统 SHALL 在调整滚动状态视觉长度时同步其碰撞体宽度，固定状态保留既有独立碰撞尺寸。

#### Scenario: Confirmed length scale
- **WHEN** 当前滚木逻辑长度为L
- **THEN** 滚动视觉X倍率为0.4+L*0.2，初始长度3对应倍率1.0；YZ缩放不变，滚动碰撞体宽度使用同一倍率

#### Scenario: Grow or shrink
- **WHEN** 滚动中的滚木增长或缩短
- **THEN** 视觉与滚动碰撞宽度按同一选定映射更新，缩到最小逻辑长度时仍具有正的宽度

### Requirement: Pause during hero selection
系统 SHALL 在英雄选择弹窗出现期间暂停世界模拟，同时保留该弹窗的动画与触摸交互。

#### Scenario: Choosing while world is paused
- **WHEN** 英雄选择界面显示且等待用户选择
- **THEN** 角色、敌人、物理、攻击和刷怪计时保持停止，选择界面仍可完成淡入并响应点击

#### Scenario: Selection completes
- **WHEN** 用户选择英雄并完成弹窗关闭
- **THEN** 释放此弹窗发起的世界暂停，按现有逻辑召唤英雄，不重复处理点击或补算暂停期间世界时间

#### Scenario: External close or game over
- **WHEN** 弹窗被外部隐藏或销毁，或游戏已经结束
- **THEN** 清理弹窗自己的动画和暂停状态，不残留永久暂停，也不误恢复其他原因造成的暂停或游戏结束

#### Scenario: Automatic final hero
- **WHEN** 只剩一个英雄可以选择而无需显示弹窗
- **THEN** 保留自动选择流程，不额外暂停世界
