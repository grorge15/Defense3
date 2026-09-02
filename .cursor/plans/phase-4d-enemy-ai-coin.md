---
slug: phase-4d-enemy-ai-coin
版本: 1
状态: done
创建: 2026-09-02
---

# §4.D 缺口：EnemyAI + 金币系统（4.19 / 4.20）

## 业务目标

补齐 `AI_TASK_LIST.md` **§4.D** 中尚未交付的 **4.19 EnemyAI** 与 **4.20 CoinSystem**（含 `Coin.ts` + `pref_item_coin`）：小怪攻击经 AI 组件对接玩家扣血并 emit `HP_CHANGED`；怪死掉落金币并吸附玩家、逻辑加币 emit `COIN_CHANGED`。

**用户澄清**：选 **A** — 不做 4.17/4.18/4.21 返工；`CombatSystem` / `HealthSystem` / `BowItem` **仅只读核对**。

**不在范围**：§5 金币 UI prefab 精修（逻辑加币即可；UI 可监听 `COIN_CHANGED` 若已有则接线，无则文档标注待 §5）；抛物线 tween 精修属 §6；Boss/Barrier 迁 HealthSystem 属范围 B（本 plan 不做）。

## 风险等级

**中** — 新建 `EnemyAI` 需改 `EnemyMinion` 攻击路径；新建金币 prefab（须 MCP）；死亡掉落与 `EnemySpawner` 计数/对象池需兼容。

## 现状差距

| 任务 | 现状 | 本 plan |
|---|---|---|
| **4.17** CombatSystem | 已有，有弓自动射箭 | **只读核对** |
| **4.18** HealthSystem | 已有，Player 已挂 | **只读核对**（小怪仍自管 `_hp`，可暂不迁） |
| **4.19** EnemyAI | **无**；攻击内联在 `EnemyMinion.tryAttack` | **新建** + Minion 委托 |
| **4.20** CoinSystem | **无** `Coin.ts` / `pref_item_coin` / CoinSystem | **新建** 全套 |
| **4.21** BowItem | 已有拾取 `setHasBow` | **只读核对** |

## 变更文件清单

### 4.19

- 【可新建】`assets/scripts/enemy/EnemyAI.ts` — 索敌玩家、冷却、单体 `Player.takeDamage`（或 `HealthSystem`）；数值读 `GameConfig.minionAttackDamage`
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — `tryAttack` / 近战判定委托 `EnemyAI`；保留移动/动画在 Minion；**禁止**再建 `EnemyMinionController`
- 【仅只读参考】`HealthSystem.ts`、`Player.takeDamage`、`GameEvents.HP_CHANGED`

### 4.20

- 【可新建】`assets/scripts/item/Coin.ts` — 吸附玩家；拾取回调/销毁
- 【可新建】`assets/scripts/game/CoinSystem.ts` — 怪死掉落；维护总币；emit `COIN_CHANGED`；吸附目标=玩家
- 【可新建】`assets/resources/prefabs/item/pref_item_coin.prefab` — MCP；§P0-A；无嵌套 Canvas
- 【可写】`assets/scripts/core/GameConfig.ts` — `coinDropAmount`、`coinMagnetSpeed`、`coinMagnetRange`（或等价）
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — `_die` 通知 CoinSystem 掉落（或 emit 专用事件）
- 【可写】`assets/scripts/game/SceneSetup.ts` — 绑 `CoinSystem` 玩家/`Effect` 父节点（可选）
- 【可写】`assets/scenes/Main.scene` — MCP：挂 `CoinSystem`（GameRoot 旁或 Effect）；绑引用
- 【仅只读参考】`GameEvents.COIN_CHANGED`、`poolMaxCoins`、`LogExtendItem` 接触模式

### 核对（不改实现）

- 【仅只读参考】`CombatSystem.ts`、`Arrow.ts`、`pref_projectile_arrow`、`BowItem.ts`、`pref_item_bow`

## To-dos

### 4.19 EnemyAI

- [ ] **4.19.a**：新建 `EnemyAI.ts`：`setTarget` / `tryAttackPlayer`；冷却；读 `GameConfig.minionAttackDamage`；命中后依赖玩家侧 emit `HP_CHANGED`
- [ ] **4.19.b**：`EnemyMinion` 组合或 `getComponent(EnemyAI)`；近战范围内调用 AI；移除重复伤害逻辑
- [ ] **4.19.c**：`tsc`；Play：小怪持续伤玩家

### 4.20 金币

- [ ] **4.20.a**：`GameConfig` 补金币掉落/吸附数值
- [ ] **4.20.b**：新建 `Coin.ts`：朝玩家移动（直线先可，抛物线 §6）；触碰玩家 → 通知 CoinSystem → destroy
- [ ] **4.20.c**：MCP 创建 `pref_item_coin`（场景搭树 → `create-prefab-from-node`）；绑 `visualNode`；AC-P*
- [ ] **4.20.d**：新建 `CoinSystem.ts`：`dropAt(worldPos)`；维护 `_balance`；emit `COIN_CHANGED(delta, balance)`；父节点优先 `GameRoot/Effect`
- [ ] **4.20.e**：`EnemyMinion._die` → `CoinSystem.dropAt`（或 `EventManager`）；Boss 可选同路径（本 plan 至少 Minion）
- [ ] **4.20.f**：MCP 挂 `CoinSystem`；SceneSetup 补绑玩家；scene-save + AC-S*（若改 scene）

### 核对

- [ ] **4.D.verify**：报告记录 CombatSystem / HealthSystem / BowItem 路径存在且可运行（rg + 可选 MCP query）

## 实施步骤

1. **S1 前置门**：MCP Defense3；`tsc` 基线；确认 Effect 节点与 `COIN_CHANGED` 常量存在。
2. **S2（4.19）**：`EnemyAI` + 改 `EnemyMinion`。
3. **S3（4.20 prefab）**：`Coin.ts` + MCP `pref_item_coin` + AC-P。
4. **S4（4.20 system）**：`CoinSystem` + Minion 死亡掉落 + SceneSetup/MCP 挂场景。
5. **S5**：`tsc` + `verify-mcp-gate.ps1` + 编辑器无红错。
6. **S6 手测**：未拾弓不能攻（既有）；小怪伤玩家；杀怪掉币吸附加币。

## 校验点

### 4.19

- [AC-4.19-SCRIPT] `rg "class EnemyAI" assets/scripts/enemy/EnemyAI.ts` — 匹配
- [AC-4.19-WIRE] `rg "EnemyAI|tryAttack" assets/scripts/enemy/EnemyMinion.ts` — Minion 委托 AI
- [AC-4.19-PLAY] 手测：小怪近战玩家扣血 / Console 可见 `HP_CHANGED`（或血量变化）

### 4.20

- [AC-4.20-COIN-TS] `rg "class Coin" assets/scripts/item/Coin.ts` — 匹配
- [AC-4.20-SYS] `rg "class CoinSystem|COIN_CHANGED" assets/scripts/game/CoinSystem.ts` — ≥2
- [AC-4.20-PREFAB] `pref_item_coin.prefab` 存在
- [AC-4.20-P1] `rg '"_name": "Canvas"' assets/resources/prefabs/item/pref_item_coin.prefab` — 0
- [AC-4.20-P3] MCP query coin prefab `invalid: false`
- [AC-4.20-P3b] MCP：`Coin.visualNode` 非 null（若有该 property）
- [AC-4.20-EDITOR] 编辑器打开 `pref_item_coin` 无红错
- [AC-4.20-SCENE] MCP：`CoinSystem` 已挂；玩家引用非 null（或 SceneSetup 补绑）
- [AC-4.20-PLAY] 手测：杀小怪掉币 → 飞向玩家 → 币数增加（emit）

### 核对 / 公共

- [AC-4.D-VERIFY] `rg "class CombatSystem|class HealthSystem|class BowItem" assets/scripts` — 均存在
- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 0
- [AC-S1] 若改 Main.scene — `rg '"_id": "Node\.'` — 0
- [AC-S2] scene-open nodeId 非 `Node.*`
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 0
- [AC-EDITOR-MAIN] Main.scene 无 missing / 红错（改 scene 时）
- [AC-SCOPE] 未重写 `CombatSystem.ts` / `HealthSystem.ts` / `BowItem.ts`（diff 以 EnemyAI/Coin* / Minion 掉落 / SceneSetup 绑为主）

## 回滚策略

- 删除新建 `EnemyAI.ts`、`Coin.ts`、`CoinSystem.ts`、`pref_item_coin`（+meta）；revert `EnemyMinion` / `GameConfig` / `SceneSetup` / `Main.scene`。
- prefab 失败：MCP 删除后重建，禁止手写整份 JSON。

## 修订记录

- v1（2026-09-02）：初始计划；范围 A：仅 4.19 + 4.20；4.17/4.18/4.21 只读核对；金币 UI 留给 §5。
