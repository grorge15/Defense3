---
slug: phase-4b-parkour-verify
版本: 1
状态: done
创建: 2026-09-02
---

# §4.B 跑酷与滚木：验收 + 滚动表现补丁

## 业务目标

`AI_TASK_LIST.md` **§4.B（4.7–4.10）** 清单已标 done；本 plan 做 **验收闭环 + 唯一代码缺口补丁**：`Log.ts` 补 **程序旋转滚动表现**（`roll` clip 已存在为空占位）。不重写 `SawTrap` / `LogExtendItem` / `ParkourLineZone` / `SceneSetup`。

**用户澄清**：选 **A**。

## 风险等级

**低** — 仅改 `Log.ts` 滚动视觉；其余只读核对场景绑定与 G1。

## 现状差距

| 任务 | 磁盘现状 | 本 plan |
|---|---|---|
| **4.7** | 同速推动 + 居中已有；**无** Visual 程序旋转 / `playAnim('roll')` | **补丁** |
| **4.8** | `SawTrap.shrink` / `LogExtendItem.extend` 已有 | 只读核对 |
| **4.9** | `ParkourLineZone` + `enterChargeZone` / `tryLockAtFinish` 已有 | 只读核对 |
| **4.10** | `SceneSetup`：`RunParkour`、`LOG_FIXED`→`CombatGuide` 已有 | MCP 核对六引用 |

## 变更文件清单

- 【可写】`assets/scripts/item/Log.ts` — `rolling`/`charging` 时按前进速度旋转 Visual（绕长度轴或 X/Z，与道路前进轴一致）；可选 `playAnim(visual, 'roll')` 一次或循环占位
- 【可写】`docs/SCENE_PLACEMENT.md`（可选）— 记 §4.B 验收勾选
- 【仅只读参考】`assets/resources/animations/log/roll.anim`、`docs/ANIM_MANIFEST.md` §log
- 【仅只读参考】`SawTrap.ts`、`LogExtendItem.ts`、`ParkourLineZone.ts`、`SceneSetup.ts`、`GameConfig.ts`
- 【仅只读参考】`assets/scenes/Main.scene` — 绑定核查（无强制改 scene，除非引用 Missing）

## To-dos

- [ ] **4.7.a**：`Log.fixedUpdate`：在 `rolling`/`charging` 且未锁定时，根据 `linearVelocity` 长度对 `visualNode` 做程序旋转（读 `GameConfig` 系数若需新增 `logRollAngularScale`，否则用现有速度推导，避免魔法数散落）
- [ ] **4.7.b**：`beginParkour` 或进入 rolling 时 `playAnim(visualNode, 'roll')`（clip 已占位）；固定/失败时停止或切 idle（若无 idle 则停 Animation）
- [ ] **4.8.a**：只读确认 `SawTrap`→`shrink`、`LogExtendItem`→`extend`；报告贴路径
- [ ] **4.9.a**：MCP/`scene-query-component`：Yellow/Blue `ParkourLineZone.log` 非 null；`blueLineMinLogLength` 存在
- [ ] **4.10.a**：MCP：`SceneSetup` 六引用非 null；`LOG_FIXED`→`CombatGuide` 代码路径存在
- [ ] **4.B.g1**：用户 Play：G1 中与滚木相关项（推木、电锯变短、加长、黄蓝线、固定后切阶段）

## 实施步骤

1. **S1**：`tsc` 基线；只读扫 4.8–4.10 入口。
2. **S2（4.7）**：实现 Visual 滚动旋转 + `roll` anim 触发；不改推动/居中逻辑。
3. **S3**：MCP 核对 SceneSetup / ParkourLineZone（仅 Missing 时才改 scene）。
4. **S4**：`tsc`；报告写清 4.8–4.10 核对证据 + AC-G1 待用户。

## 校验点

- [AC-4.7-ROLL] `rg "playAnim|visualNode\.(euler|setRotation|rotate)" assets/scripts/item/Log.ts` — ≥1（有旋转或 anim）
- [AC-4.7-PUSH] `rg "getVelocity|bindPlayer" assets/scripts/item/Log.ts` — 推动逻辑仍在
- [AC-4.8] `rg "shrink|extend" assets/scripts/trap/SawTrap.ts assets/scripts/item/LogExtendItem.ts` — 均有
- [AC-4.9] MCP：`ParkourLineZone` ×2，`log` 非 null
- [AC-4.10] MCP：`SceneSetup` player/log/joystick/joystickHint/parkourContent/enemySpawner 非 null
- [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 0
- [AC-SCOPE] 未重写 `SceneSetup`/`ParkourLineZone`/`SawTrap`（diff 以 `Log.ts` 为主）
- [AC-G1-LOG] 用户手测：推木同步、电锯/加长、黄蓝线、固定→CombatGuide

## 回滚策略

- **基线**：改前 `Log.ts` hash / `git stash`
- **失败**：`git checkout -- assets/scripts/item/Log.ts`

## 修订记录

- v1（2026-09-02）：初始计划；范围 A：4.7 滚动表现补丁 + 4.8–4.10 验收核对；不整节返工。
