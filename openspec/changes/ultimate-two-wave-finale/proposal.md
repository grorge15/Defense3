## Why

现有结尾先拉远，再播一次集体大招后清场，表现偏仓促。需要通过两次冲击体现层次，并让第二次冲击与拉远同时发生。

## What Changes

- 锁定移动后先集体播放第一轮，扣存活怪物血量并复用原受击表现。
- 第一轮完成后集体播放第二轮，同时开始镜头拉远；两者完成后沿用原最终死亡呈现和胜利结算。
- 暂定“50%”指命中时当前血量的 50%，包含小怪和 Boss；第一轮起播时统一命中一次，不按表现点数叠加。这是本草案的审阅口径。

## Non-goals（禁做）

不新增美术、点位、角色动作、场景或预制体；不改变普通战斗伤害规则、结算奖励或镜头参数；不重做最终死亡呈现。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `ultimate-bigmove-clear`：替换未归档单轮、镜头先行的结尾时序；包括旧 `fix-build-cost-and-finale-timing` 中镜头领先的约定。
- `ultimate-final-death-cleanup` 行为保持不变，仅其前置大招完成边界改为双轮与镜头汇合。

## Impact

复用现有动画、受击、镜头及死亡链。第一轮不会因本次百分比伤害直接清场；普通战斗和刷怪在最终清理前沿用既有规则。

归档依赖：`ultimate-bigmove-clear` 能力目前仅位于未归档 change；本 delta 使用 MODIFIED，归档前须先按历史顺序归档该能力的既有 change，并保留 `ultimate-final-death-cleanup` 已接受的规格，再归档本增量。本次仅提案，不执行归档或重写旧 change。

## Execution pointer

文件清单与机器 AC 见 `.cursor/plans/ultimate-two-wave-finale.md`。
