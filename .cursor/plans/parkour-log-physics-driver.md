---
slug: parkour-log-physics-driver
版本: 1
状态: draft
创建: 2026-09-15
---

# 跑酷滚木物理驱动

## 业务目标
将跑酷阶段的移动所有权从 Player→Log 跟随模式改为 Log Dynamic RigidBody2D 物理驱动：玩家临时挂到滚木并停用自身物理，输入速度只写入滚木。保留既有跑酷数值、黄蓝线、截木、固定态与防守流程，去除滚动态的位置硬写和敌人 AABB 补偿。

## OpenSpec 引用
- Change：`openspec/changes/parkour-log-physics-driver/`
- 行为语义以该 change 的 `specs/parkour-log-physics-driver/spec.md` 为唯一来源；本计划不复述 WHEN/THEN。

## 风险等级
高。该改动转换 Player/Log 的物理所有权和蓝线事件时序，并须保持固定滚木的敌人导航、拆木和阶段监听兼容。

## 禁做项
- 不修改 `assets/scenes/Main.scene`、任何 `.prefab`、`.meta`、场景坐标或 `docs/SCENE_PLACEMENT.md`；不启动 MCP 场景/预制体编辑，也不运行 `verify-mcp-gate.ps1`。
- 不新增 `PlayerController`、`LogController` 或其他重复对象主脚本；玩家只在 `Player.ts`，滚木只在 `Log.ts`。
- 不在 rolling/charging 状态调用 `setWorldPosition`、`setPosition`、`AirWallAabb.resolveWorldPos`，或以 AABB 推出替代 Log 的物理碰撞。
- 不让已挂到 Log 的 Player 写自身刚体速度或保持自身 Collider 参与碰撞；跑酷移动速度只能由 Log 写入其 Dynamic RigidBody2D。
- 不提前 emit `PARKOUR_FINISHED`；蓝线固定/失败和玩家死亡必须先执行解绑与物理恢复。固定成功才可移动到 `LogFixPoint`。
- 不增加通道测宽、最大宽度钳制、增长限制或新的 `GameConfig` 数值；保持现有世界宽度固定门槛、加长/截短范围和黄线速度。
- 不删除或弱化固定、可攻击滚木的 `EnemyNavigation`/拆木行为；仅移除滚动状态的敌人 AABB 补偿。
- 不改锯子接触点单侧切割、距离伤害、首次有效输入、横向移动、自动前进、Visual X 旋转 25 度或现有固定碰撞标定。
- 不通过手写资源 JSON、回退或覆盖无关改动来完成任务。

## 变更文件清单
- 【可写】`assets/scripts/character/Player.ts` — 临时挂靠生命周期、原物理状态快照/恢复、跑酷输入速度转交 Log、死亡清理。
- 【可写】`assets/scripts/item/Log.ts` — Dynamic 刚体跑酷移动、玩家附着/解绑协调、黄蓝线完成排序、移除跟随/AABB 推出。
- 【可写】`assets/scripts/game/ParkourLineZone.ts` — 将蓝线终结委托给 Log 的单一完成入口，禁止在入口外抢先发完成事件。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 移除仅服务 rolling/charging Log 的 AABB 速度与乘坐补偿，固定 Log 保持现有导航路径。
- 【可写】`assets/scripts/core/SortingOrder2D.ts` — 以嵌套 `SortingOrder2D` 为渲染排序边界，防止父子组件共写同一子树。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs` — 更新已失效的滚动 Log AABB 断言，同时保留固定 Log 导航/拆木回归。
- 【可新建】`.cursor/scripts/test-parkour-log-physics-driver.cjs` — Player 物理快照、挂靠/解绑世界坐标、单一速度所有权、蓝线排序、死亡清理和嵌套排序边界的 focused harness。
- 【可写】`bugs.md` — 全部机器校验通过后，在 `fix-log-follow-contact` 下追加 `v5`（现象、原因、解决、验证）；不得新建重复条目。
- 【可新建】`.cursor/plans/reports/parkour-log-physics-driver-report.md` — build-agent 成功或硬阻塞后的执行报告与证据。
- 【仅只读参考】`openspec/changes/parkour-log-physics-driver/` — 本任务行为规格；仅 replan 时同步。
- 【仅只读参考】`assets/scripts/game/SceneSetup.ts`、`assets/scripts/game/PhaseTransition.ts`、`assets/scripts/core/GameConfig.ts`、`assets/scripts/core/AirWallAabb.ts`、`assets/scripts/core/EnemyNavigation.ts`、`assets/scripts/trap/SawTrap.ts` — 现有接线、固定态、数值、物理/导航和切割契约。
- 【仅只读参考】`openspec/changes/fix-log-contact-cut-projection/`、`openspec/changes/enemy-break-blocking-log/`、`openspec/changes/root-sorting-order/`、`openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/` — 不得破坏的已采纳行为。
- 【仅只读参考】`bugs.md` 的 `fix-log-follow-contact`、`fix-physics-movement`、`fix-log-blue-line-direct-fixed`、`fix-root-sorting-order-auto-bind` — 历史根因与同题升级位置。

## To-dos
- [ ] `parkour-log-physics-driver.a`：build 起始时读取本计划、OpenSpec、相关 bug 条目、git 状态与上述只读脚本；记录基线并保护所有无关变更。
- [ ] `parkour-log-physics-driver.b`：在 `Player.ts` 实现可重入的跑酷附着状态机：记录原父节点和完整物理组件状态，保持世界变换挂到 Log 根，停用玩家刚体/碰撞体；解绑时保持世界变换还原父节点及所有记录状态。
- [ ] `parkour-log-physics-driver.c`：让 Player 的有效跑酷输入只形成 Log 可消费的既有速度意图；附着期间 Player 不写自身刚体，首次输入、横移、自动前进与黄线减速继续使用既有 `GameConfig`。
- [ ] `parkour-log-physics-driver.d`：在 `Log.ts` 将 rolling/charging 配置为 Dynamic、非 sensor、锁旋转的唯一物理移动体；写入 Log 刚体速度并以该速度驱动滚动表现，删除玩家 offset 跟随、滚动态位置硬写与 airWall AABB 推出。
- [ ] `parkour-log-physics-driver.e`：统一蓝线完成入口：先处理 Log 成功固定或失败、Player 脱离/恢复；成功时再移动 `LogFixPoint` 并应用既有固定几何；所有蓝线切换完成后才发 `PARKOUR_FINISHED`。Player 死亡路径同样先脱离恢复。
- [ ] `parkour-log-physics-driver.f`：调整 `ParkourLineZone.ts` 仅负责触发 Log 的黄线/蓝线入口，消除其与 Log 的重复触发和抢先事件发布；Log 不再轮询线位作为滚动移动替代。
- [ ] `parkour-log-physics-driver.g`：从 `EnemyMinion.ts` 和对应回归中移除 rolling/charging Log 的 AABB 重叠速度修正、视觉 AABB 和乘坐速度分支；确认 fixed Log 仍经 `EnemyNavigation` 的现有实体碰撞、阻路和攻击表面契约处理。
- [ ] `parkour-log-physics-driver.h`：修复 `SortingOrder2D.ts` 嵌套所有权：父组件遍历渲染器时遇到非自身的排序组件即停止进入该子树；不创建 prefab 组件、不改变 root-Y 公式或 renderer fallback。
- [ ] `parkour-log-physics-driver.i`：新增/更新 focused harness，覆盖 OpenSpec 行为、静态禁令和固定 Log 回归；运行所有机器校验。
- [ ] `parkour-log-physics-driver.j`：机器校验通过后，向 `bugs.md` 同一 `fix-log-follow-contact` 条目追加 v5，并写执行报告（含未执行的实玩证据）。

## 实施步骤
1. S1：先建立 Player↔Log 的显式附着接口和可幂等清理。快照须覆盖原父节点、Rigidbody2D 的启用/类型/重力/旋转/睡眠/速度状态，以及 Collider2D 的启用和 sensor 状态；无组件时安全跳过。
2. S2：将 parkour 输入路径从 Player 刚体写入改为 Log 唯一写入。Log 开始跑酷时附着 Player；滚动与蓄力期间 Log 保持 Dynamic、solid、fixedRotation，Visual 局部 X 旋转始终为 25 度。
3. S3：删除 Log 的 follow offset、late-update 位置同步、airwall 收集/推出和蓝线位置轮询。黄蓝线只由已摆好的 `ParkourLineZone` 物理 Trigger 进入，并通过一个幂等蓝线完成方法执行完整转换。
4. S4：按 OpenSpec 的出场时序完成成功、失败和死亡分支。成功分支保留现有固定碰撞、血条、目标注册和导航失效语义；失败分支保留 fade；事件监听者只在转换后收到 `PARKOUR_FINISHED`。
5. S5：删除 EnemyMinion 的滚动 Log AABB 补偿及其测试依赖，避免与真实 Dynamic Log 碰撞叠加；固定 Log 的既有导航回归不得删除。
6. S6：将排序递归改为边界感知递归，确保嵌套排序根拥有自己的 renderer subtree，避免运行期双写。
7. S7：完成测试、OpenSpec strict、编译和 diff 检查；机器校验全部通过后写 bug v5 和报告。`AC-PLAY` 记录为非阻塞人工验证。

## 校验点
- [AC-1] `npx --no-install tsc --noEmit --pretty false` 退出码 0。
- [AC-2] `node .cursor/scripts/test-parkour-log-physics-driver.cjs` 退出码 0，覆盖附着快照/恢复、唯一物理速度所有权、蓝线完成顺序、失败/死亡清理和嵌套排序边界。
- [AC-3] `node .cursor/scripts/test-log-contact-cut-projection.cjs` 退出码 0，确认接触点单侧切割、世界宽度门槛和投影约束未回归。
- [AC-4] `node .cursor/scripts/test-enemy-navigation.cjs` 退出码 0，确认 fixed Log 的导航/拆木契约仍通过，且没有滚动 Log AABB 补偿断言或生产分支残留。
- [AC-5] `npx openspec validate parkour-log-physics-driver --strict` 退出码 0。
- [AC-6] `rg -n "setWorldPosition|setPosition|resolveWorldPos|_followOffset|_adjustVelocityAgainstLog|_readRideSpeedY" assets/scripts/item/Log.ts assets/scripts/enemy/EnemyMinion.ts` 仅允许固定态或无关路径的经审查匹配；rolling/charging 路径不得存在位置硬写或旧 AABB 补偿。
- [AC-7] `git diff --check` 退出码 0，且 `git diff --name-only` 只包含计划允许的文件和 build 报告。
- [AC-8] `bugs.md` 在 `fix-log-follow-contact` 下包含完成后的 v5，且含现象、原因、解决、验证。

### 条件 / 不阻塞
- [AC-PLAY] 在 Creator 中手测 OpenSpec 场景：首次有效输入后滚木物理前进/横移、黄线减速、敌人与 Log 碰撞、锯子切割、蓝线成功/失败、固定后防守移动和 Player 死亡清理。该项不阻塞机器 AC，但报告须明确是否执行及结果。
- [AC-MCP] 不适用：本任务禁止改 `Main.scene` 与 prefab；`scene-open`、`scene-save`、`create-prefab-from-node`、`post-scene-save.ps1`、`assets-reimport-asset` 与 `verify-mcp-gate.ps1` 均不得执行。

## 回滚策略
- 仅回退本任务对 `Player.ts`、`Log.ts`、`ParkourLineZone.ts`、`EnemyMinion.ts`、`SortingOrder2D.ts` 与对应测试/bug 文档的变更；不触碰无关工作树内容。
- 若物理附着在 Creator 中产生不可接受的接触或事件次序问题，恢复本任务前的脚本基线并保留报告、OpenSpec 和失败证据，随后以 v2 replan 只调整失败路径。
- 不用场景/Prefab 重摆、手写资源 JSON、增加新通道限制或临时 AABB 推出掩盖物理驱动失败。

## 修订记录
- v1（2026-09-15）：初始计划。定义 Log Dynamic 物理所有权、Player 临时附着和恢复、蓝线事件后置、滚动 AABB 补偿删除及嵌套排序边界。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | 0（禁止） |
| scene-save | 0（禁止） |
| create-prefab-from-node | 0（禁止） |
| verify-mcp-gate | 0（不适用） |
| post-scene-save Patched | 0（不适用） |
| assets-reimport-asset | 0（禁止） |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | `openspec/changes/parkour-log-physics-driver/` |

### 必填证据
- build 前 git 状态与无关改动保护说明。
- Player 记录/恢复的父节点与物理状态字段，及成功、失败、死亡三条清理顺序的测试证据。
- Log rolling/charging 的 Dynamic、solid、fixedRotation 与唯一速度写入证据；不存在滚动位置硬写/AABB 推出的审查结果。
- `ParkourLineZone` 与 Log 的单一蓝线完成入口及 `PARKOUR_FINISHED` 后置证据。
- EnemyMinion 删除滚动补偿、fixed Log 导航回归仍通过的证据。
- SortingOrder2D 嵌套边界测试证据。
- 全部 AC 命令摘要、`bugs.md` v5 内容摘要和 AC-PLAY 执行状态。
