## ADDED Requirements

### Requirement: Fixed blocking log diversion
小怪和Boss SHALL 仅在原始有效目标无法通过合法路径到达有效追踪或攻击位置、且固定可攻击滚木确实阻断该路径时，将该滚木作为临时阻路目标；普通目标优先级不因此改变。

#### Scenario: Log blocks the only open entrance
- **WHEN** 两侧入口已关闭、中间开放入口的通道或端点被固定可攻击滚木挡住，而移除该滚木后存在通向原目标的合法路径
- **THEN** 敌人选择该滚木并接近其当前侧可达的攻击表面，不因整个入口尚不可通行而拒绝接近，也不穿过滚木或城界

#### Scenario: Log blocks pursuit on the same side
- **WHEN** 敌人与原目标位于城界同侧，固定可攻击滚木阻断追踪，而移除该滚木即可形成合法路径
- **THEN** 敌人先接近并攻击该滚木，不为拆滚木强制绕去楼梯

#### Scenario: Grid connectivity disagrees with entrance traversal
- **WHEN** 地面网格存在通向原目标的连通路径，但固定滚木阻断实际必须完成的入口通道，且没有其它开放可达入口
- **THEN** 敌人按实际入口路线识别阻路滚木，不因网格连通而停在入口外；走到攻击表面期间持续完成这次必要拆除，摧毁后恢复原路线

#### Scenario: Original objective remains reachable
- **WHEN** 原目标可直接到达，或存在绕过滚木的合法替代路径或其它开放入口
- **THEN** 敌人继续追踪原目标，不被沿途或附近的滚木抢走目标

#### Scenario: A replacement point is not a reachable objective
- **WHEN** 导航找到原目标附近的可达替代位置，但从该位置仍不能合法接近或攻击原目标，且固定滚木是路径阻断原因
- **THEN** 敌人仍识别阻路滚木，不把存在替代位置视为原目标真正可达

#### Scenario: Closure is not caused by an attackable log
- **WHEN** 非滚木障碍、城界、关闭入口或缺失导航配置使原目标不可达，移除候选滚木也不能形成合法路径
- **THEN** 不选择该滚木作为临时目标，不拆墙或其它建筑，不改变安全停留及原导航限制

#### Scenario: Moving or inactive log
- **WHEN** 滚木仍在滚动、蓄力、失败淡出、不可攻击、非有效激活状态或已被摧毁
- **THEN** 敌人不因阻路将其作为拆除目标，原移动滚木碰撞处理保持有效

### Requirement: Reachable attack surface
敌人 SHALL 根据自身真实碰撞体尺寸及偏移和滚木碰撞边界选择可达的外侧站位及攻击表面；接近和命中均保留其它障碍、地面、城界及入口约束，滚木在摧毁前保持阻挡。

#### Scenario: Offset body and long log
- **WHEN** 长滚木中心不可达，或敌人碰撞体中心偏离根节点，或敌人与滚木的最近一面不可达
- **THEN** 敌人使用实际可达的一面及外侧站位进入攻击距离，不瞄准中心、不穿模，也不以不可达的最近表面否定所有其它可达表面

#### Scenario: Attack cannot pass through another obstacle
- **WHEN** 敌人与滚木攻击表面间存在其它障碍或非法城界跨越
- **THEN** 不从该位置造成滚木伤害，继续合法接近或安全停留

### Requirement: Damage timing and lifecycle safety
小怪与Boss SHALL 使用各自既有对滚木适用的伤害数值、攻击冷却及动画命中时机；同次攻击不可重复命中同一滚木，过期的生命或攻击回调不可影响当前生命。

#### Scenario: Minion and boss hit a blocking log
- **WHEN** 小怪或Boss到达滚木的合法攻击位置并满足冷却
- **THEN** 在既有攻击命中帧或其单次兜底时机扣除对应敌人伤害；小怪保持单体攻击，Boss保留既有圆形攻击但同次不重复扣除滚木血量

#### Scenario: Target or attacker becomes invalid before the hit
- **WHEN** 出手后滚木被其它敌人摧毁、移出合法范围或不再可攻击，或攻击者死亡、禁用、销毁及入池复活
- **THEN** 旧命中及恢复回调不得补扣血、错误解锁新攻击或污染复活目标；新生命使用干净的临时目标、冷却和导航状态

### Requirement: Original objective resumption
敌人 MUST 将临时滚木目标与原始目标分开保留；滚木摧毁或不再需要拆除后清理临时状态并恢复有效原目标，原目标失效则按已有规则重选或等待分配。

#### Scenario: Destruction reopens pursuit
- **WHEN** 阻路滚木被自身或其它敌人摧毁
- **THEN** 在现有攻击恢复约束允许后恢复原始有效目标追踪，导航不继续使用已消失的滚木障碍或旧攻击站位

#### Scenario: Original target changes or dies during diversion
- **WHEN** 拆滚木期间原目标失效或外部明确重新分配目标
- **THEN** 按原规则处理目标并重新判断是否仍需拆滚木，不恢复无效旧目标，也不以滚木覆盖永久索敌状态

#### Scenario: A legal route becomes available before destruction
- **WHEN** 原目标移动或地形改变，使原目标无需拆滚木即可合法接近
- **THEN** 敌人在安全结束当前攻击后放弃临时拆除并恢复原追踪，不额外开启不必要的滚木攻击

### Requirement: Shared bounded obstruction queries
系统 SHALL 在相同地形版本、体型、可达区域与目标条件下共享阻路和表面查询结果，包含无可用滚木的结果；不按每只敌人每帧全场扫描或逐候选重建路径搜索，缓存具有上限和正确失效生命周期。

#### Scenario: Many enemies share the same obstruction
- **WHEN** 多个相同体型敌人处于同一可达区域并面对相同目标及固定滚木，相关几何保持稳定
- **THEN** 复用已完成的阻路判断及路径数据，不因敌人数或重复帧数线性增加全场扫描和候选路径重建

#### Scenario: Geometry or service lifecycle changes
- **WHEN** 滚木摧毁或几何变化、入口关闭、目标通行条件改变、敌人复用或场景释放
- **THEN** 相关结果及时失效或释放；不同体型、偏移和不可互通区域不错误共享结果，长期运行仍服从缓存容量限制
