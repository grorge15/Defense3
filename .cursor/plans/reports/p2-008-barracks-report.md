# P2-008 执行报告 — pref_barracks + Barracks.ts

**计划 slug:** p2-008-barracks  
**计划版本:** 1（首版，无修订记录）  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 本版相对上一版改动

首版执行，无上一版。计划步骤与校验点均未增删改。

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/building/Barracks.ts` | 新建 | 8 放置点周期出兵、`activate` 立即首波 + 调度 |
| `assets/resources/prefabs/building/pref_barracks.prefab` | 新建 | Visual + 8×SoldierMount + Barracks.ts |

### pref_barracks 节点结构

```
pref_barracks (Root)
├── Barracks.ts
├── Canvas/Visual (Sprite + Billboard + SortingOrder2D)
├── SoldierMount_0 … SoldierMount_7（2×4 网格分布）
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class Barracks` | **通过** |
| AC-3 | pref_barracks.prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | prefab 含 `default_sprite` | **通过** |
| AC-7 | spawnWave/activate/deactivate/reset | **通过** |
| AC-8 | soldierMounts/soldierPrefab | **通过** |
| AC-9 | `GameConfig.barracksSpawnInterval` | **通过** |
| AC-10 | 无 BarracksController.ts | **通过** |

**合计：10/10 通过**

## 失败项

无。

## 备注

- **mount 占用策略**：若某 mount 上已有存活 Soldier，跳过该点（不回收），待下波周期再尝试。
- `soldierPrefab` 暂留空，待 P2-011 `pref_soldier_melee` 后联调。
- `activate()` 立即 `spawnWave()` 一次，再以 `GameConfig.barracksSpawnInterval`（3s）周期重复。
- Cocos CLI 创建 Sprite 时自动插入 Canvas 包装层，功能不受影响。
