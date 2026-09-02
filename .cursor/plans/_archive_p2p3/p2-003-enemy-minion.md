---
slug: p2-003-enemy-minion
版本: 1
状态: done
创建: 2026-08-31
---

# P2-003 小怪 `pref_enemy_minion` + `EnemyMinion.ts`

## 业务目标

实现小怪唯一主脚本 `EnemyMinion.ts`（含索敌玩家、RigidBody2D 追击、单体攻击、受击/死亡框架及 `setTarget()` 供 P4 刷怪接入），并产出符合 §P0-A 节点结构的 `pref_enemy_minion` 预制体及 ANIM_MANIFEST §enemy_minion 空动画 clip。数值全部读 `GameConfig`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，刷怪/对象池由 P4-006 负责，本任务仅暴露 `setTarget()` 与可实例化 prefab。

## 风险等级

**中** — 涉及脚本、4 个 clip、prefab 新建；`default_sprite` 已由 P2-001 创建可复用；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/enemy/EnemyMinion.ts` — 小怪唯一主脚本
- 【可新建】`assets/resources/prefabs/enemy/pref_enemy_minion.prefab` — 小怪预制体
- 【可新建】`assets/resources/animations/enemy_minion/idle.anim` — 空占位 clip
- 【可新建】`assets/resources/animations/enemy_minion/walk.anim`
- 【可新建】`assets/resources/animations/enemy_minion/attack.anim`
- 【可新建】`assets/resources/animations/enemy_minion/die.anim`
- 【仅只读参考】`assets/scripts/character/Player.ts` — 追击/伤害目标类型参考
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — minionMaxHp / minionAttackDamage / minionMoveSpeed
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — `playAnim()`
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — 事件派发
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite（P2-001 已建则复用）
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §enemy_minion
- 【仅只读参考】`AI_TASK_LIST.md` — P2-003 / P2 通用 AC

## 实施步骤

### S1: 空动画 clip（ANIM_MANIFEST §enemy_minion）

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: animation-clip`）在 `assets/resources/animations/enemy_minion/` 创建 4 个 clip：


| 磁盘文件名         | Animation 组件 clip 名 | 循环  |
| ------------- | ------------------- | --- |
| `idle.anim`   | `idle`              | 是   |
| `walk.anim`   | `walk`              | 是   |
| `attack.anim` | `attack`            | 否   |
| `die.anim`    | `die`               | 否   |


每个 clip：无关键帧，`duration = 0.1s`。

### S2: 实现 `EnemyMinion.ts`

路径 `assets/scripts/enemy/EnemyMinion.ts`，`@ccclass('EnemyMinion')`。

**节点引用**

- `@property` 绑定 `visualNode`（Visual 子节点，挂 Animation）
- 根节点取 `RigidBody2D`（§P0-A）

**索敌与目标（供 P4 刷怪接入）**

- `setTarget(target: Node | null)`：设置追击目标（通常为 Player 根节点）；`null` 时进入 idle
- 仅索敌玩家和滚木（defense3.md：小怪仅对玩家索敌）；优先级逻辑：滚木>pref_barrier_wal>玩家

**移动（RigidBody2D 驱动，`fixedUpdate`）**

- 有目标且自身与目标距离 <= 攻击范围半径：朝目标方向移动，速度 GameConfig.minionMoveSpeed（XZ 平面）
- 无目标或已死亡：速度归零

**攻击（单体近战）**

- `attackRange` 可 `@property` 配置默认值（如 1.5 世界单位），禁止硬编码伤害
- 进入攻击范围且攻击 CD 就绪：调用 `tryAttack()`，播放 `attack` 动画
- 对目标 `Player` 组件调用 `takeDamage(GameConfig.minionAttackDamage)`；需 import `Player` 并做类型判断
- 攻击 CD 读 `GameConfig` 或 `@property attackCooldown`（若 GameConfig 无字段，用 `@property` 默认 1.0s，**伤害/速度/血量必须读 GameConfig**）

**生命与受击**

- 初始 `_hp = GameConfig.minionMaxHp`
- `takeDamage(amount)`：扣血；派发 `GameEvents.HP_CHANGED`（payload 含自身 node 与当前/最大 hp，供 P5 小怪血条「满血不显示」）
- `_hp <= 0` 时 `_die()`：播放 `die`、禁用移动与碰撞、延迟销毁或 `node.active = false`（供 P4 对象池回收预留 `reset()` 方法）

**动画切换**

- 追击移动：播 `walk`；静止：播 `idle`；攻击/死亡同上
- 统一 `playAnim(visualNode, clipName)`

**回收接口（P4 对象池预埋）**

- `reset()`：重置 hp、目标、状态、重新启用碰撞，供 P1-D01 对象池复用

### S3: 创建 `pref_enemy_minion.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`），路径 `assets/resources/prefabs/enemy/pref_enemy_minion.prefab`。

**节点层级（§P0-A，与 pref_player 一致）**

```
pref_enemy_minion (Root)
├── 组件: RigidBody2D + Collider2D + EnemyMinion.ts
└── Visual (子节点)
    ├── Sprite → default_sprite，anchorY=0，sizeMode=RAW
    ├── Animation → 挂 S1 四个 clip
    ├── Billboard → visualNode 指向自身
    └── SortingOrder2D → visualNode 指向自身
```

- `EnemyMinion.visualNode` 在 prefab 中指向 Visual 子节点
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器打开 prefab 确认无 missing script、Animation 含 4 clip

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-003-enemy-minion-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class EnemyMinion" assets/scripts/enemy/EnemyMinion.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/enemy/pref_enemy_minion.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite|Animation" assets/resources/prefabs/enemy/pref_enemy_minion.prefab`: 有匹配
- [AC-7] `test -f assets/resources/animations/enemy_minion/idle.anim && test -f assets/resources/animations/enemy_minion/attack.anim`: 退出码 0
- [AC-8] `rg "setTarget|tryAttack|takeDamage|reset" assets/scripts/enemy/EnemyMinion.ts`: 四项均有匹配
- [AC-9] `rg "GameConfig\.(minionMaxHp|minionAttackDamage|minionMoveSpeed)" assets/scripts/enemy/EnemyMinion.ts`: 有匹配
- [AC-10] `test ! -f assets/scripts/enemy/EnemyMinionController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除本任务新建的 `EnemyMinion.ts`、prefab、4 个 clip 及对应 `.meta`（勿手改 uuid）；`git checkout` 恢复误改文件

## 依赖与后续


| 依赖                 | 状态                                             |
| ------------------ | ---------------------------------------------- |
| P1-002~007 基础设施    | ✅ 已存在                                          |
| P2-001 `Player.ts` | ✅ 已存在（攻击目标）                                    |
| `default_sprite`   | ✅ P2-001 已建                                    |
| P4-006 刷怪/对象池      | 未建；本任务暴露 `setTarget()` / `reset()`             |
| P5 小怪血条 UI         | 未建；本任务派发 `HP_CHANGED`                          |
| P3 场景放置            | 跑酷段预置 7–8 只小怪由 `SCENE_PLACEMENT.md` 说明，用户编辑器拖入 |


