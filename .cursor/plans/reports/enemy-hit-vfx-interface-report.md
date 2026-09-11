# enemy-hit-vfx-interface 执行报告

## 计划与基线

- 计划版本：v1（2026-09-11），无修订。
- 风险等级：中。
- 是否续跑：否；执行前无本任务报告。
- Git 基线：`610b65ef357e74460507fad0b0ca96fd1fa8ddaa`。
- 已读取：计划、OpenSpec proposal/spec、项目规则、相关敌人/弹道/士兵/动画源码和现有工作区状态。

## Todo 完成矩阵

| Todo | 状态 | 结果 |
|---|---|---|
| `hit-vfx.a` | PASS | 新增 `EnemyHitSource`；EnemyMinion/EnemyBoss 入口和 HeroProjectile、Arrow、Soldier ranged/melee 调用均传递来源。 |
| `hit-vfx.b` | PASS | EnemyMinion/EnemyBoss 各暴露 `hitVfxBluePrefab`、`hitVfxYellowPrefab`；空绑定不加载资源。 |
| `hit-vfx.c` | PASS | helper 解析 `GameRoot/Effect`，保存敌人世界坐标，按绑定 Prefab 播放一次，`Animation` 完成后销毁；缺 Prefab、挂点、Animation 或 clip 安全返回。 |
| `hit-vfx.d` | PASS | 未持有敌人引用；未改变扣血、HP_CHANGED、死亡、对象池/禁用流程；非敌人入口未接入 helper。 |
| `hit-vfx.e` | PASS | TypeScript、diff、来源/生命周期/边界静态验证完成；Cocos 实玩未执行。 |

## 改动文件

- 新增 `assets/scripts/core/EnemyHitVfx.ts`：来源到蓝/黄映射、Effect 父节点、世界坐标、动画完成回收和安全失败。
- 修改 `assets/scripts/enemy/EnemyMinion.ts`、`assets/scripts/enemy/EnemyBoss.ts`：Inspector Prefab 字段和带来源的伤害入口。
- 修改 `assets/scripts/projectile/HeroProjectile.ts`、`assets/scripts/projectile/Arrow.ts`、`assets/scripts/character/Soldier.ts`：传递 `hero`、`player-arrow`、`soldier-ranged`、`soldier-melee`。
- 修改 `bugs.md`：新增 `fix-enemy-hit-vfx-interface` v1 条目。
- 未修改 OpenSpec 内容；使用现有 `openspec/changes/enemy-hit-vfx-interface/` 作为行为验收依据。
- 未修改 `Main.scene`、任何 Prefab/Meta/VFX 资源；未修改只读的 `Hero.ts`、`AnimUtil.ts`、`BuildSystem.ts`。

## AC 结果

| AC | 状态 | 证据 |
|---|---|---|
| AC-1 | PASS | `npx tsc --noEmit --pretty false` 退出码 0；8 个敌人命中调用显式传递来源（Hero 2、Arrow 2、Soldier 4）。 |
| AC-2 | PASS | 静态检查确认 VFX Prefab 字段和消费点仅在 EnemyMinion/EnemyBoss；无 `resources.load`、`pref_vfx_hit_blue/yellow` 路径字面量。 |
| AC-3 | PASS | helper 仅将 `hero` 映射 blue，其余三类映射 yellow；四类调用字面量静态检查通过。 |
| AC-4 | PASS（静态/可重复验证） | helper 包含 `GameRoot/Effect`、`getWorldPosition`/`setWorldPosition`、Animation FINISHED 回调和销毁；缺失绑定/挂点/动画/clip 均安全退出。实际 Inspector 绑定后的运行时播放未执行。 |
| AC-5 | PASS | Player、Hero、Soldier、建筑、滚木等现有非敌人受伤入口未调用 `playEnemyHitVfx`；仅两个敌人组件消费 helper。 |
| AC-6 | PASS（任务边界） | `git diff --check` 退出码 0；无 `Main.scene` 变更。启动前已存在的两个 VFX Prefab 修改和 `GuideIndicatorUI.ts.meta` 未被本任务触碰，保持原样。 |
| AC-7 | PASS（静态场景对照） | 已对照 OpenSpec 四类来源、缺失绑定、完成回收和非敌人隔离场景完成静态验证；运行时手测未执行。 |

验证命令：

```text
npx tsc --noEmit --pretty false                    PASS
git diff --check                                  PASS
focused enemy-hit-vfx static checks (12)          PASS
source/lifecycle audit                             PASS
```

## MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | skipped（纯脚本/文档） |
| scene-save | skipped（纯脚本/文档） |
| verify-mcp-gate | skipped（未改 scene/prefab） |
| post-scene-save Patched | 0（未运行） |
| assets-reimport-asset | skipped（未改资源） |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | no |
| OpenSpec change | `openspec/changes/enemy-hit-vfx-interface/` |

## 失败、阻塞与用户操作

- 首次静态断言因 PowerShell 引号解析失败，未执行代码检查；改用 PowerShell 原生断言后通过，不是代码失败。
- 边界审计看到启动前已有的 `pref_vfx_hit_blue.prefab`、`pref_vfx_hit_yellow.prefab` 修改和 `GuideIndicatorUI.ts.meta` 未跟踪文件；按要求保留，未回退。
- 无硬阻塞。未执行 Cocos 实玩，因此实际播放观感和 Inspector 绑定后的运行时回收仍待用户确认。
- 用户需在 Cocos Inspector 中分别为 EnemyMinion 和 EnemyBoss 手动绑定两个字段：`hitVfxBluePrefab` 绑定蓝色受击 Prefab，`hitVfxYellowPrefab` 绑定黄色受击 Prefab。代码不会自动绑定或路径加载。
