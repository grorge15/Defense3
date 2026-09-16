## ADDED Requirements

### Requirement: Navigation reflects physical collision geometry
敌人导航 SHALL 按同一启用状态及障碍分类规则反映当前支持的矩形/多边形碰撞几何。真实几何变化 MUST 在下一次移动或查询消费前令不兼容的结果不可用；只有完整相关输入已证明不变的工作才能继续复用。无法证明不受影响时 SHALL 保守失效并在现有共享预算内重建，不发布部分计算或过期结果。旧方向只能作为每帧重新验证的移动意图，不构成旧几何仍有效的证明。

#### Scenario: Static physics synchronization does not discard route work
- **WHEN** 障碍重复收到变换通知，但启用状态、分类、世界碰撞几何及地面未变
- **THEN** 共享路线工作和几何版本保持有效，不因无效通知重复重建

#### Scenario: A fixed destructible log is destroyed
- **WHEN** 固定滚木被摧毁，物理障碍改变，但某些路线计算的完整相关输入经验证保持不变
- **THEN** 仅这些已验证工作可以保留；依赖旧物理占用、连通、攻击站位或旧障碍存在性的结果立即失效，敌人通过当前几何继续安全追踪

#### Scenario: A new wall appears during unfinished route work
- **WHEN** 墙创建、移动、启停或重分类影响正在使用或计算的路线
- **THEN** 受影响结果先失效，旧计算不能稍后重新发布；重建共享有限预算，敌人仅继续当前几何下安全的移动或等待

#### Scenario: Independence cannot be proved
- **WHEN** 地面或拓扑改变，或系统不能证明某项工作与几何编辑无关
- **THEN** 保守丢弃相关工作并有界重建，即使需要使全部共享工作失效，也不基于距离远或当前一步安全继续消费未经证明的结果

#### Scenario: Geometry changes after an earlier consumer in the same frame
- **WHEN** 同帧已有敌人查询过导航后，又发生真实障碍变化
- **THEN** 后续消费与移动检查仍使用当前几何，不能以本帧已准备为由使用危险旧结果

#### Scenario: Airwall physics group is ignored by navigation
- **WHEN** 仅属于 airwall 物理组或仅名为 airWall 的碰撞体位于敌人与目标之间
- **THEN** 不仅凭组名或节点名将其视为不可破坏障碍，同节点显式障碍标记仍生效

#### Scenario: Non-airwall hard geometry still blocks pursuit
- **WHEN** 有效不可破坏墙或其它真实阻挡位于敌人与目标之间
- **THEN** 敌人使用存在的合法路线或安全等待，不穿越或攻击不可破坏墙
