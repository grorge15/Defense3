# phase-4g-game-phases 执行报告

- **计划版本**：1
- **修订记录摘要**：首版（v1）；修订记录无改动（相对无上一版步骤/校验点变更）
- **用户澄清**：A（4.29 接线 + 无 UI 的 4.30；Ultimate/GameOver 仅预留）
- **风险等级**：中
- **计划状态**：done（机器 AC 全过；AC-PLAY 待用户）
- **场景 MCP**：本 plan **仅脚本接线**，未改 `Main.scene`；**跳过** AC-S* / verify-mcp-gate（报告说明）

---

## To-dos 完成矩阵

| Todo | 状态 |
|------|------|
| 4.29.a 事件→GamePhase 表 | 完成 |
| 4.29.b SceneSetup 去 `'defense'` 裸发 | 完成 |
| 4.29.c PhaseTransition→BuildPhase2 | 完成 |
| 4.29.d BuildSystem DefensePhase / Ultimate 预留 | 完成 |
| 4.29.e Player/Joystick/JoystickHintUI 映射 | 完成 |
| 4.30.a CombatGuide 进入路径 + BossSpawner | 完成 |
| 4.30.b 无 UI：log / 可选 marker | 完成 |
| 4.30.c 禁止引导 UI prefab | 完成 |

---

## 最终事件 → GamePhase 映射表（AC-4.29-MAP）

| 触发 | GamePhase | 调用点 |
|------|-----------|--------|
| 开局 `SceneSetup.onLoad` | `RunParkour` | `SceneSetup` |
| `LOG_FIXED` | `CombatGuide` | `SceneSetup._onLogFixed` → `setPhase`；`CombatGuideController` 监听进入 |
| 建墙期（滚木固定后～两墙前） | 保持 `CombatGuide`（**未**切 `BuildPhase1`；墙地块已由 BuildSystem 在 LOG_FIXED reveal） | — |
| `BOTH_WALLS_COMPLETE` | `BuildPhase2` | `PhaseTransition`（显隐逻辑保留） |
| 拓展完成 `expandArea` | `DefensePhase` | `BuildSystem._onExpandComplete` |
| 两侧高级塔完成 / `BOTH_ADVANCED_TOWERS_COMPLETE` | `Ultimate` | `BuildSystem` 追踪 + emit + `setPhase`（大招逻辑留给 4.33） |
| 游戏结束 | `GameOver` | `GameManager.setGameOver()` **预留** |

移动语义：`run_parkour` → parkour；`combat_guide` / `build_phase_*` / `defense_phase` / `ultimate` / `game_over` → defense 全向；短期兼容旧 `'defense'` / `'parkour'`。

---

## 修改文件列表

| 文件 | 摘要 |
|------|------|
| `assets/scripts/character/Player.ts` | `_onPhaseChanged` 识别 GamePhase + 旧字符串 |
| `assets/scripts/ui/Joystick.ts` | 同上映射为 parkour/defense |
| `assets/scripts/ui/JoystickHintUI.ts` | 离开跑酷后关闭提示（含 combat_guide 等） |
| `assets/scripts/game/SceneSetup.ts` | 删除裸发 `'defense'`；`_ensureCombatGuide` |
| `assets/scripts/game/PhaseTransition.ts` | `BOTH_WALLS` → `setPhase(BuildPhase2)`；保留子节点显隐 |
| `assets/scripts/building/BuildSystem.ts` | expand→DefensePhase；高级塔→Ultimate 预留 |
| `assets/scripts/game/GameManager.ts` | 预留 `setGameOver()` |
| `assets/scripts/game/CombatGuideController.ts` | **新建**轻量引导（log + 可选 bowGuideMarker） |
| `docs/SCENE_PLACEMENT.md` | 追加 GamePhase 接线表 |

未改 `Main.scene`；未新建任何 `pref_ui_*guide*` / 引导箭头 prefab。

---

## 校验点达成表

| AC | 结果 | 证据 |
|----|------|------|
| AC-4.29-MAP | **通过** | 见上文最终映射表 |
| AC-4.29-SET | **通过** | `setPhase(GamePhase.*)` ≥3：RunParkour、CombatGuide、BuildPhase2、DefensePhase、Ultimate |
| AC-4.29-COMPAT | **通过** | Player/Joystick 含 `GamePhase.CombatGuide` → defense |
| AC-4.29-NO-ORPHAN | **通过** | SceneSetup/PhaseTransition 无 `emitEvent(PHASE_CHANGED, 'defense')` |
| AC-4.30-ENTER | **通过** | `setPhase(CombatGuide)` + `CombatGuideController._enterCombatGuide`；SceneSetup 仍 schedule BossSpawner |
| AC-4.30-NO-UI-PREFAB | **通过** | 未新建引导 UI prefab |
| AC-COMPILE | **通过** | `npx tsc --noEmit` → exit 0 |
| AC-PLAY | **待用户** | 手测：开局 parkour→蓝线后 CombatGuide 全向→两墙后 Console 见 `build_phase_2` |

---

## 失败项与障碍

无机器 AC 失败项。

**待用户**：AC-PLAY 手测清单见上。

---

## 回滚提示

revert 上述脚本改动；删除 `CombatGuideController.ts`（及编辑器自动生成的 `.meta`）。
