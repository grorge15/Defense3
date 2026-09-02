---
slug: p2-013-traps-projectiles
版本: 1
状态: draft
创建: 2026-08-31
---

# P2-013 陷阱与弹道 `pref_trap_saw` / `pref_projectile_arrow` / `pref_skill_ultimate` / `pref_barrier_*`

## 业务目标

实现 P2-013 四类预制体与主脚本：**电锯**（伤玩家、缩短滚木）、**箭**（玩家弹道）、**大招**（清场钩子）、**阻挡墙**（带血条、受击闪红，区别于 P2-006 纯阻挡 `pref_wall`）。数值读 `GameConfig`；完整 FlashRed 打磨留 P6-003。

**澄清结论（用户确认）**：本阶段四类均做完整逻辑框架，不拆分子 plan。

**与 P2-006 边界**：`pref_wall` + `Wall.ts` 无受击闪红；**`pref_barrier_wall` / `pref_barrier_long` + `Barrier.ts`** 承担带血条阻挡与 `_flashRed()`。

## 风险等级

**高** — 4 脚本 + 5 prefab，跨 Player/Log/敌人/清场多系统；单任务文件数多但各脚本职责单一；不删除既有文件。

## 变更文件清单

- 【可新建】`assets/scripts/trap/SawTrap.ts`
- 【可新建】`assets/scripts/projectile/Arrow.ts`
- 【可新建】`assets/scripts/projectile/UltimateSkill.ts`
- 【可新建】`assets/scripts/building/Barrier.ts`
- 【可新建】`assets/resources/prefabs/trap/pref_trap_saw.prefab`
- 【可新建】`assets/resources/prefabs/projectile/pref_projectile_arrow.prefab`
- 【可新建】`assets/resources/prefabs/projectile/pref_skill_ultimate.prefab`
- 【可新建】`assets/resources/prefabs/building/pref_barrier_wall.prefab`
- 【可新建】`assets/resources/prefabs/building/pref_barrier_long.prefab`
- 【仅只读参考】`assets/scripts/character/Player.ts` — `takeDamage` / `castUltimate` / `onUltimateCast`
- 【仅只读参考】`assets/scripts/item/Log.ts` — `shrink()`
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts` — 箭矢命中目标
- 【仅只读参考】`assets/scripts/building/Wall.ts` — 纯阻挡对比（P2-006 v2）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — barrierMaxHp / playerAttackDamage / logShrinkAmount
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `HP_CHANGED`
- 【仅只读参考】`assets/resources/sprite/default_sprite.png`
- 【仅只读参考】`AI_TASK_LIST.md` — P2-013 / P2-006
- 【仅只读参考】`defense3.md` — 电锯、箭、大招、拓展区阻挡

## 实施步骤

### S1: 占位资源

五 prefab 均复用 `default_sprite`；无角色式 Animation clip（电锯可用程序旋转）。

### S2: `SawTrap.ts`（a 电锯）

路径 `assets/scripts/trap/SawTrap.ts`；prefab `pref_trap_saw`（挂 `ParkourContent` 下，场景说明见 P3）。

- `Collider2D` Trigger 或碰撞体
- 碰 `Player` → `takeDamage`（伤害 `@property` 或读已有 GameConfig 攻击字段，禁止硬编码「几下死」）
- 碰 `Log` → `shrink()`
- 可选 `update` 中旋转 Visual（程序动画）

### S3: `Arrow.ts`（b 箭）

路径 `assets/scripts/projectile/Arrow.ts`；prefab `pref_projectile_arrow`。

- `launch(direction, speed)` 或 `init(owner, targetDir)`：直线飞行
- 命中 `EnemyMinion`（等）→ `takeDamage(GameConfig.playerAttackDamage)`，销毁箭矢
- 超出射程/生命周期自动销毁；供 `Player.tryAttack()` 与 P2-011 远程小兵实例化

### S4: `UltimateSkill.ts`（c 大招）

路径 `assets/scripts/projectile/UltimateSkill.ts`；prefab `pref_skill_ultimate`。

- 由 `Player.castUltimate()` / `onUltimateCast` 实例化
- `executeClear()`：遍历场上敌人并 `takeDamage` 致死或派发清场事件，供 P4 统一处理
- 播放占位特效后 `destroy()`；**不在此任务实现镜头拉远/GameOver UI**（P5-005）

### S5: `Barrier.ts`（d 阻挡墙）

路径 `assets/scripts/building/Barrier.ts`；prefab `pref_barrier_wall`、`pref_barrier_long`。

- `setBarrierType('wall' | 'long')`：碰撞体尺寸/Visual scale 区分
- `_hp = GameConfig.barrierMaxHp`；`takeDamage(amount)` → `HP_CHANGED`（供 P5 血条）
- `_flashRed()`：基础 tint 闪红（P6-003 可替换）
- `Collider2D` 非 Trigger，阻挡怪物；**无** `WallSide`/楼梯逻辑

### S6: 创建 5 个 prefab 并 AC 校验

报告写入 `.cursor/plans/reports/p2-013-traps-projectiles-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class SawTrap" assets/scripts/trap/SawTrap.ts`: 有匹配
- [AC-3] `rg "class Arrow" assets/scripts/projectile/Arrow.ts`: 有匹配
- [AC-4] `rg "class UltimateSkill" assets/scripts/projectile/UltimateSkill.ts`: 有匹配
- [AC-5] `rg "class Barrier" assets/scripts/building/Barrier.ts`: 有匹配
- [AC-6] `test -f assets/resources/prefabs/trap/pref_trap_saw.prefab && test -f assets/resources/prefabs/projectile/pref_projectile_arrow.prefab && test -f assets/resources/prefabs/building/pref_barrier_wall.prefab`: 退出码 0
- [AC-7] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-8] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-9] `rg "shrink|Log" assets/scripts/trap/SawTrap.ts`: 有匹配
- [AC-10] `rg "launch|playerAttackDamage" assets/scripts/projectile/Arrow.ts`: 有匹配
- [AC-11] `rg "executeClear|onUltimateCast" assets/scripts/projectile/UltimateSkill.ts`: 有匹配
- [AC-12] `rg "takeDamage|_flashRed|barrierMaxHp" assets/scripts/building/Barrier.ts`: 有匹配
- [AC-13] `rg "takeDamage|_flashRed" assets/scripts/building/Wall.ts && exit 1 || true`: 退出码 0（与 P2-006 边界：Wall 无受击）

## 回滚策略

- **基线**：`git rev-parse HEAD`
- **失败恢复**：删除本任务新建 4 脚本、5 prefab 及 `.meta`

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-001 Player | ✅ |
| P2-002 Log | 计划/实现中；`shrink()` |
| P2-006 Wall | v2 纯阻挡，与 Barrier 区分 |
| P2-011 Soldier | 箭矢占位 |
| P5 血条 | Barrier `HP_CHANGED` |
| P6-003 FlashRed | 增强 Barrier 闪红 |
| G1/G4 | 跑酷电锯；拓展区阻挡+大招结束 |
