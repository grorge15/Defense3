# phase-5-5-5-to-5-8-ui 执行报告

- **计划版本**：1
- **修订记录摘要**：首版；用户范围 A（prefab+脚本；不挂场景；不做 UIManager）
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / Play 待用户）
- **本批不做**：Main.scene 实例化、`UIManager.ts`（§5.9）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 5.5 pref_ui_hp_bar_player + HpBarUI | **完成**（黑底绿条；fillSprite 已绑） |
| 5.6 pref_ui_hp_bar_enemy | **完成**（白底红条；`hideWhenFull=true`；Bg 色修正为白） |
| 5.7 pref_ui_hp_bar_boss | **完成**（红 Fill + 白 Buffer + Value Label；缓动在 HpBarUI） |
| 5.8 pref_ui_game_over + GameOverUI | **完成**（Mask α=102 + Title + Next Level） |
| AC-NO-SCENE | **完成** |
| 机器 AC + 报告 | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/ui/HpBarUI.ts` | 共享血条：HP_CHANGED、跟随、Boss 缓冲缓动 |
| `assets/scripts/ui/GameOverUI.ts` | GameOver 显隐 + Next 占位 |
| `assets/scripts/core/GameConfig.ts` | `hpBarBufferLerpSpeed`（已有） |
| `assets/resources/prefabs/ui/pref_ui_hp_bar_player.prefab` | Bg+Fill 绿 |
| `assets/resources/prefabs/ui/pref_ui_hp_bar_enemy.prefab` | 白底红 Fill；hideWhenFull |
| `assets/resources/prefabs/ui/pref_ui_hp_bar_boss.prefab` | Buffer+Fill+Label |
| `assets/resources/prefabs/ui/pref_ui_game_over.prefab` | Mask/Title/NextButton |
| `docs/SCENE_PLACEMENT.md` | §5.5–5.8 表 |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-P2 | **通过** | gate：无 Canvas/Camera；无 1×1 |
| AC-P3 | **通过** | 四 prefab `invalid: false` |
| AC-P3b | **通过** | fillSprite；boss buffer+valueLabel；game_over panelRoot+nextButton |
| AC-NO-SCENE | **通过** | 未新增 Main 实例 |
| AC-COMPILE | **通过** | tsc exit 0 |
| AC-GATE | **通过** | verify-mcp-gate exit 0 |
| AC-EDITOR | **待用户** | 打开四 prefab 无红错 |
| AC-PLAY | **待用户** | 绑 target 后受伤比例；Boss 白条缓动；GameOver 阶段弹出 |

## verify-mcp-gate 输出

```
PASS AC-S1 / AC-S1b / AC-P1 / AC-P2 / AC-P-FAKE / AC-P-EXTRA
MCP gate (machine): ALL PASS
gate=0
```

## 失败项

无机器失败。

## 备注

- `targetNode` / `followAnchor` 运行时或场景挂载时再绑（本 plan 不挂场景）。
- Next Level 仅 console + `onNextLevel` 回调；完整关卡流留给后续。
