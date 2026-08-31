# P2-007 执行报告 — pref_tower_basic / pref_tower_advanced + Tower.ts

**计划 slug:** p2-007-tower  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/building/Tower.ts` | 新建 | 塔类型、3 挂载点生成小兵、`activate`/`deactivate` 协调 |
| `assets/resources/prefabs/building/pref_tower_basic.prefab` | 新建 | 初级箭塔：Visual + 3×SoldierMount + Tower.ts |
| `assets/resources/prefabs/building/pref_tower_advanced.prefab` | 新建 | 高级箭塔：`towerType=advanced`，更大 mount 间距 |

### pref_tower_* 节点结构

```
pref_tower_* (Root)
├── Tower.ts
├── Canvas/Visual (Sprite + Billboard + SortingOrder2D)
├── SoldierMount_0
├── SoldierMount_1
└── SoldierMount_2
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class Tower` | **通过** |
| AC-3 | 两个 prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | basic prefab 含 `default_sprite` | **通过** |
| AC-7 | setTowerType/spawnSoldiers/activate/TowerType | **通过** |
| AC-8 | soldierMounts/soldierPrefab | **通过** |
| AC-9 | 无 TowerController.ts | **通过** |

**合计：9/9 通过**

## 失败项

无。

## 备注

- `soldierPrefab` 暂留空，待 P2-011 `pref_soldier_ranged` 后联调 `spawnSoldiers()`。
- Cocos CLI 创建 Sprite 时自动插入 Canvas 包装层，功能不受影响。
- `spawnSoldiers()` 通过 `getComponent('Soldier')` 调用 `setDeployment('tower')`，避免对未建 Soldier 的硬依赖。
