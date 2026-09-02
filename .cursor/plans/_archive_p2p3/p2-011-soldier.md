---
slug: p2-011-soldier
版本: 1
状态: done
创建: 2026-08-31
---

# P2-011 小兵 `pref_soldier_ranged` / `pref_soldier_melee` + `Soldier.ts`

## 业务目标

实现小兵唯一主脚本 `Soldier.ts`（含 `setDeployment('tower'|'barracks')` 远程/近战双模式、索敌攻击、受击/死亡、`reset()` 回收），并产出 `pref_soldier_ranged`、`pref_soldier_melee` 预制体及 ANIM_MANIFEST §soldier_ranged / §soldier_melee 空动画 clip。血量读 `GameConfig.soldierMaxHp`；供 P2-007 箭塔与 P2-008 兵营生成接入。禁止 `SoldierController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，不合并 P2-007/008 建筑实现。

## 风险等级

**中** — 双 prefab + 两套 clip；部署模式（塔顶站桩远程 vs 兵营近战）行为分支；远程弹道可复用 `pref_projectile_arrow` 占位；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/character/Soldier.ts` — 小兵唯一主脚本
- 【可新建】`assets/resources/prefabs/character/pref_soldier_ranged.prefab`
- 【可新建】`assets/resources/prefabs/character/pref_soldier_melee.prefab`
- 【可新建】`assets/resources/animations/soldier_ranged/idle.anim`
- 【可新建】`assets/resources/animations/soldier_ranged/remote_attack.anim`
- 【可新建】`assets/resources/animations/soldier_ranged/die.anim`
- 【可新建】`assets/resources/animations/soldier_melee/idle.anim`
- 【可新建】`assets/resources/animations/soldier_melee/melee_attack.anim`
- 【可新建】`assets/resources/animations/soldier_melee/die.anim`
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts` — 索敌/攻击/受击模式参考
- 【仅只读参考】`assets/scripts/building/Tower.ts` — `setDeployment('tower')` 调用方（P2-007）
- 【仅只读参考】`assets/scripts/building/Barracks.ts` — `setDeployment('barracks')` 调用方（P2-008）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — soldierMaxHp
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — remoteAttack / meleeAttack 映射
- 【仅只读参考】`assets/scripts/core/Billboard.ts` / `SortingOrder2D.ts`
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — 可选 HP 事件
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §soldier_ranged / §soldier_melee
- 【仅只读参考】`defense3.md` — 塔顶远程、兵营近战、Boss 可秒杀

## 实施步骤

### S1: 空动画 clip

**soldier_ranged**（`assets/resources/animations/soldier_ranged/`）：

| 磁盘文件名 | clip 名 | 循环 |
|---|---|---|
| `idle.anim` | `idle` | 是 |
| `remote_attack.anim` | `remote_attack` | 否 |
| `die.anim` | `die` | 否 |

**soldier_melee**（`assets/resources/animations/soldier_melee/`）：

| 磁盘文件名 | clip 名 | 循环 |
|---|---|---|
| `idle.anim` | `idle` | 是 |
| `melee_attack.anim` | `melee_attack` | 否 |
| `die.anim` | `die` | 否 |

每个 clip：`duration = 0.1s`，无关键帧。

### S2: 实现 `Soldier.ts`

路径 `assets/scripts/character/Soldier.ts`，`@ccclass('Soldier')`。

**部署模式**

- `SoldierDeployment`：`'tower' | 'barracks'`
- `setDeployment(deployment)`：
  - `'tower'`：**远程** — 站桩（跟随父 mount 节点，不主动位移），索敌后 `remoteAttack` + 发射弹道占位
  - `'barracks'`：**近战** — 可向敌人移动（`RigidBody2D` 或位置插值），进入范围 `meleeAttack`

**索敌与攻击**

- `setTarget(target: Node | null)` 或自动扫描最近 `EnemyMinion`
- `tryAttack()`：按部署模式播放 `remoteAttack` / `meleeAttack`（AnimUtil camelCase）
- 伤害不硬编码；`@property attackDamage` 默认值或读 GameConfig（若无 soldierAttackDamage 字段则用 `@property`）
- 远程：实例化 `pref_projectile_arrow` 占位（P2-013 未建时可仅播放动画 + 直接对目标扣血占位）

**生命与受击**

- `_hp = GameConfig.soldierMaxHp`
- `takeDamage(amount)`：Boss 等高伤害可一击击杀（由 hp/伤害数值自然达成，禁止硬编码「一击秒杀」文案）
- `_die()`：播 `die`、禁用攻击与碰撞；`reset()` 供 P4 对象池复用

**节点**

- `@property visualNode`；§P0-A 结构（RigidBody2D + Collider2D + Visual）

### S3: 创建双 prefab

路径 `assets/resources/prefabs/character/`：

- `pref_soldier_ranged.prefab` — 挂 ranged 三 clip
- `pref_soldier_melee.prefab` — 挂 melee 三 clip

结构同 §P0-A，**禁止**手写 uuid。

### S4: 自检与 AC

报告写入 `.cursor/plans/reports/p2-011-soldier-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Soldier" assets/scripts/character/Soldier.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/character/pref_soldier_ranged.prefab && test -f assets/resources/prefabs/character/pref_soldier_melee.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite|Animation" assets/resources/prefabs/character/pref_soldier_ranged.prefab`: 有匹配
- [AC-7] `test -f assets/resources/animations/soldier_ranged/remote_attack.anim && test -f assets/resources/animations/soldier_melee/melee_attack.anim`: 退出码 0
- [AC-8] `rg "setDeployment|tryAttack|takeDamage|reset" assets/scripts/character/Soldier.ts`: 四项均有匹配
- [AC-9] `rg "GameConfig\.soldierMaxHp" assets/scripts/character/Soldier.ts`: 有匹配
- [AC-10] `rg "remoteAttack|meleeAttack" assets/scripts/character/Soldier.ts`: 有匹配（双模式动画调用）
- [AC-11] `test ! -f assets/scripts/character/SoldierController.ts`: 退出码 0

## 回滚策略

- **基线**：`git rev-parse HEAD`
- **失败恢复**：删除本任务新建文件及 `.meta`

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-007 Tower | 计划/实现中；生成 `pref_soldier_ranged` + `setDeployment('tower')` |
| P2-008 Barracks | 计划/实现中；生成 `pref_soldier_melee` + `setDeployment('barracks')` |
| P2-013 `pref_projectile_arrow` | 远程小兵弹道占位 |
