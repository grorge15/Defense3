# phase-4c-spawn-boss-wall 执行报告

- **计划版本**: 1（首版，无修订记录改动）
- **风险等级**: 中
- **计划状态**: done（机器 AC 全过；Play/编辑器手测待用户）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 4.14.a BossSpawner.ts | 完成 |
| 4.14.b registerTargets | 完成 |
| 4.14.c SceneSetup 触发 | 完成 |
| 4.14.d MCP 挂组件 + 绑 prefab/player | 完成 |
| 4.15.a pickTarget 确认 | 完成（只读，已有 building>hero>player） |
| 4.15.b registerTargets 扩展预留 | 完成（buildings/heroes 空数组） |
| 4.15.c Play Boss 移向玩家 | 阻塞（待用户 AC-PLAY-G2） |
| 4.16.a BuildPlot emit BUILD_COMPLETE | 完成 |
| 4.16.b EnemySpawner stopSide | 完成 |
| 4.16.c 最小 emit（无 Wall instantiate） | 完成 |
| 4.16.d MCP spawnSide L/R | 完成 |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/enemy/BossSpawner.ts` | **新建**；`trySpawnFirst()` + `_spawned` guard + `registerTargets` |
| `assets/scripts/enemy/BossSpawner.ts.meta` | Cocos refresh 自动生成 |
| `assets/scripts/core/GameConfig.ts` | +`bossFirstSpawnDelay = 1.5` |
| `assets/scripts/game/SceneSetup.ts` | +`bossSpawner`；LOG_FIXED 后 scheduleOnce 调 spawn |
| `assets/scripts/building/BuildPlot.ts` | +`spawnSide`；`_completeBuild` emit `BUILD_COMPLETE` |
| `assets/scripts/enemy/EnemySpawner.ts` | 监听 `BUILD_COMPLETE`；`stopSide(left/right)` |
| `assets/scenes/Main.scene` | MCP：`BossSpawn_First<BossSpawner>`；SceneSetup.bossSpawner；墙 spawnSide |
| `docs/SCENE_PLACEMENT.md` | #5 同步：Boss 出生点 + 墙侧别停刷映射 |

## 校验点达成表

### 4.14

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.14-SCRIPT | **通过** | `BossSpawner.ts` 含 `class BossSpawner`、`trySpawnFirst` |
| AC-4.14-SCENE | **通过** | MCP：`BossSpawn_First/BossSpawner`；`bossPrefab` uuid=`1e50bb5b-…` 非空 |

### 4.15

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.15-REG | **通过** | `BossSpawner.trySpawnFirst` 调用 `registerTargets` |
| AC-4.15-PICK | **通过** | `EnemyBoss.pickTarget` building→hero→player 逻辑未改 |

### 4.16

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.16-EMIT | **通过** | `BuildPlot._completeBuild` emit `BUILD_COMPLETE` |
| AC-4.16-STOP | **通过** | `EnemySpawner` 含 `BUILD_COMPLETE`、`stopSide`（≥2 匹配） |
| AC-4.16-SIDE | **通过** | MCP：`Plot_Wall_L.spawnSide=left`；`Plot_Wall_R.spawnSide=right`；文档已更新 |

### 公共

| AC | 结果 | 证据 |
|---|---|---|
| AC-COMPILE | **通过** | `npx tsc --noEmit` 退出码 0 |
| AC-S1 | **通过** | `verify-mcp-gate.ps1` PASS AC-S1（无 `Node.*` _id） |
| AC-S2 | **通过** | MCP `BossSpawn_First` nodeId=`44/e+JEay0irZmnWmSc7vg` |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` 退出码 0，ALL PASS |
| AC-EDITOR | **待用户** | MCP scene-open/save 无报错；须编辑器打开 Main.scene 确认无红错 |
| AC-PLAY-G2 | **待用户** | Boss 从 BossSpawn_First 靠近玩家 |
| AC-PLAY-G3 | **待用户** | 单侧墙完成后该侧停刷 |

## MCP 交付门禁输出

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1/P2/P-FAKE/P-EXTRA: ALL PASS
MCP gate (machine): ALL PASS
```

## 失败项与障碍

无阻塞性失败。4.11–4.13 按 plan 跳过未改动。

## 回滚基线

执行前 git 基线含已修改 `Main.scene`、`SceneSetup.ts` 等；回滚：`git checkout` 本 plan 变更文件 + 删除 `BossSpawner.ts(.meta)`。
