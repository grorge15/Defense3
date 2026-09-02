---
slug: phase-5-5-5-to-5-8-ui
版本: 1
状态: done
创建: 2026-09-02
---

# §5.5–5.8 UI Prefab + 脚本（不挂场景）

## 业务目标

用户选 **A**：prefab + 必需脚本；**不挂 Main.scene**；**不做 UIManager**（5.9）。

| 任务 | Prefab | 脚本 |
|---|---|---|
| 5.5 | `pref_ui_hp_bar_player` | 共享 `HpBarUI.ts`（黑底绿条） |
| 5.6 | `pref_ui_hp_bar_enemy` | 同上（白底红条；满血隐藏） |
| 5.7 | `pref_ui_hp_bar_boss` | 同上 + 白缓冲条 + Label |
| 5.8 | `pref_ui_game_over` | `GameOverUI.ts`（遮罩+标题+Next） |

## 校验点

- AC-P2 / AC-P3 / AC-P3b / AC-NO-SCENE / AC-COMPILE / AC-GATE
- AC-EDITOR 待用户

## 修订记录

- v1：范围 A。
