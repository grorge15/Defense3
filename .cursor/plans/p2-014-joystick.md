---
slug: p2-014-joystick
版本: 1
状态: draft
创建: 2026-08-31
---

# P2-014 摇杆 `pref_joystick` + `Joystick.ts`

## 业务目标

实现虚拟摇杆 `Joystick.ts`（含触摸/鼠标拖拽、跑酷段仅左右 / 防守段全方向、归一化方向向量输出），并产出 UI 预制体 `pref_joystick`。通过 `bindPlayer()` 将方向注入 `Player.setMoveDirection()`。摇杆移动提示 UI（P5-004 `pref_ui_joystick_hint`）不在本任务内。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，不合并 P5-004 提示 UI。

## 风险等级

**中** — UI 触摸输入 + 与 `Player` 模式联动；摇杆为 Canvas UI 非 §P0-A 角色结构；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/ui/Joystick.ts` — 摇杆唯一主脚本
- 【可新建】`assets/resources/prefabs/ui/pref_joystick.prefab` — 虚拟摇杆 UI 预制体
- 【仅只读参考】`assets/scripts/character/Player.ts` — `setMoveDirection()` / `PlayerMode`
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `PHASE_CHANGED` 同步模式
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`assets/resources/sprite/default_sprite.png` — 背景/摇杆头占位图
- 【仅只读参考】`AI_TASK_LIST.md` — P2-014 / G1 / P5-004
- 【仅只读参考】`defense3.md` — 跑酷左右、防守全方向、鼠标操作

## 实施步骤

### S1: 确认占位资源

复用 `default_sprite` 作为摇杆底盘与摇杆头 Sprite。本 prefab **无 Animation clip**（UI 位移动画由节点 position 驱动）。

### S2: 实现 `Joystick.ts`

路径 `assets/scripts/ui/Joystick.ts`，`@ccclass('Joystick')`。

**节点引用**

- `@property background` — 底盘节点
- `@property knob` — 摇杆头节点，拖拽时相对底盘偏移
- `@property maxRadius` — 拖拽最大半径（世界/本地像素）

**玩家绑定**

- `bindPlayer(player: Player | null)`：保存引用；每帧或输入变化时调用 `player.setMoveDirection(dir)`
- `unbindPlayer()`：松开时方向归零

**输入**

- 监听触摸/鼠标：`TOUCH_START` / `TOUCH_MOVE` / `TOUCH_END` / `TOUCH_CANCEL`（或 Cocos 输入系统等价 API）
- 将触点转换为底盘局部坐标，计算归一化方向向量 `dir`（`Vec2`）

**模式约束**

- `JoystickMode`：`'parkour' | 'defense'`，与 `PlayerMode` 对齐
- `setMode(mode)`：切换约束；监听 `GameEvents.PHASE_CHANGED` 自动同步（`parkour` / `defense`）
- **跑酷**：仅使用 `dir.x`，`dir.y = 0`（左右移动）
- **防守**：使用 `dir.x` 与 `dir.y`（全方向），归一化后输出

**输出**

- `getDirection(): Readonly<Vec2>`：当前方向，供调试或其它系统读取
- 无输入/松开时输出 `(0, 0)`

### S3: 创建 `pref_joystick.prefab`

路径 `assets/resources/prefabs/ui/pref_joystick.prefab`（挂于 Canvas 下使用，场景放置见 P3）。

**节点层级**

```
pref_joystick (Root)
├── 组件: Joystick.ts + UITransform（及触摸区域）
├── Background (Sprite → default_sprite)
└── Knob (Sprite → default_sprite)
```

- `Joystick` 的 `background` / `knob` 在 prefab 中绑定
- **禁止**手写/篡改 `.meta` uuid

### S4: Prefab 自检与资源刷新

- 确认触摸区域可响应；`bindPlayer` 后手测跑酷仅 X、防守 XY

### S5: 编译与 AC 校验

报告写入 `.cursor/plans/reports/p2-014-joystick-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Joystick" assets/scripts/ui/Joystick.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/ui/pref_joystick.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite" assets/resources/prefabs/ui/pref_joystick.prefab`: 有匹配
- [AC-7] `rg "bindPlayer|setMoveDirection|setMode|getDirection" assets/scripts/ui/Joystick.ts`: 四项均有匹配
- [AC-8] `rg "parkour|defense" assets/scripts/ui/Joystick.ts`: 有匹配（双模式约束）
- [AC-9] `test ! -f assets/scripts/ui/JoystickController.ts`: 退出码 0

## 回滚策略

- **基线**：`git rev-parse HEAD`
- **失败恢复**：删除 `Joystick.ts`、`pref_joystick.prefab` 及 `.meta`

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-001 `Player.ts` | ✅ `setMoveDirection()` |
| P1-D02 GamePhase | 未建；可用 `PHASE_CHANGED` 或手测 `setMode` |
| P5-004 JoystickHint | 未建；3s 无操作提示 |
| G1 手测 | P2-001 + P2-002 + P2-014 联调推滚木 |
