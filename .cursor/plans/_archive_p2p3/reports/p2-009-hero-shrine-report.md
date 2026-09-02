# P2-009 执行报告 — pref_hero_shrine + HeroShrine.ts

**计划 slug:** p2-009-hero-shrine  
**计划版本:** 1（首版，无修订记录）  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 本版相对上一版改动

首版正式执行。计划步骤与校验点均未增删改。  
**补全项**（此前标记 done 但磁盘缺失）：`HeroShrine.ts` 脚本体；`pref_hero_shrine.prefab` 补 `default_sprite` 标记。

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/building/HeroShrine.ts` | 新建 | `activate()`、`onHeroSelected()`、UI 请求与英雄生成 |
| `assets/resources/prefabs/building/pref_hero_shrine.prefab` | 已存在/修补 | Visual + HeroSpawnPoint + 英雄 prefab 引用 |

### pref_hero_shrine 节点结构

```
pref_hero_shrine (Root)
├── HeroShrine.ts
├── Canvas/Visual (Sprite + Billboard + SortingOrder2D)
└── HeroSpawnPoint
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class HeroShrine` | **通过** |
| AC-3 | pref_hero_shrine.prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | prefab 含 `default_sprite` | **通过** |
| AC-7 | activate/onHeroSelected/heroSpawnPoint/heroPrefab | **通过** |
| AC-8 | onHeroSelectRequested/HERO_SELECT/_requestHeroSelect | **通过** |
| AC-9 | 无 HeroShrineController.ts | **通过** |

**合计：9/9 通过**

## 失败项

无。

## 备注

- `activate()` 派发 `GameEvents.HERO_SELECT_REQUESTED` 或调用 `onHeroSelectRequested` 回调。
- `onHeroSelected(0|1)` 在 `heroSpawnPoint` 实例化对应英雄，调用 `Hero.setHeroVariant()`，随后隐藏召唤碑节点。
- `onHeroSpawned` 回调供 P4 系统接入跟随玩家逻辑。
