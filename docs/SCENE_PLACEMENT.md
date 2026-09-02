# 场景放置说明（SCENE_PLACEMENT）

> **由 AI 维护**（节点清单、坐标、阶段显隐、prefab 关联）。**空挂点**与 **prefab 场景实例**默认经 **Defense3 + Cocos MCP**（`scene-create-node-by-type` / `scene-create-node-by-asset`）按本文落盘；用户仅在坐标或 Inspector 需微调时在编辑器补操作。大规模破坏既有引用的 reparent/重命名须用户批准（见 `defense3-workflow.mdc`「场景与序列化」）。

## 最新场景同步（2026-09-02 #6，phase-4f 英雄与拓展接线）

> build-agent：补齐 `BuildSystem` 4.F 引用；场景内搭 `HeroSelect`（**非** UI prefab）；`HeroShrine.autoSelectOnActivate=true` 便于 G4。

### 已执行

1. `BuildSystem` 绑：`heroShrinePlots`→`Plot_HeroShrine`；`expandPlots`→`Plot_Expand`；`towerAdvancedPlots`→`Plot_TowerAdvanced_L/R`；`heroShrinePrefab` / `heroPrefab01` / `heroPrefab02`；`playerNode`→`pref_player`；`barrierWallL/R` / `barrierLongCenter` / `expandSideWalls`
2. `GameRoot/UI/HeroSelect`（Mask / Card0 / Card1）+ `HeroSelectUI`；`SceneSetup.heroSelectUI` 已绑
3. `pref_ui_hero_select.prefab` 已建（§5.4，**未**强制替换场景 `HeroSelect`；挂场景留给后续）
4. `HeroShrine.autoSelectOnActivate` 默认 **true**（建碑后自动选英雄 0；§5 正式 UI 美术就绪后关闭）
5. `scene-save` → Node.* `_id` 最小补丁 → reimport；`verify-mcp-gate.ps1` ALL PASS

### §4.F 接线表

| 项 | 路径 / 绑定 |
|---|---|
| `BuildSystem` | `GameRoot/World/Buildings` |
| `heroShrinePlots` | `BuildPlots/Plot_HeroShrine` |
| `expandPlots` | `BuildPlots/Plot_Expand` |
| `towerAdvancedPlots` | `Plot_TowerAdvanced_L`、`Plot_TowerAdvanced_R` |
| Prefab | `pref_hero_shrine` / `pref_hero_01` / `pref_hero_02` |
| `playerNode` | `GameRoot/World/pref_player` |
| Barrier 根 | `BarrierWall_L` / `BarrierWall_R` / `BarrierLong_Center` / `ExpandSideWalls` |
| 选英雄 UI | `GameRoot/UI/HeroSelect` + `HeroSelectUI`（场景节点，**无** `.prefab`） |
| `SceneSetup.heroSelectUI` | → 上表 HeroSelectUI |
| 解锁链 | 兵营→reveal 碑 → activate→**autoSelect 0**→`setFollowTarget` + reveal Expand → expand 完成→Barrier/高级塔 |

### Play（AC-G4 待用户）

1. 建碑后应自动出英雄 01 并跟随玩家
2. 英雄近敌可攻击；`Plot_Expand` 可买
3. 拓展完成后 Barrier / ExpandSideWalls / 高级塔地块可见
4. 若要测二选一 UI：Inspector 关 `HeroShrine.autoSelectOnActivate`，再点 Card0/Card1（当前无卡牌贴图，仅占位可点）

---

## 最新场景同步（2026-09-02 #5，phase-4c Boss 生成 + 建墙停刷）

> build-agent 经 MCP 挂 `BossSpawner`、墙地块 `spawnSide`、更新 `SceneSetup.bossSpawner`。

### 已执行

1. `BossSpawn_First` 挂 **`BossSpawner`**：`bossPrefab`→`pref_enemy_boss`；`player`→`pref_player`；`spawnPoint`→自身
2. `SceneSetup.bossSpawner`→`BossSpawn_First<BossSpawner>`（LOG_FIXED 后 `scheduleOnce(bossFirstSpawnDelay)` 调 `trySpawnFirst`）
3. `Plot_Wall_L` `BuildPlot.spawnSide`=`left`；`Plot_Wall_R` `spawnSide`=`right`（建完 emit `BUILD_COMPLETE` → `EnemySpawner.stopSide`）
4. `scene-save`；`verify-mcp-gate.ps1` **ALL PASS**；AC-S2 `BossSpawn_First` nodeId=`44/e+JEay0irZmnWmSc7vg`

### 墙侧别停刷映射（§4.16）

| 地块实例 | `spawnSide` | 停刷目标 |
|---|---|---|
| `BuildPlots/Plot_Wall_L/pref_build_plot` | `left` | `SpawnPoint_Left` 侧 schedule |
| `BuildPlots/Plot_Wall_R/pref_build_plot` | `right` | `SpawnPoint_Right` 侧 schedule |

### Boss 首次生成（§4.14–4.15）

| 节点 | 组件 / 绑定 | 说明 |
|---|---|---|
| `GameRoot/World/BossSpawn_First` | `BossSpawner` | 世界 `(0,0,-50)`；spawn 后 `registerTargets({player, buildings:[], heroes:[]})` |
| `GameRoot/SceneSetup` | `bossSpawner` | 非 null → 上表组件 |

---

## 最新场景同步（2026-09-02 #4，清 InstanceRoot + GameRoot RenderRoot2D）

> 在 #3（Node.* `_id` 修复）之后执行。

### 已执行

1. `scene-close` → 最小结构补丁：13 个 `InstanceRoot` 子 prefab **提升到挂点**，删除空壳 + 其 `UITransform`（`PreEnemy_1` 上残留 Canvas/Widget 一并删）→ `__id__` 重映射
2. 同步 library + `assets-reimport-asset`
3. MCP `scene-add-component`：`GameRoot` 挂 **`cc.RenderRoot2D`**（编辑器自动附带 `cc.UITransform`）
4. `scene-save`；`SceneSetup` 六引用 / `PhaseTransition.logNode` 仍非 null

备份：`assets/scenes/Main.scene.bak-instanceroot`  
报告：`.cursor/plans/reports/instanceroot-remove-2026-09-02.json`

### 权威路径（无 InstanceRoot）

| 挂点 | prefab |
|---|---|
| `PlayerSpawn/pref_player` | ✓ |
| `RoadRoot/LogAnchor/pref_log` | ✓ |
| `ParkourContent/SawTrap_*/pref_trap_saw` | ✓ |
| `ParkourContent/PreEnemy_*/pref_enemy_minion*` | ✓ |
| `BuildPlots/Plot_*/pref_build_plot` | ✓（本就无 InstanceRoot） |

### GameRoot 组件

| 组件 | 状态 |
|---|---|
| `cc.UITransform` | ✓（挂 RenderRoot2D 时自动添加） |
| `cc.RenderRoot2D` | ✓ |

### 仍未处理

| 项 | 说明 |
|---|---|
| 场景根 `pref_projectile_arrow` | 疑似误拖，可另清 |
| `PhaseTransition.defenseContentRoot` | 仍空（可选） |

---

## 最新场景同步（2026-09-02 #3，Node.* `_id` 修复）

> **根因**：磁盘 `Main.scene` 含非法 `"_id": "Node.<数字>"`（MCP 实例化副作用）→ Hierarchy「重复 UUID」过滤 → 看起来像 InstanceRoot 复现 / RenderRoot2D 丢失。

### 已执行修复（AC-S1 补丁链）

1. `scene-close`
2. 最小替换：全部 `Node.\d+`（37 个唯一 token，含 `_id`/`fileId`）→ 合法 22 位压缩 UUID（不改 `__id__` 父子树）
3. 同步 `library/27/2786ab12-….json` + `assets-reimport-asset`
4. `scene-open` 复验：根/实例 `nodeId` 均为压缩 UUID（如 `YfCoSLCS5c1qQby2HEVARh`），**无** `Node.<数字>`
5. `verify-mcp-gate.ps1`：**ALL PASS**（含 AC-S1）

映射表：`.cursor/plans/reports/node-id-remap-2026-09-02.txt`  
备份：`assets/scenes/Main.scene.bak-nodeid`

### 修复后仍存在（未在本步改结构）

| 项 | 状态 |
|---|---|
| 跑酷挂点下 `InstanceRoot` | ✓ **已在 #4 清除** | 见文首「#4」权威路径 |
| `GameRoot` `RenderRoot2D` | 仍未挂 |
| `BuildPlots` 无 Canvas | ✓ 保持 |
| 场景根多出 `pref_projectile_arrow` | MCP 可见（可能是编辑器误拖；可另清） |

### 请你本地确认

1. 关闭再打开 `Main.scene`（或刷新 Hierarchy）
2. Console：**不应再刷**「过滤了重复的 UUID 节点」
3. Hierarchy 应能完整显示；再决定是否删 `InstanceRoot` / 挂 `RenderRoot2D`

---

## 最新场景同步（2026-09-02 #2，用户保存 + MCP `scene-reload` / `scene-open`）

> 用户称已删全部 `InstanceRoot`、并加 `renderRoot` 后保存。MCP 复验磁盘/编辑器状态如下（**以 MCP query 为准**）。**已被 #3 的 Node.* 修复部分覆盖。**

### 结构变更摘要

| 项 | MCP 实测 | 说明 |
|---|---|---|
| `BuildPlots` 下无嵌套 `Canvas`/`Camera` | ✓ | `Plot_*/pref_build_plot` 两级；用户清理已生效 |
| `World` 弓 / Boss / 阻挡物 | ✓ | 无 Canvas 包装；见 §3.4–3.7 |
| `GameRoot` 上 `RenderRoot2D` | ✗ **未挂** | `GameRoot` 组件列表为空；磁盘无 `RenderRoot2D` |
| 名为 `renderRoot` 的子节点 | ✗ **未找到** | Hierarchy：`World` / `UI` / `Effect` / `SceneSetup` |
| `InstanceRoot` 中间层 | ⚠ **仍有 13 处** | 跑酷挂点下仍在（见下表）；BuildPlots **无** InstanceRoot |
| `GameRoot/UI` | ✓ 合法 UI Canvas | 含 `Canvas` + `UICamera` + 摇杆（**应保留**，不是世界物体套娃） |
| `SceneSetup` / `PhaseTransition` | ✓ | 六引用 / parkourContent+logNode 仍绑 |
| 主相机 `Camera` | `(480, 320, 1000)`，rx=-45° | 待按道路微调 |

### `InstanceRoot` 仍存在的路径（MCP / 磁盘）

| 路径 |
|---|
| `PlayerSpawn/InstanceRoot/pref_player` |
| `RoadRoot/LogAnchor/InstanceRoot/pref_log` |
| `ParkourContent/SawTrap_1~3/InstanceRoot/pref_trap_saw` |
| `ParkourContent/PreEnemy_1~8/InstanceRoot/pref_enemy_minion*` |
| （加长道具 / BuildPlots / 弓 / 阻挡物 **无** InstanceRoot） |

> 若编辑器里已看不到 `InstanceRoot`，请再 **Ctrl+S** 并确认未打开旧场景；然后说「已保存」，再跑一次 MCP 同步。

### 预防约定（MCP / Agent 强制）

| 问题 | 根因 | 预防 |
|---|---|---|
| 世界物体下套 `Canvas`+`Camera` | `assets-create-asset-by-type` / 部分 `scene-create-node-by-asset` 把 Sprite/Label 当 UI | 世界实例化后 **立即** query 父链；发现 Canvas 则拆包装、提升 prefab；**禁止**标 done |
| 挂点下多一层 `InstanceRoot` | MCP 往空挂点实例化时常见中间空节点 | 目标结构：`挂点/pref_*`（**不要** `挂点/InstanceRoot/pref_*`）；交付前 `rg '"_name": "InstanceRoot"' Main.scene` → 0（或仅文档允许的例外） |
| `RenderRoot2D` | 2D 批渲染根，**不**阻止 CLI 插 Canvas | 可挂在 `GameRoot` 或 `World` 以改善世界 2D 渲染；**不能**替代上述拆包装纪律 |

### `BuildPlots` 当前层级（MCP 权威）

```
GameRoot/World/BuildPlots
├── Plot_Wall_L/pref_build_plot          ← inactive
├── Plot_Wall_R/pref_build_plot          ← inactive
├── Plot_Barracks/pref_build_plot        ← inactive
├── Plot_HeroShrine/pref_build_plot      ← inactive
├── Plot_Tower_1/pref_build_plot         ← inactive（towerBasic）
├── Plot_Tower_2/pref_build_plot         ← inactive（towerBasic）
├── Plot_TowerAdvanced_L/pref_build_plot ← inactive（towerAdvanced）
├── Plot_Expand/pref_build_plot          ← inactive（expandArea）
└── Plot_TowerAdvanced_R/pref_build_plot ← inactive（towerAdvanced）
```

### `World` 其它 §3 实例（MCP 权威）

| 路径 | prefab | 本地坐标 | active |
|---|---|---|---|
| `GameRoot/World/pref_item_bow_001` | `pref_item_bow` | `(3, 0, -68)` | true |
| `GameRoot/World/BossSpawn_First` | 空节点 + **`BossSpawner`** | `(0, 0, -50)` | true |
| `GameRoot/World/BarrierWall_L/pref_barrier_wall` | `pref_barrier_wall` | 挂点 `(-8, 0, 50)` | 实例 inactive |
| `GameRoot/World/BarrierWall_R/pref_barrier_wall` | `pref_barrier_wall` | 挂点 `(8, 0, 50)` | 实例 inactive |
| `GameRoot/World/BarrierLong_Center/pref_barrier_long` | `pref_barrier_long` | 挂点 `(0, 0, 55)` | 实例 inactive |
| `GameRoot/World/ExpandSideWalls` | 空节点 | `(0, 0, 52)` | **false** |

## Phase 0：Main.scene 目标层级（phase-0-bootstrap，MCP + 迁移）

> **2026-09-01** 自 P3 扁平骨架迁移至 `GameRoot → World` 结构；P3 子树坐标与 UUID 保留。

### 根层级（当前权威）

```
Main
├── Camera                    ← 原 Main Camera；透视 (0,15,15) 俯角约 45°
├── Main Light                ← 3D 模板灯光（扩展保留）
├── GameRoot
│   ├── World
│   │   ├── RoadRoot          ← 迁移（含 Road/SideWalls/Stairs/LogAnchor）
│   │   ├── ParkourContent    ← 迁移；SawTrap_1~3；PreEnemy_1~8；YellowLine；BlueLine
│   │   ├── SpawnPoint_Far    ← 原 SpawnPoints/SpawnFar 子节点迁入
│   │   ├── SpawnPoint_Left   ← 原 SpawnPoints/SpawnLeft 子节点迁入
│   │   ├── SpawnPoint_Right  ← 原 SpawnPoints/SpawnRight 子节点迁入
│   │   ├── PlayerSpawn
│   │   ├── BuildPlots        ← §3.5–3.6 建造地块（pref_build_plot 直接挂 Plot_*）
│   │   ├── pref_item_bow_001 ← §3.4
│   │   ├── BossSpawn_First   ← §3.4
│   │   ├── BarrierWall_L/R、BarrierLong_Center、ExpandSideWalls ← §3.7
│   ├── UI                    ← Canvas；joystick + hint + **pref_ui_coin_001**（§5.1）
│   ├── Effect                ← 空容器
│   └── SceneSetup            ← Phase 1 接线（不 instantiate 静态关卡）
└── GameManager               ← GameManager + PhaseTransition + UltimateSystem
```

### §5.1 金币数量 UI（2026-09-02 phase-5-5-1-coin-ui）

| 项 | 路径 / 说明 |
|---|---|
| Prefab | `assets/resources/prefabs/ui/pref_ui_coin.prefab`（Background/Icon/Amount；无 Canvas/Camera） |
| 脚本 | `CoinUI.ts`：听 `COIN_CHANGED(delta, balance)`；开局 `CoinSystem.balance` |
| 场景实例 | `GameRoot/UI/pref_ui_coin_001`；位姿约 `(-400, 280, 0)` 左上 HUD |
| 资源 | Icon←`金币.png`；Background←`框.png` |
| 非本任务 | UIManager（5.9）；飞币动画（§6） |

### §5.3 / §5.4 UI Prefab（2026-09-02 phase-5-5-3-4-ui-prefabs）

| Prefab | 说明 | 入场景 |
|---|---|---|
| `pref_ui_joystick_hint` | Label「← →」+ `JoystickHintUI`；280×60；`hintRoot`→根 | 既有实例可保留；本 plan **不新增** |
| `pref_ui_hero_select` | Mask→Card0→Card1→Finger；`HeroSelectUI.fingerNode` 已绑；卡面/图标 `@property` 可空 | **本 plan 不拖入**；场景仍可用临时 `HeroSelect` |

### §5.5–5.8 UI Prefab（2026-09-02 phase-5-5-5-to-5-8-ui）

| Prefab | 结构 / 脚本 | 入场景 |
|---|---|---|
| `pref_ui_hp_bar_player` | Bg+Fill（绿）；`HpBarUI` | **不挂**；运行时绑 `targetNode`/`followAnchor` |
| `pref_ui_hp_bar_enemy` | 白底红 Fill；`hideWhenFull=true` | 同上 |
| `pref_ui_hp_bar_boss` | Bg+Buffer 白+Fill 红+Value Label；缓冲缓动读 `GameConfig.hpBarBufferLerpSpeed` | 同上 |
| `pref_ui_game_over` | Mask(40%)+Title+NextButton；`GameOverUI` 听 `GameOver` | §5.9 已挂 `GameRoot/UI/pref_ui_game_over` |

### §5.9 UIManager（2026-09-02 phase-5-5-9-ui-manager）

| 项 | 说明 |
|---|---|
| 节点 | `GameRoot/UI/UIManager` + `UIManager.ts` |
| 已绑 | coinUI / joystick / joystickHint / heroSelectUI（场景 HeroSelect）/ gameOverUI / player；三血条 prefab + gameOverPrefab |
| 运行时 | `playerHpBar` 由 `playerHpBarPrefab` spawn；`spawnHpBar('enemy'\|'boss', target, anchor)` |
| 阶段 | GameOver → 显示结束 UI、关摇杆；其余保持金币 HUD；英雄选择仍由 HeroSelectUI 自管 |

## Phase 1：跑酷段 MCP 装配（phase-1-parkour v2）

> **2026-09-01** build-agent 经 Defense3 + Cocos MCP 按放置表实例化静态 prefab 并挂组件；用户仅微调坐标/Inspector。

### 用户保存同步（2026-09-02，见文首「最新场景同步」）

> 详细绑定与 BuildPlots 结构以 **§最新场景同步（2026-09-02）** 为准；下列为跑酷段接线摘要。

#### `GameRoot/SceneSetup` → `SceneSetup`

| `@property` | 绑定目标节点路径 | 状态 |
|---|---|---|
| `player` | `GameRoot/World/PlayerSpawn/pref_player` | ✓ 已绑（#4 无 InstanceRoot） |
| `log` | `GameRoot/World/RoadRoot/LogAnchor/pref_log` | ✓ 已绑 |
| `joystick` | `GameRoot/UI/pref_joystick_001` | ✓ 已绑 |
| `joystickHint` | `GameRoot/UI/pref_ui_joystick_hint_001` | ✓ 已绑 |
| `parkourContent` | `GameRoot/World/ParkourContent` | ✓ 已绑 |
| `enemySpawner` | `GameRoot/World/SpawnPoint_Far`（`EnemySpawner` 组件） | ✓ 已绑 |

#### `GameManager` → `PhaseTransition`

| `@property` | 绑定目标节点路径 | 状态 |
|---|---|---|
| `parkourContent` | `GameRoot/World/ParkourContent` | ✓ 已绑（按子节点分阶段隐藏） |
| `logNode` | `GameRoot/World/RoadRoot/LogAnchor/pref_log` | ✓ 已绑 |
| `defenseContentRoot` | — | 未绑（可选） |

#### 跑酷物件分阶段显隐（`PhaseTransition` + `defense3.md`）

| 时机 | 隐藏子节点 | 仍可见 |
|---|---|---|
| `LOG_FIXED`（滚木固定，跑酷段结束） | `SawTrap_1~3`、`LogExtendItemRoot` | `PreEnemy_1~8`、`YellowLine`、`BlueLine` |
| `BOTH_WALLS_COMPLETE` | `PreEnemy_1~8`、`YellowLine`、`BlueLine` | `ParkourContent` 根节点保持 active；滚木在 `LogAnchor` |

> **禁止** `ParkourContent.active=false`。

#### `ParkourLineZone`（黄蓝线）

| 节点 | `lineKind` | `log` 绑定 | 本地 Z |
|---|---|---|---|
| `GameRoot/World/ParkourContent/YellowLine` | `yellow` | `LogAnchor/pref_log` | **-72** |
| `GameRoot/World/ParkourContent/BlueLine` | `blue` | `LogAnchor/pref_log` | **-78** |

### MCP 已实例化 checklist

| 挂点 | prefab / 组件 | 状态 |
|---|---|---|
| `GameRoot/World/PlayerSpawn` | `pref_player` ×1 | ✓ 已实例化（#4 无 InstanceRoot） |
| `GameRoot/World/RoadRoot/LogAnchor` | `pref_log` ×1 | ✓ 已实例化（勿放 ParkourContent） |
| `ParkourContent/SawTrap_1~3` | `pref_trap_saw` ×3 | ✓ 已实例化 |
| `ParkourContent/PreEnemy_1~8` | `pref_enemy_minion` ×8 | ✓ 已实例化 |
| `ParkourContent/LogExtendItemRoot` | `pref_item_log_extend_001` ×1 | ✓ 已实例化 |
| `GameRoot/UI` | `pref_joystick_001` + `pref_ui_joystick_hint_001` | ✓ 已实例化 |
| `YellowLine` / `BlueLine` | `ParkourLineZone` + `BoxCollider2D` Trigger | ✓ 已挂；`log` → `pref_log` |
| `GameRoot/SceneSetup` | `SceneSetup` | ✓ 六引用均已绑（见上表） |
| `SpawnPoint_Far` | `EnemySpawner` | ✓ 已挂（仅运行时刷 Far） |
| `GameManager` | `PhaseTransition` | ✓ `parkourContent` / `logNode` 已绑 |

### 用户可微调

- 电锯 / 预置怪 / 加长道具沿道路的本地坐标
- 摇杆与 hint 在 Canvas 下的锚点位置
- 黄蓝线 Z（当前约 Yellow `-72` / Blue `-78`）

### 节点迁移映射（旧路径 → 新路径）

| 旧路径 | 新路径 | 备注 |
|---|---|---|
| `Main Camera` | `Camera` | 重命名；仍在 Main 根下 |
| `RoadRoot` | `GameRoot/World/RoadRoot` | reparent，本地坐标不变 |
| `ParkourContent` | `GameRoot/World/ParkourContent` | reparent |
| `ParkourContent/SawTraps` | `ParkourContent/SawTrap_1~3` | 拆为 3 空节点 |
| `ParkourContent/PreSpawnEnemies/PreSpawn_*` | `ParkourContent/PreEnemy_1~2` | 重命名 + reparent 至 ParkourContent |
| — | `ParkourContent/PreEnemy_3~8` | 新建空节点 |
| `SpawnPoints/SpawnFar/*` | `SpawnPoint_Far/*` | 子节点迁入新父 |
| `SpawnPoints/SpawnLeft/*` | `SpawnPoint_Left/*` | 同上 |
| `SpawnPoints/SpawnRight/*` | `SpawnPoint_Right/*` | 同上 |
| `SpawnPoints`（空壳） | — | 迁移后删除 |
| `PlayerSpawn` | `GameRoot/World/PlayerSpawn` | reparent |
| `BuildPlots` | `GameRoot/World/BuildPlots` | reparent |

> **SceneSetup / PhaseTransition**：`parkourContent` 等 `@property` 须指向 `GameRoot/World/ParkourContent`（非旧根级路径）。

### 启动场景

在 Cocos 编辑器：**项目设置 → 项目数据 → 启动场景** 设为 `assets/scenes/Main.scene`。

### 2D 物理

须在编辑器 **项目设置 → 功能裁剪** 确认 2D 物理已启用（build 无法代验）。

---

## P3-001：Main.scene 空骨架（MCP 已创建，已由 Phase 0 重构）

> **`assets/scenes/Main.scene` 已由 Defense3 + Cocos MCP 创建**（`scene-create` 3d 模板 + 空骨架节点 + 透视相机配置）。下表为用户验证 checklist（非从零自建）。

- [ ] 在 Cocos Creator 中 **打开** `assets/scenes/Main.scene`，确认可正常加载
- [ ] Hierarchy 可见根骨架：`Main Camera` / `Main Light`（3d 模板等价相机/灯光）及 `RoadRoot` / `ParkourContent` / `PlayerSpawn` / `SpawnPoints` / `BuildPlots`
- [ ] 主相机为透视；position ≈ `(0, 15, 15)`；俯角约 45° 看向道路中心
- [ ] 控制台确认 **无 missing script**
- [ ] （后续 P3 任务）再按预制体放置表拖入实例

## 相机参数表（§P0-A #5）

| 项 | 设计参考值 | **当前场景实测**（MCP 2026-09-01） | 说明 |
|---|---|---|---|
| Projection | **透视（Perspective）** | 透视 | **禁止正交（Orthographic）** |
| 俯角 | 约 **45°** | rotation.x = **-45°** | 相机朝下看向地面/道路 |
| Position | 约 **`(0, 15, 15)`** | **`(480, 320, 1000)`** | 用户保存后实测；若与道路不对齐可在编辑器微调 |
| lookAt | **道路中心** | — | 主相机看向 `RoadRoot` / 道路中段附近 |
| 关联 | `AI_TASK_LIST.md` §P0-A #5 | 与 P0 渲染约定一致 | |

## 节点层级（Main.scene 完整子树）

> 根层级见 **Phase 0** 节；以下为 `World` 下子树细节（P3-002/003/004 已建）。

```
Main
├── Camera（透视，见「相机参数表」）
├── Main Light
├── GameRoot
│   ├── World
│   │   ├── RoadRoot
│   │   │   ├── Road / SideWalls / Stairs / LogAnchor
│   │   ├── ParkourContent
│   │   │   ├── SawTrap_1 / SawTrap_2 / SawTrap_3
│   │   │   ├── PreEnemy_1 ~ PreEnemy_8
│   │   │   ├── YellowLine / BlueLine
│   │   ├── SpawnPoint_Far / SpawnPoint_Left / SpawnPoint_Right
│   │   ├── PlayerSpawn
│   │   └── BuildPlots
│   ├── UI（Canvas；Phase 1 已挂 joystick + hint）
│   ├── Effect（空）
│   └── SceneSetup
└── GameManager（+ PhaseTransition）
```

## Phase 1：跑酷可玩链（MCP 已交付）

见上文 **「Phase 1：跑酷段 MCP 装配」** 表。机器门禁：`powershell -File .cursor/scripts/verify-mcp-gate.ps1` 须退出码 0；Play 手测见计划 G1。

## Phase 3：§3.4–3.7 塔防段场景布局（phase-3-scene-layout v2）

> **2026-09-02** 用户保存后 MCP 复验：`BuildPlots` / 阻挡物 / 弓 **已无** CLI 插入的 `Canvas`/`Camera` 包装；`pref_build_plot` 直接作为 `Plot_*` 子节点。

### §3.4 战斗引导摆场

| 节点路径 | prefab / 类型 | 建议本地坐标 (World) | 初始显隐 | 解锁时机（§4） |
|---|---|---|---|---|
| `GameRoot/World/pref_item_bow_001` | `pref_item_bow` ×1 | `(3, 0, -68)` | active | 跑酷末可拾取 |
| `GameRoot/World/BossSpawn_First` | 空节点 + `BossSpawner` | `(0, 0, -50)` | active | §4.C LOG_FIXED 后首次 spawn |

### §3.5 建造地块（墙 / 初级塔 / 兵营）

| 挂点 | prefab 实例路径 | `buildType` | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|---|
| `Plot_Wall_L` | `BuildPlots/Plot_Wall_L/pref_build_plot` | `wall` | `spawnSide=left` | `(-6, 0, 5)` | **inactive** | `LOG_FIXED` 后 BuildSystem reveal |
| `Plot_Wall_R` | `BuildPlots/Plot_Wall_R/pref_build_plot` | `wall` | `spawnSide=right` | `(6, 0, 5)` | **inactive** | 同上 |
| `Plot_Tower_1` | `BuildPlots/Plot_Tower_1/pref_build_plot` | `towerBasic` | `(-4, 0, 25)` | **inactive** | 两墙完成后 |
| `Plot_Tower_2` | `BuildPlots/Plot_Tower_2/pref_build_plot` | `towerBasic` | `(4, 0, 25)` | **inactive** | 两墙完成后 |
| `Plot_Barracks` | `BuildPlots/Plot_Barracks/pref_build_plot` | `barracks` | `(-10, 0, 15)` | **inactive** | 两墙完成后 |

命名映射：`Plot_Tower_1/2` 对应设计文档 `Plot_TowerBasic_L/R`。

### §3.6 英雄碑与拓展地块

| 挂点 | prefab 实例路径 | `buildType` | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|---|
| `Plot_HeroShrine` | `BuildPlots/Plot_HeroShrine/pref_build_plot` | `heroShrine` | `(10, 0, 15)` | **inactive** | 兵营建成后 §4.F |
| `Plot_Expand` | `BuildPlots/Plot_Expand/pref_build_plot` | `expandArea` | `(0, 0, 45)` | **inactive** | 选英雄后 §4.F |

### §3.7 拓展防守区

| 挂点 | prefab / 类型 | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|
| `BarrierWall_L` | `BarrierWall_L/pref_barrier_wall` | `(-8, 0, 50)` | 实例 **inactive** | `Plot_Expand` 购买后 §4.H |
| `BarrierWall_R` | `BarrierWall_R/pref_barrier_wall` | `(8, 0, 50)` | 实例 **inactive** | 同上 |
| `BarrierLong_Center` | `BarrierLong_Center/pref_barrier_long` | `(0, 0, 55)` | 实例 **inactive** | 同上 |
| `ExpandSideWalls` | 空节点 | `(0, 0, 52)` | 节点 **inactive** | 拓展解锁后 |
| `Plot_TowerAdvanced_L` | `BuildPlots/Plot_TowerAdvanced_L/pref_build_plot` | `towerAdvanced` | `(0, 0, 35)` | **inactive** | 拓展地块解锁后 |
| `Plot_TowerAdvanced_R` | `BuildPlots/Plot_TowerAdvanced_R/pref_build_plot` | `towerAdvanced` | `(8, 0, 35)` | **inactive** | 同上 |

> **世界建造地块禁止嵌套 Canvas/Camera**（AC-P1）；实例化后须保持 `Plot_*/pref_build_plot` 两级结构。

### MCP 已实例化 checklist（§3.4–3.7，2026-09-02 复验）

| AC | 项 | 状态 |
|---|---|---|
| 3.4 | `pref_item_bow_001` 于 `World` 下（无 Canvas 包装） | ✓ |
| 3.4 | `BossSpawn_First` | ✓ |
| 3.5 | 墙/塔/兵营 `pref_build_plot` ×5，直接挂 `Plot_*` | ✓ |
| 3.6 | 英雄碑 + `Plot_Expand` build_plot | ✓ |
| 3.7 | `pref_barrier_wall` ×2、`pref_barrier_long` ×1 | ✓ |
| 3.7 | `ExpandSideWalls` 空节点 | ✓ |
| 3.7 | `Plot_TowerAdvanced_L/R` build_plot | ✓ |
| — | `BuildPlots` 下 **0** 个 `Canvas`/`Camera` | ✓ 用户清理后 MCP 确认 |

### 阶段显隐（与 §3.5–3.7 布局）

| 时机 | reveal（BuildSystem §4.E / phase-4e） |
|---|---|
| `LOG_FIXED` | `Plot_Wall_L/R`（`pref_build_plot.active=true`） |
| 单侧墙 `BUILD_COMPLETE` | instantiate `pref_wall` @ `Stairs/WallSpawn_L|R` → `Wall.activate()`；`EnemySpawner.stopSide`（既有） |
| `BOTH_WALLS_COMPLETE` | `Plot_Tower_1/2`、`Plot_Barracks`；PhaseTransition 藏预置怪/黄蓝线 |
| 塔/兵营 `BUILD_COMPLETE` | instantiate `pref_tower_basic` / `pref_barracks` → `activate()` |
| 兵营建成 | `Plot_HeroShrine`（§4.F / phase-4f） |
| 选英雄 | `Plot_Expand`（§4.F 已接线；默认 autoSelect） |
| 拓展地块建成 | `BarrierWall_*`、`BarrierLong_Center`、`ExpandSideWalls`、`Plot_TowerAdvanced_L/R` |

### BuildSystem 场景接线（2026-09-02 phase-4e）

| 项 | 路径 / 绑定 |
|---|---|
| 组件挂点 | `GameRoot/World/Buildings` + `BuildSystem` |
| `wallPlots` | `Plot_Wall_L`、`Plot_Wall_R` |
| `towerPlots` | `Plot_Tower_1`、`Plot_Tower_2` |
| `barracksPlots` | `Plot_Barracks` |
| Prefab | `pref_wall` / `pref_tower_basic` / `pref_barracks` |
| 墙锚点 | `RoadRoot/Stairs/WallSpawn_L` `(-6,0,5)`、`WallSpawn_R` `(6,0,5)` |
| `buildingRoot` | `GameRoot/World/Buildings` |
| `coinSystem` | `GameRoot/Effect/CoinSystem` |
| `SceneSetup.buildSystem` | → 上述 BuildSystem |
| `pref_tower_basic.soldierPrefab` | `pref_soldier_ranged` |
| `pref_barracks.soldierPrefab` | `pref_soldier_melee` |

### §4.F 英雄与拓展接线（2026-09-02 phase-4f）

| 项 | 路径 / 绑定 |
|---|---|
| 组件挂点 | `GameRoot/World/Buildings` + `BuildSystem`（沿用 4e） |
| `heroShrinePlots` | `BuildPlots/Plot_HeroShrine` |
| `expandPlots` | `BuildPlots/Plot_Expand` |
| `towerAdvancedPlots` | `Plot_TowerAdvanced_L`、`Plot_TowerAdvanced_R` |
| Prefab | `pref_hero_shrine` / `pref_hero_01` / `pref_hero_02` |
| `playerNode` | `GameRoot/World/pref_player` |
| Barrier 根 | `BarrierWall_L`、`BarrierWall_R`、`BarrierLong_Center`、`ExpandSideWalls` |
| 选英雄 UI | 场景仍可用 `GameRoot/UI/HeroSelect`；正式 prefab：`prefabs/ui/pref_ui_hero_select`（§5.4 已建，本阶段可不入场景） |
| G4 默认 | `HeroShrine.autoSelectOnActivate=true`（跳过 UI 直接选英雄 0）；正式二选一手测请关 |
| 解锁链 | 兵营 → reveal `Plot_HeroShrine` → 建碑 activate → 选英雄 → reveal `Plot_Expand` → expandArea → Barrier / 高级塔 |
| 英雄弹道 | `pref_hero_01/02.projectilePrefab01/02` 已绑（不改攻击算法） |

---

## Phase 3：§3.1–3.3 跑酷场景修补验收（phase-3-parkour-scene v1）

> **2026-09-01** build-agent 对照 `AI_TASK_LIST` §3.1–3.3：**修补策略**（不重摆）。磁盘半成品已含 `PlayerSpawn` 与玩家迁出；本轮 MCP 复验 + `scene-save` + 门禁。

### §3.1 骨架（MCP 权威）

| 节点 | 路径 | 状态 |
|---|---|---|
| `PlayerSpawn` | `GameRoot/World/PlayerSpawn`（本地 Z≈**-80**） | ✓ 已存在 |
| `RoadRoot` / `ParkourContent` / `BuildPlots` | `GameRoot/World/*` | ✓ |
| `SpawnPoint_Far/Left/Right` | `GameRoot/World/*` | ✓ |
| `UI` / `Effect` / `SceneSetup` | `GameRoot/*` | ✓ |
| `GameManager` | 场景根 `GameManager` | ✓ |

### §3.2 玩家父链与实例

| 项 | 权威路径 | 状态 |
|---|---|---|
| 玩家实例 | `GameRoot/World/PlayerSpawn/pref_player` | ✓ 父链**不含** `ParkourContent` / `InstanceRoot` |
| 滚木 | `GameRoot/World/RoadRoot/LogAnchor/pref_log` | ✓ |
| 电锯 ×3 | `ParkourContent/SawTrap_*/pref_trap_saw` | ✓ |
| 预置怪 ×8 | `ParkourContent/PreEnemy_*/pref_enemy_minion*` | ✓ |
| 加长道具 | `ParkourContent/LogExtendItemRoot/pref_item_log_extend_001` | ✓ |
| 摇杆 / hint | `GameRoot/UI/pref_joystick_001`、`pref_ui_joystick_hint_001` | ✓ |

`SceneSetup` 六引用（MCP `scene-query-component`）：player / log / joystick / joystickHint / parkourContent / enemySpawner **均非 null**（磁盘上跨 prefab 引用经 `cc.TargetOverrideInfo` 落盘，字段字面量可为 null）。

### §3.3 线 / 刷怪 / 阶段

| 组件 | 关键绑定 | 状态 |
|---|---|---|
| `YellowLine` / `BlueLine` `ParkourLineZone` | `lineKind` yellow/blue；`log`→滚木；`BoxCollider2D.sensor=true`；Z **-72** / **-78** | ✓ |
| `SpawnPoint_Far` `EnemySpawner` | `enemyPrefab` 非空；`leftSpawnRoot`→`SpawnPoint_Left`；`rightSpawnRoot`→`SpawnPoint_Right` | ✓ |
| `PhaseTransition` | `parkourContent`→`ParkourContent`；`logNode`→`pref_log` | ✓ |

### 验收勾选

- [x] AC-3.1-HIER / AC-3.1-PLAYER-PARENT / AC-3.2-INST / AC-3.2-BIND / AC-3.3-*（机器）
- [x] AC-S1 / AC-S2 / AC-GATE / AC-EDITOR（`verify-mcp-gate.ps1` 退出码 0；`scene-open` 后 error 日志空）
- [ ] AC-G1 Play 手测 8 项（**待用户**）

## P3-002：道路分层（MCP 已创建）

> `RoadRoot` / `ParkourContent` 子树空节点已由 MCP 创建。滚木 **必须** 挂在 `RoadRoot/LogAnchor`，**勿放 ParkourContent**。跑酷物件按子节点分阶段隐藏（见「阶段显隐规则」），**禁止**整棵关闭 `ParkourContent`。

### 子树职责与坐标建议

| 节点路径 | 职责 | 建议坐标（世界/本地） | 阶段显隐 |
|---|---|---|---|
| `RoadRoot` | 道路/侧墙/楼梯/滚木挂点根；始终保留 | `(0,0,0)` | 始终可见 |
| `RoadRoot/Road` | 主道路 mesh/碰撞占位 | `(0,0,0)` | 始终可见 |
| `RoadRoot/SideWalls` | 道路两侧墙体占位 | `(0,0,0)` | 始终可见 |
| `RoadRoot/Stairs` | 左右侧楼梯占位 | `(0,0,0)` | 始终可见 |
| `RoadRoot/LogAnchor` | **滚木实例挂点**（禁止挂到 ParkourContent） | 初值本地 `(0,0,5)` | 始终可见 |
| `ParkourContent` | 跑酷专属内容根（**勿**整棵 `active=false`） | `(0,0,0)` | 根节点始终 active |
| `ParkourContent/SawTrap_1~3` | 电锯陷阱挂点 | `(0,0,0)` | `LOG_FIXED` 后隐藏 |
| `ParkourContent/LogExtendItemRoot` | 滚木加长道具挂点 | 道边 | `LOG_FIXED` 后隐藏 |
| `ParkourContent/PreEnemy_1~8` | 跑酷预置怪挂点 | 见刷怪点表 | `BOTH_WALLS_COMPLETE` 后隐藏 |
| `ParkourContent/YellowLine` | 黄线触发区 | 本地 Z **-72** | 滚木固定后仍可见；两墙后隐藏 |
| `ParkourContent/BlueLine` | 蓝线（滚木固定）触发区 | 本地 Z **-78** | 滚木固定后仍可见；两墙后隐藏 |

## 阶段显隐规则

| 时机 | 行为 |
|------|------|
| 开局 / 跑酷中 | `ParkourContent` 及子节点均可见；塔/兵营等后续建造垫 `startHidden` |
| 滚木蓝线固定（`LOG_FIXED`） | 玩家切防守移动；墙地块出现；**仅隐藏** `SawTrap_1~3`、`LogExtendItemRoot`；预置怪/黄蓝线仍可见 |
| **两侧墙均建完**（`BOTH_WALLS_COMPLETE`） | `PhaseTransition` 隐藏 `PreEnemy_1~8`、`YellowLine`、`BlueLine`；滚木仍可见；reveal 初级塔+兵营地块 |

> 实现：`PhaseTransition` 监听 `LOG_FIXED` / `BOTH_WALLS_COMPLETE`，按子节点名 `active=false`；**禁止** `ParkourContent.active=false`。

### GamePhase 接线（2026-09-02 phase-4g）

| 触发 | `GameManager.setPhase` |
|------|------------------------|
| 开局 `SceneSetup.onLoad` | `RunParkour` |
| `LOG_FIXED`（`SceneSetup`） | `CombatGuide`（轻量 `CombatGuideController` 日志/可选弓标记；BossSpawner 仍由 SceneSetup 延迟触发） |
| `BOTH_WALLS_COMPLETE`（`PhaseTransition`） | `BuildPhase2` |
| 拓展完成 `expandArea`（`BuildSystem`） | `DefensePhase` |
| `BOTH_ADVANCED_TOWERS_COMPLETE`（`BuildSystem` 左右高级塔齐备） | `Ultimate` |
| 大招成功后（`UltimateSystem` → `GameManager.setGameOver`） | `GameOver`（**无**结束 UI prefab，留 §5.8） |

> `PHASE_CHANGED` 载荷为 `GamePhase` 枚举值；Player/Joystick 将 `combat_guide` / `build_*` / `defense_phase` / `ultimate` 映射为全向 `defense` 移动，并短期兼容旧字符串 `'defense'`/`'parkour'`。不再由 SceneSetup/PhaseTransition 裸发 `'defense'`。

### §4.H 大招与 Barrier（2026-09-02 phase-4h）

| 项 | 路径 / 说明 |
|---|---|
| `UltimateSystem` | 挂于 `GameManager` 节点；`player`→`pref_player`；`cameraFollow`→`Camera` |
| 解锁 | `BOTH_ADVANCED_TOWERS_COMPLETE` |
| 触发 | **空格** → `Player.castUltimate` → `clearAllEnemies` → `CameraFollow.zoomOut` → `setGameOver` |
| Barrier | 拓展完成后激活；小怪/Boss 近距 `Barrier.takeDamage`；死亡关碰撞并 `active=false` |
| 禁止 | 未建 `pref_ui_game_over`；`pref_skill_ultimate` 跳过 |

## P3-003 / Phase 0：刷怪点（MCP 已创建并迁移）

> 刷怪点父节点已迁至 `GameRoot/World/SpawnPoint_*`；刷怪逻辑属 **P4**。

### 侧别与封墙停刷映射（供 P4）

| 侧别父节点 | 含义 | 停刷条件（设计约定） |
|---|---|---|
| `GameRoot/World/SpawnPoint_Left` | 道路左侧楼梯侧刷怪 | **`Plot_Wall_L` 建完**（`BUILD_COMPLETE` spawnSide=left） |
| `GameRoot/World/SpawnPoint_Right` | 道路右侧楼梯侧刷怪 | **`Plot_Wall_R` 建完**（`BUILD_COMPLETE` spawnSide=right） |
| `GameRoot/World/SpawnPoint_Far` | 远端（道路前进轴负 Z） | 不随单侧封墙停刷 |
| `GameRoot/World/ParkourContent/PreEnemy_*` | 跑酷段预置怪挂点 | `BOTH_WALLS_COMPLETE` 后隐藏 |

### 刷怪点表（节点路径 / 建议世界坐标 / 关联 prefab）

| 节点路径 | 建议世界坐标 | 关联 prefab | 侧别 |
|---|---|---|---|
| `GameRoot/World/SpawnPoint_Left` | `(-6, 0, 0)` | （分组） | Left |
| `GameRoot/World/SpawnPoint_Left/SpawnPoint_L0` | `(-6, 0, 0)` | `prefabs/enemy/pref_enemy_minion` | Left |
| `GameRoot/World/SpawnPoint_Left/SpawnPoint_L1` | `(-6, 0, -8)` | `prefabs/enemy/pref_enemy_minion` | Left |
| `GameRoot/World/SpawnPoint_Right` | `(6, 0, 0)` | （分组） | Right |
| `GameRoot/World/SpawnPoint_Right/SpawnPoint_R0` | `(6, 0, 0)` | `prefabs/enemy/pref_enemy_minion` | Right |
| `GameRoot/World/SpawnPoint_Right/SpawnPoint_R1` | `(6, 0, -8)` | `prefabs/enemy/pref_enemy_minion` | Right |
| `GameRoot/World/SpawnPoint_Far` | `(0, 0, -20)` | （分组） | Far |
| `GameRoot/World/SpawnPoint_Far/SpawnPoint_F0` | `(0, 0, -20)` | `prefabs/enemy/pref_enemy_minion` | Far |
| `GameRoot/World/SpawnPoint_Far/SpawnPoint_F1` | `(0, 0, -28)` | `prefabs/enemy/pref_enemy_boss` | Far |
| `GameRoot/World/ParkourContent/PreEnemy_1` | `(-2, 0, -4)` | `prefabs/enemy/pref_enemy_minion` | PreSpawn |
| `GameRoot/World/ParkourContent/PreEnemy_2` | `(2, 0, -10)` | `prefabs/enemy/pref_enemy_minion` | PreSpawn |

> 坐标为建议初值（沿道路前进轴 **-Z** 分布）；道路 mesh 落盘后可在编辑器微调。

## 预制体放置表

| 空节点 | 预制体路径 | 备注 |
|---|---|---|
| `RoadRoot/LogAnchor` | `prefabs/item/pref_log` | 滚木固定后留在场上；勿挂 `ParkourContent` |
| （待 P3 任务填充） | | |

## 编辑器操作 checklist（MCP 装配后微调 / 绑定）

> 默认由 build-agent **MCP 按放置表实例化**；下列项供验收或用户微调。禁止手写 scene JSON。

- [x] 滚木实例挂在 `RoadRoot/LogAnchor/pref_log`（勿挂 `ParkourContent`）— #4 MCP 复验 ✓
- [x] 场景无 `InstanceRoot`；`GameRoot` 已挂 `RenderRoot2D` — #4 ✓
- [x] `SceneSetup` 六引用均已绑（player/log/joystick/joystickHint/parkourContent/enemySpawner）— MCP 复验 ✓
- [x] `PhaseTransition.parkourContent` → `GameRoot/World/ParkourContent`；`logNode` → `pref_log` — MCP 复验 ✓
- [x] 显隐约定：`LOG_FIXED` 藏电锯/加长道具；`BOTH_WALLS_COMPLETE` 藏预置怪/黄蓝线（非整棵 ParkourContent）— 文档+代码已对齐
- [ ] `PhaseTransition.defenseContentRoot`（可选，当前未绑）
- [x] 跑酷段静态 prefab（玩家/电锯/预置怪/UI 等）已在场景 — MCP 复验 ✓
- [x] 用户已保存 `Main.scene`（**2026-09-02** MCP 已 `scene-open` 同步）
- [x] `BuildPlots` 下无嵌套 Canvas/Camera；`pref_build_plot` 直接挂 `Plot_*` — MCP 复验 ✓
- [ ] 保存场景后控制台确认无 missing script（用户/编辑器验收）
- [ ] G1 Play 手测清单（见 `.cursor/plans/phase-3-parkour-scene.md` AC-G1）
