---
slug: phase-3-parkour-scene
版本: 1
状态: done
创建: 2026-09-01
---

# §3.1–3.3 跑酷场景修补与验收

## 业务目标

对照 `AI_TASK_LIST.md` **3.1 / 3.2 / 3.3**，在**不重摆**已有跑酷 prefab 的前提下修补 `Main.scene`：补齐 `PlayerSpawn`、将玩家移出 `ParkourContent`、复验实例与 `SceneSetup`/`ParkourLineZone`/`EnemySpawner`/`PhaseTransition` 绑定，并通过 G1 跑酷手测。

> phase-0 / phase-1 计划已手动归档，本 plan **不引用**归档 plan；以磁盘场景 + `AI_TASK_LIST` + `SCENE_PLACEMENT.md` 为准。

**用户澄清（brainstorming）**：选 **A — 修补**，非清空重摆。

## 风险等级

**中** — MCP reparent 玩家实例可能打断 `SceneSetup`/`targetOverrides` 引用；须 `scene-save` 后复验 AC-SCENE-BIND 与 AC-S*。

## 现状差距（磁盘调研）

| 任务 | 文档/清单声称 | 磁盘现状 | 本 plan 动作 |
|---|---|---|---|
| **3.1** | `PlayerSpawn` 在 `World` 下 | `Main.scene` **无** `PlayerSpawn` 节点名 | MCP 新建 `GameRoot/World/PlayerSpawn` |
| **3.2** | 玩家 @ `PlayerSpawn` | `pref_player` 在 `ParkourContent` 子树（与预置怪同级风险） | MCP reparent 至 `PlayerSpawn`，**保留世界坐标** |
| **3.2** | 跑酷 prefab 齐全 | log/saw×3/preEnemy×8/joystick/hint/extend 已实例化 | 核对清单，缺则补实例 |
| **3.3** | 黄蓝线 + 刷怪 + PhaseTransition | 脚本已存在；`PhaseTransition` 已改为**按子节点**隐藏（非整棵 `ParkourContent`） | MCP 复验组件与 `@property`；Play 验收行为 |

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — MCP：新建 `PlayerSpawn`、reparent 玩家、复验/补绑组件（禁止手写整份 JSON）
- 【可写】`docs/SCENE_PLACEMENT.md` — 与磁盘层级对齐；标注 3.1–3.3 验收状态
- 【仅只读参考】`AI_TASK_LIST.md` §3.1–3.3、§G1
- 【仅只读参考】`assets/scripts/game/SceneSetup.ts`、`ParkourLineZone.ts`、`EnemySpawner.ts`、`PhaseTransition.ts`
- 【仅只读参考】已有跑酷 prefab（`pref_player`、`pref_log`、`pref_trap_saw`、`pref_enemy_minion`、`pref_joystick`、`pref_ui_joystick_hint`、`pref_item_log_extend`）

> **不新建** prefab/主脚本（§2.1–2.7、§4.A–C 已交付）；本 plan 仅场景修补 + 文档 + 手测。

## To-dos

- [x] **3.1.a**：MCP 确认 `GameRoot/World` 下存在 `RoadRoot`、`ParkourContent`、`SpawnPoint_Far/Left/Right`、`BuildPlots`、`PlayerSpawn`（缺则建 `PlayerSpawn` 空节点）、`UI`、`Effect`；`GameRoot/SceneSetup`、`GameManager` 存在
- [x] **3.1.b**：更新 `SCENE_PLACEMENT.md` §3.1 层级表与磁盘一致
- [x] **3.2.a**：MCP 将 `pref_player` 实例 **reparent** 到 `GameRoot/World/PlayerSpawn`（保留世界坐标；勿留在 `ParkourContent` 下）— 半成品已完成，本轮复验
- [x] **3.2.b**：核对跑酷静态实例齐全：`LogAnchor/pref_log`、`SawTrap_1~3`、`PreEnemy_1~8`、`LogExtendItemRoot`、`UI/joystick+hint`；缺项 MCP `scene-create-node-by-asset` 补实例
- [x] **3.2.c**：MCP/局部补丁更新 `SceneSetup.player` 指向新玩家路径；`scene-query-component` 六引用非 null
- [x] **3.3.a**：`YellowLine`/`BlueLine` 挂 `ParkourLineZone`（`lineKind` yellow/blue）+ Trigger `Collider2D`；`log` → `LogAnchor` 下滚木
- [x] **3.3.b**：`SpawnPoint_Far` 挂 `EnemySpawner`：`enemyPrefab`、`leftSpawnRoot`→`SpawnPoint_Left`、`rightSpawnRoot`→`SpawnPoint_Right`；`SceneSetup` 已 `setTarget` 玩家
- [x] **3.3.c**：`GameManager` 上 `PhaseTransition`：`parkourContent`、`logNode` 非 null；与 `defense3.md` 分阶段隐藏子节点名一致
- [ ] **3.3.d**：用户 Play 模式 G1 手测 8 项（见 AC-G1）

## 实施步骤

1. **S1 前置门**：MCP `assets-query-path` 确认 Defense3；`scene-open` `Main.scene`；导出当前 `pref_player` 父路径与世界坐标作回滚基线。

2. **S2（3.1）骨架补缺**：在 `GameRoot/World` 下若无 `PlayerSpawn` 则 `scene-create-node-by-type` 创建；对照清单核对其余挂点（不删 `BuildPlots`）。

3. **S3（3.2）玩家迁移**：MCP reparent `pref_player` 至 `PlayerSpawn`；`scene-update-node` 保持 `_lpos`/世界坐标；更新 `SceneSetup.player` 引用。

4. **S4（3.2）实例核对**：按放置表 query 各挂点 prefab 实例；仅对**缺失**项 MCP 实例化（已有不动坐标，除非与玩家重叠）。

5. **S5（3.3）组件复验**：
   - 黄蓝线：`ParkourLineZone` + sensor collider；`log` 绑定滚木。
   - `SpawnPoint_Far`：`EnemySpawner` 及 left/right 根节点引用。
   - `PhaseTransition`：`parkourContent`、`logNode`。
   - `scene-save`。

6. **S6 文档**：`SCENE_PLACEMENT.md` 更新 §3.1–3.3 权威路径表（以 MCP query 为准，删除与磁盘不符的「已绑」行）。

7. **S7 后置门**：`verify-mcp-gate.ps1` + AC-S* + 编辑器无红错。

8. **S8 G1 手测**：用户 Play；报告勾选 AC-G1。

## 校验点

### 3.1 骨架

- [x] [AC-3.1-HIER] MCP 查询存在：`GameRoot/World/PlayerSpawn`、`RoadRoot`、`ParkourContent`、`SpawnPoint_Far`、`UI`、`SceneSetup`
- [x] [AC-3.1-PLAYER-PARENT] MCP/场景查询：`pref_player` 的父链 **不含** `ParkourContent`（须在 `PlayerSpawn` 下）

### 3.2 实例与绑定

- [x] [AC-3.2-INST] MCP 查询：`pref_log`×1、`pref_trap_saw`×3、`pref_enemy_minion`×8、joystick、hint、log_extend 均已实例化
- [x] [AC-3.2-BIND] MCP `scene-query-component`：`SceneSetup` 的 player/log/joystick/joystickHint/parkourContent/enemySpawner **均非 null**

### 3.3 线与刷怪

- [x] [AC-3.3-ZONE] YellowLine/BlueLine 含 `ParkourLineZone`；`log` 引用滚木
- [x] [AC-3.3-SPAWN] `SpawnPoint_Far` 含 `EnemySpawner`；`leftSpawnRoot`/`rightSpawnRoot` 非 null
- [x] [AC-3.3-PHASE] `PhaseTransition.parkourContent` 与 `logNode` 非 null

### MCP 门禁

- [x] [AC-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — 0 匹配
- [x] [AC-S2] MCP `scene-open` 后相关 nodeId 非 `Node.<数字>`
- [x] [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 退出码 0
- [x] [AC-EDITOR] 编辑器打开 `Main.scene` — 无 missing script / 红错

### G1 手测（AC-G1，用户 Play）

1. 开局：玩家、滚木、7~8 怪、3 电锯、摇杆可见  
2. 摇杆仅左右；玩家自动向前推滚木  
3. 远端持续刷怪  
4. 碰电锯：玩家受伤、滚木变短  
5. 拾加长道具：滚木变长  
6. 过黄线：减速蓄力  
7. 过蓝线：够长→固定+左右刷怪；不够→滚出淡出  
8. 固定后全方向移动；电锯隐藏、预置怪/黄蓝线仍可见；滚木在 LogAnchor  

> AC-G1：**待用户 Play**（机器 AC 已全过，计划状态 `done`）。  

## 回滚策略

- **基线**：S1 记录的玩家父节点与世界坐标；build 前 `git stash` 或 commit。
- **失败**：`git checkout -- assets/scenes/Main.scene`；MCP `scene-close` → `assets-reimport-asset` → `scene-open`。

## 修订记录

- v1（2026-09-01）：初始计划；覆盖 AI_TASK_LIST 3.1–3.3；修补策略（补 PlayerSpawn、挪玩家、复验绑定 + G1）；不引用已归档 phase-0/1 plan。
