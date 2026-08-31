# P2-010 执行报告 — pref_hero_01 / pref_hero_02 + Hero.ts

**计划 slug:** p2-010-hero  
**计划版本:** 1（首版，无修订记录）  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 本版相对上一版改动

首版正式执行。计划步骤与校验点均未增删改。  
**补全项**（此前标记 done 但磁盘缺失）：`Hero.ts` 脚本体、8 个 `.anim` 文件、`pref_hero_01.prefab` JSON 损坏修复。

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/character/Hero.ts` | 新建 | 跟随玩家、远程攻击、受击/死亡、`setHeroVariant` |
| `assets/resources/animations/hero_01/*.anim` | 新建 | idle/walk/attack/die 空 clip ×4 |
| `assets/resources/animations/hero_02/*.anim` | 新建 | idle/walk/attack/die 空 clip ×4 |
| `assets/resources/prefabs/character/pref_hero_01.prefab` | 修复 | 补全 `followOffset` 字段（JSON 损坏） |
| `assets/resources/prefabs/character/pref_hero_02.prefab` | 已存在 | `heroVariant=2`，结构完整 |
| `assets/resources/prefabs/projectile/pref_projectile_hero_01.prefab` | 已存在 | default_sprite 占位 |
| `assets/resources/prefabs/projectile/pref_projectile_hero_02.prefab` | 已存在 | default_sprite 占位 |

### pref_hero_* 节点结构

```
pref_hero_* (Root)
├── Hero.ts + RigidBody2D + BoxCollider2D
└── Canvas/Visual (Sprite + Animation + Billboard + SortingOrder2D)
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class Hero` | **通过** |
| AC-3 | 两个 hero prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | pref_hero_01 含 `Animation` | **通过** |
| AC-7 | hero_01/idle + hero_02/attack clip 存在 | **通过** |
| AC-8 | setFollowTarget/setHeroVariant/tryAttack/takeDamage | **通过** |
| AC-9 | `GameConfig.heroMaxHp` / `heroFollowSpeed` | **通过** |
| AC-10 | pref_projectile_hero_01 存在 | **通过** |
| AC-11 | 无 HeroController.ts | **通过** |

**合计：11/11 通过**

## 失败项

无。

## 备注

- 弹道占位 prefab 由 `Hero._spawnProjectile()` 简单插值驱动，完整池化留 P2-013/P4。
- `attackDamage` 使用 `@property` 默认值 15，不硬编码击杀次数。
- 自动攻击：跟随逻辑中检测范围内 `EnemyMinion` 后调用 `tryAttack()`。
