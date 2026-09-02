---
slug: phase-4g-game-phases
版本: 1
状态: done
创建: 2026-09-02
---

# §4.G 阶段切换：GamePhase 接线 + 轻量 CombatGuide（4.29 / 4.30）

## 业务目标

按 `AI_TASK_LIST.md` **4.29 / 4.30**：把主流程关键节点接到 `GameManager.setPhase(GamePhase.*)`；统一 `PHASE_CHANGED` 载荷；CombatGuide 做**无 UI**轻量引导（日志 / 可选标记节点），不建引导箭头 prefab。

**用户澄清**：选 **A**。

## 风险等级

**中** — 改 Joystick/Player/SceneSetup/PhaseTransition/BuildSystem 的事件语义，易破坏跑酷/防守移动；须兼容旧 `'defense'`/`'parkour'` 或一并迁移。

## 现状差距

| 任务 | 现状 | 缺口 |
|---|---|---|
| **4.29** | `GamePhase` 七值、`GameManager.setPhase` 已有 | 仅 `RunParkour`→`CombatGuide`；Build/Defense/Ultimate/GameOver 未 `setPhase`；`PhaseTransition`/`SceneSetup` 另 emit 字符串 `'defense'` |
| **4.30** | `LOG_FIXED`→`CombatGuide` | 无拾弓/Boss/金币引导钩子 |

## 建议阶段映射（写入实现）

| 触发 | `GamePhase` |
|---|---|
| 开局 `SceneSetup` | `RunParkour` |
| `LOG_FIXED` | `CombatGuide` |
| `BOTH_WALLS_COMPLETE`（首墙建造阶段开始可用 `BuildPhase1`；两墙后） | `BuildPhase1`（滚木固定后可先 `BuildPhase1`，或 CombatGuide 内建墙；**推荐**：`LOG_FIXED`→`CombatGuide`，`BOTH_WALLS_COMPLETE`→`BuildPhase2`） |
| 拓展完成 / 进入防守拓展 | `DefensePhase` |
| `BOTH_ADVANCED_TOWERS_COMPLETE` | `Ultimate`（若 4.H 未做则仅 setPhase，大招逻辑留给 4.33） |
| 游戏结束（4.H） | `GameOver`（本 plan 可只预留调用点） |

> 精确映射以 `defense3.md` 为准；计划允许微调，但须在报告写清最终表。

## 变更文件清单

- 【可写】`assets/scripts/game/GameManager.ts` — 可选：`advanceFromEvent` 辅助；保持 `setPhase` 唯一出口
- 【可写】`assets/scripts/game/SceneSetup.ts` — 去掉重复 emit `'defense'`；依赖 `setPhase(CombatGuide)` + 监听方映射
- 【可写】`assets/scripts/game/PhaseTransition.ts` — `BOTH_WALLS_COMPLETE` 后改为 `GameManager.setPhase(...)`，勿裸 emit 字符串（或双发兼容期）
- 【可写】`assets/scripts/building/BuildSystem.ts` — 关键节点 `setPhase`（BuildPhase / DefensePhase）
- 【可写】`assets/scripts/character/Player.ts`、`assets/scripts/ui/Joystick.ts`、`JoystickHintUI.ts` — `_onPhaseChanged` 识别 `GamePhase` 枚举值（及短期兼容旧字符串）
- 【可新建】`assets/scripts/game/CombatGuideController.ts`（可选）— 无 UI：进入 CombatGuide 时 `console`/可选高亮弓节点；监听拾弓/首次击杀；不强制改玩法
- 【可写】`docs/SCENE_PLACEMENT.md` 或短注释 — 阶段表
- 【仅只读参考】`GamePhase.ts`、`GameEvents.ts`、`BossSpawner.ts`

## To-dos

### 4.29 阶段接线

- [x] **4.29.a**：文档化最终「事件→GamePhase」表（写进 plan 报告）
- [x] **4.29.b**：`LOG_FIXED`→仅 `setPhase(CombatGuide)`；删除或降级 SceneSetup 额外 `'defense'` emit
- [x] **4.29.c**：`BOTH_WALLS_COMPLETE`→`setPhase(BuildPhase2)`（或表定值）；PhaseTransition 不破坏显隐逻辑
- [x] **4.29.d**：BuildSystem 拓展完成→`setPhase(DefensePhase)`；若已有高级塔完成事件则→`Ultimate`（无则跳过）
- [x] **4.29.e**：Player / Joystick / JoystickHintUI：把 `combat_guide`/`build_*`/`defense_phase` 映射为 defense 移动；`run_parkour`→parkour

### 4.30 轻量 CombatGuide

- [x] **4.30.a**：新建或 SceneSetup 内：进入 `CombatGuide` 时确保弓可见、BossSpawner 仍触发（已有则只接 phase）
- [x] **4.30.b**：无 UI：可选 `@property` 引导节点（箭头空节点）`active=true` 直至 `setHasBow`；无节点则仅 log
- [x] **4.30.c**：**禁止**新建引导 UI prefab

## 实施步骤

1. **S1**：梳理所有 `PHASE_CHANGED` / `setPhase` 调用点。
2. **S2**：实现映射表 + 改监听方兼容 `GamePhase`。
3. **S3**：BuildSystem / PhaseTransition / SceneSetup 接线。
4. **S4**：轻量 CombatGuideController（或 SceneSetup 扩展）。
5. **S5**：`tsc`；手测跑酷→固定→CombatGuide 移动/摇杆→两墙后阶段值正确。

## 校验点

- [AC-4.29-MAP] 报告含完整事件→GamePhase 表
- [AC-4.29-SET] `rg "setPhase\\(GamePhase\\." assets/scripts` — ≥3（含 Build/Defense 等后续阶段至少一处）
- [AC-4.29-COMPAT] Player/Joystick 识别 `GamePhase.CombatGuide` 或 `defense_phase` 为全向移动
- [AC-4.29-NO-ORPHAN] `PhaseTransition` / `SceneSetup` 不再作为唯一阶段源裸发 `'defense'`（或双发且有注释兼容）
- [AC-4.30-ENTER] 进入 CombatGuide 有明确代码路径（Controller 或 SceneSetup）
- [AC-4.30-NO-UI-PREFAB] 未新建 `pref_ui_*guide*` / 引导箭头 prefab
- [AC-COMPILE] `npx tsc --noEmit` — 0
- [AC-PLAY] 手测：开局 parkour→蓝线后 CombatGuide 全向移动→两墙后 phase 变化（Console 可见）

## 回滚策略

- revert 改动的 GameManager 调用点与 Joystick/Player；删除 `CombatGuideController.ts` 若新建。

## 修订记录

- v1（2026-09-02）：初始计划；范围 A：4.29 接线 + 无 UI 的 4.30；Ultimate/GameOver 仅预留。
