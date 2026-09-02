---
slug: phase-5-5-1-coin-ui
版本: 1
状态: done
创建: 2026-09-02
---

# §5.1 金币数量 UI（phase-5-5-1-coin-ui）

## 业务目标

新建 `pref_ui_coin` + `CoinUI.ts`；监听 `COIN_CHANGED`；MCP 挂到 `GameRoot/UI`；开局 0、增减刷新。用户选 **A**；图标绑 `金币.png`。

## 风险等级

**中** — UI prefab 须 MCP；禁止嵌套 Canvas/Camera；AC-P2 尺寸。

## 变更文件清单

- 【可新建】`assets/scripts/ui/CoinUI.ts`
- 【可新建】`assets/resources/prefabs/ui/pref_ui_coin.prefab`（仅 MCP）
- 【可写】`assets/scenes/Main.scene` — MCP 实例化
- 【可写】`docs/SCENE_PLACEMENT.md`

## To-dos

- [ ] CoinUI.ts
- [ ] MCP prefab（Background/Icon/Amount）
- [ ] MCP 挂 GameRoot/UI
- [ ] tsc + gate + 报告

## 校验点

- AC-SCRIPT / AC-P2 / AC-P3 / AC-P3b / AC-COMPILE / AC-S1 / AC-S2 / AC-GATE / AC-EDITOR / AC-PLAY

## 修订记录

- v1（2026-09-02）：范围 A；绑 金币.png。
