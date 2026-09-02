---
slug: phase-1-parkour
版本: 2
状态: done
创建: 2026-09-01
---

# Phase 1：开局 + 跑酷段（可玩链）

## 业务目标

把**已有 prefab**（`pref_player`、`pref_log`、`pref_enemy_minion`、`pref_joystick`）与**本 Phase 新建**的跑酷 prefab/脚本，经 **MCP 场景装配 + SceneSetup 接线** 串成可手测的跑酷链（G1）。

**场景摆放分工（v2）**：
- **禁止**用代码/`instantiate` 在 `onLoad`/`start` 中生成**静态关卡布局**（玩家、滚木、电锯、预置怪、道具、UI 等须预先在场景落盘）。
- **允许** build-agent 经 MCP（`scene-create-node-by-asset` 等）按放置表向 `Main.scene` **批量实例化 prefab**、设坐标、挂脚本组件 — 属**常规装配**，无需额外用户批准（见 `defense3-workflow.mdc`）。
- AI 维护 `docs/SCENE_PLACEMENT.md`；用户仅在坐标/Inspector 需微调时在编辑器补操作。
- `EnemySpawner` 仅在 `SpawnPoint_Far` **运行时刷怪**（动态生成），不替代场景内预置怪与静态陷阱摆放。

## 风险等级

**中** — 多脚本新建 + MCP 批量改 `Main.scene`；须跑 AC-S* / AC-P* 门禁与编辑器验收。

## 现状差距

| 类别 | 已有 | 缺口 |
|---|---|---|
| Prefab | `pref_player`、`pref_log`、`pref_enemy_minion`、`pref_joystick` | `pref_trap_saw`、`pref_item_log_extend`、`pref_ui_joystick_hint` |
| 脚本 | `Player.ts`、`Log.ts`、`Joystick.ts`、`EnemyMinion.ts`、`GameManager.ts` | `SawTrap.ts`、`LogExtendItem.ts`、`JoystickHintUI.ts`、`EnemySpawner.ts`、`SceneSetup.ts`、`ParkourLineZone.ts` |
| 场景 | Phase 0 骨架齐全（挂点齐全） | **无 prefab 实例**；`SceneSetup`/`PhaseTransition`/`ParkourLineZone` 未挂接 |
| 系统 | `LOG_FIXED`/`PHASE_CHANGED` 事件链部分存在 | 开局 `RunParkour`、滚木固定 → `CombatGuide`、摇杆↔玩家绑定、远端刷怪、黄蓝线检测 |

## 变更文件清单

### 新建 prefab（MCP）

- 【可新建】`assets/resources/prefabs/trap/pref_trap_saw.prefab` + `SawTrap.ts`
- 【可新建】`assets/resources/prefabs/item/pref_item_log_extend.prefab` + `LogExtendItem.ts`
- 【可新建】`assets/resources/prefabs/ui/pref_ui_joystick_hint.prefab` + `JoystickHintUI.ts`

### 新建/扩展脚本

- 【可新建】`assets/scripts/game/SceneSetup.ts` — 开局接线（读场景已有节点，**不** spawn 静态关卡物）
- 【可新建】`assets/scripts/enemy/EnemySpawner.ts` — 仅 `SpawnPoint_Far` 运行时刷怪
- 【可新建】`assets/scripts/game/ParkourLineZone.ts` — 黄/蓝线 Trigger → `Log.enterChargeZone` / `tryLockAtFinish`
- 【可写】`assets/scripts/core/GameConfig.ts` — 刷怪间隔、蓝线最小滚木长度、摇杆提示延迟等
- 【可写】`assets/scripts/character/Player.ts` — 仅补开局钩子（若 SceneSetup 不足）
- 【可写】`assets/scripts/item/Log.ts` — 确认/补黄蓝线外部触发接口
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 简版朝玩家移动 AI（无金币掉落）

### 场景与文档（MCP 装配）

- 【可写】`assets/scenes/Main.scene` — **经 MCP** 按放置表实例化 prefab、挂组件、设坐标、绑 `@property`（禁止手写整份 scene JSON）
- 【可写】`docs/SCENE_PLACEMENT.md` — Phase 1 放置表 + 已交付 checklist

### 归档参考

- 【仅只读参考】`.cursor/plans/_archive_p2p3/p2-001-player.md`、`p2-002-log.md`、`p2-003-enemy-minion.md`、`p2-014-joystick.md`
- 【仅只读参考】`AI_TASK_LIST.md` §Phase 1、`docs/ANIM_MANIFEST.md`

## 场景放置表（MCP 执行；坐标可用户事后微调）

| 挂点路径 | prefab / 动作 | 数量 | 建议初值 | 备注 |
|---|---|---|---|---|
| `GameRoot/World/PlayerSpawn` | `pref_player` | 1 | `(0,0,0)` | 初始 parkour |
| `GameRoot/World/RoadRoot/LogAnchor` | `pref_log` | 1 | `(0,0,5)` | **勿**放 ParkourContent |
| `ParkourContent/SawTrap_1~3` | `pref_trap_saw` | 各 1 | 沿道路分布 | MCP 设本地坐标 |
| `ParkourContent/PreEnemy_1~8` | `pref_enemy_minion` | 各 1 | 道路中段 | |
| `ParkourContent` 下或道边 | `pref_item_log_extend` | ≥1 | 道边 | 可建空父节点 |
| `GameRoot/UI` | `pref_joystick` | 1 | 左下角 | Canvas 下 |
| `GameRoot/UI` | `pref_ui_joystick_hint` | 1 | 摇杆旁 | |
| `YellowLine` / `BlueLine` | 挂 `ParkourLineZone` + Trigger | — | — | MCP 挂组件 |
| `GameRoot` 或同级 | 空节点 + `SceneSetup` | 1 | — | 绑引用 |
| `SpawnPoint_Far` | 挂 `EnemySpawner` | — | — | **不**预摆小怪 |

### Inspector 绑定（MCP `scene-set-property` 或局部补丁；失败则文档写明用户补绑）

| 组件 | 属性 | 指向 |
|---|---|---|
| `SceneSetup` | `player` / `log` / `joystick` / `joystickHint` / `parkourContent` / `enemySpawner` | 对应实例/节点 |
| `ParkourLineZone` ×2 | `log` | LogAnchor 滚木 |
| `PhaseTransition` | `parkourContent` / `logNode` | 同上 |
| `Joystick.bindPlayer` | — | 由 SceneSetup `onLoad` 调用 |

## 实施步骤

1. **S1 前置门**：MCP `assets-query-path` 确认 Defense3；`npx tsc --noEmit` 基线。

2. **S2** 新建 `SawTrap.ts` + `pref_trap_saw`（MCP）：Trigger；碰 Player→`takeDamage`；碰 Log→`shrink()`；§P0-A 结构。

3. **S3** 新建 `LogExtendItem.ts` + `pref_item_log_extend`（MCP）：Trigger → `Log.extend()` 后销毁/隐藏。

4. **S4** 新建 `JoystickHintUI.ts` + `pref_ui_joystick_hint`（MCP）：3s 无输入显示；`defense` 后不显示。

5. **S5** 新建 `ParkourLineZone.ts`：yellow→`enterChargeZone`；blue→`tryLockAtFinish(length>=min)`。

6. **S6** 新建 `EnemySpawner.ts`：Far 点运行时刷怪；`LOG_FIXED` 后激活 Left/Right。

7. **S7** 新建 `SceneSetup.ts`：**不** instantiate 静态关卡物；绑玩家/滚木/摇杆；`setPhase(RunParkour)`；`LOG_FIXED`→`CombatGuide`。

8. **S8** `GameConfig` 补 `farSpawnInterval`、`blueLineMinLogLength`、`joystickHintDelay` 等。

9. **S9** `EnemyMinion` 简版朝玩家 AI。

10. **S10 MCP 场景装配**（常规，无需用户批准）：
    - `scene-open` Main.scene；按放置表 `scene-create-node-by-asset` 实例化全部静态 prefab；设坐标。
    - Yellow/BlueLine 挂 `ParkourLineZone` + BoxCollider2D Trigger。
    - 创建 `SceneSetup` 节点并挂脚本；尽量 MCP 绑 `@property`。
    - `SpawnPoint_Far` 挂 `EnemySpawner`；补绑 `PhaseTransition`。
    - `scene-save` → 跑 AC-S1/S2/GATE。

11. **S11 文档**：更新 `SCENE_PLACEMENT.md` §Phase 1（放置表 +「MCP 已实例化 / 用户可微调」）。

12. **S12 后置门**：prefab AC-P* + scene AC-S* + `verify-mcp-gate.ps1` + 编辑器打开无红错。

13. **S13 G1 手测**：用户按 G1 清单打勾（Play 模式）；报告记录结果。

## 校验点

### 机器 AC

- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 退出码 0
- [AC-SCRIPTS] `rg "class SceneSetup|class EnemySpawner|class SawTrap|class ParkourLineZone" assets/scripts` — ≥4
- [AC-PREFAB-SAW] `pref_trap_saw.prefab` 存在
- [AC-PREFAB-EXTEND] `pref_item_log_extend.prefab` 存在
- [AC-PREFAB-HINT] `pref_ui_joystick_hint.prefab` 存在
- [AC-P1] trap/item 新建 prefab 无嵌套 `"_name": "Canvas"`
- [AC-P2] UI prefab 无嵌套 Canvas/Camera；UITransform 非 1×1
- [AC-P3] MCP query 新建 prefab `invalid: false`
- [AC-P4] 编辑器打开新建 prefab — 无 missing / 红错
- [AC-SCENE-INST] MCP `scene-open` 后：PlayerSpawn/LogAnchor/SawTrap×3/PreEnemy×8/joystick/hint **均有 prefab 实例**
- [AC-SCENE-BIND] `SceneSetup` 关键引用非 null；黄蓝线已挂 `ParkourLineZone`（MCP 无法绑的项报告列出，用户补绑后复验）
- [AC-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — 0 匹配
- [AC-S2] MCP scene-open 后 nodeId 非 `Node.<数字>`
- [AC-S3] 若需：scene-close → library 同步 → reimport → scene-open
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 退出码 0
- [AC-DOC] `rg "Phase 1|MCP" docs/SCENE_PLACEMENT.md` — ≥2
- [AC-EDITOR] 编辑器打开 `Main.scene` — 无 missing script / 红错

### G1 手测（AC-G1，用户 Play）

1. 开局：玩家、滚木、7~8 怪、3 电锯、摇杆可见  
2. 摇杆仅左右；玩家自动向前推滚木  
3. 远端持续刷怪  
4. 碰电锯：玩家受伤、滚木变短  
5. 拾加长道具：滚木变长  
6. 过黄线：减速蓄力  
7. 过蓝线：够长→固定+左右刷怪；不够→滚出淡出  
8. 固定后全方向移动；电锯/黄蓝线仍可见；滚木在 LogAnchor  

## 回滚策略

- **脚本/prefab**：`git checkout` / MCP 删除新建 prefab。
- **场景**：`git checkout -- assets/scenes/Main.scene` + MCP reimport。
- 可先交付脚本+prefab，再单独跑 S10 场景装配。

## 修订记录

- v1（2026-09-01）：场景 prefab 由用户编辑器拖入；禁止 MCP 批量实例化。
- v2（2026-09-01）：**解除限制** — MCP 批量实例化属常规装配；删除 Part B 用户摆场暂停点与「禁止 MCP 拖入」；新增 S10 场景装配与 AC-SCENE-INST/BIND/S*；约束文件同步更新（`defense3-workflow` / plan-agent / build-agent / SCENE_PLACEMENT）。
