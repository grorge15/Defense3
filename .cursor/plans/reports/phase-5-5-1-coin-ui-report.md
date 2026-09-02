# phase-5-5-1-coin-ui 执行报告

- **计划版本**：1（首版）
- **修订记录摘要**：首版，无相对上一版步骤/校验点改动
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / AC-PLAY 待用户）
- **用户澄清**：A（prefab + CoinUI + 挂 GameRoot/UI；绑 金币.png）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| CoinUI.ts | **完成**（已存在，核对） |
| MCP pref_ui_coin | **完成**（已存在可用；未重建） |
| MCP 挂 GameRoot/UI | **完成**（`pref_ui_coin_001`；位姿左上） |
| tsc + gate + 报告 | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/ui/CoinUI.ts` | 听 `COIN_CHANGED`；初始化 balance |
| `assets/resources/prefabs/ui/pref_ui_coin.prefab` | Background/Icon/Amount；CoinUI 三引用已绑 |
| `assets/scenes/Main.scene` | 实例 `GameRoot/UI/pref_ui_coin_001`；修复非法 `_id` Node.2782 |
| `docs/SCENE_PLACEMENT.md` | §5.1 接线表 |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-SCRIPT | **通过** | `CoinUI` + `COIN_CHANGED` |
| AC-P2 | **通过** | gate：无 Canvas/Camera；无 1×1；尺寸 240×64 / 48×48 / 120×40 |
| AC-P3 | **通过** | MCP `invalid: false` |
| AC-P3b | **通过** | amountLabel / iconSprite / background 非 null |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-S1 | **通过** | Main.scene 无 `"_id": "Node.` |
| AC-S2 | **通过** | 实例 nodeId=`wQLiI8wAx95uqWDgKhguhT` |
| AC-GATE | **通过** | verify-mcp-gate exit 0 |
| AC-EDITOR | **待用户** | 打开 prefab/Main 无红错 |
| AC-PLAY | **待用户** | 开局 Label=0；拾币/扣币刷新 |

## verify-mcp-gate 输出

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1/P2/P-FAKE/P-EXTRA: ALL PASS
MCP gate (machine): ALL PASS
gate_exit=0
```

## 失败项

无机器失败。

## Play 清单

1. 进 Play：左上角金币条显示 **0**
2. 击杀掉落金币吸附后 Label 增加
3. 建造扣币后 Label 减少
