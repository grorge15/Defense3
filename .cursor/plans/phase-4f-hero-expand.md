---
slug: phase-4f-hero-expand
版本: 1
状态: done
创建: 2026-09-02
---

# §4.F 英雄与拓展：场景接线 + 验收（不建 UI prefab）

## 业务目标

闭环 `AI_TASK_LIST.md` **4.26 / 4.27 / 4.28**：核对已有 `HeroShrine` / `Hero` / `HeroSelectUI` / `BuildSystem` 逻辑，经 **MCP 补齐 Main.scene 引用**，使 G4 可跑通「建碑→选英雄→跟随攻击→拓展解锁」。

**用户澄清**：
- 采用「验收 + 场景接线」，**不返工**核心逻辑。
- **禁止**新建 `pref_ui_hero_select`（或任何英雄选择 UI **prefab 资产**）。

## 风险等级

**中** — 改 `Main.scene` 绑 `BuildSystem` 多引用；HeroSelectUI 依赖场景子节点树（遮罩+两卡），无 prefab 时须场景内搭树或临时自动选英雄。

## 现状差距

| 任务 | 代码 | 场景/资源缺口 |
|---|---|---|
| **4.26** | `HeroShrine`、`HeroSelectUI.ts` 已有 | 场景未见 `HeroSelectUI`/`BuildSystem` 挂载；**无** UI prefab（本 plan **不建**） |
| **4.27** | `Hero` 跟随/射弹/伤害已有；BuildSystem `onHeroSpawned`→`setFollowTarget` | 依赖 4.26 真正选出英雄 |
| **4.28** | BuildSystem：选英雄后 reveal `Plot_Expand`；`expandArea`→Barrier/高级塔 | 场景有 `Plot_Expand`/`BarrierWall_*`；BuildSystem 引用可能未绑 |

## 变更文件清单

- 【可写】`assets/scenes/Main.scene` — MCP：挂/绑 `BuildSystem`（地块、prefab、玩家、Barrier 根）；可选在 `GameRoot/UI` 下建 **场景节点**（非 `.prefab`）挂 `HeroSelectUI`
- 【可写】`assets/scripts/building/HeroShrine.ts`（可选）— `@property autoSelectOnActivate` 或 debug：无 UI 时自动 `onHeroSelected(0)`，便于验 4.27/4.28；默认 false，文档说明
- 【可写】`assets/scripts/game/SceneSetup.ts` — 确认 `heroSelectUI` / `buildSystem` 补绑
- 【可写】`docs/SCENE_PLACEMENT.md` — §4.F 接线表；注明 UI prefab 延后 §5
- 【仅只读参考】`BuildSystem.ts`、`Hero.ts`、`HeroSelectUI.ts`、`pref_hero_01/02`、弹道 prefab
- 【禁止新建】`assets/resources/prefabs/ui/pref_ui_hero_select.prefab`

## To-dos

### 4.26 二选一流程（无 UI prefab）

- [x] **4.26.a**：MCP 查询 `BuildSystem` / `HeroSelectUI` 是否在场景；缺则挂 `BuildSystem` 到 GameRoot（或既有节点）
- [x] **4.26.b（二选一，build 择优）**：
  - **优先**：MCP 在 `GameRoot/UI` 下建场景节点 `HeroSelect`（子节点：Mask、Card0、Card1，尺寸可用），挂 `HeroSelectUI` — **不是** create-prefab；或
  - **备选**：`HeroShrine` 增加「无监听 UI 时自动选英雄 0」开关，本 plan 默认开启以便 G4，正式 UI 留给 §5
- [x] **4.26.c**：核对 `HERO_SELECT_REQUESTED` → 选英雄 → `onHeroSelected` → 生成 `pref_hero_*`
- [x] **4.26.d**：**禁止** `assets-create` / `create-prefab-from-node` 产出 `pref_ui_hero_*`

### 4.27 跟随与攻击

- [x] **4.27.a**：确认 BuildSystem `_onHeroSpawned` 调用 `setFollowTarget(playerNode)`；MCP 绑 `playerNode`
- [x] **4.27.b**：确认 `Hero.tryAttack` / 弹道 prefab 在英雄 prefab 上已绑（缺则 MCP 补绑，不改攻击算法）
- [ ] **4.27.c**：Play：英雄跟随玩家并可伤小怪

### 4.28 拓展解锁

- [x] **4.28.a**：MCP 绑 `expandPlots`、`barrierWallL/R`、`barrierLongCenter`、`expandSideWalls`、`towerAdvancedPlots`
- [ ] **4.28.b**：核对选英雄后 `Plot_Expand` 显示；`expandArea` 完成后 Barrier/高级塔地块激活
- [x] **4.28.c**：更新 `SCENE_PLACEMENT.md` §4.F

## 实施步骤

1. **S1**：MCP 前置；盘点 BuildSystem `@property` 与场景节点。
2. **S2（4.26）**：场景接线 +（场景 UI 树 **或** 自动选英雄兜底）；**不建 UI prefab**。
3. **S3（4.27）**：玩家/弹道引用核对；手测跟随攻击。
4. **S4（4.28）**：拓展相关引用绑齐；手测 expand。
5. **S5**：AC-S* / gate / 编辑器；报告写明「UI prefab 未建，§5 补」。

## 校验点

- [AC-4.26-NO-PREFAB] `Test-Path assets/resources/prefabs/ui/pref_ui_hero_select.prefab` — **False**（本 plan 不得创建）
- [AC-4.26-WIRE] MCP：存在 `BuildSystem`；兵营后可 reveal/spawn 英雄碑路径（代码+引用）
- [AC-4.26-SELECT] 存在可选英雄路径：场景 `HeroSelectUI` **或** `autoSelect` 兜底（报告写明采用哪种）
- [AC-4.27-FOLLOW] `rg "setFollowTarget" assets/scripts/building/BuildSystem.ts` — 匹配；MCP `playerNode` 非 null
- [AC-4.27-ATK] `rg "tryAttack|_spawnProjectile" assets/scripts/character/Hero.ts` — 匹配
- [AC-4.28-EXPAND] MCP：`expandPlots` / Barrier 根引用非 null（或文档列出待用户补绑项）
- [AC-COMPILE] `npx tsc --noEmit` — 0
- [AC-S1] 改 scene 后 `Node.` _id — 0
- [AC-S2] scene-open nodeId 合法
- [AC-GATE] `verify-mcp-gate.ps1` — 0
- [AC-EDITOR] Main.scene 无 missing / 红错
- [AC-G4] 手测：建碑→（选英雄或自动）→跟随攻击→拓展地块可买→Barrier/高级塔显隐

## 回滚策略

- `git checkout -- assets/scenes/Main.scene`；revert `HeroShrine`/`SceneSetup`/`SCENE_PLACEMENT` 若改。
- 删除误建的 UI prefab（若违反禁令创建了）及 `.meta`。

## 修订记录

- v1（2026-09-02）：初始计划；验收+接线；**明确禁止新建英雄选择 UI prefab**；可选场景内节点树或自动选英雄兜底。
