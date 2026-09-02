# P2-003 执行报告 — pref_enemy_minion + EnemyMinion.ts

**计划 slug:** p2-003-enemy-minion  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/enemy/EnemyMinion.ts` | 新建 | 索敌追击、近战攻击、受击/死亡、`setTarget()`/`reset()` 对象池预埋 |
| `assets/resources/animations/enemy_minion/idle.anim` | 新建 | 空占位 clip，duration=0.1s，循环 |
| `assets/resources/animations/enemy_minion/walk.anim` | 新建 | 空占位 clip，循环 |
| `assets/resources/animations/enemy_minion/attack.anim` | 新建 | 空占位 clip，非循环 |
| `assets/resources/animations/enemy_minion/die.anim` | 新建 | 空占位 clip，非循环 |
| `assets/resources/prefabs/enemy/pref_enemy_minion.prefab` | 新建 | §P0-A 结构，Cocos CLI 直接于 Defense3 创建 |
| `*.meta` | 新建 | 由 Cocos 编辑器/CLI 自动生成 |

### pref_enemy_minion 节点结构

```
pref_enemy_minion (Root)
├── RigidBody2D + BoxCollider2D + EnemyMinion.ts (visualNode → Visual)
└── Visual
    ├── UITransform (anchorY=0)
    ├── Sprite (default_sprite, sizeMode=RAW)
    ├── Animation (idle/walk/attack/die)
    ├── Billboard
    └── SortingOrder2D + Sorting2D
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class EnemyMinion` | **通过** |
| AC-3 | prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | prefab 含 Animation 引用 | **通过** |
| AC-7 | idle.anim + attack.anim 存在 | **通过** |
| AC-8 | setTarget/tryAttack/takeDamage/reset | **通过** |
| AC-9 | GameConfig 三项数值引用 | **通过** |
| AC-10 | 无 EnemyMinionController.ts | **通过** |

**合计：10/10 通过**

## 失败项

无。

## 备注

- `visualNode` 绑定经 prefab 序列化补丁完成（MCP `scene-set-component-property` 暂未能识别该 `@property`）。
- 索敌优先级（滚木 > 城墙 > 玩家）由 P4 刷怪系统通过 `setTarget()` 注入，本任务不实现自动索敌。
