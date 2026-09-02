---
slug: phase-5-5-9-ui-manager
版本: 1
状态: done
创建: 2026-09-02
---

# §5.9 UIManager 统一入口

## 业务目标

用户选 **A**：新建 `UIManager.ts`；MCP 挂 `GameRoot/UI`；绑已有 UI；实例化 `pref_ui_game_over` + 玩家血条；按 `GamePhase` 显隐；小怪/Boss 血条 `spawnHpBar` API。

## 不做

- 不做 B/C：不替换场景 HeroSelect；不预挂全部小怪血条
- 精细飞币/倒 8 留给 §6

## 校验点

- AC-SCRIPT / AC-SCENE / AC-PHASE / AC-SPAWN-API / AC-COMPILE / AC-S1 / GATE / AC-EDITOR / AC-PLAY

## 修订记录

- v1：范围 A。
