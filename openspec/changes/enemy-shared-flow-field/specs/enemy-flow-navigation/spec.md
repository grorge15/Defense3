## ADDED Requirements

### Requirement: Open entrance routing
系统 SHALL 使用三条楼梯作为合法跨区通道：2号常开，1号与3号在各自对应墙建造完成后关闭。城外敌人先寻找当前可达且开放的楼梯，再依次经过外侧、内侧。

#### Scenario: Ordinary enemy spawn and respawn
- **WHEN** 普通怪出生或死亡后重生且存在可用开放入口
- **THEN** 从实际出生位置可达的开放入口中随机选择一个，先走到楼梯外侧再完成固定进场路线，不将远端出生的怪物传送到楼梯口，复活不会被旧回调重复执行

#### Scenario: Boss entrance preference
- **WHEN** Boss 激活或重生且需要从城外进入城内
- **THEN** 从其实际位置可达的开放入口中选择距玩家最近的入口；入口选择不改变Boss原索敌规则，同侧目标无需先绕去楼梯

#### Scenario: Corresponding wall completes
- **WHEN** 1号或3号楼梯对应的墙完成建造
- **THEN** 仅关闭该楼梯并更新障碍数据，未入城且原选此楼梯的敌人重新选择开放可达入口；两侧均关闭后仅选择2号，已入城的怪物不退回楼梯

#### Scenario: Closure during crossing
- **WHEN** 墙在怪物通过楼梯期间建成
- **THEN** 怪物不传送或穿墙，基于当前位置与合法通行侧恢复路线或停止；扩地不自动重开已关闭楼梯

#### Scenario: Missing or unreachable entrance
- **WHEN** 入口缺少端点、已关闭或按怪物体型不可达
- **THEN** 不选择该入口；没有可达入口的怪物安全停留，不直穿城墙；新初始化的导航也正确识别此前已建成的墙

### Requirement: Exterior routing and region classification
系统 SHALL 区分城外、楼梯过渡和城内，基于实际地面位置与配置的城内区域判断，只有开放楼梯通道允许跨区。

#### Scenario: Obstacle before stairs
- **WHEN** 城外怪物到所选楼梯外侧存在障碍
- **THEN** 使用按体型与入口共享的城外流场绕行，直线可达时直接靠近；不对每只怪单独运行A*

#### Scenario: Visible target across boundary
- **WHEN** 怪物可直观看到另一侧目标但连线未通过开放楼梯
- **THEN** 仍经合法楼梯通行，直接追踪、远点前瞻和避让均不能跨越其他城内外边界

#### Scenario: Inside and transition state
- **WHEN** 怪物已在城内出生或正在通过楼梯
- **THEN** 城内出生者直接追踪目标，楼梯中怪物完成通道后才退出过渡状态；不按美术屏幕高度误判区域

#### Scenario: Boss pursues an exterior target
- **WHEN** 城内Boss按原索敌规则选择城外目标
- **THEN** 经开放可达楼梯反向通行，同侧目标按原追踪方式接近，攻击锁期间仍停止移动

### Requirement: Shared obstacle-aware pursuit
系统 SHALL 在城内让普通怪追踪玩家，Boss 保留原索敌规则；直线能通行时直接靠近当前目标，墙或建筑阻挡时使用同体型、同目标格共享的流场，不为每只敌人单独运行 A*。

#### Scenario: Clear and blocked pursuit
- **WHEN** 当前有效目标与敌人之间通行条件改变
- **THEN** 敌人在直接靠近和共享绕障间选择；Boss 的索敌优先级和重选节奏不因寻路变化

#### Scenario: Grid distance and corner constraints
- **WHEN** 需要绕障
- **THEN** 使用20世界单位网格，以当前目标所在格为终点四方向传播距离，允许八方向沿更小距离移动，但不斜穿障碍拐角；普通怪目标为玩家

#### Scenario: Cache sharing and invalidation
- **WHEN** 多个同体型敌人追踪同一玩家，玩家格及障碍均未变化
- **THEN** 共享已有结果，不重复计算；玩家换格或实际扩地、建造、障碍移除后更新结果，不同体型分别满足通行约束

#### Scenario: Boss selects a different objective
- **WHEN** Boss 按原有近战士兵、建筑/障碍/滚木、英雄、玩家的优先级选到不同于普通怪的目标
- **THEN** 使用该目标对应的共享距离场，不误用玩家距离场；目标为阻挡建筑时选择可到达的攻击接近位置，不移除建筑阻挡

#### Scenario: Unreachable or invalid destination
- **WHEN** 目标越界、被封闭或失效
- **THEN** 不穿墙、不沿旧目标无限移动；停留或走向可达的合法替代位置，并在目标或障碍变化后恢复有效追踪

### Requirement: Smooth collision-constrained movement
系统 SHALL 在流场路径上最多前瞻20格选择直线可达远端路点，并叠加附近敌人的有限排斥，最终服从地图碰撞约束。

#### Scenario: Crowded corner and long frame
- **WHEN** 敌人在墙角拥挤、位置重叠或单帧移动距离较大
- **THEN** 避让降低重叠，不穿越墙体、建筑或障碍拐角，也不因避让超过原移动速度

### Requirement: Minion attack hysteresis
普通怪 SHALL 在距玩家中心32单位以内停止追踪并进入攻击状态，仅在距离超过50单位时恢复追踪。

#### Scenario: Hysteresis band
- **WHEN** 普通怪已进入攻击状态，玩家在32至50单位范围内移动
- **THEN** 普通怪保持停止追踪，实际伤害仍需在32单位攻击距离内且无阻挡，不把50单位视为伤害范围

#### Scenario: Reachable attack distance
- **WHEN** 普通怪在无遮挡处接近玩家
- **THEN** 玩家分离规则允许其达到32单位，原有较大分离半径不会使其永远无法攻击

### Requirement: Boss attack movement lock
Boss SHALL 使用相同入口和共享追踪规则，并在攻击前摇和恢复期间停止移动，保留既有圆形攻击的伤害与范围。

#### Scenario: Player retreats during attack
- **WHEN** Boss 已开始攻击且当前目标离开触发距离
- **THEN** Boss 在恢复结束前保持停移，不被追踪或邻居避让推动；命中按既有攻击时机及范围判断

#### Scenario: Death or reuse during attack
- **WHEN** 攻击中的敌人死亡、禁用或重新激活
- **THEN** 清理旧攻击回调和移动状态，不对新一轮生命重复结算旧伤害
