# phase-1-parkour 执行报告

| 项 | 值 |
|---|---|
| slug | phase-1-parkour |
| 计划版本 | **2** |
| 计划状态（本报告后） | **done** |
| 风险等级 | 中 |
| 执行日 | 2026-09-01 |

## 修订记录摘要（相对 v1）

- **v1**：场景 prefab 由用户编辑器拖入；禁止 MCP 批量实例化。
- **v2**：解除限制 — MCP 批量实例化属常规装配；新增 S10 与 AC-SCENE-INST/BIND/S*。

## 本轮相对「半成品」补了什么

| 步骤 | 本轮动作 |
|---|---|
| S1–S9 | **已存在且合格**：脚本 / GameConfig / Log 接口 / EnemyMinion AI / 新建 prefab — **未重写** |
| S10 | **核对**：Main.scene 已有全部静态实例 + SceneSetup / ParkourLineZone / EnemySpawner / PhaseTransition；MCP `scene-query-component` 确认关键 `@property` 非 null（跨 prefab 引用经 scene `targetOverrides`） |
| S10 缺口修复 | `pref_joystick` Knob `UITransform` 曾为 1×1 → MCP 设为 80×80 + Sprite `sizeMode=CUSTOM` 后 `scene-save`；hint 宽 220 |
| S11 | 更新 `docs/SCENE_PLACEMENT.md` Phase 1 MCP 放置表 + checklist |
| S12 | `verify-mcp-gate.ps1` 退出码 0；AC-S1/S2/P*；清日志后重开 Main 无 error |
| S13 / AC-G1 | **待用户 Play 手测** |

## 修改文件列表（本轮）

| 文件 | 变更 |
|---|---|
| `assets/resources/prefabs/ui/pref_joystick.prefab` | Knob UITransform 80×80；Sprite sizeMode CUSTOM（MCP save） |
| `assets/resources/prefabs/ui/pref_ui_joystick_hint.prefab` | UITransform width 220（局部） |
| `docs/SCENE_PLACEMENT.md` | Phase 1 MCP 装配表与 checklist |
| `.cursor/plans/phase-1-parkour.md` | 状态 → done |
| `.cursor/plans/reports/phase-1-parkour-report.md` | 本报告 |

> 脚本与 trap/item/hint prefab、Main.scene 主体实例化属前序半成品，本轮以验收+文档+UI 尺寸修复为主。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-COMPILE | **通过** | `npx tsc --noEmit -p tsconfig.json` 退出码 0 |
| AC-SCRIPTS | **通过** | SceneSetup / EnemySpawner / SawTrap / ParkourLineZone 均存在 |
| AC-PREFAB-SAW | **通过** | `pref_trap_saw.prefab` 存在 |
| AC-PREFAB-EXTEND | **通过** | `pref_item_log_extend.prefab` 存在 |
| AC-PREFAB-HINT | **通过** | `pref_ui_joystick_hint.prefab` 存在 |
| AC-P1 | **通过** | trap/item 无嵌套 `"_name": "Canvas"` |
| AC-P2 | **通过** | UI 无 Canvas/Camera；无 1×1 UITransform（gate PASS） |
| AC-P3 | **通过** | MCP query 三新建 prefab `invalid: false` |
| AC-P3b | **通过** | SawTrap.visualNode 非 null；Joystick 有 background/knob |
| AC-P4 | **通过** | MCP `scene-open` pref_trap_saw / joystick；清日志后无新 error |
| AC-SCENE-INST | **通过** | Player/Log/Saw×3/PreEnemy×8/joystick/hint/log_extend 均在 nestedPrefabInstanceRoots |
| AC-SCENE-BIND | **通过** | SceneSetup 六引用非 null；黄蓝线 ParkourLineZone.log 已绑；PhaseTransition 已绑 |
| AC-S1 | **通过** | `rg Node.` → 0；gate PASS |
| AC-S2 | **通过** | scene-open 根/实例 nodeId 非 `Node.<数字>`（如 `ZRu_hTcRtE1zhxlSefMwyA`） |
| AC-S3 | **跳过** | 无需 `_id` patch |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` 退出码 0 |
| AC-DOC | **通过** | SCENE_PLACEMENT 含 Phase 1 + MCP（≥2） |
| AC-EDITOR | **通过** | 清日志后 `scene-open` Main → `system-query-logs` error 空 |
| AC-G1 | **待用户手测** | Play 模式按计划 G1 清单 1–8 |

## 失败项与障碍

无阻塞机器 AC。遗留仅 **AC-G1 用户手测**。

## 风险备注

- 中：场景依赖大量跨 prefab `targetOverrides`；用户若在编辑器断引用需复验 AC-SCENE-BIND。
- 低：本轮对 `pref_joystick` Knob 做了尺寸修复（MCP save），属 UI 可用性门禁必需。
