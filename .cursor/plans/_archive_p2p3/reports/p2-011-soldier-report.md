# P2-011 执行报告 — Soldier.ts + pref_soldier_ranged / pref_soldier_melee

**计划 slug:** p2-011-soldier  
**计划版本:** 1（首版，无修订记录）  
**风险等级:** 中  
**执行时间:** 2026-09-01  

## 本版相对上一版改动

无修订记录 / 首版。计划步骤与校验点均未增删改。

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/character/Soldier.ts` | 已存在/补全 | 双部署模式、索敌攻击、受击/死亡、`reset()`；onLoad 按 prefab 名设默认 deployment；移动无 walk clip 时播 idle |
| `assets/scripts/character/Soldier.ts.meta` | 已存在 | 未改 uuid |
| `assets/resources/animations/soldier_ranged/{idle,remote_attack,die}.anim` | 已存在/核对 | duration=0.1，idle 循环 wrapMode=2，攻击/死亡非循环 wrapMode=1 |
| `assets/resources/animations/soldier_melee/{idle,melee_attack,die}.anim` | 已存在/核对 | 同上 |
| `assets/resources/prefabs/character/pref_soldier_ranged.prefab` | 新建 | §P0-A + Soldier + ranged 三 clip；`visualNode` 已绑定 |
| `assets/resources/prefabs/character/pref_soldier_melee.prefab` | 新建 | §P0-A + Soldier + melee 三 clip；`visualNode` 已绑定 |

### prefab 节点结构

```
Root (Soldier.ts + RigidBody2D + BoxCollider2D)
└── Visual (UITransform anchorY=0 + Sprite(default_sprite) + Animation + Billboard + SortingOrder2D)
```

**备注：** Cocos CLI MCP（user-cocos-cli）本环境不可用，prefab 按既有 `pref_enemy_minion` / `pref_hero_01` 布局手写 JSON；未手写 `.prefab.meta`（由编辑器导入时生成）。

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit -p tsconfig.json` 退出码 0 | **通过** |
| AC-2 | `class Soldier` | **通过** |
| AC-3 | 双 prefab 存在 | **通过** |
| AC-4 | 无 PlayerController\|LogController | **通过** |
| AC-5 | 无 第N下\|hitsToKill\|一击秒杀 | **通过** |
| AC-6 | pref_soldier_ranged 含 default_sprite\|Animation | **通过** |
| AC-7 | remote_attack.anim 与 melee_attack.anim 存在 | **通过** |
| AC-8 | setDeployment\|tryAttack\|takeDamage\|reset | **通过** |
| AC-9 | GameConfig.soldierMaxHp | **通过** |
| AC-10 | remoteAttack\|meleeAttack | **通过** |
| AC-11 | 无 SoldierController.ts | **通过** |

**合计：11/11 通过**

## 失败项

无。

## 备注

- 远程弹道：`projectilePrefab` 可挂 `pref_projectile_arrow`（P2-013）；未绑定时仅播 `remoteAttack` + 直接对 `EnemyMinion.takeDamage` 占位。
- `setDeployment('tower'|'barracks')` 供 Tower/Barracks 调用；prefab 名含 `melee`/`ranged` 时 onLoad 设默认部署。
- 未合并 P2-007/008 建筑实现；禁止创建 `SoldierController.ts`。
