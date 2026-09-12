---
slug: fix-friendly-target-reservation-and-joystick-onboarding
版本: 2
状态: done
创建: 2026-09-12
---

# 友军攻击预约与跑酷摇杆首输修复

## 业务目标

修复塔载 Soldier 在攻击命中帧仍对死亡或离开射程旧目标结算的问题。以共享预约分配降低 Player 与塔兵对低血小怪的无谓集火，同时保留 Boss 自然集火和唯一敌人多单位攻击。跑酷开局立即显示摇杆提示，只有实际产生移动方向的第一次摇杆输入才会解锁 Player 移动，之后静止三秒再次显示提示。

## OpenSpec 引用

- Change：`openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/`
- 行为语义仅以该 delta 的 `specs/**` 为准；本计划不复述 WHEN/THEN。
- 执行时须保持未归档 `fix-defense-combat-expand`、`fix-tower-arrow-and-ultimate-death-cleanup` 与 `ten-step-player-guidance` 的已接受语义。

## 风险等级

中。变更跨攻击延迟回调、投射物、敌人死亡/对象生命周期与全局触摸输入；错误 token 释放、循环依赖或将零向量视为有效输入都会造成战斗或控制回归。

## 禁做项

- 不修改 `assets/scenes/Main.scene`、任何 prefab、动画/clip、SpriteFrame、`GameConfig.ts`、项目设置、场景接线或 `docs/SCENE_PLACEMENT.md`。
- 除 `assets/scripts/core/AttackReservation.ts.meta` 外，禁止新增、修改、删除或手写任何 `.meta`。该唯一例外只能是 Cocos watcher 为本任务新建 `AttackReservation.ts` 生成的自动元数据；不得手改其 UUID 或其他字段。
- 不改攻击伤害、攻击帧、冷却、攻击动画锁、Player Arrow 的碰撞/穿透/衰减/距离，或 Soldier 既有 0.2 秒展示弹道寿命；预约不得延迟、重复或取消既有合法伤害。
- 不改变 Boss 优先级或用 pending damage 将 Player/近战 Soldier 从 Boss 改指向小怪；不改变 Enemy AI、导航、刷怪、对象池、奖励或死亡表现。
- 不将全局 `TOUCH_START`、`TOUCH_END`、零向量、或跑酷约束后仅垂直的拖拽认作有效首输；不改摇杆可视结构或提示的现有跑酷横移/防守倒 8 表现。
- 不新增 `*Controller.ts`、第二个 Player 主脚本、全局游戏系统组件、场景节点、资源加载路径或 Inspector 接线。共享预约必须是无场景依赖的纯 TypeScript 服务，避免新的组件/模块循环。
- 不调用 MCP，也不执行 `scene-open/save`、`create-prefab-from-node`、`post-scene-save.ps1`、`verify-mcp-gate.ps1`、assets refresh/reimport。
- 不使用 `git reset --hard`、`git checkout --`、stash 覆盖、全局格式化或任何会覆盖当前脏工作区的操作。

## 变更文件清单

### 可写

- 【可写】`assets/scripts/core/AttackReservation.ts` — 新建无场景依赖的预约账本；管理 token、按目标聚合 pending damage、按攻击者/目标释放，以及稳定的小怪候选评分。不得导入 Player、Soldier、EnemyMinion、EnemyBoss 或 Cocos Component。
- 【可写】`assets/scripts/character/Soldier.ts` — Tower 起攻登记预约；命中帧重新验证/分配合法目标；在命中、取消、reset、deactivate、死亡、disable/destroy 时准确释放。近战兵、攻击数值/动画/冷却与既有即时伤害保持。
- 【可写】`assets/scripts/game/CombatSystem.ts` — Player 起攻使用共享分配；将预约安全关联至一次动画/Arrow 生命周期；在攻击帧取消、Player 死亡、组件禁用/销毁、Arrow 初始化失败时释放，不改自动攻击频率或动画时序。
- 【可写】`assets/scripts/projectile/Arrow.ts` — 接收并终结 Player 的目标预约；保留全部现有命中、穿透、衰减、超距与销毁语义，在目标命中或弹道取消/销毁时 release。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 只提供预约选择所需的只读当前 HP，并在现有死亡、disable/destroy/reset 生命周期释放该目标预约；保留 current final-death、奖励和对象池行为。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 只提供预约选择所需的只读当前 HP，并在现有死亡、disable/destroy/reset 生命周期释放该目标预约；Boss 不参与小怪过量伤害规避。
- 【可写】`assets/scripts/character/Player.ts` — 添加由有效摇杆首输控制的 parkour 移动接收门槛；锁定时清零速度且不接受零向量触发，保留防守移动、死亡、大招和阶段模式。
- 【可写】`assets/scripts/ui/Joystick.ts` — 以约束后方向而非 touch 活动状态定义有效输入；在 parkour 首次有效水平输入时按顺序解锁并下发 Player，暴露只读有效输入状态供提示读取，阶段/禁用/销毁清理状态。
- 【可写】`assets/scripts/ui/JoystickHintUI.ts` — 移除全局 touch 作为提示输入来源；跑酷开局立即可见，之后仅由 Joystick 的有效方向更新 idle 定时及显隐，保留已有阶段 suppress 和动作模式。
- 【可写】`bugs.md` — 仅在全部阻塞机器 AC 通过后，分别追加/建立塔兵旧目标空放、友军小怪过量集火、跑酷摇杆首输/提示三条用户问题记录；已有同主题条目优先追加 vN。

### 可新建

- 【可新建】`assets/scripts/core/AttackReservation.ts.meta` — 仅允许 Cocos watcher 为本任务的新 TypeScript 脚本自动生成；必须保持 importer 为 `typescript` 且 `imported: true`，不得人工编辑或作为其他资源 metadata 的先例。
- 【可新建】`.cursor/scripts/test-friendly-target-reservation-and-joystick-onboarding.cjs` — Node 内置断言、真实 TypeScript 转译和最小 Cocos mock 的 focused harness；不得成为通用测试框架。
- 【可新建】`openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/proposal.md` — defense3-lite 提案。
- 【可新建】`openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/specs/friendly-attack-reservation/spec.md` — 战斗预约行为 delta。
- 【可新建】`openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/specs/parkour-joystick-onboarding/spec.md` — 跑酷输入/提示行为 delta。
- 【可新建】`.cursor/plans/reports/fix-friendly-target-reservation-and-joystick-onboarding-report.md` — build 成功或硬阻塞报告。
- 【可新建】`.cursor/plans/reports/fix-friendly-target-reservation-and-joystick-onboarding-evidence/` — harness、TypeScript、OpenSpec、diff 与范围检查摘要。

### 仅只读参考

- 【仅只读参考】`AGENTS.md`、`AI_TASK_LIST.md`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,cocos-mcp,openspec}.md`、`.cursor/plans/_TEMPLATE.md` — 路由、纯脚本边界与交付约束。
- 【仅只读参考】`assets/scripts/{core/GameConfig.ts,core/AnimUtil.ts,core/GameEvents.ts,game/SceneSetup.ts,building/Tower.ts}` — 数值、攻击帧、现有绑定与塔载 Soldier 生命周期。
- 【仅只读参考】`openspec/changes/{fix-defense-combat-expand,fix-tower-arrow-and-ultimate-death-cleanup,ten-step-player-guidance}/`、相关 plan/report、`bugs.md` 既有 Soldier/Arrow/Joystick 条目 — 未归档契约和版本去重基线。
- 【仅只读参考】当前脏工作区基线，尤其 `assets/scripts/{character/Soldier.ts,enemy/EnemyMinion.ts,enemy/EnemyBoss.ts,projectile/Arrow.ts}`、`bugs.md` 与所有 prefab/scene/config/ultimate 变动 — 只能在保留既有 hunk 前提下叠加本任务。

## To-dos

- [x] `reservation-input.1`：已完成；基线、相关规则、OpenSpec 和目标文件已审阅，且无 scene/prefab 工作混入。
- [x] `reservation-input.2`：已完成；已新增无场景依赖的 `AttackReservation` 账本。
- [x] `reservation-input.3`：已完成；敌人/攻击者/投射物生命周期的 token 所有权与清理已接通。
- [x] `reservation-input.4`：已完成；Tower Soldier hit-frame 合法性重选与无替代取消已实现。
- [x] `reservation-input.5`：已完成；parkour 有效首输门槛与 Joystick 驱动提示时序已实现。
- [x] `reservation-input.6`：已完成；focused harness 使用真实 TypeScript，45 assertions、11 scenarios 均通过。
- [x] `reservation-input.7`：已续跑最终机器检查与范围审计；watcher 自动生成的 `assets/scripts/core/AttackReservation.ts.meta` 是唯一新增/变动 metadata，JSON 确认 `importer` 为 `typescript`、`imported` 为 `true`。对照 v1 report 脏基线与续跑前 `git status --short`，无新增或本任务归属的 `Main.scene`、prefab 或其他 `.meta` 变动；harness、TypeScript、OpenSpec strict 和 diff 检查全部通过。未修改实现、OpenSpec 或 bugs。

## 实施步骤

1. S1：锁定当前脏基线，特别检查既有 Soldier 箭矢视觉和 Enemy final-death hunk；仅添加可独立审查的预约/输入逻辑，不回退它们。
2. S2：以小型数据服务承载预约，不把状态分散进 Player、Soldier 或敌人实例。小怪评分使用当前 HP 减同目标 pending damage；有非过杀候选时优先它，只有一个合格小怪时允许继续预约；Boss 路径不调用该筛选。
3. S3：先把 token 生命周期接通，再写 Tower hit-frame 重选。旧目标在延迟期间失效时先 release；替代目标 only-if 合法并在相同一次命中内完成原有一发伤害与展示，任何空路径都只结束本攻击。
4. S4：让 Player Arrow 接收 reservation token 并在目标命中或 existing cancellation/destruction 边界释放；不得把 tower 的即时伤害改成 Arrow 碰撞流程，也不得改变 Player Arrow 对中途穿透目标的伤害处理。
5. S5：让 Player parkour movement gate 初始锁定、有效 Joystick 方向后一次解锁；Joystick 先计算约束向量再判断有效性，确保全局 touch start `(0,0)` 与被跑酷模式抹掉的垂直拖拽均不会解锁。
6. S6：让提示只观察 Joystick 有效方向/最后有效输入时间。进入 parkour 时立即显示；有效输入隐藏并重置 idle；无有效方向累计 `GameConfig.joystickHintDelay` 后显示；现有 ultimate/game-over suppress 覆盖一切。
7. S7：以 focused harness 验证真实生命周期与输入顺序，再执行 TypeScript、OpenSpec strict、diff 和范围检查。纯脚本任务，MCP 流程不适用。

## 校验点

- [x] [AC-1] Tower Soldier 在 hit frame 发现旧目标死亡、销毁、隐藏或越界时，只会重选仍合法的范围内目标；无合法目标时不产生 damage/projectile，本轮动画/冷却按原规则结束。
- [x] [AC-2] Player 与 tower Soldier 均在起攻前登记 pending damage；多小怪时优先未被预约过杀的合法小怪，唯一小怪允许并发预约；Boss 维持已有自然集火与优先级，不因 pending 改指向。
- [x] [AC-3] 每个 reservation 在命中、取消、target death/disable/destroy、attacker reset/deactivate/death/disable/destroy、Arrow 超距/销毁各路径至多释放一次；后续选择无法观测到 stale pending damage。
- [x] [AC-4] Player Arrow 的原始碰撞、Boss-first hit ordering、穿透名额、伤害衰减、最大距离、销毁时机不变；tower 的即时伤害、攻击帧、插值展示与寿命不变。
- [x] [AC-5] 新 parkour 开局提示立即可见且 Player 不接收 movement input；TOUCH_START、零向量及 parkour 约束为零的垂直拖拽不能解锁，首次有效水平方向会先解锁再下发并立即隐藏提示。
- [x] [AC-6] 解锁后有效方向持续时提示保持隐藏；无有效方向满 `GameConfig.joystickHintDelay` 后提示以当前模式的既有动作重显；阶段切换、input disabled、ultimate/game-over suppress、防守全向摇杆均不回归。
- [x] [AC-7] `node .cursor/scripts/test-friendly-target-reservation-and-joystick-onboarding.cjs` 退出 0，报告列出断言数和所有场景；测试使用真实目标组件转译，不只断言文本。
- [x] [AC-COMPILE] `npx tsc --noEmit --pretty false` 退出 0。
- [x] [AC-OPSX] `npx openspec validate fix-friendly-target-reservation-and-joystick-onboarding --strict` 退出 0；无 OpenSpec delta 变更。
- [x] [AC-DIFF] `git diff --check` 退出 0；任务范围仅包含既有允许路径与唯一 watcher 生成的 `assets/scripts/core/AttackReservation.ts.meta`。该 metadata 已经 JSON 解析确认 `importer: "typescript"` 与 `imported: true`；相对 v1 report 的脏基线和本次续跑基线，没有任何本任务归属的 `Main.scene`、prefab 或其他 `.meta` 变动。
- [x] [AC-BUGS] `bugs.md` 对应三条问题均已有版本化现象/原因/解决/验证记录；续跑不得修改它们。
- [AC-PLAY] 非阻塞：观察塔兵在目标死去/走出射程后改打有效目标或不空放；多兵不重复浪费攻击低血小怪、Boss 可被自然集火；跑酷开局提示即时显示且纯点击不让 Player 起步，方向拖动后解锁，静置三秒提示重现。

## 验证命令 / 检查

```powershell
node .cursor/scripts/test-friendly-target-reservation-and-joystick-onboarding.cjs
npx tsc --noEmit --pretty false
npx openspec validate fix-friendly-target-reservation-and-joystick-onboarding --strict
git diff --check
git diff --name-only
git status --short
Get-Content -Raw -LiteralPath assets/scripts/core/AttackReservation.ts.meta | ConvertFrom-Json
rg -n "AttackReservation|reservation|pending|currentHp|tryAttack|_spawnArrow|_spawnProjectile|setMovementInput|effective|setMoveDirection|TOUCH_START|joystickHintDelay" assets/scripts/core/AttackReservation.ts assets/scripts/character/Soldier.ts assets/scripts/game/CombatSystem.ts assets/scripts/projectile/Arrow.ts assets/scripts/enemy/EnemyMinion.ts assets/scripts/enemy/EnemyBoss.ts assets/scripts/character/Player.ts assets/scripts/ui/Joystick.ts assets/scripts/ui/JoystickHintUI.ts
```

MCP checks are N/A: this pure script/documentation task must not open or save scenes, assemble prefabs, create assets, run post-scene processing, or run the MCP gate.

Final scope review must record the parsed metadata fields (`importer=typescript`, `imported=true`) and compare the final status path list with the v1 report baseline plus the continuation-start snapshot. It must explicitly confirm that no other task-owned `.meta`, `assets/scenes/Main.scene`, or `*.prefab` path changed.

## 回滚策略

以执行前 `git status --short` 和逐文件 diff 为基线，仅反向本任务在允许脚本、`bugs.md`、focused harness、新 OpenSpec delta、新 plan/report/evidence 中的 hunk。绝不 reset、checkout、stash-pop、reimport 或覆盖既有 Soldier 投射物视觉、Enemy final-death、Ultimate、scene、prefab、animation、config 或其他未提交工作。任何 AC 失败均保留 evidence，状态置为 `replan`，只改失败 todo、相关 AC 和直接关联 OpenSpec delta。

## 修订记录

- v1（2026-09-12）：初始中型 player-visible bug-fix 计划；定义共享预约账本、Tower hit-frame 重选、Player Arrow token 生命周期，以及跑酷有效首输门槛与提示时序。
- v2（2026-09-12）：仅处理 v1 的范围门禁硬阻塞；允许 Cocos watcher 为新建 `AttackReservation.ts` 自动生成唯一的 TypeScript metadata，并新增其 importer/范围验证。已完成实现、已接受 AC 和 OpenSpec 语义保持不变。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---:|
| scene-open | 0（纯脚本） |
| scene-save | 0（纯脚本） |
| create-prefab-from-node | 0（未建 prefab） |
| verify-mcp-gate | 0（未改 scene/prefab） |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/` |

### 非 MCP 证据

| 指标 | 值 |
|---|---|
| dirty baseline | `git status --short` 摘要与重叠文件保护说明 |
| focused harness | exit code / assertion count / scenario count |
| TypeScript | exit code |
| OpenSpec strict | exit code / any synchronized delta |
| diff and scope | exit code / allowed file list |
| reservation lifecycle cases | pass / fail summary |
| joystick effective-input cases | pass / fail summary |
| bugs versions | three entries or not written on failure |
| AC-PLAY | run / not run（不阻塞） |
