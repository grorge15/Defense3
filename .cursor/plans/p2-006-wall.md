---
slug: p2-006-wall
版本: 2
状态: draft
创建: 2026-08-31
修订: 2026-08-31
---

# P2-006 城墙 `pref_wall` + `Wall.ts`

## 业务目标

实现城墙唯一主脚本 `Wall.ts` 与 `pref_wall` 预制体。`pref_wall` 为**矮墙式纯阻挡物**（封路、挡怪），与两侧灰色矮墙同类；**不承担侧别逻辑、不受击、不闪红**。封楼梯停刷怪由**场景放置位置 / 建造地块实例 / P4 刷怪管理**根据「哪一侧建造地块完成了墙」判定，不由 `Wall.ts` 持有 `WallSide`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，P4 刷怪停发不在 Wall 脚本内实现。

**v1 澄清结论（已废止）**：~~含 `setSide`、受击闪红~~ — 与最新设计冲突。

**v2 修订（业务冲突）**：
- 移除 `WallSide` / `setSide()` / `onStairsSealed(side)` — **墙不需要知道属于哪一侧**
- 移除 `takeDamage()` / `_flashRed()` — **仅 `pref_barrier_wall`（P2-013 `Barrier.ts`）带受击与闪红**；`pref_wall` 与矮墙一样只做阻挡

## 风险等级

**低** — 单脚本 + 单 prefab，逻辑简化为碰撞阻挡 + Visual；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/building/Wall.ts` — 城墙唯一主脚本（纯阻挡）
- 【可新建】`assets/resources/prefabs/building/pref_wall.prefab` — 城墙预制体
- 【仅只读参考】`assets/scripts/building/BuildPlot.ts` — 建造完成生成墙；**侧别→停刷怪**由 BuildPlot 实例位置或 P4 映射，非 Wall
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 占位 Sprite
- 【仅只读参考】`AI_TASK_LIST.md` — P2-006；受击闪红归属 P2-013 / P6-003
- 【仅只读参考】`defense3.md` — 封楼梯停刷怪（流程层）、矮墙阻挡

## 实施步骤

### S1: 确认占位资源

复用 `default_sprite` 作为城墙 Visual 占位。本 prefab **无 Animation clip**，**无受击闪红**。

### S2: 实现 `Wall.ts`

路径 `assets/scripts/building/Wall.ts`，`@ccclass('Wall')`。

**职责边界（v2）**

- **仅做**：物理阻挡（`Collider2D` 非 Trigger）+ Visual 渲染（Billboard + SortingOrder2D）
- **不做**：侧别枚举、楼梯封印回调、受击、闪红、血量 — 上述能力在 P2-013 `Barrier.ts` 或 P4 刷怪系统中实现

**节点引用**

- `@property visualNode` — Visual 子节点（Sprite）
- 根节点 `Collider2D`（`isTrigger = false`），尺寸覆盖墙体通行面

**生命周期**

- `activate()`（可选）：`BuildPlot.onBuildComplete` 生成墙实例后调用，启用碰撞体与显示；**不**在 Wall 内派发停刷怪事件
- 停刷怪：P4 监听建造地块完成事件，根据**地块配置/场景节点名/放置侧**决定停止左侧或右侧生成点

**禁止内容**

- 禁止 `WallSide`、`setSide`、`sealStairs`、`onStairsSealed`
- 禁止 `takeDamage`、`_flashRed`、`flashRed`

### S3: 创建 `pref_wall.prefab`

路径 `assets/resources/prefabs/building/pref_wall.prefab`。

**节点层级**

```
pref_wall (Root)
├── 组件: Wall.ts + BoxCollider2D (isTrigger=false)
└── Visual (子节点)
    ├── Sprite → default_sprite，anchorY=0，sizeMode=RAW
    ├── Billboard → visualNode 指向自身
    └── SortingOrder2D → visualNode 指向自身
```

- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh`
- 编辑器确认：碰撞体为非 Trigger、无 missing script

### S5: 编译与 AC 批量校验

报告写入 `.cursor/plans/reports/p2-006-wall-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Wall" assets/scripts/building/Wall.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/building/pref_wall.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/building/pref_wall.prefab`: 有匹配
- [AC-7] `rg "activate|visualNode" assets/scripts/building/Wall.ts`: 有匹配
- [AC-8] `rg "takeDamage|flashRed|WallSide|setSide|sealStairs|onStairsSealed" assets/scripts/building/Wall.ts && exit 1 || true`: 退出码 0（v2：墙脚本不得含侧别/受击）
- [AC-9] `test ! -f assets/scripts/building/WallController.ts`: 退出码 0

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`
- **失败恢复**：删除 `Wall.ts`、`pref_wall.prefab` 及对应 `.meta`；`git checkout` 恢复误改文件

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-005 `BuildPlot` | 生成 `pref_wall`；侧别停刷怪在 BuildPlot/P4 层处理 |
| P2-013 `Barrier.ts` | 带血条阻挡墙；**受击闪红**归属此处 + P6-003 |
| P4 刷怪管理 | 根据建造地块/场景侧别停发，非 `Wall.ts` |
| G3 手测 | 建墙阻挡 + 对应侧停刷怪（由场景/P4 验证） |
