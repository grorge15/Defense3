# phase-4h-ultimate-end 执行报告

- **计划版本**：1（首版）
- **修订记录摘要**：首版，无相对上一版的步骤/校验点改动
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / AC-PLAY-G5/G6 待用户）
- **风险等级**：中
- **用户澄清**：A（4.31–4.34；禁止结束 UI prefab；skill prefab 跳过）
- **大招触发方式**：**空格（Space）**；`GameConfig.ultimateOnce=true`（仅一次）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 4.31.a Barrier Collider 非 sensor / 拓展后 active | **完成**（代码 `sensor=false`；拓展由 BuildSystem 激活根） |
| 4.31.b 小怪/Boss 打 Barrier | **完成**（EnemyAI/Minion/Boss） |
| 4.31.c Barrier 死亡不挡路 | **完成**（`_die` 关碰撞 + `active=false`） |
| 4.32.a/b 双高级塔计数 + emit | **完成**（`_advLeftDone`/`_advRightDone`/`_bothAdvEmitted`） |
| 4.33.a UltimateSystem + clearAllEnemies | **完成** |
| 4.33.b onUltimateCast 绑定 | **完成**（解锁后 `_bindPlayerCallback`） |
| 4.33.c 触发方式 | **完成**（空格） |
| 4.33.d MCP 挂组件接线 | **完成**（挂于 GameManager；绑 player/cameraFollow） |
| 4.34.a zoomOut | **完成** |
| 4.34.b 大招后 zoomOut + setGameOver | **完成** |
| 4.34.c 禁止 pref_ui_game_over | **完成**（未创建） |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/game/UltimateSystem.ts` | 已存在：解锁/空格/清场/zoomOut/setGameOver（本 plan 核对） |
| `assets/scripts/enemy/EnemyAI.ts` / `EnemyMinion.ts` / `EnemyBoss.ts` | 已存在：Barrier 索敌与 takeDamage（核对） |
| `assets/scripts/building/Barrier.ts` | 已存在：takeDamage/死亡（核对） |
| `assets/scripts/game/CameraFollow.ts` | 已存在：zoomOut 缓动 `_zoomExtraZ`（核对） |
| `assets/scripts/building/BuildSystem.ts` | 已存在：双侧高级塔计数 + emit（核对） |
| `assets/scripts/core/GameConfig.ts` | 已有 ultimateOnce/zoom/delay（核对） |
| `assets/scenes/Main.scene` | MCP：`GameManager/UltimateSystem` 绑 player + cameraFollow |
| `docs/SCENE_PLACEMENT.md` | §4.H 接线表 + GamePhase 表更新 |

> `pref_skill_ultimate`：**跳过**（大招以逻辑清场为准，报告注明）。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.31 | **通过** | `EnemyAI.findNearestBarrier` + `barrier.takeDamage`；Boss 同；Barrier `_die` 关碰撞 |
| AC-4.32 | **通过** | `_advLeftDone`/`_advRightDone` → `_emitBothAdvancedTowers` → `BOTH_ADVANCED_TOWERS_COMPLETE` |
| AC-4.33-SYS | **通过** | `class UltimateSystem` / `clearAllEnemies` / `BOTH_ADVANCED` ≥2 |
| AC-4.33-PLAYER | **通过** | 解锁后 `player.onUltimateCast = this._onUltimateCast`；MCP 绑 `player` |
| AC-4.34-ZOOM | **通过** | `zoomOut` 缓动 `_zoomExtraZ` / `_zoomFrom`/`_zoomTo` |
| AC-4.34-PHASE | **通过** | `GameManager.instance?.setGameOver()` 于 zoom 延迟后 |
| AC-4.34-NO-UI | **通过** | `pref_ui_game_over.prefab` 不存在 |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-S1 | **通过** | 无 `"_id": "Node.` |
| AC-S2 | **通过** | MCP：`GameManager` nodeId=`vjqxnK6XFFUPnUazL4Kwjg`（非 Node.*） |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` exit 0（见下） |
| AC-EDITOR | **待用户** | 编辑器打开 Main.scene 无红错 |
| AC-PLAY-G5 | **待用户** | Barrier 挡路/可受伤 |
| AC-PLAY-G6 | **待用户** | 双高级塔→空格大招清怪→镜头拉远→阶段 GameOver |

## verify-mcp-gate 输出

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1/P2/P-FAKE/P-EXTRA: ALL PASS
MCP gate (machine): ALL PASS
gate_exit=0
```

## 失败项与障碍

无机器 AC 失败。

**待用户**：AC-EDITOR、AC-PLAY-G5、AC-PLAY-G6。

## Play 清单（留给用户）

1. 拓展完成后靠近 Barrier：小怪停拆障 / Boss 可伤 Barrier；Barrier 死后不挡路
2. 建完左右高级塔 → Console 见 Ultimate 解锁日志
3. 按 **空格** → 全场怪消失、镜头拉远 → 阶段 `game_over`（无结束 UI）
