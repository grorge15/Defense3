# 场景放置说明（SCENE_PLACEMENT）

> **由 AI 在 P3 任务中维护**；用户在 Cocos Creator 编辑器中按本文拖入预制体。AI **禁止**大规模改写 `Main.scene`。

## 节点层级（Main.scene）

```
Main
├── Camera（透视，见 AI_TASK_LIST §P0）
├── DirectionalLight
├── RoadRoot          ← 塔防段保留
│   ├── Road
│   ├── SideWalls
│   └── Stairs
├── ParkourContent    ← 塔防段 active=false
│   ├── SawTraps
│   ├── PreSpawnEnemies
│   ├── LogSpawn
│   ├── YellowLine
│   └── BlueLine
├── PlayerSpawn
├── SpawnPoints
└── BuildPlots
```

## 预制体放置表

| 空节点 | 预制体路径 | 备注 |
|---|---|---|
| （待 P3 任务填充） | | |

## 编辑器操作 checklist

- [ ] 在编辑器中创建空节点层级（不手写 scene JSON）
- [ ] 从资源管理器拖入 prefab 实例
- [ ] 保存场景后在控制台确认无 missing script
