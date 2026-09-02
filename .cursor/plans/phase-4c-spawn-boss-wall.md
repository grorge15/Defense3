---
slug: phase-4c-spawn-boss-wall
版本: 1
状态: done
创建: 2026-09-02
---

# §4.C 剩余项：Boss 生成/索敌 + 建墙停刷（4.14–4.16）

## 业务目标

补齐 `AI_TASK_LIST.md` **§4.C 未完成项**：
- **4.14** `BossSpawn_First` 首次生成 Boss，屏外靠近玩家（G2 部分）
- **4.15** spawn 后 `registerTargets`，复用已有 `EnemyBoss.pickTarget`（建筑>英雄>玩家）
- **4.16** 单侧墙建完 → 对应侧 `SpawnPoint_Left/Right` 停刷

**4.11–4.13 已 done**：本 plan **不重写**远端/左右小怪刷怪与小怪追击 AI。

**用户澄清**：选 **C**（含 4.16）；允许最小 `BUILD_COMPLETE` 占位（完整 BuildSystem 属 §4.E，本 plan 只 emit + 停刷接线）。

## 风险等级

**中** — 新建 Boss 刷怪脚本 + 改 `EnemySpawner`/`BuildPlot`/`Wall`；MCP 挂 `BossSpawn_First`；事件 payload 须与后续 §4.E 兼容。

## 现状差距

| 任务 | 现状 | 缺口 |
|---|---|---|
| 4.11–4.13 | `EnemySpawner` Far/Left/Right；`EnemyMinion` 追击攻击 | 跳过 |
| **4.14** | 场景有 `BossSpawn_First`；`pref_enemy_boss` + `EnemyBoss.ts` 已有 | **无**首次 spawn 逻辑 |
| **4.15** | `pickTarget` / `registerTargets` 已实现 | spawn 时未 register；建筑/英雄列表可空 |
| **4.16** | Left/Right 刷怪在 `LOG_FIXED` 后激活 | **无**墙完成停刷；`BuildPlot` 未 emit `BUILD_COMPLETE` |

## 变更文件清单

- 【可新建】`assets/scripts/enemy/BossSpawner.ts` — 挂 `BossSpawn_First`；首次 spawn `pref_enemy_boss`；`registerTargets({ player })`；仅 spawn 一次
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — 确保 spawn 后 `fixedUpdate` 朝 `pickTarget()` 移动（已有则只读确认）；可选 `onSpawned()` 钩子
- 【可写】`assets/scripts/enemy/EnemySpawner.ts` — 监听 `BUILD_COMPLETE`；按侧别 `stopSide('left'|'right')`；Left/Right 子 spawn 可拆为独立组件或本类扩展
- 【可写】`assets/scripts/building/BuildPlot.ts` — `_completeBuild` 时 `emit(BUILD_COMPLETE, { type, side? })`
- 【可写】`assets/scripts/building/Wall.ts` — 可选 `@property side: 'left'|'right'|'none'`（供 spawn 出的 Wall 实例标记；或 side 仅来自 BuildPlot）
- 【可写】`assets/scripts/building/BuildPlot.ts` — 墙地块 `@property spawnSide: 'left'|'right'|''`（Plot_Wall_L→left，Plot_Wall_R→right）
- 【可写】`assets/scripts/core/GameConfig.ts` — `bossFirstSpawnDelay`（秒，LOG_FIXED 后延迟，可选）
- 【可写】`assets/scripts/game/SceneSetup.ts` — 监听 `LOG_FIXED` 或 `CombatGuide` 触发 `BossSpawner.trySpawnFirst()`；向 BossSpawner 传 player
- 【可写】`assets/scenes/Main.scene` — MCP：`BossSpawn_First` 挂 `BossSpawner`；绑 boss prefab、player；墙 build_plot 设 `spawnSide`（若 MCP 可设）
- 【可写】`docs/SCENE_PLACEMENT.md` — Boss 出生点 + 墙侧别停刷映射
- 【仅只读参考】`pref_enemy_boss`、`EnemyBoss.registerTargets`、归档 `p2-004`
- 【仅只读参考】`SpawnPoint_Left` / `SpawnPoint_Right` 节点路径

## To-dos

### 4.14 Boss 首次生成

- [ ] **4.14.a**：新建 `BossSpawner.ts`：`bossPrefab`；`spawnPoint`（默认自身）；`_spawned` 防重复；`trySpawnFirst()` instantiate @ `BossSpawn_First` 世界坐标
- [ ] **4.14.b**：spawn 后 `registerTargets({ player, buildings: [], heroes: [] })`；`setTarget` 或 Boss 自索敌
- [ ] **4.14.c**：触发：`SceneSetup` 在 `LOG_FIXED` 或 `GamePhase.CombatGuide` 后 `scheduleOnce(delay)` 调 `trySpawnFirst`（delay 读 GameConfig）
- [ ] **4.14.d**：MCP 挂组件 + 绑 prefab/player；scene-save

### 4.15 Boss 索敌（接线）

- [ ] **4.15.a**：确认 `EnemyBoss.pickTarget` 在无建筑/英雄时选玩家；有则按优先级
- [ ] **4.15.b**：预留 `registerTargets` 扩展：SceneSetup 或后续 BuildSystem 可注入 `buildings`/`heroes` 数组（本 plan 可空数组 + 文档说明）
- [ ] **4.15.c**：Play 验收：Boss 从 `BossSpawn_First` 移向玩家

### 4.16 建墙停刷

- [ ] **4.16.a**：`BuildPlot` 增加 `@property spawnSide: ''|'left'|'right'`（仅 wall 地块用）；`_completeBuild` emit `GameEvents.BUILD_COMPLETE`，payload `{ buildType, spawnSide }`
- [ ] **4.16.b**：`EnemySpawner`（或新建 `SideSpawnController` 挂 Left/Right 根）：监听 `BUILD_COMPLETE`；`spawnSide==='left'` → 停 Left 侧 `schedule` 刷怪；right 同理
- [ ] **4.16.c**：墙建成时 `instantiate pref_wall` 可选（若 BuildPlot 尚无 onBuildComplete 实现，本 plan **最小**：emit 事件即可停刷，Wall 实例由 plot 回调或 §4.E 补；**优先** BuildPlot 完成时 emit + 可选 spawn Wall prefab 占位）
- [ ] **4.16.d**：MCP/Inspector：`Plot_Wall_L` spawnSide=left，`Plot_Wall_R` spawnSide=right（文档 + 尽量 MCP 设 property）

## 实施步骤

1. **S1 前置门**：MCP Defense3；`tsc` 基线；确认 `BossSpawn_First`、`SpawnPoint_Left/Right` 存在。
2. **S2（4.14）**：`BossSpawner` + GameConfig delay + SceneSetup 触发 + MCP 绑 scene。
3. **S3（4.15）**：spawn 时 register；只读验证 Boss 移动/索敌。
4. **S4（4.16）**：BuildPlot emit + spawnSide；EnemySpawner 停刷侧别。
5. **S5**：文档；AC-S*（若改 scene）；`verify-mcp-gate.ps1`；编辑器无红错。
6. **S6 手测**：G2 Boss 靠近；G3 单侧墙完成后该侧不再刷怪（可用 debug 触发 BuildPlot 完成或 Play 建墙）。

## 校验点

### 4.14

- [AC-4.14-SCRIPT] `rg "class BossSpawner|trySpawnFirst" assets/scripts/enemy/BossSpawner.ts` — ≥2
- [AC-4.14-SCENE] MCP：`BossSpawn_First` 含 `BossSpawner`；`bossPrefab` 非 null

### 4.15

- [AC-4.15-REG] spawn 路径调用 `registerTargets`（rg 或 MCP query）
- [AC-4.15-PICK] `EnemyBoss.pickTarget` 仍存在 building>hero>player 逻辑（只读）

### 4.16

- [AC-4.16-EMIT] `rg "BUILD_COMPLETE" assets/scripts/building/BuildPlot.ts` — emit 存在
- [AC-4.16-STOP] `rg "BUILD_COMPLETE|stopSide|spawnSide" assets/scripts/enemy/EnemySpawner.ts` — ≥2
- [AC-4.16-SIDE] 文档或 MCP：`Plot_Wall_L` spawnSide=left，`Plot_Wall_R` spawnSide=right

### 公共

- [AC-COMPILE] `npx tsc --noEmit` — 0
- [AC-S1] 若改 Main.scene — `rg '"_id": "Node\.'` — 0
- [AC-S2] scene-open nodeId 非 `Node.*`
- [AC-GATE] `verify-mcp-gate.ps1` — 0
- [AC-EDITOR] Main.scene 无 missing / 红错
- [AC-PLAY-G2] Boss 首次从 BossSpawn 靠近玩家
- [AC-PLAY-G3] 单侧墙完成后该侧停刷（手测或模拟 emit BUILD_COMPLETE）

## 回滚策略

- 删除 `BossSpawner.ts`；revert `EnemySpawner`/`BuildPlot`/`SceneSetup`/`Main.scene`。
- `git checkout` 单文件失败时 MCP reimport scene。

## 修订记录

- v1（2026-09-02）：初始计划；范围 C：4.14+4.15+4.16；4.11–4.13 跳过；最小 BUILD_COMPLETE 占位供停刷，完整建造链留 §4.E。
