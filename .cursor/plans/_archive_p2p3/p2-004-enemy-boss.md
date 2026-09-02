---
slug: p2-004-enemy-boss
版本: 1
状态: done
创建: 2026-08-31
---

# P2-004 Boss `pref_enemy_boss` + `EnemyBoss.ts`

## 业务目标

实现 Boss 唯一主脚本 `EnemyBoss.ts`（含建筑>英雄>玩家优先级索敌、RigidBody2D 追击、朝向长条范围攻击、受击/死亡框架及目标注册接口供 P4 刷怪接入），并产出符合 §P0-A 节点结构的 `pref_enemy_boss` 预制体及 ANIM_MANIFEST §enemy_boss 空动画 clip。数值全部读 `GameConfig`（`bossMaxHp`、`bossAttackDamage`、`bossMoveSpeed`）。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，首次生成与 Boss 血条 UI 分别由 P4/P5 负责，本任务仅暴露目标注册与可实例化 prefab。

## 风险等级

**中** — 涉及脚本、4 个 clip、prefab 新建；Boss 索敌优先级与长条攻击比小怪复杂，但建筑/英雄脚本尚未齐全，需用通用 `takeDamage` 接口或节点组件探测；`default_sprite` 已存在可复用；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/enemy/EnemyBoss.ts` — Boss 唯一主脚本
- 【可新建】`assets/resources/prefabs/enemy/pref_enemy_boss.prefab` — Boss 预制体
- 【可新建】`assets/resources/animations/enemy_boss/idle.anim` — 空占位 clip
- 【可新建】`assets/resources/animations/enemy_boss/walk.anim`
- 【可新建】`assets/resources/animations/enemy_boss/attack.anim`
- 【可新建】`assets/resources/animations/enemy_boss/die.anim`
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts` — 追击/受击/动画模式参考
- 【仅只读参考】`assets/scripts/character/Player.ts` — 攻击目标与 `takeDamage`
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — bossMaxHp / bossAttackDamage / bossMoveSpeed
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — `playAnim()`
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — 事件派发
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §enemy_boss
- 【仅只读参考】`AI_TASK_LIST.md` — P2-004 / P2 通用 AC
- 【仅只读参考】`defense3.md` — Boss 索敌优先级与长条攻击

## 实施步骤

### S1: 空动画 clip（ANIM_MANIFEST §enemy_boss）

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: animation-clip`）在 `assets/resources/animations/enemy_boss/` 创建 4 个 clip：

| 磁盘文件名 | Animation 组件 clip 名 | 循环 |
|---|---|---|
| `idle.anim` | `idle` | 是 |
| `walk.anim` | `walk` | 是 |
| `attack.anim` | `attack` | 否 |
| `die.anim` | `die` | 否 |

每个 clip：无关键帧，`duration = 0.1s`。

### S2: 实现 `EnemyBoss.ts`

路径 `assets/scripts/enemy/EnemyBoss.ts`，`@ccclass('EnemyBoss')`。

**节点引用**

- `@property` 绑定 `visualNode`（Visual 子节点，挂 Animation）
- 根节点取 `RigidBody2D`（§P0-A）

**索敌与目标注册（供 P4 刷怪 / 场景接入）**

- `registerTargets(options: { buildings?: Node[]; heroes?: Node[]; player?: Node | null })`：注册可攻击目标池
- `pickTarget()`：按 defense3 优先级选取当前目标 — **建筑 > 英雄 > 玩家**；同类取最近存活目标
- 无可用目标时进入 idle

**移动（RigidBody2D 驱动，`fixedUpdate`）**

- 有目标且距离 > 攻击触发距离：朝目标移动，速度 `GameConfig.bossMoveSpeed`（XZ 平面）
- 移动时更新朝向（面向目标或攻击方向），供长条攻击使用
- 无目标或已死亡：速度归零

**长条范围攻击**

- `tryAttack()`：攻击 CD 就绪且目标在射程内时触发
- 播放 `attack` 动画
- 以 Boss 当前朝向为轴，在面前矩形/长条区域内检测命中（`@property attackLength`、`attackWidth` 可配置默认值，**伤害读 `GameConfig.bossAttackDamage`**）
- 对区域内所有有效目标调用 `takeDamage`（通过 `Player`、后续建筑/英雄组件或通用探测；建筑/英雄脚本未建时先支持 `Player`，并为建筑/英雄节点预留同接口扩展）
- 长条攻击可一次命中多个单位（与小怪单体攻击区分）

**生命与受击**

- 初始 `_hp = GameConfig.bossMaxHp`
- `takeDamage(amount)`：扣血；派发 `GameEvents.HP_CHANGED`（payload 含自身 node、当前/最大 hp，供 P5 Boss 血条常驻显示）
- `_hp <= 0` 时 `_die()`：播放 `die`、禁用移动与碰撞；`reset()` 供对象池复用

**动画切换**

- 追击：播 `walk`；静止：播 `idle`；攻击/死亡同上
- 统一 `playAnim(visualNode, clipName)`

**回收接口（P4 对象池预埋）**

- `reset()`：重置 hp、目标池、状态、碰撞，供 P1-D01 复用

### S3: 创建 `pref_enemy_boss.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`），路径 `assets/resources/prefabs/enemy/pref_enemy_boss.prefab`。

**节点层级（§P0-A，与 pref_enemy_minion 一致）**

```
pref_enemy_boss (Root)
├── 组件: RigidBody2D + Collider2D + EnemyBoss.ts
└── Visual (子节点)
    ├── Sprite → default_sprite，anchorY=0，sizeMode=RAW
    ├── Animation → 挂 S1 四个 clip
    ├── Billboard → visualNode 指向自身
    └── SortingOrder2D → visualNode 指向自身
```

- `EnemyBoss.visualNode` 在 prefab 中指向 Visual 子节点
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器打开 prefab 确认无 missing script、Animation 含 4 clip

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-004-enemy-boss-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class EnemyBoss" assets/scripts/enemy/EnemyBoss.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/enemy/pref_enemy_boss.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite|Animation" assets/resources/prefabs/enemy/pref_enemy_boss.prefab`: 有匹配
- [AC-7] `test -f assets/resources/animations/enemy_boss/idle.anim && test -f assets/resources/animations/enemy_boss/attack.anim`: 退出码 0
- [AC-8] `rg "registerTargets|pickTarget|tryAttack|takeDamage|reset" assets/scripts/enemy/EnemyBoss.ts`: 五项均有匹配
- [AC-9] `rg "GameConfig\.(bossMaxHp|bossAttackDamage|bossMoveSpeed)" assets/scripts/enemy/EnemyBoss.ts`: 有匹配
- [AC-10] `test ! -f assets/scripts/enemy/EnemyBossController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `EnemyBoss.ts`、prefab、4 个 clip 及对应 `.meta`（勿手改 uuid）；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P1-002~007 基础设施 | ✅ 已存在 |
| P2-001 `Player.ts` | ✅ 已存在（攻击目标之一） |
| P2-003 `EnemyMinion.ts` | ✅ 已存在（模式参考） |
| `default_sprite` | ✅ P2-001 已建 |
| P2-005~011 建筑/英雄 | 未建；本任务 `registerTargets` 预留建筑/英雄节点 |
| P4 首次 Boss 生成 | 未建；本任务暴露 `registerTargets()` / `reset()` |
| P5 Boss 血条 UI | 未建；本任务派发 `HP_CHANGED` |
