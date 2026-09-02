---
slug: phase-4e-build-system
版本: 1
状态: done
创建: 2026-09-02
---

# §4.E 建造系统：BuildSystem + 墙/塔/兵营（4.22–4.24）

## 业务目标

按 `AI_TASK_LIST.md` **4.22 / 4.23 / 4.24** 实现建造编排：`LOG_FIXED` 解锁墙地块 → 扣币建墙生成 `Wall` 并对齐楼梯、触发侧别停刷 → 两墙完成 `BOTH_WALLS_COMPLETE` → 解锁初级塔+兵营地块 → 生成 `Tower`/`Barracks` 并 `activate()`。

**用户澄清**：选 **A**。**4.25 PhaseTransition 只读核对**（已 done，禁止整棵 `ParkourContent.active=false`）。

**依赖**：`BuildPlot`、墙/塔/兵营 prefab 已有；`CoinSystem` 若 `phase-4d` 未交付 → BuildSystem 提供 stub getter（无限币或本地余额），接口与 `setAvailableCoins` 兼容。

## 风险等级

**中** — 跨 BuildPlot / 建筑 prefab / 事件 / 场景引用；须 MCP 挂 `BuildSystem` 并绑地块与 spawn 锚点；破坏 `PhaseTransition` 则 G1/G3 回退。

## 现状差距

| 任务 | 现状 | 本 plan |
|---|---|---|
| **4.22** | 无 `BuildSystem`；地块初始常 `active=false`；`BuildPlot` 有绿条/`BUILD_COMPLETE` | **新建** BuildSystem：解锁链 + 扣币注入 + 生成建筑 |
| **4.23** | `Wall.activate` 仅挡路；无侧别字段；停刷依赖 4.16 `spawnSide` | 生成 Wall、对齐楼梯锚点、两墙 emit `BOTH_WALLS_COMPLETE` |
| **4.24** | `Tower`/`Barracks` 有 `activate`/`spawnSoldiers` | BuildSystem 完成时 instantiate + `activate` |
| **4.25** | `PhaseTransition` 已按子节点隐藏 | **只读核对** |

## 变更文件清单

- 【可新建】`assets/scripts/building/BuildSystem.ts` — 全局建造编排（唯一建造系统脚本，禁止 `BuildController`）
- 【可写】`assets/scripts/building/BuildPlot.ts` — 与 BuildSystem 接线（`setAvailableCoins`、完成前勿 destroy 直至回调返回，或 BuildSystem 在 destroy 前读 type/side）；必要时延迟 destroy
- 【可写】`assets/scripts/building/Wall.ts` — `@property spawnSide`；`activate()` 保持；可选楼梯对齐偏移
- 【可写】`assets/scripts/building/Tower.ts` / `Barracks.ts` — 仅确认 `activate` API；必要时补 `soldierPrefab` 场景绑定文档
- 【可写】`assets/scripts/game/SceneSetup.ts` — 可选补绑 BuildSystem / CoinSystem
- 【可写】`assets/scenes/Main.scene` — MCP：挂 BuildSystem；绑 wall/tower/barracks 地块节点、建筑 prefab、楼梯/生成锚点
- 【可写】`docs/SCENE_PLACEMENT.md` — 建造解锁顺序与锚点表
- 【仅只读参考】`PhaseTransition.ts`、`GameEvents`（`LOG_FIXED`/`BOTH_WALLS_COMPLETE`/`BUILD_COMPLETE`）
- 【仅只读参考】`pref_wall` / `pref_tower_basic` / `pref_barracks` / `pref_build_plot`
- 【仅只读参考】`CoinSystem`（若存在）或 stub
- 【仅只读参考】归档 `p4-005-build.md`（解锁顺序参考，简化：本 plan 用 `@property` 引用数组，不必完整 BuildPlotUnlock 框架）

## 解锁顺序（权威）

1. 开局：墙/塔/兵营地块 **`active=false`**
2. `LOG_FIXED` → `Plot_Wall_L` + `Plot_Wall_R` 显示
3. 单侧墙 `BUILD_COMPLETE`（wall + spawnSide）→ instantiate `pref_wall` @ 该侧锚点 → `Wall.activate()` →（已有 EnemySpawner 停刷）
4. 左右墙均完成 → emit `BOTH_WALLS_COMPLETE` → 显示 `Plot_Tower_1/2`（或 TowerBasic L/R）+ `Plot_Barracks`
5. 塔/兵营完成 → instantiate 对应 prefab → `Tower.activate()` / `Barracks.activate()`
6. **本 plan 不做**：英雄碑/拓展/高级塔（§4.F / 3.7）

## To-dos

### 4.22 BuildSystem

- [x] **4.22.a**：新建 `BuildSystem.ts`：监听 `LOG_FIXED` 显示墙地块；注入 `setAvailableCoins`（CoinSystem.getBalance 或 stub）
- [x] **4.22.b**：监听 `BUILD_COMPLETE` / `onBuildComplete`：按 `buildType` 生成建筑；计数墙完成
- [x] **4.22.c**：两墙完成后 emit `BOTH_WALLS_COMPLETE`；reveal 塔+兵营地块
- [x] **4.22.d**：MCP 挂组件；绑地块 Node 数组与墙/塔/兵营 Prefab + spawn 锚点

### 4.23 墙

- [x] **4.23.a**：`Wall` 增加 `spawnSide`（可选）；BuildSystem 生成时设侧别并对齐 `Stairs` 左/右锚点（`@property` 左右墙挂点）
- [x] **4.23.b**：确认与 4.16 停刷事件兼容（同一 `BUILD_COMPLETE` payload）
- [ ] **4.23.c**：Play：单侧墙出现并挡路；双侧后 `BOTH_WALLS_COMPLETE`（PhaseTransition 藏预置怪/黄蓝线）— **待用户手测**

### 4.24 塔与兵营

- [x] **4.24.a**：BuildSystem 对 `towerBasic` → `pref_tower_basic` + `activate()`；对 `barracks` → `pref_barracks` + `activate()`
- [x] **4.24.b**：确认塔顶/兵营 `soldierPrefab` 在 prefab 或场景实例上已绑（缺则 MCP 补绑）
- [ ] **4.24.c**：Play：塔兵远程、营兵周期近战（G3 部分）— **待用户手测**

### 4.25 核对

- [x] **4.25.v**：rg/`scene-query`：`PhaseTransition` 仍按子节点隐藏；**无** `parkourContent.active = false` 整树关闭

## 实施步骤

1. **S1**：MCP 前置；确认 BuildPlots 子节点与建筑 prefab 存在；CoinSystem 有无决定 stub。
2. **S2**：实现 `BuildSystem` 解锁与完成派发。
3. **S3**：墙生成 + 锚点 + `BOTH_WALLS_COMPLETE`。
4. **S4**：塔/兵营生成 + activate；补 soldierPrefab 绑定。
5. **S5**：MCP 场景接线；文档；AC-S* / gate / 编辑器。
6. **S6**：G3 手测清单（建墙→停刷→两墙藏跑酷线怪→塔营出兵）。

## 校验点

### 4.22

- [AC-4.22-SCRIPT] `rg "class BuildSystem|LOG_FIXED|BOTH_WALLS_COMPLETE" assets/scripts/building/BuildSystem.ts` — ≥3
- [AC-4.22-SCENE] MCP：`BuildSystem` 已挂；墙/塔/兵营地块引用非 null
- [AC-4.22-COIN] BuildPlot 有 `setAvailableCoins` 注入（rg 或 MCP）

### 4.23

- [AC-4.23-SPAWN] 墙完成后场景出现 `Wall` 实例（Play 或代码路径 rg instantiate pref_wall）
- [AC-4.23-BOTH] 两墙后 emit `BOTH_WALLS_COMPLETE`（代码路径存在）

### 4.24

- [AC-4.24-TOWER] `BuildSystem` 处理 `towerBasic` → Tower.activate
- [AC-4.24-BARRACKS] 处理 `barracks` → Barracks.activate

### 4.25 / 公共

- [AC-4.25-V] `rg "parkourContent\.active\s*=\s*false" assets/scripts/game/PhaseTransition.ts` — **0** 匹配
- [AC-COMPILE] `npx tsc --noEmit` — 0
- [AC-S1] 改 scene 后 `Node.` _id — 0
- [AC-S2] scene-open nodeId 合法
- [AC-GATE] `verify-mcp-gate.ps1` — 0
- [AC-EDITOR] Main.scene 无 missing / 红错
- [AC-G3] 手测：滚木固定出墙地块；建墙；两墙后出塔+兵营并可出兵；跑酷子节点按 PhaseTransition 规则隐藏

## 回滚策略

- 删除 `BuildSystem.ts`；revert BuildPlot/Wall/SceneSetup/Main.scene。
- 场景失败：`git checkout -- assets/scenes/Main.scene` + reimport。

## 修订记录

- v1（2026-09-02）：初始计划；范围 A：4.22–4.24；4.25 只读核对；CoinSystem stub 兜底；英雄/拓展不在本 plan。
