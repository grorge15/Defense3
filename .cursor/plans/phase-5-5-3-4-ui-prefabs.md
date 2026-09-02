---
slug: phase-5-5-3-4-ui-prefabs
版本: 1
状态: done
创建: 2026-09-02
---

# §5.3 + §5.4 仅制作 UI Prefab（不挂场景）

## 业务目标

用户明确：**仅制作 prefab，无需拖入场景**。

- **5.3** `pref_ui_joystick_hint`：核对/补齐 AC-P2（已有则验收，缺则 MCP 建）
- **5.4** `pref_ui_hero_select`：MCP 新建；挂 `HeroSelectUI`（脚本已有）；结构 Mask + Card0 + Card1 + Finger；素材 `@property` 可空占位
- **禁止**：改 Main.scene 实例化；不复制 SFK chooseView 资源

## 风险等级

中 — UI prefab MCP；禁止嵌套 Canvas/Camera。

## 校验点

- AC-P2：两 prefab 无 Canvas/Camera；无 1×1
- AC-P3：invalid false
- AC-P3b：关键引用（hint 脚本属性；hero select fingerNode 等）
- AC-NO-SCENE：本 plan 不新增 Main.scene 实例
- AC-COMPILE：tsc 0（若只改 prefab 可不改脚本）
- AC-EDITOR：待用户

## 修订记录

- v1：用户要求仅 prefab、不挂场景。
