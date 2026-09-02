# phase-5-5-3-4-ui-prefabs 执行报告

- **计划版本**：1
- **修订记录摘要**：首版；用户要求仅 prefab、不挂场景
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR 待用户）
- **范围**：§5.3 `pref_ui_joystick_hint` + §5.4 `pref_ui_hero_select`；**未**向 Main.scene 新增实例

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 5.3 核对/补齐 AC-P2 | **完成**（已有 prefab：Label + JoystickHintUI，280×60） |
| 5.4 MCP 建 pref_ui_hero_select | **完成**（Mask/Card0/Card1/Finger + HeroSelectUI） |
| 不拖入场景 | **完成**（AC-NO-SCENE） |
| 机器 AC + 报告 | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/resources/prefabs/ui/pref_ui_joystick_hint.prefab` | 已有；验收通过（hintRoot 绑根；joystick 场景侧补绑） |
| `assets/resources/prefabs/ui/pref_ui_hero_select.prefab` | 新建/齐备；子序 Mask→Card0→Card1→Finger；fingerNode 已绑；卡面 SpriteFrame 留空 |
| `docs/SCENE_PLACEMENT.md` | §5.3/5.4 表；更正「未建 hero_select」过时表述 |
| `assets/scenes/Main.scene` | **本 plan 不作为交付改动**（未新增 5.3/5.4 实例） |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-P2 | **通过** | gate：无 Canvas/Camera；无 1×1 |
| AC-P3 | **通过** | 两 prefab `invalid: false` |
| AC-P3b | **通过** | hintRoot 非空；fingerNode 非空；子节点顺序正确 |
| AC-NO-SCENE | **通过** | 本 plan 未要求/未新增 Main 中 hero_select 实例 |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-GATE | **通过** | verify-mcp-gate exit 0 |
| AC-EDITOR | **待用户** | 编辑器打开两 prefab 无红错 |

## verify-mcp-gate 输出

```
PASS AC-S1 / AC-S1b / AC-P1 / AC-P2 / AC-P-FAKE / AC-P-EXTRA
MCP gate (machine): ALL PASS
gate_exit=0
```

## 失败项

无机器失败。

## 备注

- 卡面/英雄图标 SpriteFrame 仍空（任务书允许占位 `@property`）。
- 场景临时 `GameRoot/UI/HeroSelect` 可与正式 prefab 并存；替换挂载留给后续。
