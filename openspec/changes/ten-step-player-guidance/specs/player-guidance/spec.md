## ADDED Requirements

### Requirement: Ordered guidance objectives
系统 SHALL 按以下十个主步骤提供非强制指引，并以实际完成为准推进：1拾取一个滚木增长道具；2将滚木推至固定点并成功固定；3拾取弓；4建成左侧初始箭塔；5建成右侧初始箭塔；6建成兵营；7解锁英雄祭坛；8完成拓展区购买；9建成左侧最终箭塔；10建成右侧最终箭塔。地块刚出现、站到地块、部分付款或仅接近目标均不代表步骤完成。引导 SHALL 保持玩家原有操作自由。

#### Scenario: Complete the intended route
- **WHEN** 玩家在新的一局中依次完成十个主步骤
- **THEN** 引导按上述顺序推进，每次只指引一个行动目标，右侧最终箭塔完成后结束本局引导

#### Scenario: A later objective was completed early
- **WHEN** 玩家先完成了后续目标，例如先建成右侧初始箭塔，再建成左侧初始箭塔
- **THEN** 引导记录真实完成历史，到达该后续步骤时直接跳过，不要求重复购买；已经完成的目标后来被摧毁也不回退教程

#### Scenario: Repeated or unrelated completion signals
- **WHEN** 同一目标完成信息重复到达，或玩家完成了非当前目标
- **THEN** 每个目标最多记录一次完成；其他目标的完成不错误完成当前目标，左右两侧也不混淆

### Requirement: Nearest growth item and successful pickup
系统 SHALL 在推木阶段选择距离玩家最近、仍可拾取的滚木增长道具，以玩家和道具在实际玩法平面的世界位置计算直线距离。由玩家或其推动的滚木成功触发一次该道具消费后，系统 SHALL 立即结束第一步；同一消费的碰撞与距离检测不得重复计数。单纯滚木长度变化不算拾取。

#### Scenario: Nearest item changes
- **WHEN** 玩家移动导致最近道具变化，或原道具被其他流程消费、隐藏或销毁
- **THEN** 指引在配置的刷新周期内重新选择最近有效道具；距离相同保持稳定目标，不来回闪动

#### Scenario: First accepted collection
- **WHEN** 玩家或其推动的滚木成功消费一个增长道具，包括滚木已经达到长度上限的情况
- **THEN** 第一步立即完成，后续不再指引第二个增长道具，拾取动画和既有增长效果正常执行

#### Scenario: No item remains before collection
- **WHEN** 仍处于推木阶段、尚无成功拾取记录且暂时没有有效增长道具
- **THEN** 保留第一步并隐藏其方向提示，等待有效道具；不假装已经拾取，也不因余额为零指向敌人

#### Scenario: Parkour already succeeded without collecting
- **WHEN** 玩家没有拾取增长道具就已经成功固定滚木
- **THEN** 第一、二步作为已经越过的跑酷指引结束，转入尚未完成的拾弓步骤，不指向已隐藏的跑酷道具

### Requirement: Fixed log and bow completion
系统 SHALL 在第二步指向关卡已有的滚木固定位置，在滚木实际固定成功后才转入拾弓；第三步 SHALL 指向仍存在的弓道具，在玩家实际持弓后完成。固定失败 SHALL 停止本轮方向提示，不伪造成功。

#### Scenario: Arriving is not a successful fix
- **WHEN** 滚木抵达跑酷终点但固定条件没有满足，或终点通知早于固定结果
- **THEN** 不把该通知当成第二步成功，不引导玩家进入购买步骤；固定失败后隐藏指引，交由原有失败流程处理

#### Scenario: Bow acquisition
- **WHEN** 滚木已经固定且玩家尚未持弓
- **THEN** 指引弓道具，待拾取效果使玩家实际持弓后才进入第四步；余额为零也继续拾弓指引

### Requirement: Existing construction prerequisites
系统 SHALL 保留现有解锁前提。第四步的前置子流程依次引导尚未完成的左墙、右墙，再指向左初始箭塔；已完成的墙直接跳过。第七步祭坛购买完成即记录该步完成，但在现有英雄选择与召唤流程使拓展购买可用之前，系统 SHALL 等待并隐藏世界方向提示。这些衔接不增加主步骤数量，不自动解锁或付款。

#### Scenario: First tower is still locked by walls
- **WHEN** 玩家已经持弓，但至少一面前置墙尚未建成
- **THEN** 第四步先指引尚未完成的左墙，再指引尚未完成的右墙；两墙完成并且初始塔购买可用后指向左初始箭塔

#### Scenario: Selecting the hero before expansion
- **WHEN** 祭坛购买完成，英雄选择仍在进行或召唤尚未使拓展购买可用
- **THEN** 不指向隐藏的拓展地块，也不指引刷金币；按现有界面完成选择和召唤后继续第八步

#### Scenario: An expected target is not available
- **WHEN** 当前目标尚未完成，但购买地块仍未开放，或场景中缺少其对象
- **THEN** 保持当前步骤、隐藏失效方向提示并等待目标可用，不自行跳过目标或修改解锁条件

### Requirement: Temporary enemy direction when funds are insufficient
系统 SHALL 以当前实际可购买目标的剩余费用与玩家当前可用金币余额比较，剩余费用为总费用减去已支付金额且不小于零。余额低于剩余费用时 SHALL 临时指向距离玩家最近的有效存活敌人，包括小怪与首领，统一按玩法平面的世界直线距离选取，不增加首领优先权，也不限制为当前攻击范围。系统 SHALL 保留主步骤和前置子流程，并在余额足够时恢复原购买目标。免费步骤和尚不可购买的等待阶段 SHALL 不触发该分支。

#### Scenario: Partial funds or partial payment
- **WHEN** 当前目标可购买，总价100、已支付40、余额59
- **THEN** 暂时引导最近敌人，保留原目标与支付进度；余额恢复到60时重新指向原目标，无须再次凑齐总价100

#### Scenario: Exact affordability during continuous payment
- **WHEN** 余额等于当前剩余费用，或两者在分批小数扣款过程中只有数值精度误差
- **THEN** 继续指向购买目标，不在购买目标与敌人之间闪切；已付金额和余额使用同一轮扣款后的状态判断

#### Scenario: Enemy diversion does not finish a step
- **WHEN** 玩家根据临时指引击败敌人，但金币尚未实际到账或余额依然不足
- **THEN** 保留当前教程步骤，继续选择最近有效敌人；敌人死亡本身不完成购买目标，金币够后才恢复购买指引

#### Scenario: First tower prerequisite costs money
- **WHEN** 第四步正引导一面前置墙，而余额不足这面墙的剩余费用
- **THEN** 临时指向最近敌人，钱够后恢复该墙指引，不使用尚未开放的箭塔价格作比较

#### Scenario: A target completes during the diversion
- **WHEN** 临时敌人指引期间，当前购买目标通过原有流程实际完成
- **THEN** 先记录该目标完成并推进到下一个未完成步骤，再根据新目标重新判断指引，不返回旧地块

#### Scenario: Free objectives with zero coins
- **WHEN** 当前主步骤为拾增长道具、推木固定或拾弓且玩家金币为零
- **THEN** 继续原目标指引，不转向敌人

### Requirement: Target validity and loss handling
系统 SHALL 排除已死亡、失效、已销毁或在层级中不可见的敌人，以及已经消费或不可见的道具。玩家或目标移动后 SHALL 在配置刷新周期内重选最近对象；同距目标采用稳定顺序。无可用对象时 SHALL 隐藏指向标记并保留进度。

#### Scenario: Guided enemy dies or becomes hidden
- **WHEN** 当前指引敌人死亡、销毁、隐藏，或有另一敌人变得更近
- **THEN** 在配置的刷新周期内指向新的最近有效敌人，不保留指向尸体或失效位置的箭头

#### Scenario: No living enemies can be guided
- **WHEN** 当前余额不足但没有有效存活敌人
- **THEN** 隐藏方向提示、保留赚钱分支；有效敌人出现时恢复指引，或余额通过其他来源足够时恢复购买目标；不生成敌人或发放金币

### Requirement: Visible directional feedback
系统 SHALL 使用清晰的方向箭头与目标标记表达当前唯一行动目标：玩家附近的方向箭头指向该目标，目标在屏幕内时显示其位置标记；目标在屏幕外时以屏幕安全边缘的方向标记指向它。全部标记 SHALL 使用同一个目标，并避免遮挡或拦截摇杆、金币显示与弹窗操作。

#### Scenario: Target moves out of view
- **WHEN** 玩家或镜头移动使目标离开屏幕
- **THEN** 方向提示仍在可见安全区域内指向该目标，回到屏幕内后恢复目标位置标记，不出现反向或失效坐标闪烁

#### Scenario: Player uses the joystick
- **WHEN** 玩家拖动摇杆并按引导方向移动
- **THEN** 指引继续跟随当前目标并允许触摸穿透，不取消或代替摇杆输入

### Requirement: Guidance lifecycle
系统 SHALL 将进度限定于本局，并在初始化时同步真实游戏状态，避免依赖已经错过的阶段通知。暂停或英雄选择期间 SHALL 隐藏方向标记并保留进度；恢复后重新评估当前目标。游戏结束、玩家死亡、滚木固定失败或本局引导完成后 SHALL 停止显示与目标刷新。新加载的关卡 SHALL 从该局真实初始状态重新引导，不沿用上一局目标或回调。

#### Scenario: Initial phase notification did not fire
- **WHEN** 关卡启动时已经处于推木阶段，没有新的阶段切换通知
- **THEN** 第一步仍正常初始化并显示有效目标

#### Scenario: Pause and resume
- **WHEN** 世界暂停，包括英雄选择导致的暂停
- **THEN** 暂停期间方向标记隐藏且教程进度不因等待而变化，弹窗交互保持原样；恢复后再选取有效目标，不补算暂停时间

#### Scenario: Game ends during guidance
- **WHEN** 游戏胜利、失败或玩家死亡发生在任一主步骤或敌人临时分支
- **THEN** 隐藏并停止本局指引，后续迟到的金币、拾取或建造通知不重新显示它

#### Scenario: Reload or disable and enable
- **WHEN** 关卡重新加载，或本局引导组件暂时停用后重新启用
- **THEN** 新关卡清理旧监听和旧进度并重新初始化；同局重新启用保留已完成记录、重新核对真实进度，不累加重复监听或箭头实例
