# 场景放置说明（SCENE_PLACEMENT）

> **由 AI 维护**（节点清单、坐标、阶段显隐、prefab 关联）。**空挂点**与 **prefab 场景实例**默认经 **Defense3 + Cocos MCP**（`scene-create-node-by-type` / `scene-create-node-by-asset`）按本文落盘；用户仅在坐标或 Inspector 需微调时在编辑器补操作。大规模破坏既有引用的 reparent/重命名须用户批准（见 `defense3-workflow.mdc`「场景与序列化」）。

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
│   │   └── BuildPlots        ← Phase 3 扩展保留
│   ├── UI                    ← Canvas；Phase 1 已挂 pref_joystick + pref_ui_joystick_hint
│   ├── Effect                ← 空容器
│   └── SceneSetup            ← Phase 1 接线（不 instantiate 静态关卡）
└── GameManager               ← GameManager + PhaseTransition
```

## Phase 1：跑酷段 MCP 装配（phase-1-parkour v2）

> **2026-09-01** build-agent 经 Defense3 + Cocos MCP 按放置表实例化静态 prefab 并挂组件；用户仅微调坐标/Inspector。

### 用户保存同步（2026-09-01，MCP `scene-open` + `scene-query-component`）

> 用户在编辑器保存 `Main.scene` 后，经 MCP 复验的**当前权威绑定**（组件路径以编辑器序列化名称为准，如 `SceneSetup_013`）。

#### `GameRoot/SceneSetup` → `SceneSetup`

| `@property` | 绑定目标节点路径 | 状态 |
|---|---|---|
| `player` | `GameRoot/World/PlayerSpawn/InstanceRoot/pref_player` | ✓ 已绑 |
| `log` | `GameRoot/World/RoadRoot/LogAnchor/InstanceRoot/pref_log` | ✓ 已绑 |
| `joystick` | `GameRoot/UI/pref_joystick_001` | ✓ 已绑 |
| `joystickHint` | `GameRoot/UI/pref_ui_joystick_hint_001` | ✓ 已绑 |
| `parkourContent` | `GameRoot/World/ParkourContent` | ✓ 已绑 |
| `enemySpawner` | `GameRoot/World/SpawnPoint_Far`（`EnemySpawner` 组件） | ✓ 已绑 |

#### `GameManager` → `PhaseTransition`

| `@property` | 绑定目标节点路径 | 状态 |
|---|---|---|
| `parkourContent` | `GameRoot/World/ParkourContent` | ✓ 已绑（按子节点分阶段隐藏，非整棵关） |
| `logNode` | `GameRoot/World/RoadRoot/LogAnchor/InstanceRoot/pref_log` | ✓ 已绑 |
| `defenseContentRoot` | — | 未绑（可选，当前为空） |

#### 跑酷物件分阶段显隐（`PhaseTransition` + `defense3.md`）

| 时机 | 隐藏子节点 | 仍可见 |
|---|---|---|
| `LOG_FIXED`（滚木固定，跑酷段结束） | `SawTrap_1~3`、`LogExtendItemRoot` | `PreEnemy_1~8`、`YellowLine`、`BlueLine` |
| `BOTH_WALLS_COMPLETE` | `PreEnemy_1~8`、`YellowLine`、`BlueLine` | `ParkourContent` 根节点保持 active；滚木在 `LogAnchor` |

> **禁止** `ParkourContent.active=false`。

#### `ParkourLineZone`（黄蓝线）

| 节点 | `lineKind` | `log` 绑定 | 本地 Z |
|---|---|---|---|
| `GameRoot/World/ParkourContent/YellowLine` | `yellow` | `LogAnchor/InstanceRoot/pref_log` | **-72** |
| `GameRoot/World/ParkourContent/BlueLine` | `blue` | `LogAnchor/InstanceRoot/pref_log` | **-78** |

### MCP 已实例化 checklist

| 挂点 | prefab / 组件 | 状态 |
|---|---|---|
| `GameRoot/World/PlayerSpawn/InstanceRoot` | `pref_player` ×1 | ✓ 已实例化 |
| `GameRoot/World/RoadRoot/LogAnchor/InstanceRoot` | `pref_log` ×1 | ✓ 已实例化（勿放 ParkourContent） |
| `ParkourContent/SawTrap_1~3/InstanceRoot` | `pref_trap_saw` ×3 | ✓ 已实例化 |
| `ParkourContent/PreEnemy_1~8/InstanceRoot` | `pref_enemy_minion` ×8 | ✓ 已实例化 |
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

## Phase 3：§3.4–3.7 塔防段场景布局（phase-3-scene-layout v1）

> **2026-09-01** build-agent 经 Defense3 + Cocos MCP 在 `Main.scene` 摆场：弓/Boss 出生点、建造地块、英雄碑/拓展地块、阻挡物与高级塔地块；初始 `active=false`（§4 BuildSystem 解锁显隐）。**未**实现 BuildSystem / Boss 刷怪 / 拓展解锁逻辑。

### §3.4 战斗引导摆场

| 节点路径 | prefab / 类型 | 建议本地坐标 (World) | 初始显隐 | 解锁时机（§4） |
|---|---|---|---|---|
| `GameRoot/World/Canvas/pref_item_bow_001` | `pref_item_bow` ×1 | `(3, 0, -68)` 道边 | active | 跑酷末可拾取 |
| `GameRoot/World/BossSpawn_First` | 空节点 | `(0, 0, -50)` 屏外远端 | active | §4.D Boss 首次生成 |

> MCP `scene-create-node-by-asset` 对弓实例插入了 `World/Canvas` 包装层（CLI 副作用）；实例仍在 `World` 子树，坐标已设。

### §3.5 建造地块（墙 / 初级塔 / 兵营）

| 挂点 | prefab 实例路径 | `buildType` | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|---|
| `Plot_Wall_L` | `…/Plot_Wall_L/Canvas/pref_build_plot` | `wall`（默认） | `(-6, 0, 5)` | **inactive** | `LOG_FIXED` 后 BuildSystem reveal |
| `Plot_Wall_R` | `…/Plot_Wall_R/Canvas/pref_build_plot` | `wall`（默认） | `(6, 0, 5)` | **inactive** | 同上 |
| `Plot_Tower_1` | `…/Plot_Tower_1/Canvas/pref_build_plot` | `towerBasic` | `(-4, 0, 25)` | **inactive** | 两墙完成后 |
| `Plot_Tower_2` | `…/Plot_Tower_2/Canvas/pref_build_plot` | `towerBasic` | `(4, 0, 25)` | **inactive** | 两墙完成后 |
| `Plot_Barracks` | `…/Plot_Barracks/Canvas/pref_build_plot` | `barracks` | `(-10, 0, 15)` | **inactive** | 两墙完成后 |

命名映射：`Plot_Tower_1/2` 对应设计文档 `Plot_TowerBasic_L/R`（保留场景原名）。

### §3.6 英雄碑与拓展地块

| 挂点 | prefab 实例路径 | `buildType` | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|---|
| `Plot_HeroShrine` | `…/Plot_HeroShrine/Canvas/pref_build_plot` | `heroShrine` | `(10, 0, 15)` | **inactive** | 兵营建成后 §4.F |
| `Plot_Expand` | `…/Plot_Expand/Canvas/pref_build_plot` | `expandArea` | `(0, 0, 45)` | **inactive** | 选英雄后 §4.F |

### §3.7 拓展防守区

| 挂点 | prefab / 类型 | 挂点本地坐标 | 初始显隐 | 解锁时机 |
|---|---|---|---|---|
| `BarrierWall_L` | `…/BarrierWall_L/Canvas/pref_barrier_wall` | `(-8, 0, 50)` | **inactive** | `Plot_Expand` 购买后 §4.H |
| `BarrierWall_R` | `…/BarrierWall_R/Canvas/pref_barrier_wall` | `(8, 0, 50)` | **inactive** | 同上 |
| `BarrierLong_Center` | `…/BarrierLong_Center/Canvas/pref_barrier_long` | `(0, 0, 55)` | **inactive** | 同上 |
| `ExpandSideWalls` | 空节点（占位） | `(0, 0, 52)` | **inactive** | 拓展解锁后矮墙扩展区 |
| `Plot_TowerAdvanced_L` | `…/Plot_TowerAdvanced_L/Canvas/pref_build_plot` | `towerAdvanced` | `(0, 0, 35)`（原 `Plot_Tower_3` 改名） | **inactive** | 拓展地块解锁后 |
| `Plot_TowerAdvanced_R` | `…/Plot_TowerAdvanced_R/Canvas/pref_build_plot` | `towerAdvanced` | `(8, 0, 35)` | **inactive** | 同上 |

`buildType` 经场景 `propertyOverrides`（`bc_buildplot` → `_buildType`）落盘；墙地块默认 `wall` 无需覆盖。

### MCP 已实例化 checklist（§3.4–3.7）

| AC | 项 | 状态 |
|---|---|---|
| 3.4 | `pref_item_bow` 于 `World` 子树 | ✓ |
| 3.4 | `BossSpawn_First` | ✓ |
| 3.5 | 墙/塔/兵营 `pref_build_plot` ×5 | ✓ |
| 3.6 | 英雄碑 + `Plot_Expand` build_plot | ✓ |
| 3.7 | `pref_barrier_wall` ×2、`pref_barrier_long` ×1 | ✓ |
| 3.7 | `ExpandSideWalls` 空节点 | ✓ |
| 3.7 | `Plot_TowerAdvanced_L/R` build_plot | ✓ |

### 阶段显隐（与 §3.5–3.7 布局）

| 时机 | reveal（BuildSystem §4，本 plan 仅摆场） |
|---|---|
| `LOG_FIXED` | `Plot_Wall_L/R` |
| `BOTH_WALLS_COMPLETE` | `Plot_Tower_1/2`、`Plot_Barracks` |
| 兵营建成 | `Plot_HeroShrine` |
| 选英雄 | `Plot_Expand` |
| 拓展地块建成 | `BarrierWall_*`、`BarrierLong_Center`、`ExpandSideWalls`、`Plot_TowerAdvanced_L/R` |

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
| 玩家实例 | `GameRoot/World/PlayerSpawn/InstanceRoot/pref_player` | ✓ 父链**不含** `ParkourContent` |
| 滚木 | `GameRoot/World/RoadRoot/LogAnchor/InstanceRoot/pref_log` | ✓ |
| 电锯 ×3 | `ParkourContent/SawTrap_1~3/InstanceRoot/pref_trap_saw` | ✓ |
| 预置怪 ×8 | `ParkourContent/PreEnemy_1~8/InstanceRoot/pref_enemy_minion*` | ✓ |
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

## P3-003 / Phase 0：刷怪点（MCP 已创建并迁移）

> 刷怪点父节点已迁至 `GameRoot/World/SpawnPoint_*`；刷怪逻辑属 **P4**。

### 侧别与封墙停刷映射（供 P4）

| 侧别父节点 | 含义 | 停刷条件（设计约定） |
|---|---|---|
| `GameRoot/World/SpawnPoint_Left` | 道路左侧楼梯侧刷怪 | 左侧墙建完后停刷该侧 |
| `GameRoot/World/SpawnPoint_Right` | 道路右侧楼梯侧刷怪 | 右侧墙建完后停刷该侧 |
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

- [x] 滚木实例挂在 `RoadRoot/LogAnchor/InstanceRoot/pref_log`（勿挂 `ParkourContent`）— 用户保存后 MCP 复验 ✓
- [x] `SceneSetup` 六引用均已绑（player/log/joystick/joystickHint/parkourContent/enemySpawner）— MCP 复验 ✓
- [x] `PhaseTransition.parkourContent` → `GameRoot/World/ParkourContent`；`logNode` → `pref_log` — MCP 复验 ✓
- [x] 显隐约定：`LOG_FIXED` 藏电锯/加长道具；`BOTH_WALLS_COMPLETE` 藏预置怪/黄蓝线（非整棵 ParkourContent）— 文档+代码已对齐
- [ ] `PhaseTransition.defenseContentRoot`（可选，当前未绑）
- [x] 跑酷段静态 prefab（玩家/电锯/预置怪/UI 等）已在场景 — MCP 复验 ✓
- [x] 用户已保存 `Main.scene`（2026-09-01）
- [ ] 保存场景后控制台确认无 missing script（用户/编辑器验收）
- [ ] G1 Play 手测清单（见 `.cursor/plans/phase-3-parkour-scene.md` AC-G1）
