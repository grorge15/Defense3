## ADDED Requirements

### Requirement: Stable obstruction approach
小怪 SHALL 保留原始追踪目标，并持续执行仍合法的临时拆障目标和接近站位，直至完成拆障或明确满足释放条件；接近过程 MUST 保持真实碰撞和既有攻击时序。

#### Scenario: Stable log blocks pursuit
- **WHEN** 有效滚木阻挡已选追踪路线，小怪已取得合法可达攻击站位，原目标及相关几何保持有效
- **THEN** 小怪持续安全接近并攻击滚木，不因接近中的临时路线点变化反复切回原目标或重启接近过程

#### Scenario: Pending work or temporary contact
- **WHEN** 接近期间替换路线尚未完成，或小怪短暂接触、重叠滚木，但既有拆障决定尚未被证明失效
- **THEN** 保留该决定，仅执行当前物理条件允许的移动、接触攻击、恢复或安全等待，不将暂时无结果视为取消拆障的依据

### Requirement: Locally appropriate reachable attack surface
小怪 SHALL 优先使用当前侧可直接安全到达的合法攻击站位；需要绕行时允许在有界查询中按最近可达启发式选择，不承诺全局最短物理路线。站位 MUST 满足真实碰撞体及偏移、攻击距离、地面和其它障碍限制。

#### Scenario: Opposite sides share connected ground
- **WHEN** 两只小怪位于同一连通地面的滚木南北两侧，且各自附近都有直接可达的合法攻击面
- **THEN** 各自接近适合自身位置的攻击面，不因另一只先查询或候选枚举顺序被迫绕到对面

#### Scenario: Closest face needs a detour
- **WHEN** 最近的攻击面不能直接安全到达，而存在绕行可达的合法攻击站位
- **THEN** 小怪选择可达站位并安全接近，不穿过滚木或其它障碍；使用最近可达启发式时不将结果视为全局最短物理路线

### Requirement: Explicit commitment release and lifecycle isolation
小怪 SHALL 在障碍被摧毁、失活或不再可攻击，原目标真正更换或失效，单位生命或体型改变，或当前拓扑确认站位不可达时释放或重新评估拆障决定。原目标直接安全可达时 SHALL 结束不必要的拆障，包括同一原目标移动后的情况；清理 MUST 不影响其它单位。

#### Scenario: Same player moves to the enemy side
- **WHEN** 同一玩家移动到小怪一侧，按当前完整物理几何和真实体型，从小怪到该玩家的完整直线已经可以安全通行
- **THEN** 小怪在既有攻击恢复约束允许后释放临时拆障并恢复追玩家，不要求玩家身份发生变化；仅到临时路线点的短线畅通不足以触发此释放

#### Scenario: Obstacle removal or invalid approach
- **WHEN** 滚木被移除或不再可攻击，或者当前几何已确认原站位不可达
- **THEN** 小怪停止使用失效障碍或站位，恢复有效原目标或重新选择合法接近方案，无合法移动时安全等待

#### Scenario: Reset pooling and target reassignment
- **WHEN** 小怪重置、死亡、禁用、销毁、回收复活或被分配另一原目标
- **THEN** 旧生命、目标和站位状态不影响后续移动及攻击，同场其它小怪的有效接近过程继续

### Requirement: Bounded shared approach work
系统 SHALL 共享适用的路网计算并保留既有每帧工作量及缓存上限；不同起始侧、体型、偏移与几何条件 MUST 不错误复用最终站位。

#### Scenario: Repeated pursuit by many enemies
- **WHEN** 多只小怪在稳定几何下反复更新已确定的有效拆障接近过程
- **THEN** 不随重复帧进行全场或全表面重扫，也不为每个候选构建完整路径场；冷绕行工作按共享预算推进，旧单位状态可独立释放
