---
slug: p2-012-items
版本: 1
状态: draft
创建: 2026-08-31
---

# P2-012 道具 `pref_item_*` + `LogExtendItem` / `BowItem` / `Coin`

## 业务目标

实现三类拾取道具：滚木加长（`LogExtendItem.ts`）、弓箭（`BowItem.ts`）、金币（`Coin.ts`），并产出对应 `pref_item_log_extend`、`pref_item_bow`、`pref_item_coin` 预制体。跑酷段滚木/玩家碰撞触发加长；弓箭使 `Player.setHasBow(true)`；金币拾取派发 `COIN_CHANGED` 并预留吸附目标接口。完整 CoinSystem（P4-004）与抛物线美术动画（P6）不在本任务内。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，三道具均含 Trigger 拾取与核心效果，不合并 P4-004。

## 风险等级

**中** — 3 脚本 + 3 prefab；跨 `Player` / `Log` 联动；金币全局钱包未建需事件预埋；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/item/LogExtendItem.ts` — 滚木加长道具
- 【可新建】`assets/scripts/item/BowItem.ts` — 弓箭道具
- 【可新建】`assets/scripts/item/Coin.ts` — 金币掉落物
- 【可新建】`assets/resources/prefabs/item/pref_item_log_extend.prefab`
- 【可新建】`assets/resources/prefabs/item/pref_item_bow.prefab`
- 【可新建】`assets/resources/prefabs/item/pref_item_coin.prefab`
- 【仅只读参考】`assets/scripts/item/Log.ts` — `extend()`
- 【仅只读参考】`assets/scripts/character/Player.ts` — `setHasBow()`
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — `logExtendAmount` 等
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `COIN_CHANGED`
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`assets/scripts/core/Billboard.ts` / `SortingOrder2D.ts`（可选 Visual）
- 【仅只读参考】`assets/resources/sprite/default_sprite.png`
- 【仅只读参考】`AI_TASK_LIST.md` — P2-012 / P4-004
- 【仅只读参考】`defense3.md` — 道具拾取规则

## 实施步骤

### S1: 确认占位资源

三道具均复用 `default_sprite`；**无 Animation clip**（收集抛物线动画留 P6）。

### S2: 实现 `LogExtendItem.ts`

路径 `assets/scripts/item/LogExtendItem.ts`。

- 根节点 `Collider2D`（`isTrigger = true`）
- `onTriggerEnter`：对方含 `Player` 或 `Log` 组件时，对场景中/碰撞关联的 `Log` 调用 `extend()`（延长量由 `Log`/`GameConfig` 处理）
- 拾取后 `node.destroy()` 或 `active = false`
- 仅跑酷段有效：可检测 `Player` 模式或 `ParkourContent` 父级（build 阶段二选一）

### S3: 实现 `BowItem.ts`

路径 `assets/scripts/item/BowItem.ts`。

- Trigger 碰撞 `Player` → `player.setHasBow(true)`
- 拾取后销毁节点
- 塔防战斗引导用，通常非跑酷段放置

### S4: 实现 `Coin.ts`

路径 `assets/scripts/item/Coin.ts`。

- `@property coinValue` 默认 1（或读 GameConfig 若后续扩展）
- `setMagnetTarget(target: Node | null)`：供 P4 设置玩家吸附目标
- `update`：距目标小于阈值时视为拾取，派发 `EventManager.emitEvent(GameEvents.COIN_CHANGED, delta)`（payload 与 P4-004 约定一致）
- 可选简单向目标移动（线性吸附），**不**实现完整抛物线轨迹
- 敌人死亡生成由 P4 负责，本任务仅可拾取 prefab

### S5: 创建三个 prefab

路径 `assets/resources/prefabs/item/`：

| prefab | 脚本 | 碰撞 |
|---|---|---|
| `pref_item_log_extend` | LogExtendItem.ts | Trigger |
| `pref_item_bow` | BowItem.ts | Trigger |
| `pref_item_coin` | Coin.ts | Trigger |

结构：Root（脚本 + Collider2D）+ 可选 Visual（Sprite + SortingOrder2D）。**禁止**手写 uuid。

### S6: 编译与 AC 校验

报告写入 `.cursor/plans/reports/p2-012-items-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class LogExtendItem" assets/scripts/item/LogExtendItem.ts`: 有匹配
- [AC-3] `rg "class BowItem" assets/scripts/item/BowItem.ts`: 有匹配
- [AC-4] `rg "class Coin" assets/scripts/item/Coin.ts`: 有匹配
- [AC-5] `test -f assets/resources/prefabs/item/pref_item_log_extend.prefab && test -f assets/resources/prefabs/item/pref_item_bow.prefab && test -f assets/resources/prefabs/item/pref_item_coin.prefab`: 退出码 0
- [AC-6] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-7] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-8] `rg "default_sprite" assets/resources/prefabs/item/pref_item_coin.prefab`: 有匹配
- [AC-9] `rg "extend|Log" assets/scripts/item/LogExtendItem.ts`: 有匹配
- [AC-10] `rg "setHasBow" assets/scripts/item/BowItem.ts`: 有匹配
- [AC-11] `rg "COIN_CHANGED|setMagnetTarget" assets/scripts/item/Coin.ts`: 有匹配

## 回滚策略

- **基线**：`git rev-parse HEAD`
- **失败恢复**：删除本任务新建 3 脚本、3 prefab 及 `.meta`

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-001 `Player.ts` | ✅ `setHasBow()` |
| P2-002 `Log.ts` | 计划/实现中；`extend()` |
| P4-004 CoinSystem | 未建；监听 `COIN_CHANGED` |
| P5-001 CoinUI | 未建 |
| G2 手测 | 拾弓→射箭→掉金币 |
