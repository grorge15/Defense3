# P2-005 执行报告 — pref_build_plot + BuildPlot.ts

**计划 slug:** p2-005-build-plot  
**风险等级:** 中  
**执行时间:** 2026-08-31  

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/building/BuildPlot.ts` | 新建 | Trigger 扣费进度、6 种建造类型、`onBuildComplete` 回调 |
| `assets/resources/prefabs/building/pref_build_plot.prefab` | 新建 | 背景/金币/费用/预览/绿条 UI 结构 + Trigger 碰撞体 |

### pref_build_plot 节点结构

```
pref_build_plot (Root)
├── BuildPlot.ts + BoxCollider2D (sensor=true)
├── Canvas/Background (Sprite)
├── Canvas_001/CoinIcon (Sprite)
├── Canvas_001/CostLabel (Label)
├── Canvas_001/PreviewIcon (Sprite)
└── Canvas_001/FillBar (Sprite, FILLED VERTICAL)
```

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | **通过** |
| AC-2 | `class BuildPlot` | **通过** |
| AC-3 | pref_build_plot.prefab 存在 | **通过** |
| AC-4 | 无 PlayerController/LogController | **通过** |
| AC-5 | 无硬编码击杀次数 | **通过** |
| AC-6 | prefab 含 `default_sprite` | **通过** |
| AC-7 | setBuildType/getBuildCost/onBuildComplete/BuildPlotType | **通过** |
| AC-8 | GameConfig 六项建造费用 | **通过** |
| AC-9 | COIN_CHANGED/onTriggerEnter/fillRange | **通过** |
| AC-10 | 无 BuildPlotController.ts | **通过** |

**合计：10/10 通过**

## 失败项

无。

## 备注

- 金币经济由 `setAvailableCoins()` 与 `COIN_CHANGED` 事件预埋，P4-005 再接全局钱包。
- Cocos CLI 创建 Sprite/Label 子节点时自动插入 Canvas 包装层，功能不受影响。
