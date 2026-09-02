# phase-5-5-9-ui-manager 执行报告

- **计划版本**：1
- **修订记录摘要**：首版；用户范围 A（挂 GameRoot/UI；绑已有 UI；game_over + 玩家血条；阶段显隐；spawnHpBar）
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / AC-PLAY 待用户）
- **不做**：替换 HeroSelect 为 pref_ui_hero_select；不预挂全部小怪血条

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| UIManager.ts | **完成**（含 `_resolveRefs`、`spawnHpBar`、阶段显隐） |
| MCP 挂 GameRoot/UI/UIManager | **完成** |
| 绑 coin/joystick/hint/heroSelect/player/gameOver | **完成** |
| game_over 实例 | **完成**（`GameRoot/UI/pref_ui_game_over`） |
| 玩家血条 | **完成**（运行时 `playerHpBarPrefab` spawn） |
| spawnHpBar API | **完成** |
| 机器 AC + 报告 | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/ui/UIManager.ts` | 新建/完善；阶段显隐；spawnHpBar；缺引用运行时补找 |
| `assets/scenes/Main.scene` | MCP：UIManager 节点与绑定；实例化 pref_ui_game_over；Node.* _id 修补 |
| `docs/SCENE_PLACEMENT.md` | §5.9 接线表 |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-SCRIPT | **通过** | `class UIManager` + `spawnHpBar` + `PHASE_CHANGED` |
| AC-SCENE | **通过** | `GameRoot/UI/UIManager`；prefabs 与 UI 引用已绑 |
| AC-PHASE | **通过** | `_applyPhase`：GameOver 显示结束 UI / 关摇杆 |
| AC-SPAWN-API | **通过** | `spawnHpBar(kind, target, followAnchor)` |
| AC-COMPILE | **通过** | tsc exit 0 |
| AC-S1 | **通过** | Main.scene 无 `"_id": "Node.` |
| AC-GATE | **通过** | verify-mcp-gate exit 0 |
| AC-EDITOR | **待用户** | 打开 Main 无红错 |
| AC-PLAY | **待用户** | 阶段切换 UI；大招后 GameOver；spawnHpBar 小怪/Boss |

## verify-mcp-gate 输出

```
PASS AC-S1 / AC-S1b / AC-P1 / AC-P2 / AC-P-FAKE / AC-P-EXTRA
MCP gate (machine): ALL PASS
gate=0
```

## 失败项

无机器失败。

## Play 清单

1. 开局：金币 + 摇杆可见；结束面板隐藏
2. GameOver 阶段：结束 UI 弹出；摇杆隐藏
3. 调用 `UIManager.instance.spawnHpBar('enemy', minionNode, anchor)` 可见白底红条
4. 玩家血条随 `playerHpBarPrefab` 在 start 生成并跟随
