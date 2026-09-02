---
slug: phase-0-bootstrap
版本: 1
状态: done
创建: 2026-09-01
---

# Phase 0：项目初始化与基础架构（查缺补漏）

## 业务目标

按 `AI_TASK_LIST.md` 任务 0.1~0.6 **完整对齐** Phase 0 规范：在保留现有 P3 场景子树（RoadRoot/ParkourContent/SpawnPoints/BuildPlots 坐标与 UUID）的前提下，经 **Defense3 + Cocos MCP** 重建 `Main.scene` 根层级为 `GameRoot → World` 结构，补齐 `GameManager`/`GamePhase` 与缺失事件，通过 G0 门禁（编译 + 场景无红错 + 阶段切换事件）。

**用户澄清（brainstorming）**：选 **C — 完整 0.2**，允许迁移现有节点；`BuildPlots` 与 `Main Light` 作为 Phase 3 / 3D 模板扩展保留在 `World` 下，不删除。

## 风险等级

**高** — 涉及 `Main.scene` 大规模节点迁移与重命名；错误 reparent 可能导致后续 Phase 脚本 `@property` 路径失效。须 MCP 操作 + AC-S* 门禁 + 编辑器验收；禁止手写整份 scene JSON。

## 现状差距（调研摘要）

| 任务 | 现状 | 缺口 |
|---|---|---|
| 0.1 目录 | `assets/scripts/*`、`resources/prefabs/*`、`docs/` 已存在 | 确认 `resources/sprite/frames/` 存在；2D 物理启用待编辑器确认 |
| 0.2 场景 | `Main.scene` 有 P3 扁平骨架（`Main Camera`/`RoadRoot`/…） | 缺 `GameRoot`/`World`/`UI`/`Effect`/`GameManager`；刷怪点名 `SpawnPoints/*` 非 `SpawnPoint_Far/Left/Right`；`SawTraps` 非 `SawTrap_1~3`；预置怪仅 2 个 |
| 0.3 事件 | `Singleton`/`EventManager`/`GameEvents` 已有 | 缺 `BUILD_COMPLETE`、`BOTH_ADVANCED_TOWERS_COMPLETE`（保留现有 `LOG_FIXED`/`HERO_SELECT_REQUESTED`） |
| 0.4 渲染 | `SortingOrder2D`/`Billboard` 已有 | `SortingOrder2D` 缺 `offset` 参数 |
| 0.5 管理 | `GameConfig` 已有 | **缺** `GamePhase.ts`、`GameManager.ts` |
| 0.6 动画 | `AnimUtil.playAnim` 已有 | 缺 `Animation.EventType.FINISHED` 监听封装 |

## 变更文件清单

- 【可写】`assets/scripts/core/GameEvents.ts` — 补全 Phase 0 必需事件常量
- 【可写】`assets/scripts/core/SortingOrder2D.ts` — 增加 `offset` 并纳入 sortingOrder 计算
- 【可写】`assets/scripts/core/AnimUtil.ts` — 增加 `playAnimWithCallback` 或等价 FINISHED 监听 API
- 【可新建】`assets/scripts/game/GamePhase.ts` — 阶段枚举
- 【可新建】`assets/scripts/game/GameManager.ts` — Component 单例，`setPhase()` + emit `PHASE_CHANGED`
- 【可写】`assets/scenes/Main.scene` — **仅经 MCP** 迁移/新建节点；禁止 AI 手写整文件
- 【可写】`docs/SCENE_PLACEMENT.md` — 更新为 Phase 0 目标层级（含 `GameRoot/World` 与节点迁移映射表）
- 【仅只读参考】`AI_TASK_LIST.md` §Phase 0 — 权威任务与 G0 AC
- 【仅只读参考】`.cursor/plans/_archive_p2p3/p3-001-main-scene.md` — 旧 P3 骨架坐标参考
- 【仅只读参考】`assets/scripts/game/PhaseTransition.ts` — `parkourContent` 等路径迁移后须仍能绑定

## 目标场景层级（0.2 + 扩展）

```
Main
├── Camera                    ← 由 Main Camera 重命名；透视 (0,15,15) lookAt 道路中心
├── Main Light                ← 保留 3D 模板灯光（扩展，非 0.2 原文）
├── GameRoot
│   ├── World
│   │   ├── RoadRoot          ← 迁移（含 Road/SideWalls/Stairs/LogAnchor）
│   │   ├── ParkourContent    ← 迁移；子节点对齐 0.2 命名
│   │   │   ├── SawTrap_1 ~ SawTrap_3
│   │   │   ├── PreEnemy_1 ~ PreEnemy_8
│   │   │   ├── YellowLine
│   │   │   └── BlueLine
│   │   ├── SpawnPoint_Far    ← 自 SpawnPoints/SpawnFar 迁移子节点
│   │   ├── SpawnPoint_Left   ← 自 SpawnPoints/SpawnLeft 迁移
│   │   ├── SpawnPoint_Right  ← 自 SpawnPoints/SpawnRight 迁移
│   │   ├── PlayerSpawn       ← 迁移
│   │   └── BuildPlots        ← 扩展保留（Phase 3 建造地块）
│   ├── UI                    ← 新建 Canvas（空，Phase 1 再挂 pref_joystick）
│   └── Effect                ← 新建空容器
└── GameManager               ← 新建空节点 + 挂 GameManager.ts
```

### 节点迁移映射（build 时对照）

| 现有路径 | 目标路径 | 动作 |
|---|---|---|
| `Main Camera` | `Camera` | MCP 重命名 + 校正 position/rotation |
| `RoadRoot` 整棵 | `GameRoot/World/RoadRoot` | reparent，保留本地坐标 |
| `ParkourContent` 整棵 | `GameRoot/World/ParkourContent` | reparent |
| `ParkourContent/SawTraps` | 拆为 `SawTrap_1~3` 空节点 | 删除容器或清空后新建 3 节点 |
| `ParkourContent/PreSpawnEnemies/*` | `PreEnemy_1~8` | 已有 2 个重命名；补 6 个空节点 |
| `SpawnPoints/SpawnFar/*` | `SpawnPoint_Far/*` | reparent + 父节点重命名 |
| `SpawnPoints/SpawnLeft/*` | `SpawnPoint_Left/*` | 同上 |
| `SpawnPoints/SpawnRight/*` | `SpawnPoint_Right/*` | 同上 |
| `SpawnPoints`（空壳） | — | 迁移完成后删除 |
| `PlayerSpawn` | `GameRoot/World/PlayerSpawn` | reparent |
| `BuildPlots` | `GameRoot/World/BuildPlots` | reparent |

## 实施步骤

1. **S1 前置门**：MCP `assets-query-path` 确认绑定 **Defense3** `assets`；`scene-open` `db://assets/scenes/Main.scene`；记录现有节点 UUID 与坐标（`assets-query-serialized-data`）作回滚基线。

2. **S2 目录查缺（0.1）**：确认 `resources/sprite/frames/` 存在（无则 MCP `assets-create-asset` 建目录占位）；列出缺失目录一次性补齐；在 plan 报告注明 2D 物理需在编辑器 **项目设置 → 功能裁剪** 确认已启用。

3. **S3 脚本 — GamePhase + GameManager（0.5）**：
   - 新建 `GamePhase.ts` 枚举：`RunParkour | CombatGuide | BuildPhase1 | BuildPhase2 | DefensePhase | Ultimate | GameOver`。
   - 新建 `GameManager.ts`：`@ccclass` Component，`onLoad` 单例去重（`static instance`）；`currentPhase` + `setPhase(phase: GamePhase)`；`setPhase` 内 `EventManager.instance.emitEvent(GameEvents.PHASE_CHANGED, phase)`；暴露 `getPhase()`。
   - **禁止**与 `PhaseTransition` 职责重叠（GameManager 管阶段状态，PhaseTransition 管场景显隐）。

4. **S4 脚本 — 事件与工具补全（0.3/0.4/0.6）**：
   - `GameEvents.ts` 增加 `BUILD_COMPLETE`、`BOTH_ADVANCED_TOWERS_COMPLETE`（字符串 snake_case 与现有一致）。
   - `SortingOrder2D` 增加 `@property offset: number`，公式改为 `Math.round(-y * 100) + offset`。
   - `AnimUtil` 增加 `onAnimFinished(node, clipName, callback)` 或在 `playAnim` 返回 Promise，内部 `anim.once(Animation.EventType.FINISHED, ...)`。

5. **S5 MCP 场景骨架（0.2）— 新建容器**：
   - `scene-create-node-by-type` 在 Main 下创建 `GameRoot`、`GameManager`。
   - 在 `GameRoot` 下创建 `World`、`UI`（Canvas 组件）、`Effect` 空节点。
   - 在 `GameManager` 节点挂 `GameManager` 脚本组件（MCP `scene-set-property` 或编辑器等价）。

6. **S6 MCP 场景迁移 — reparent 现有子树**：
   - 将 `RoadRoot`、`ParkourContent`、`PlayerSpawn`、`BuildPlots` reparent 到 `GameRoot/World`（MCP `scene-move-node` 或等价 API）；**保持各节点 localPosition 不变**。
   - 将 `Main Camera` 重命名为 `Camera`；设置 position `(0,15,15)`、透视、lookAt `(0,0,0)` 或道路中心。
   - 保留 `Main Light` 于 Main 根（与 Camera 并列）。

7. **S7 MCP 场景对齐 — 刷怪点与跑酷子节点命名**：
   - 创建 `SpawnPoint_Far`/`SpawnPoint_Left`/`SpawnPoint_Right` 于 `World` 下；将 `SpawnFar`/`SpawnLeft`/`SpawnRight` 子节点迁入对应父节点；删除空 `SpawnPoints`。
   - `ParkourContent` 下：新建 `SawTrap_1~3`；将 `PreSpawn_0/1` 重命名为 `PreEnemy_1/2` 并补 `PreEnemy_3~8` 空节点；删除 `SawTraps`/`PreSpawnEnemies` 空壳（若 MCP 无法批量重命名，允许保留旧名并在 `SCENE_PLACEMENT.md` 标注「待 Phase 1 统一」，但 **优先**完成重命名）。
   - `scene-save`。

8. **S8 文档同步**：更新 `docs/SCENE_PLACEMENT.md` 根层级图为 Phase 0 目标结构；补充迁移映射表与「旧路径 → 新路径」供 Phase 1 `SceneSetup.ts` 引用。

9. **S9 启动场景**：在 Cocos 编辑器将 `Main.scene` 设为启动场景（`项目设置 → 项目数据 → 启动场景`）；build 报告记录截图或设置路径。

10. **S10 后置门与验收**：跑 MCP 交付门禁脚本 + 编辑器打开验证（见校验点）。

## 校验点

- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 退出码 0
- [AC-EVENTS] `rg "BUILD_COMPLETE|BOTH_ADVANCED_TOWERS_COMPLETE" assets/scripts/core/GameEvents.ts` — 2 匹配
- [AC-GAMEPHASE] `rg "RunParkour|GameOver" assets/scripts/game/GamePhase.ts` — ≥2 匹配
- [AC-GAMEMGR] `rg "setPhase|PHASE_CHANGED" assets/scripts/game/GameManager.ts` — ≥2 匹配
- [AC-HIER-1] MCP `scene-open` 后查询：存在 `GameRoot/World/RoadRoot`、`GameRoot/World/ParkourContent`、`GameManager` 节点
- [AC-HIER-2] MCP 查询：`SpawnPoint_Far`、`SpawnPoint_Left`、`SpawnPoint_Right` 位于 `World` 下（非 `SpawnPoints`）
- [AC-HIER-3] MCP 查询：`Camera` 节点 position.y ≈ 15（容差 ±0.5）
- [AC-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — **0 匹配**
- [AC-S2] MCP `scene-open` 后相关 nodeId **不得**匹配 `Node.<数字>`
- [AC-S3] 若 AC-S1 patch 后 AC-S2 仍失败：`scene-close` → 同步 `library` → `assets-reimport-asset` → 再 `scene-open`
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 退出码 0
- [AC-EDITOR] Defense3 编辑器打开 `Main.scene`：**无 missing script、无节点/组件红错**；`GameManager` 节点已挂脚本
- [AC-PHASE-MANUAL] 编辑器 Play 或组件面板：调用/触发 `GameManager.setPhase` 切换阶段，Console 可见 `phase_changed` 事件（可在 GameManager 临时 `console.log` 或写最小测试监听，验收后保留 log 即可）

## 回滚策略

- **基线**：build 前 `git stash` 或记录 `Main.scene` + 脚本文件 hash；S1 导出的节点 UUID/坐标表存于 build 报告。
- **场景失败**：`git checkout -- assets/scenes/Main.scene`（及 `.meta` 若被改）；MCP `scene-close` → `assets-reimport-asset`。
- **脚本失败**：单独 revert `GameManager.ts`/`GamePhase.ts` 新建文件删除即可，不影响已有 P2 脚本。

## 修订记录

- v1（2026-09-01）：初始计划；用户选 C（完整 0.2 重建 + 迁移 P3 节点）；slug `phase-0-bootstrap`
