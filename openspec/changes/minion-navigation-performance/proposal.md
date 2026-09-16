## Why

小怪逐帧重复导航和避让决策；真实几何变化还会丢弃全部共享路线工作，可能集中产生重算。需要在保持连续安全移动和拆障闭环的前提下简化小怪决策，并只复用可证明仍有效的工作。性能收益待同基线测量，不预先承诺 FPS。

## What Changes

- 小怪昂贵决策约每 0.2-0.3 秒错峰执行，间隔内继续逐帧安全移动和既有攻击检查。
- 小怪优先处理当前路线局部首个合法可破坏阻挡，保持有效拆障承诺，避免重复全局绕路比较；局部无合法面时保留有界的可达回退。
- 小怪避让降低更新频率，仅使用少量邻居（默认最多 4 个）；碰撞安全仍逐帧检查。
- 几何编辑后仅保留能证明完整相关输入不变的工作，其余立即失效并有界重建；Boss 共享此安全失效机制，其决策策略保持不变。

## Non-goals（禁做）

不改变 Boss 索敌、决策频率、避让和攻击，不改战斗数值、建造击退、盾兵近战、大招、刷怪或场景资源。不恢复旧城界/入口限制，不承诺全局最短路线，不以过期几何换取流畅度。

## Capabilities

### New Capabilities
- `minion-navigation-performance`：错峰决策、连续安全执行、局部拆障及有限邻居避让。

### Modified Capabilities
- `enemy-navigation-runtime-contract`：替换未归档同名能力中的 `Navigation reflects physical collision geometry` 要求，允许经完整依赖验证的工作保留，明确不安全结果必须先失效。

`openspec/specs/` 当前没有已归档正文，故上述替换以 ADDED 要求携带完整同名文本；后续合并未归档 changes 时，本 change 覆盖 `fix-enemy-navigation-runtime-contract` 同名要求中“任何几何变化均丢弃全部旧版本工作”的条款，不产生两个冲突要求。该能力其余要求不变。

## Impact

本 change 补充 `fix-minion-log-route-oscillation` 的稳定承诺/当前侧合法攻击面，以及 `fix-enemy-pursuit-demolition` 的选定路线拆障/持续追踪要求；只将小怪非紧急重评估限制在决策窗口。原有碰撞、攻击、生命代次、pending 和预算约束继续生效。Boss 原有决策与 `fix-boss-retained-navigation` 行为继续生效；几何有效性条款按本 change 执行。

## Execution pointer

文件权限、实现步骤、测试与测量见 `.cursor/plans/minion-navigation-performance.md`。用户已授权后续 build，无需再次确认；此 change 不包含 design/tasks artifact。
