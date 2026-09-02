# phase-4e-build-system 执行报告

- **计划版本**：1（首版）
- **修订记录摘要**：首版，无相对上一版的步骤/校验点改动
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / AC-G3 / Play todos 待用户）
- **风险等级**：中
- **用户澄清**：A（4.22–4.24 建造编排；4.25 只读核对 PhaseTransition）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 4.22.a BuildSystem + LOG_FIXED + setAvailableCoins | 完成 |
| 4.22.b BUILD_COMPLETE → 按 type 生成 + 计墙 | 完成 |
| 4.22.c BOTH_WALLS_COMPLETE + reveal 塔/兵营 | 完成 |
| 4.22.d MCP 挂组件与引用 | 完成 |
| 4.23.a Wall.spawnSide + Stairs 锚点 | 完成 |
| 4.23.b 与 EnemySpawner BUILD_COMPLETE 兼容 | 完成（同 payload `spawnSide`） |
| 4.23.c Play 手测 | **待用户** |
| 4.24.a towerBasic / barracks → activate | 完成 |
| 4.24.b soldierPrefab MCP 补绑 | 完成 |
| 4.24.c Play 出兵手测 | **待用户** |
| 4.25.v PhaseTransition 无整树关闭 | 完成 |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/building/BuildSystem.ts`（新建） | 解锁链、扣币注入、`BUILD_COMPLETE` 生成墙/塔/兵营、`BOTH_WALLS_COMPLETE` |
| `assets/scripts/building/BuildPlot.ts` | payload 增 `worldPosition`；完成延迟 destroy |
| `assets/scripts/building/Wall.ts` | `@property spawnSide` |
| `assets/scripts/game/SceneSetup.ts` | 可选 `buildSystem` + `_bindBuildSystem` |
| `assets/scenes/Main.scene` | MCP：`Buildings`+`BuildSystem`；`Stairs/WallSpawn_L|R`；绑地块/prefab/锚点/CoinSystem；`Node.*` `_id` 最小补丁 |
| `assets/resources/prefabs/building/pref_tower_basic.prefab` | MCP 绑 `soldierPrefab`→`pref_soldier_ranged` |
| `assets/resources/prefabs/building/pref_barracks.prefab` | MCP 绑 `soldierPrefab`→`pref_soldier_melee` |
| `docs/SCENE_PLACEMENT.md` | BuildSystem 接线与解锁表 |
| `assets/scripts/building/BuildSystem.ts.meta` | 编辑器 refresh 自动生成 |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.22-SCRIPT | **通过** | `class BuildSystem`/`LOG_FIXED`/`BOTH_WALLS_COMPLETE` 匹配 ≥3（实测 5） |
| AC-4.22-SCENE | **通过** | MCP：`GameRoot/World/Buildings/BuildSystem`；wall/tower/barracks 地块与 prefab 引用非 null |
| AC-4.22-COIN | **通过** | `BuildSystem` 调用 `bp.setAvailableCoins(() => this._getBalance())`，接 `CoinSystem.balance` |
| AC-4.23-SPAWN | **通过** | `_spawnWall` → `instantiate(wallPrefab)` @ `wallSpawnLeft/Right` |
| AC-4.23-BOTH | **通过** | `_onBothWallsComplete` → `emitEvent(BOTH_WALLS_COMPLETE)` |
| AC-4.24-TOWER | **通过** | `towerBasic` → `Tower.activate()` |
| AC-4.24-BARRACKS | **通过** | `barracks` → `Barracks.activate()` |
| AC-4.25-V | **通过** | `parkourContent.active = false` 在 PhaseTransition.ts：**0** 匹配 |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-S1 | **通过** | 磁盘 `Main.scene` 无 `"_id": "Node.` |
| AC-S2 | **通过** | `scene-query-node` Buildings `nodeId=c2ehRPx+azqEJmDic2ehRP`（非 `Node.*`） |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` exit 0（见下粘贴） |
| AC-EDITOR | **待用户** | 编辑器打开 Main / 相关 prefab 无红错 |
| AC-G3 | **待用户** | Play：滚木固定→墙地块→建墙→两墙→塔/兵营出兵 |

## verify-mcp-gate 输出

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1: assets/resources/prefabs/character has no Canvas
PASS AC-P1: assets/resources/prefabs/building has no Canvas
PASS AC-P2-CANVAS: prefabs/ui has no Canvas
PASS AC-P2-CAMERA: prefabs/ui has no Camera
PASS AC-P2-SIZE: prefabs/ui has no UITransform 1x1 placeholder
PASS AC-P-FAKE: no default_sprite literal in prefabs
PASS AC-P-EXTRA: no default_sprite in __editorExtras__

MCP gate (machine): ALL PASS
gate exit=0
```

## 失败项与障碍

- 无机器 AC 失败。
- **待用户**：AC-EDITOR、AC-G3、todo 4.23.c / 4.24.c Play 清单。
- **风险备注**：MCP `scene-save` 曾批量写出非法 `Node.*` `_id`；已按 workflow 最小替换 + `assets-reimport-asset` 修复。后续勿在未检查 AC-S1 的情况下反复 save。组件侧仍有少量 `Comp.*` `_id`（非 AC-S1 范围）。

## Play 清单（留给用户）

1. 跑酷至蓝线固定 → 出现 `Plot_Wall_L/R`
2. 站墙地块扣币建完 → 侧锚点出现墙并挡路；该侧停刷
3. 左右墙均完成 → 出现塔+兵营地块；预置怪/黄蓝线按 PhaseTransition 隐藏（ParkourContent 整树仍 active）
4. 建塔/兵营 → 出现建筑并出兵（塔远程 / 营近战周期）
