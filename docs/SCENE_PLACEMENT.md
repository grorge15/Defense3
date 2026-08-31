# 场景放置说明（SCENE_PLACEMENT）

> **由 AI 在 P3 任务中维护**；用户在 Cocos Creator 编辑器中按本文拖入预制体。AI **禁止**大规模改写 `Main.scene`。

## 节点层级（Main.scene）

```
Main
├── Camera（透视，见 AI_TASK_LIST §P0）
├── DirectionalLight
├── RoadRoot                    ← 跑酷/塔防共用，始终保留
│   ├── Road
│   ├── SideWalls
│   ├── Stairs
│   └── LogAnchor               ← 固定滚木挂点（两墙后仍可见；勿放 ParkourContent 下）
├── ParkourContent              ← 仅跑酷专属；两墙建完后 active=false
│   ├── SawTraps
│   ├── PreSpawnEnemies
│   ├── YellowLine
│   └── BlueLine
├── PlayerSpawn
├── SpawnPoints
└── BuildPlots
```

## 阶段显隐规则

| 时机 | 行为 |
|------|------|
| 开局 / 跑酷中 | `ParkourContent` 可见；塔/兵营等后续建造垫 `startHidden` |
| 滚木蓝线固定 | emit `LOG_FIXED`；玩家切防守移动；墙地块出现；**不**藏 `ParkourContent` |
| **两侧墙均建完** | emit `BOTH_WALLS_COMPLETE` → `PhaseTransition`：`ParkourContent.active=false`；滚木仍可见；reveal 初级塔+兵营地块 |

## 预制体放置表

| 空节点 | 预制体路径 | 备注 |
|---|---|---|
| `RoadRoot/LogAnchor` | `prefabs/item/pref_log` | 滚木固定后留在场上；勿挂 `ParkourContent` |
| （待 P3 任务填充） | | |

## 编辑器操作 checklist

- [ ] 在编辑器中创建空节点层级（不手写 scene JSON）
- [ ] 滚木实例挂在 `RoadRoot/LogAnchor`（或等价 `ParkourContent` 外节点）
- [ ] `PhaseTransition.parkourContent` 拖入 `ParkourContent`；`logNode` 拖入滚木实例
- [ ] 从资源管理器拖入其余 prefab 实例
- [ ] 保存场景后在控制台确认无 missing script
