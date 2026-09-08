# phase-6-6-1-import-frames 执行报告

- **计划版本**：3
- **修订记录摘要**：v1 路径策略 A + 20 角色 clip；v2 道具 Y 浮动、电锯/箭矢序列帧、蓝黄升级 VFX；v3 放宽 `soldier_*` 空占位历史基线，为 `soldier_melee` / `soldier_ranged` 既有 clip 填入序列帧，并把士兵攻击生效点接入既有帧事件链。
- **计划状态**：`blocked`（v3 文件改动已完成；机器 AC 未全过）
- **是否续跑**：yes（只执行 v3 `6.1.q`～`6.1.w`；跳过已勾选 `6.1.a`～`6.1.p`，未重建 v1/v2 产物）
- **OpenSpec change**：none
- **风险等级**：中
- **写入前 git baseline**：`5a1059c`

## Todo 完成矩阵（v3）

| Todo | 状态 |
|---|---|
| 6.1.q ANIM_MANIFEST soldier 映射与 v3 放宽说明 | **完成** |
| 6.1.r 确认 `角色/佣兵2` / `角色/佣兵1` SpriteFrame 导入状态 | **完成**（所有 PNG `.meta` 均有 imported `f9941` SpriteFrame；未搬目录、未复制目录、未手写 `.meta` uuid） |
| 6.1.s Soldier.ts 接入 `playAttackWithFrameHit` / `AttackFrameRelay` | **完成**（ranged 出弹+伤害、melee 伤害改为帧事件回调触发；未改数值/冷却/目标选择/clip 名） |
| 6.1.t `soldier_melee` clip 填帧 + attack 事件 | **完成**（idle 6 帧 Loop；melee_attack 8 帧 Normal，`frame_013` -> 0.5s `onAttackFrameHit`；die 8 帧 Normal） |
| 6.1.u `soldier_ranged` clip 填帧 + attack 事件 | **完成**（idle 7 帧 Loop；remote_attack 12 帧 Normal，`frame_017` -> 0.9s `onAttackFrameHit`；die 8 帧 Normal） |
| 6.1.v soldier prefab/Animation 条件刷新 | **N/A**（prefab 已引用既有 soldier clip UUID；v3 未改 prefab 节点树或引用，仅 reimport 6 个 `.anim`） |
| 6.1.w 任务末机器 AC | **阻塞**（见 AC 结果） |

## 修改文件列表（v3）

| 文件 | 摘要 |
|---|---|
| `docs/ANIM_MANIFEST.md` | 新增 v3 士兵帧目录、clip 映射、攻击帧事件帧号；移除 soldier 仍缺帧口径；注明 v1/v2 soldier 空占位历史基线已由 v3 放宽 |
| `assets/scripts/character/Soldier.ts` | import `playAttackWithFrameHit`；tower/ranged 与 barracks/melee 攻击生效改为 `onAttackFrameHit` 回调；保留原数值、冷却、目标选择和 `remoteAttack` / `meleeAttack` 调用名 |
| `assets/resources/animations/soldier_melee/idle.anim` | 使用 `sprite/frames/角色/佣兵2/待机` 6 帧 SpriteFrame，Loop |
| `assets/resources/animations/soldier_melee/melee_attack.anim` | 使用 `sprite/frames/角色/佣兵2/攻击` 8 帧 SpriteFrame，Normal，0.5s `onAttackFrameHit` |
| `assets/resources/animations/soldier_melee/die.anim` | 使用 `sprite/frames/角色/佣兵2/死亡` 8 帧 SpriteFrame，Normal |
| `assets/resources/animations/soldier_ranged/idle.anim` | 使用 `sprite/frames/角色/佣兵1/待机` 7 帧 SpriteFrame，Loop |
| `assets/resources/animations/soldier_ranged/remote_attack.anim` | 使用 `sprite/frames/角色/佣兵1/攻击` 12 帧 SpriteFrame，Normal，0.9s `onAttackFrameHit` |
| `assets/resources/animations/soldier_ranged/die.anim` | 使用 `sprite/frames/角色/佣兵1/死亡` 8 帧 SpriteFrame，Normal |

**未改（v3 强制）**：未改 `Main.scene`；未改/新建 prefab；未改 `.meta` uuid；未搬迁或复制中文帧目录；未改 `playAnim` 字符串、战斗数值、冷却或目标选择；未重建 v1/v2 saw / arrow / upgrade VFX / item float；未做 §6.2～6.7。

## AC 结果

| AC | 结果 | 证据 |
|---|---|---|
| AC-SOLDIER-MANIFEST | **通过** | `docs/ANIM_MANIFEST.md` 含 v3 soldier_melee / soldier_ranged 映射、事件帧号与 soldier 空占位基线放宽说明 |
| AC-SOLDIER-MELEE | **通过** | `soldier_melee` 三个既有 clip 均有 `角色/佣兵2` SpriteFrame 曲线；`melee_attack` `_events[0] = { frame: 0.5, func: "onAttackFrameHit" }`，对应 `frame_013` |
| AC-SOLDIER-RANGED | **通过** | `soldier_ranged` 三个既有 clip 均有 `角色/佣兵1` SpriteFrame 曲线；`remote_attack` `_events[0] = { frame: 0.9, func: "onAttackFrameHit" }`，对应 `frame_017` |
| AC-SOLDIER-EVENT | **通过** | `AnimUtil.ATTACK_FRAME_HIT = "onAttackFrameHit"`；`AttackFrameRelay.onAttackFrameHit()` 为现有接收函数；`Soldier.ts` 使用 `playAttackWithFrameHit`，攻击生效在回调中 |
| AC-SOLDIER-NO-MOVE | **通过** | 未搬迁/复制 `assets/resources/sprite/frames/角色/佣兵1`、`佣兵2`；未写 `.meta` uuid |
| AC-NO-REGRESS-V3 | **失败 / 硬阻塞** | `playAnim` 调用名未改；但当前 `assets/resources/animations/player/parkour.anim` 有 4 帧 SpriteFrame 曲线，`assets/resources/animations/log/roll.anim` 有 10 帧 SpriteFrame 曲线。两者不是本次 v3 写入且无 `git diff`，按用户要求不得回退前序/用户产物 |
| AC-GATE | **失败 / 硬阻塞** | `verify-mcp-gate.ps1` 报 `Main.scene has Node.* token(s) (19 hit(s); includes fileId)`。`Main.scene` 是本次 v3 未改的既有 dirty 文件，按 v3 范围不得 patch/保存/重导入 scene |
| AC-P3 | **N/A** | v3 未新建或修改 prefab |
| AC-EDITOR-MCP | **N/A** | v3 未修改 prefab 或 `Main.scene` |

## verify-mcp-gate 输出

首次按要求执行：

```text
File C:\Users\Admin\Defense3\.cursor\scripts\verify-mcp-gate.ps1 cannot be loaded because running scripts is disabled on this system.
    + CategoryInfo          : SecurityError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

使用 `-ExecutionPolicy Bypass` 执行同一脚本：

```text
FAIL AC-S1: Main.scene has Node.* token(s) (19 hit(s); includes fileId)
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1: assets/resources/prefabs/character has no Canvas
PASS AC-P1: assets/resources/prefabs/building has no Canvas
PASS AC-P2-CANVAS: prefabs/ui has no Canvas
PASS AC-P2-CAMERA: prefabs/ui has no Camera
PASS AC-P2-SIZE: prefabs/ui has no UITransform 1x1 placeholder
PASS AC-P-FAKE: no default_sprite literal in prefabs
PASS AC-P-EXTRA: no default_sprite in __editorExtras__

MCP gate: 1 failure(s) - do not mark done
```

## MCP 指标

| 指标 | 次数/值 |
|---|---|
| assets-query-path | 1（`db://assets` -> `C:\Users\Admin\Defense3\assets`） |
| scene-open | 0 |
| scene-save | 0 |
| scene-close | 0 |
| verify-mcp-gate | 2（第一次被 PowerShell execution policy 拦截；第二次 Bypass 后执行并失败于既有 `Main.scene` `Node.*`） |
| post-scene-save Patched | N/A（v3 未改 scene；不得为本次范围外 dirty `Main.scene` 执行 patch/save 链） |
| assets-reimport-asset | 6（6 个 soldier `.anim`，均 `invalid:false`） |
| assets-refresh | 0 |
| create-prefab-from-node | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes |
| OpenSpec change | none |

## 硬阻塞与建议 replan 目标

1. `Main.scene` 当前已有 `Node.*` token，导致项目 AC-GATE 失败；本 v3 原则上不改 `Main.scene`，且用户明确禁止回退不属于本 v3 的改动。建议单独 replan/修复当前 `Main.scene` 的 `Node.*` remap 与 post-scene-save/reimport 链。
2. `player/parkour.anim` 与 `log/roll.anim` 当前已有 SpriteFrame 曲线，与 v3 AC-NO-REGRESS-V3 的“仍空”要求冲突；它们不是本次 v3 写入，且没有当前 diff 可回退。建议 replan 明确这是新基线还是需要允许专门清空这两个 clip。
