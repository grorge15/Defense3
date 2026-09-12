---
slug: ultimate-bigmove-clear
版本: 1
状态: draft
创建: 2026-09-11
---

# 大招 BigMove 同步清场收尾

## 业务目标

把现有大招收尾改成可观察且有确定顺序的流程：触发即锁定玩家并拉远镜头，在 `SceneSetup` 配置的所有点位同时播放一次 `Vfx_BigMove/BigMove`，动画完成后再清空所有 `EnemyMinion/EnemyBoss`，最后复用现有胜利结算。用户负责在场景编辑器摆放并绑定点位数组；本次不改场景或 prefab。

## OpenSpec 引用（有玩家可感知行为时必填）

- Change：`openspec/changes/ultimate-bigmove-clear/`
- 行为顺序、同步播放、幂等和缺失绑定兜底以该 change 的 spec 为准；本计划不重复 WHEN/THEN。

## 风险等级

中。风险集中在动态添加 `UltimateSystem` 的注入时机、多个 Animation 完成回调汇聚、运行时资源加载失败，以及现有收尾重复触发保护。

## 禁做项（必填）

- 不修改 `assets/scenes/Main.scene`，不要求 MCP、Cocos 编辑器或场景保存/后处理流程。
- 不修改或重建任何 prefab、`.meta`、`Vfx_BigMove.prefab`、`BigMove.anim` 或其 SpriteFrame 引用。
- 不新增大招 prefab、动画、结束 UI、第二套相机控制器或静态场景布局实例。
- 不把用户点位硬编码进脚本，不替用户摆放/绑定 `Node[]`。
- 不提前清敌，不改变 `clearAllEnemies()` 已有的敌人类型范围和刷怪停止语义。
- 不回滚或覆盖工作区已有的 `Main.scene` 修改及其他无关改动。

## 变更文件清单

### 计划执行时可写

- 【可写】`assets/scripts/game/SceneSetup.ts` — 暴露序列化的 `Node[]` 大招点位；在运行时添加 `UltimateSystem` 后把该数组传入，保持重复 `_wireGameplay` 幂等。
- 【可写】`assets/scripts/game/UltimateSystem.ts` — 接收点位；解析/加载既有 BigMove prefab；在一次收尾中同步实例化、播放并汇聚完成回调；把现有清敌和胜利结算移动到完成阶段。
- 【可写】`assets/scripts/game/CameraFollow.ts` — 仅在现有 `zoomOut` 接口不足以表达触发即拉远时做最小兼容调整；优先复用当前实现，不新增相机控制器。

### 本次可新建

- 【可新建】`openspec/changes/ultimate-bigmove-clear/proposal.md` — 本次行为变更提案。
- 【可新建】`openspec/changes/ultimate-bigmove-clear/specs/ultimate-bigmove-clear/spec.md` — `defense3-lite` 行为规格。
- 【可新建】`.cursor/plans/ultimate-bigmove-clear.md` — 本执行计划。

### 仅只读参考

- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — 核对现有大招相机距离、时长和胜利延迟；除非实现证据表明必须新增配置，否则不改。
- 【仅只读参考】`assets/scripts/game/GameManager.ts` — 复用现有 `setGameOver('win')` 路径。
- 【仅只读参考】`assets/scripts/character/Player.ts` — 复用现有 `setCanMove(false)` / 大招回调入口，不改玩家业务脚本。
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts`、`assets/scripts/core/EnemyHitVfx.ts` — 复用 Animation 完成监听、instantiate 与失败清理模式。
- 【仅只读参考】`assets/resources/prefabs/VFX/Vfx_BigMove.prefab` — 既有 VFX 资源，仅确认 Animation 组件可播放 `BigMove`。
- 【仅只读参考】`assets/resources/animations/vfx/BigMove.anim` — 既有一次播放动画及其有效时长。
- 【仅只读参考】`bugs.md` — 已有 `fix-advanced-towers-no-ultimate` 与 `fix-advanced-towers-no-gameover`，用于避免回归旧问题。
- 【仅只读参考】`AI_TASK_LIST.md`、`.cursor/rules/multi-agent-orchestrator.mdc`、`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/openspec.mdc` — 项目约束与任务路由。

## To-dos（必填）

- [ ] `ultimate-bigmove.a`：build-agent 开始时重新读取本计划、OpenSpec、git 状态和目标脚本；确认只在列出的脚本范围内工作，保留已有 `Main.scene` 修改。
- [ ] `ultimate-bigmove.b`：在 `SceneSetup` 增加可序列化 `Node[]` 点位入口，并在 `_ensureUltimateSystem`/相关接线路径把同一数组传给运行时动态添加的 `UltimateSystem`；重复接线不得替换或累加错误引用。
- [ ] `ultimate-bigmove.c`：在 `UltimateSystem` 增加点位接收与既有 VFX 资源解析；每个有效点位只创建一个临时 VFX 实例，统一启动 `BigMove`，实例归属和世界坐标遵循点位节点，无法创建时安全清理。
- [ ] `ultimate-bigmove.d`：以一次 finale 状态机保护触发；锁定玩家和调用现有 `CameraFollow.zoomOut` 先发生；所有有效实例的完成状态汇聚后才调用既有 `clearAllEnemies()`，再按原路径设置 `GamePhase.Ultimate`/`setGameOver('win')`，避免重复回调重复结算。
- [ ] `ultimate-bigmove.e`：实现缺失/空点位或资源失败的非阻塞兜底，并保留可诊断日志；不能因为等不到 Animation 完成而永久卡住胜利流程。
- [ ] `ultimate-bigmove.f`：执行静态检查与定向源码断言，确认未改 `Main.scene`、prefab、动画资源或 `.meta`；输出本计划要求的验证证据。

## 实施步骤

1. **S1 调研基线**：核对 `SceneSetup` 动态 `addComponent(UltimateSystem)` 的生命周期，确认点位数组在组件添加后、收尾触发前可注入；核对 BigMove 资源路径、Animation 组件位置和完成事件用法。
2. **S2 配置传递**：只改 `SceneSetup.ts` 的公开 `Node[]` 配置和 UltimateSystem 注入接口；不通过 MCP 绑定，不修改 `Main.scene`。
3. **S3 收尾时序**：只改 `UltimateSystem.ts`，将现有 `_runFinale` 拆为触发、VFX 播放、完成汇聚、清敌、胜利结算阶段；以有效实例数量决定完成汇聚，并对零实例/加载失败走非阻塞路径。
4. **S4 相机兼容核对**：优先证明现有 `CameraFollow.zoomOut` 已满足触发时调用；只有确有接口缺口才对 `CameraFollow.ts` 做最小脚本改动，禁止重写或新增相机系统。
5. **S5 验证与交付**：运行 TypeScript、diff 检查和 OpenSpec 结构/关键源码断言；检查变更边界，确认没有场景/prefab/MCP 产物。

## 校验点 / Acceptance Criteria

- [AC-1] `SceneSetup.ts` 存在可由 Inspector 配置的 `Node[]` 大招点位入口，并在动态添加 `UltimateSystem` 后显式传入同一数组；不得依赖 `Main.scene` 本次落盘接线。
- [AC-2] `UltimateSystem.ts` 只在一次 finale 中为每个有效点位创建一次既有 `Vfx_BigMove`，播放一次 `BigMove`，并对多个实例使用同一触发时刻的完成汇聚；不得在每个点位重复触发收尾。
- [AC-3] 触发顺序可由源码断言证明为：`setCanMove(false)` 与 `zoomOut` 在 VFX/清敌之前；`clearAllEnemies()` 仅在 VFX 完成阶段之后；`setGameOver('win')` 仅在清敌之后。
- [AC-4] 重复大招/重复高级塔事件/重复动画完成回调不会产生第二波 VFX、第二次清敌或第二次胜利结算；沿用 `ultimateOnce` 与 `_finishing` 保护语义。
- [AC-5] 空/失效点位、资源加载失败、缺失 Animation 或缺失 BigMove clip 均有诊断且不永久阻塞最终胜利；有效 VFX 实例在完成后回收，不遗留活动特效。
- [AC-6] 现有 `EnemySpawner` 停止及 `EnemyMinion`/`EnemyBoss` 清理行为保持覆盖；现有 `GameManager.setGameOver('win')` 仍是最终结算入口。
- [AC-7] 变更范围只包含本计划列出的脚本与三份文档；`Main.scene`、所有 prefab、动画、`.meta` 和无关用户改动不变。
- [AC-COMPILE] `npx tsc --noEmit --pretty false` 退出码 0。
- [AC-DIFF] `git diff --check` 退出码 0；`git status --short` 显示无本任务之外的意外文件变化。
- [AC-OPSX] OpenSpec 目录包含 proposal 与 `specs/ultimate-bigmove-clear/spec.md`，且规格包含 Requirement、Scenario、WHEN/THEN 与 SHALL/MUST 关键字。
- [AC-PLAY] 可选手测：双高级塔完成后触发大招，观察玩家锁定、镜头拉远、所有已绑定点位同步 BigMove、动画结束后敌人消失并进入胜利；该项不阻塞机器完成，除非后续 build 明确将其设为阻塞项。

### MCP

本任务不改 `Main.scene` 或 prefab，按 Defense3 规则跳过 `assets-query-path`、`scene-open/save`、`create-prefab-from-node`、`post-scene-save.ps1`、`verify-mcp-gate.ps1`、AC-P3 和 AC-EDITOR-MCP；不得为了凑门禁执行 MCP 写入。

## 验证命令 / 检查

```powershell
npx tsc --noEmit --pretty false
git diff --check
rg -n "Node\[\]|UltimateSystem|Vfx_BigMove|BigMove|clearAllEnemies|setCanMove|zoomOut|setGameOver" assets/scripts/game/SceneSetup.ts assets/scripts/game/UltimateSystem.ts assets/scripts/game/CameraFollow.ts
Test-Path openspec/changes/ultimate-bigmove-clear/proposal.md
Test-Path openspec/changes/ultimate-bigmove-clear/specs/ultimate-bigmove-clear/spec.md
git status --short
```

人工/脚本检查：按 AC-3 对照调用顺序；确认 `Main.scene` 不在本任务 diff；确认点位为空或 VFX 不可用时存在继续胜利的路径；确认没有新增 prefab、动画或 `.meta`。

## 回滚策略

仅回滚本任务新增的 OpenSpec 与计划文件，或由 build-agent 按 git diff 精确反向撤销本任务触及的 `SceneSetup.ts`、`UltimateSystem.ts`、`CameraFollow.ts` 局部改动；不得使用 `git reset --hard`、`git checkout --`，不得覆盖现有 `Main.scene` 或其他工作区改动。若验证失败，保留失败证据并走 `replan ultimate-bigmove-clear`，只修改失败步骤/AC。

## 修订记录

- v1（2026-09-11）：初始 OpenSpec 与脚本实现计划；明确动态 `UltimateSystem` 的 Node[] 注入和 BigMove 完成后清敌时序。

---

## 执行报告须含（build-agent）

### MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | N/A（纯脚本与文档） |
| scene-save | N/A（纯脚本与文档） |
| verify-mcp-gate | N/A（未改 scene/prefab） |
| post-scene-save Patched | N/A |
| assets-reimport-asset | N/A |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/ultimate-bigmove-clear/` |
