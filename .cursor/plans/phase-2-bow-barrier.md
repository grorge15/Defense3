---
slug: phase-2-bow-barrier
版本: 1
状态: done
创建: 2026-09-01
---

# §2.8 弓箭道具 + §2.19 阻挡物（Prefab + 脚本框架）

## 业务目标

按 `AI_TASK_LIST.md` **2.8 / 2.19** 交付可复用资源：**`pref_item_bow` + `BowItem.ts`**、**`pref_barrier_wall` / `pref_barrier_long` + `Barrier.ts`**。本 Phase 只做 Prefab + 脚本框架；**不**改 `Main.scene`、**不**写 `CombatSystem` / 完整血条 UI（场景摆放属 3.4 / 3.7，攻击接通属 §4.D）。

**用户澄清**：选 **A**。

## 风险等级

**中** — 新建 3 个 prefab（须 Defense3 MCP，禁手写 JSON）+ 2 个脚本；不改场景，无 AC-S* 场景门禁。

## 现状差距

| 任务 | 现状 | 缺口 |
|---|---|---|
| **2.8** | `Player.setHasBow` / `_hasBow` 已有；`tryAttack` 无弓 return | 无 `BowItem.ts`、无 `pref_item_bow` |
| **2.19** | `GameConfig.barrierMaxHp` 已有；`Wall.ts` 仅矮墙无血量 | 无 `Barrier.ts`、无 `pref_barrier_wall` / `pref_barrier_long` |

## 变更文件清单

- 【可新建】`assets/scripts/item/BowItem.ts` — Trigger 拾取 → `Player.setHasBow(true)` 后销毁/隐藏
- 【可新建】`assets/resources/prefabs/item/pref_item_bow.prefab` — MCP；§P0-A 结构
- 【可新建】`assets/scripts/building/Barrier.ts` — HP 读 `barrierMaxHp`；`takeDamage`；血条锚点；挡怪 Collider（非 sensor）
- 【可新建】`assets/resources/prefabs/building/pref_barrier_wall.prefab` — MCP；短阻挡
- 【可新建】`assets/resources/prefabs/building/pref_barrier_long.prefab` — MCP；长阻挡（同脚本，尺寸不同）
- 【可写】`docs/SCENE_PLACEMENT.md`（可选）— 仅追加 §2.8/2.19 资源条目，**不**写场景实例坐标表为必做
- 【仅只读参考】`assets/scripts/character/Player.ts` — `setHasBow` / `tryAttack`
- 【仅只读参考】`assets/scripts/item/LogExtendItem.ts` — Trigger 拾取模式
- 【仅只读参考】`assets/scripts/building/Wall.ts` — 与 Barrier 职责分离（Wall 无血量）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — `barrierMaxHp`
- 【仅只读参考】`AI_TASK_LIST.md` §2.8、§2.19

## To-dos

### 2.8 弓箭道具

- [x] **2.8.a**：新建 `BowItem.ts`：`Collider2D` sensor + `BEGIN_CONTACT`；碰 `Player` → `setHasBow(true)` → `destroy`/隐藏自身；`@property visualNode`
- [x] **2.8.b**：MCP 创建 `pref_item_bow`（推荐：场景搭树 → `create-prefab-from-node`）：Root + Trigger Collider + `BowItem`；`Visual` + Sprite（占位）+ Billboard + SortingOrder2D；`anchorY=0`；拆除嵌套 Canvas/Camera
- [x] **2.8.c**：MCP 绑 `BowItem.visualNode`；`assets-query-asset-info` `invalid: false`；编辑器打开无红错

### 2.19 阻挡物

- [x] **2.19.a**：新建 `Barrier.ts`：唯一主脚本；`maxHp`/`_hp` 读 `GameConfig.barrierMaxHp`；`takeDamage(amount)`；死亡 `active=false` 或禁用 Collider；暴露 `hpBarAnchor: Node`（满血可隐藏，UI 挂载属 §5）；`flashRed` 可留空方法或最小 tween 占位；**禁止** `BarrierController.ts`
- [x] **2.19.b**：MCP 创建 `pref_barrier_wall`：Root + 非 Trigger Collider（挡怪）+ `Barrier`；`Visual` + Sprite + Billboard + SortingOrder2D；子节点 `HpBarAnchor`；无嵌套 Canvas
- [x] **2.19.c**：MCP 创建 `pref_barrier_long`：同结构；Collider/Visual 尺寸更长（与 wall 区分）；共用 `Barrier.ts`
- [x] **2.19.d**：两 prefab 绑 `visualNode` / `hpBarAnchor`；AC-P* + 编辑器无红错

## 实施步骤

1. **S1 前置门**：MCP `assets-query-path` 确认 Defense3；`npx tsc --noEmit` 基线。
2. **S2（2.8.a）**：实现 `BowItem.ts`（对齐 `LogExtendItem` 接触模式）。
3. **S3（2.8.b–c）**：MCP 建 `pref_item_bow` → 绑引用 → AC-P。
4. **S4（2.19.a）**：实现 `Barrier.ts`（与 `Wall` 分离：有 HP、可受伤）。
5. **S5（2.19.b–d）**：MCP 建 `pref_barrier_wall` / `pref_barrier_long` → 绑引用 → AC-P。
6. **S6**：`npx tsc --noEmit`；`verify-mcp-gate.ps1`（prefab 相关）；编辑器打开三 prefab 无红错。
7. **S7（禁止）**：本 plan **不** `scene-open` 改 `Main.scene`；不实现射箭/怪打 Barrier 的 AI。

## 校验点

### 2.8

- [AC-2.8-SCRIPT] `rg "setHasBow|class BowItem" assets/scripts/item/BowItem.ts` — ≥2
- [AC-2.8-PREFAB] `Test-Path assets/resources/prefabs/item/pref_item_bow.prefab` — True
- [AC-2.8-P1] `rg '"_name": "Canvas"' assets/resources/prefabs/item/pref_item_bow.prefab` — 0
- [AC-2.8-P3] MCP `assets-query-asset-info` pref_item_bow — `invalid: false`
- [AC-2.8-P3b] MCP `scene-query-component`：`BowItem.visualNode` 非 null
- [AC-2.8-EDITOR] 编辑器打开 `pref_item_bow` — 无 missing / 红错

### 2.19

- [AC-2.19-SCRIPT] `rg "barrierMaxHp|takeDamage|hpBarAnchor" assets/scripts/building/Barrier.ts` — ≥3
- [AC-2.19-PREFAB-W] `pref_barrier_wall.prefab` 存在
- [AC-2.19-PREFAB-L] `pref_barrier_long.prefab` 存在
- [AC-2.19-P1] `rg '"_name": "Canvas"' assets/resources/prefabs/building/pref_barrier_wall.prefab assets/resources/prefabs/building/pref_barrier_long.prefab` — 0
- [AC-2.19-P3] MCP query 两 barrier prefab — `invalid: false`
- [AC-2.19-P3b] MCP：`Barrier.visualNode` 与 `hpBarAnchor` 非 null（两 prefab）
- [AC-2.19-EDITOR] 编辑器打开两 barrier prefab — 无 missing / 红错

### 公共

- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 退出码 0
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 退出码 0（prefab 相关）
- [AC-SCOPE] 本 plan **未**修改 `assets/scenes/Main.scene`（`git diff` 无该文件，或报告注明未改）

## 回滚策略

- **基线**：build 前记录新建路径；`git status` 记录。
- **失败**：MCP 删除新建 prefab + `.meta`；删除 `BowItem.ts` / `Barrier.ts`；不回滚无关文件。

## 修订记录

- v1（2026-09-01）：初始计划；覆盖 2.8 + 2.19；范围 A（仅 Prefab+脚本，不摆场、不接 CombatSystem）。
