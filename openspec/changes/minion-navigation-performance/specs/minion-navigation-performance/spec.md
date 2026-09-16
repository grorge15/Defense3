## ADDED Requirements

### Requirement: Staggered decisions preserve continuous safe movement
小怪 SHALL 将昂贵路线和临时拆障决策分散到约 0.2-0.3 秒的更新窗口，间隔内持续执行仍有效的移动意图。每帧 MUST 按当前几何验证实际移动，并保留既有存活、攻击距离、攻击锁定和建造击退规则；长帧不补跑多次过期决策。

#### Scenario: Many minions pursue a moving target
- **WHEN** 一批小怪同时出现并持续追踪同一个有效移动目标
- **THEN** 普通决策分散在不同帧执行，目标移动在下一个决策窗口重新评估，小怪在窗口之间继续安全移动，不因节流出现周期性停走

#### Scenario: Current movement becomes unsafe between decisions
- **WHEN** 两次决策之间出现新墙、目标死亡、攻击锁定或建造击退
- **THEN** 当前帧即停止不合法的导航执行或遵循既有高优先级动作，不等待下一次昂贵决策，也不穿越新墙

#### Scenario: A minion is reused or changes objective
- **WHEN** 小怪死亡、禁用、回池复活、重置、迁移，或原目标身份/自身碰撞体改变
- **THEN** 旧生命和旧目标的移动、拆障及避让状态不影响新状态，其他小怪继续各自有效行为

### Requirement: Local demolition retains a legal actionable commitment
小怪 SHALL 按已选合法追踪路段处理首个符合资格的可破坏阻挡，优先当前侧可直接到达的合法攻击面，不反复比较全局绕路代价。有效拆障决定 MUST 保持稳定；局部直达方案不足时，仍允许有界可达查询找到合法站位，不保证全局最短路线。

#### Scenario: A fixed log blocks the selected route with a detour available
- **WHEN** 可攻击的固定滚木阻挡当前路段，旁边也存在绕路
- **THEN** 小怪稳定接近合法攻击面并按原时序摧毁滚木，随后恢复原目标，不因临时路线点变化在两种目标间反复切换

#### Scenario: Direct local faces are obstructed
- **WHEN** 近侧攻击面无法直接到达，但绕开不可破坏障碍后存在合法站位
- **THEN** 小怪通过有界查询选择可达站位，等待计算时只做安全移动或等待，不穿墙或错误攻击不可破坏物

#### Scenario: An existing diversion becomes unnecessary or invalid
- **WHEN** 同一原目标移动到完整物理直线可达的位置，或滚木已摧毁、失活、不再可攻击
- **THEN** 不必要的拆障在下个决策窗口且既有攻击恢复允许时结束；失效对象立即停止接收攻击和移动承诺，后续依据当前几何恢复追踪或选择下一个合法阻挡

### Requirement: Bounded low frequency avoidance preserves role behavior
小怪 SHALL 错峰低频更新局部避让，默认最多使用 4 个有效邻居，并将避让结果限制为受当前碰撞约束的移动修正。Boss MUST 保持既有决策节奏、目标优先级、拆障、避让及攻击行为。

#### Scenario: Dense mixed crowd moves near a wall
- **WHEN** 多只小怪与 Boss 在墙边追踪目标
- **THEN** 小怪以有限邻居更新避让并逐帧安全移动，旧避让不能推其穿墙；Boss 继续原有决策，不套用小怪更新窗口或邻居限制

#### Scenario: Neighbors leave between avoidance updates
- **WHEN** 邻居移动、死亡或回池，距离下次小怪避让更新尚有时间
- **THEN** 缓存修正保持有界且经过当前帧安全检查，下个窗口刷新邻居，不对失效对象施加攻击或依赖其旧生命状态
