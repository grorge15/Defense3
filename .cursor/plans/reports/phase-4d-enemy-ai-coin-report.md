# phase-4d-enemy-ai-coin 执行报告

- **计划版本**：1（首版）
- **状态**：机器 AC 全部通过 → 计划已标 **done**；Play AC 待用户手测
- **风险等级**：中
- **回滚基线**：`git HEAD` `6f27c54`（执行前）

## 修订记录摘要（相对上一版）

首版执行；相对上一版：**无**（本为 v1）。

## To-dos 完成矩阵

| Todo | 结果 |
|---|---|
| 4.19.a EnemyAI.ts | 完成 |
| 4.19.b EnemyMinion 委托 AI | 完成 |
| 4.19.c tsc / Play | tsc 完成；Play **待用户** |
| 4.20.a GameConfig 金币数值 | 完成 |
| 4.20.b Coin.ts | 完成 |
| 4.20.c MCP pref_item_coin + AC-P* | 完成 |
| 4.20.d CoinSystem.ts | 完成 |
| 4.20.e Minion._die → dropAt | 完成 |
| 4.20.f MCP 挂 CoinSystem + SceneSetup | 完成 |
| 4.D.verify 只读核对 | 完成 |

## 修改文件列表（diff 摘要）

| 文件 | 摘要 |
|---|---|
| `assets/scripts/enemy/EnemyAI.ts`（新建） | 索敌/`tryAttackPlayer`/冷却；`Player.takeDamage(GameConfig.minionAttackDamage)` |
| `assets/scripts/enemy/EnemyMinion.ts` | `get/addComponent(EnemyAI)`；`tryAttack` 委托；`_die` → `CoinSystem.dropAt` |
| `assets/scripts/item/Coin.ts`（新建） | 直线吸附；进入 `coinPickupRange` 回调加币并 destroy |
| `assets/scripts/game/CoinSystem.ts`（新建） | `dropAt`/`addCoins`/emit `COIN_CHANGED(delta, balance)`；单例 |
| `assets/scripts/core/GameConfig.ts` | `coinDropAmount`/`coinMagnetSpeed`/`coinMagnetRange`/`coinPickupRange` |
| `assets/scripts/game/SceneSetup.ts` | `coinSystem` 属性 + `_bindCoinSystem` |
| `assets/resources/prefabs/item/pref_item_coin.prefab`（MCP） | Root→Visual；Coin.visualNode→Visual；无嵌套 Canvas |
| `assets/scenes/Main.scene`（MCP） | `GameRoot/Effect` 挂 `CoinSystem`（coinPrefab/playerNode/dropRoot）；SceneSetup.coinSystem→33 |

**未改（AC-SCOPE）**：`CombatSystem.ts` / `HealthSystem.ts` / `BowItem.ts`（`git diff --stat` 空）。

## 校验点达成表

### 4.19

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.19-SCRIPT | 通过 | `class EnemyAI` 于 `EnemyAI.ts` |
| AC-4.19-WIRE | 通过 | Minion：`EnemyAI` + `tryAttack` → `_ai.tryAttackPlayer()` |
| AC-4.19-PLAY | **待用户** | 小怪近战扣血 / `HP_CHANGED` |

### 4.20

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.20-COIN-TS | 通过 | `class Coin` 于 `Coin.ts` |
| AC-4.20-SYS | 通过 | `class CoinSystem` + `COIN_CHANGED` |
| AC-4.20-PREFAB | 通过 | `pref_item_coin.prefab` 存在；uuid `fe5eb4d3-f704-45ea-affe-9e9e184b8070` |
| AC-4.20-P1 | 通过 | prefab 无 `"_name": "Canvas"` |
| AC-4.20-P3 | 通过 | MCP `invalid: false` |
| AC-4.20-P3b | 通过 | MCP `pref_item_coin/Coin`：`visualNode.uuid`=`Node.4518`（Visual）；磁盘 `visualNode.__id__=2` |
| AC-4.20-EDITOR | 通过* | MCP `scene-open` prefab 成功；`system-query-logs` error 空（*编辑器手开确认建议复验） |
| AC-4.20-SCENE | 通过 | Effect/`CoinSystem`：`coinPrefab`/`playerNode` 非空；SceneSetup.`coinSystem`→`__id__` 33 |
| AC-4.20-PLAY | **待用户** | 杀怪掉币→吸附→币数增加 |

### 核对 / 公共

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.D-VERIFY | 通过 | CombatSystem / HealthSystem / BowItem 均存在 |
| AC-COMPILE | 通过 | `npx tsc --noEmit -p tsconfig.json` exit 0 |
| AC-S1 | 通过 | `rg '"_id": "Node\.'` → 0；gate PASS |
| AC-S2 | 通过 | Effect `nodeId`=`Xi-p7xasW_4M4HYL-LshWg`（非 `Node.*`） |
| AC-GATE | 通过 | 见下方粘贴 |
| AC-EDITOR-MAIN | 通过* | MCP 打开 Main 成功；error 日志空 |
| AC-SCOPE | 通过 | 未重写 CombatSystem / HealthSystem / BowItem |

## MCP gate 输出粘贴

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1: assets/resources/prefabs/character has no Canvas
PASS AC-P1: assets/resources/prefabs/building has no Canvas
PASS AC-P2-CANVAS: prefabs/ui has no Canvas
PASS AC-P2-CAMERA: prefabs/ui has no Camera
PASS AC-P2-SIZE: prefabs/ui has no UITransform 1x1 placeholder
PASS AC-P-FAKE: no default_sprite literal in prefabs
PASS AC-P-EXTRA: no default_sprite in __editorExtras__

MCP gate (machine): ALL PASS — still run AC-P3/P3b/P4 via MCP + editor (cocos-mcp.mdc step 5)
```

## 失败项与障碍

无机器 AC 失败项。

Play 项（AC-4.19-PLAY / AC-4.20-PLAY）标 **待用户**：
1. 小怪近战持续伤玩家（可见血量/`HP_CHANGED`）
2. 杀小怪掉币 → 飞向玩家 → 余额增加（`COIN_CHANGED`）

## 风险备注

- 打开 `pref_item_coin` 时编辑器路径可能显示 `Canvas/pref_item_coin`（编辑态包装）；**磁盘 prefab 根无嵌套 Canvas**（与 4a 箭 prefab 同现象）。
- `EnemyAI` 在 `EnemyMinion.onLoad` 中 `addComponent`，无需立刻给每个 minion prefab MCP 加组件；后续可在 prefab 上预挂以显式 Inspector 调参。
- 金币 UI（§5）与抛物线（§6）不在本 plan 范围。
