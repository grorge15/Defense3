# phase-4a-player-combat 执行报告

- **计划版本**：1（首版，无修订改动）
- **状态**：机器 AC 全部通过 → 计划可标 **done**；`AC-PLAY` 待用户手测
- **风险等级**：中
- **基线**：`git HEAD` `6f27c54`；半成品脚本/prefab 已存在，本轮只补缺口

## 修订记录摘要（相对 v1）

首版执行；相对磁盘半成品本轮补了：

| 项 | 半成品 | 本轮 |
|---|---|---|
| Arrow / CameraFollow / CombatSystem / HealthSystem / GameConfig / Player / SceneSetup 脚本 | 已满足 AC | **未重写**，核对通过 |
| `pref_projectile_arrow` | 已存在，无嵌套 Canvas，`Arrow.visualNode`→Visual，`invalid: false` | 核对通过；编辑器打开无 error 日志 |
| `Main.scene` 挂接 | 磁盘无 CameraFollow/CombatSystem 字面/组件 | **MCP 确认编辑器已挂并 `scene-save` 落盘** |
| 相机初始位 | `(0,0,1000)` | MCP 改 `(0,15,15)` 俯角 -45° 并 save |

## To-dos 完成矩阵

| Todo | 结果 |
|---|---|
| 2.9.a Arrow.ts | 完成（已有） |
| 2.9.b pref_projectile_arrow MCP | 完成（已有） |
| 2.9.c AC-P* + 编辑器 | 完成 |
| 4.5.a GameConfig 偏移/平滑 | 完成（已有） |
| 4.5.b CameraFollow.ts | 完成（已有） |
| 4.5.c MCP 挂 Camera + AC-S* | 完成（本轮 save） |
| 4.5.d SceneSetup 补绑 | 完成（已有 `_bindCameraAndCombat`） |
| 4.6.a GameConfig 间隔/箭速 | 完成（已有） |
| 4.6.b CombatSystem | 完成（已有；有弓自动寻敌） |
| 4.6.c Player.tryAttack 委托 | 完成（已有） |
| 4.6.d MCP 挂 CombatSystem + arrowPrefab | 完成（本轮 save；挂在 `GameRoot/Effect`） |
| 4.7.a HealthSystem | 完成（已有） |
| 4.7.b Player 委托 HealthSystem | 完成（已有） |
| 4.7.c SawTrap/EnemyMinion API | 完成（`Player.takeDamage` 仍公开） |

## 修改文件列表（本轮 diff 摘要）

| 文件 | 摘要 |
|---|---|
| `assets/scenes/Main.scene` | 落盘 `CameraFollow`（target→玩家）、`CombatSystem`（arrowPrefab/playerNode/projectileRoot）、SceneSetup 绑 cameraFollow/combatSystem；Camera `_lpos`→`(0,15,15)` |
| `.cursor/plans/reports/phase-4a-player-combat-report.md` | 本报告（新建） |
| 脚本 / 箭 prefab | **本轮无代码/prefab 内容改动**（半成品已合格） |

## 校验点达成表

### 2.9

| AC | 结果 | 证据 |
|---|---|---|
| AC-2.9-SCRIPT | 通过 | `class Arrow` 于 `Arrow.ts` |
| AC-2.9-PREFAB | 通过 | `pref_projectile_arrow.prefab` 存在 |
| AC-2.9-P1 | 通过 | prefab 无 `"_name": "Canvas"` |
| AC-2.9-P3 | 通过 | MCP `invalid: false`，uuid `ff2f2302-dcf6-4a6d-b6ad-b2d846510dd1` |
| AC-2.9-EDITOR | 通过 | `scene-open` prefab 成功；`system-query-logs` error 空 |

### 4.5

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.5-SCRIPT | 通过 | `CameraFollow` + `cameraFollowOffset*` |
| AC-4.5-SCENE | 通过 | MCP：`Camera/CameraFollow`，`target`=`pref_player` |
| AC-4.5-S1 | 通过 | `rg '"_id": "Node\.'` → 0；gate AC-S1 PASS |
| AC-4.5-S2 | 通过 | Camera `nodeId`=`c9DMICJLFO5IeO07EPon7U`（非 `Node.*`） |

### 4.6

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.6-COMBAT | 通过 | `CombatSystem` + `arrowPrefab`；`Player.setHasBow` 门禁 |
| AC-4.6-GATE | 通过 | `tryAttack`：`!player.hasBow` 直接 return |
| AC-4.6-SCENE | 通过 | MCP：`GameRoot/Effect/CombatSystem`，`arrowPrefab` uuid 非空 |

### 4.7

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.7-HEALTH | 通过 | `HealthSystem`：`takeDamage`/`heal` |
| AC-4.7-PLAYER | 通过 | `Player.takeDamage` → `_health.takeDamage`；SawTrap/EnemyMinion 仍调公开 API |

### 公共

| AC | 结果 | 证据 |
|---|---|---|
| AC-COMPILE | 通过 | `npx tsc --noEmit -p tsconfig.json` exit 0 |
| AC-GATE | 通过 | `verify-mcp-gate.ps1` → ALL PASS |
| AC-EDITOR | 通过 | Main.scene / 箭 prefab 打开成功；error 日志空 |
| AC-PLAY | **待用户** | ①相机跟玩家 ②拾弓后箭伤怪 ③受击扣血/死亡 |

## 失败项与障碍

无机器 AC 失败项。

## 风险备注

- 场景内 prefab 实例磁盘上仍有 `_children`/`_components` 的 `null` 占位（Cocos 嵌套实例常见写法）；`verify-mcp-gate` AC-S1b 已 PASS，未另做破坏性清理。
- 打开箭 prefab 时编辑器路径显示 `Canvas/pref_projectile_arrow` 为编辑态包装；**磁盘 prefab 根无嵌套 Canvas**。
