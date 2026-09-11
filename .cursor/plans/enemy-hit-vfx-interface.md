---
slug: enemy-hit-vfx-interface
版本: 1
状态: draft
创建: 2026-09-11
---

# 敌人受击 VFX 来源接口

## 业务目标
为敌人受击伤害入口增加来源类型，并让 EnemyMinion/EnemyBoss 使用用户 Inspector 绑定的蓝/黄受击 VFX；命中特效在敌人当前世界坐标的 `GameRoot/Effect` 下播放一次并回收。

## OpenSpec 引用
- Change：`openspec/changes/enemy-hit-vfx-interface/`
- 行为语义以该目录的 proposal 与 `specs/enemy-hit-vfx-interface/spec.md` 为准；本计划不重复 WHEN/THEN 场景。

## 风险等级
中

## 禁做项
- 不修改 `assets/scenes/Main.scene` 或任何其他 `.scene`。
- 不修改、新建、重建或重新序列化任何 `.prefab`、`.meta` 或 VFX 资源；现有 `pref_vfx_hit_blue/yellow` 仅只读参考。
- 不自动执行 Inspector 绑定；由用户将蓝色/黄色 Prefab 绑定到 EnemyMinion/EnemyBoss 现有组件新增字段。
- 不在代码中硬编码 `pref_vfx_hit_blue` / `pref_vfx_hit_yellow` 路径，不使用 `resources.load` 作为绑定缺失时的 fallback。
- 不让 Player、Hero、Soldier、建筑、滚木或其他非 EnemyMinion/EnemyBoss 对象播放敌人受击 VFX。
- 不改变伤害值、目标选择、箭矢穿透、攻击动画/冷却、死亡、血条事件或对象池重置语义。
- 不新增第二套角色主脚本，不用运行时生成静态场景布局；本任务没有 MCP prefab/scene 装配步骤。

## 变更文件清单
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 暴露 Inspector VFX Prefab 字段；接收来源并触发本敌人的受击 VFX。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 暴露 Inspector VFX Prefab 字段；接收来源并触发本 Boss 的受击 VFX。
- 【可写】`assets/scripts/projectile/Arrow.ts` — 以 Player/Arrow 来源调用敌人伤害入口。
- 【可写】`assets/scripts/projectile/HeroProjectile.ts` — 以 Hero 来源调用敌人伤害入口。
- 【可写】`assets/scripts/character/Soldier.ts` — 以 Soldier ranged/melee 来源调用敌人伤害入口。
- 【可新建】`assets/scripts/core/EnemyHitVfx.ts`（若实现需要共享 helper）— 集中来源到颜色映射、`GameRoot/Effect` 解析、世界坐标实例化与播放完成回收；不得承载敌人生命逻辑。
- 【仅只读参考】`assets/resources/prefabs/VFX/pref_vfx_hit_blue.prefab` — 蓝色受击 VFX；现有动画约 0.3 秒。
- 【仅只读参考】`assets/resources/prefabs/VFX/pref_vfx_hit_yellow.prefab` — 黄色受击 VFX；现有动画约 0.3 秒。
- 【仅只读参考】`assets/resources/animations/vfx/hit_blue.anim`、`assets/resources/animations/vfx/hit_yellow.anim` — 核对一次播放 clip 与时长。
- 【仅只读参考】`assets/scripts/building/BuildSystem.ts` — 参考已有 VFX 实例化、设世界坐标、播放完成销毁模式，不复制资源路径 fallback。
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — 复用项目已有 Animation 完成回调能力。
- 【仅只读参考】`bugs.md` — 已知受击闪红/特效生命周期背景；本计划不新增 bug 条目。
- 【仅只读参考】`AI_TASK_LIST.md`、`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/openspec.mdc` — 项目约束与验收规则。

## To-dos
- [ ] `hit-vfx.a`：定义稳定的伤害来源类型，至少区分 `hero`、`player-arrow`、`soldier-ranged`、`soldier-melee`；更新 EnemyMinion/EnemyBoss 伤害入口及所有本任务内调用点，保持现有调用行为和血条事件。
- [ ] `hit-vfx.b`：在 EnemyMinion 与 EnemyBoss 组件上各暴露一个 Inspector `Prefab` 字段；蓝色字段用于 Hero 来源，黄色字段用于 Player/Arrow 与 Soldier 两种来源。字段为空时必须安全跳过 VFX，不得路径加载。
- [ ] `hit-vfx.c`：实现受击 VFX 播放生命周期：实例挂到场景 `GameRoot/Effect`，以受击敌人调用时的世界坐标定位，播放一次，动画完成后回收；处理场景挂点或 Prefab 为空时的安全失败，不得影响伤害结算。
- [ ] `hit-vfx.d`：核对 EnemyMinion、EnemyBoss 的对象池 reset/deactivate/death 生命周期，确保临时 VFX 不持有敌人引用、不阻断死亡/回池；检查 Hero projectile、Arrow、Soldier ranged/melee 四条来源路径均传递正确类型。
- [ ] `hit-vfx.e`：执行静态验证与针对性测试，记录 Inspector 绑定前后行为、缺失绑定行为、世界坐标/Effect 父节点、动画完成回收及非敌人不触发 VFX 的证据。

## 实施步骤
1. S1：先读取当前所有敌人伤害调用点与 `AnimUtil` 的播放完成 API，确定来源类型和 helper 边界；不改场景或资源。
2. S2：修改 EnemyMinion/EnemyBoss 的脚本接口与 Inspector 字段，并在受击入口内触发来源映射；保留扣血、`HP_CHANGED`、死亡和对象池流程顺序。
3. S3：修改 HeroProjectile、Arrow、Soldier 的调用点传递来源；Soldier ranged 与 melee 必须分别保留来源值，均映射黄色。
4. S4：实现/接入共享 VFX 生命周期 helper（如采用），只接受已绑定 Prefab；使用 `GameRoot/Effect` 作为父节点并在动画完成回收。禁止创建或编辑 prefab，禁止 MCP 场景装配。
5. S5：让用户在 Cocos Inspector 手动绑定 EnemyMinion/EnemyBoss 的蓝色与黄色 Prefab 字段；构建前确认磁盘无 `.scene`/`.prefab`/`.meta` 变化。
6. S6：按 OpenSpec 场景执行静态/单元式验证与可运行手测；本任务未改 prefab/scene，因此跳过 MCP `scene-open`、`scene-save`、`post-scene-save`、`verify-mcp-gate`、`AC-P3` 和 `AC-EDITOR-MCP`。

## 校验点
- [AC-1] `npx tsc --noEmit --pretty false` 通过，来源类型在所有 Hero projectile、Player/Arrow、Soldier ranged、Soldier melee 敌人命中调用处均显式传递。
- [AC-2] 静态检查确认只有 EnemyMinion/EnemyBoss 具备并消费受击 VFX Prefab 字段；不存在 `resources.load` 或硬编码 `pref_vfx_hit_*` 路径。
- [AC-3] 静态/测试证据确认来源映射：Hero=blue；Player/Arrow=yellow；Soldier ranged=yellow；Soldier melee=yellow。
- [AC-4] 运行时或可重复测试确认 VFX 实例父节点为 `GameRoot/Effect`、位置为命中敌人的当前世界坐标、动画结束后实例被回收；空绑定不抛错且伤害仍结算。
- [AC-5] 运行时或调用链测试确认 Player、Hero、Soldier、建筑、滚木等非 EnemyMinion/EnemyBoss 受击不会生成本次敌人 VFX。
- [AC-6] `git diff --check` 通过；`git status --short` 显示仅计划、OpenSpec 与列明的脚本文件变化，不含 `Main.scene`、任意 prefab/meta 或资源文件变化。
- [AC-7] 对照 `openspec/changes/enemy-hit-vfx-interface/specs/enemy-hit-vfx-interface/spec.md` 完成四种来源、缺失绑定、回收和非敌人隔离场景的验证记录。
### MCP
- 本任务纯脚本与文档/OpenSpec，不改 prefab/scene；MCP 机器门禁不适用，报告中保留 skipped 说明，不得以未绑定 Inspector 伪造通过。
### 条件 / 不阻塞
- `[AC-PLAY]` 若当前运行环境可启动 Cocos，则补充手测；否则保留静态/单元证据并标明未执行，不阻塞脚本机器 AC。

## 回滚策略
- 以任务开始时的 git 状态为基线；若来源接口或回收逻辑验证失败，只回退本任务触及的脚本与新增 helper，保留用户已有未相关修改。
- 不回退或重写用户手动 Inspector 绑定、现有 prefab/meta/scene；若绑定造成问题，用户在编辑器清空对应字段即可。
- 若发现需要修改 prefab/scene 才能完成，则停止执行并走 replan，不以手写序列化文件替代。

## 修订记录
- v1（2026-09-11）：初始 Plan；新增敌人受击来源接口与 OpenSpec，限定脚本改动和用户手动 Inspector 绑定。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | skipped（纯脚本/文档） |
| scene-save | skipped（纯脚本/文档） |
| verify-mcp-gate | skipped（未改 scene/prefab） |
| post-scene-save Patched | 0（未运行） |
| assets-reimport-asset | skipped（未改资源） |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/enemy-hit-vfx-interface/` |
