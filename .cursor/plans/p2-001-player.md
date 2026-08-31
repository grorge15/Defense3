---
slug: p2-001-player
版本: 1
状态: done
创建: 2026-08-31
---

# P2-001 玩家 `pref_player` + `Player.ts`

## 业务目标

实现玩家唯一主脚本 `Player.ts`（含跑酷/防守双模式 RigidBody2D 移动、攻击与大招标记框架、`setMoveDirection()` 供 P2-014 接入），并产出符合 §P0-A 节点结构的 `pref_player` 预制体及 ANIM_MANIFEST §player 空动画 clip。数值全部读 `GameConfig`，禁止创建 `PlayerController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，摇杆输入通过 `setMoveDirection()` 注入，不合并 P2-014。

## 风险等级

**中** — 涉及多文件新建（脚本、6 个 clip、占位图、prefab），prefab 须通过 Cocos CLI MCP 或编辑器创建；不删除既有文件、无接口破坏性改动。`default_sprite` 与 clip 资源当前仓库尚不存在，需一并创建。

## 变更文件清单

- 【可新建】`assets/scripts/character/Player.ts` — 玩家唯一主脚本
- 【可新建】`assets/resources/prefabs/character/pref_player.prefab` — 玩家预制体
- 【可新建】`assets/resources/sprite/default_sprite.png` — 占位 Sprite 图（1×1 白图即可，若已存在则跳过）
- 【可新建】`assets/resources/animations/player/idle.anim` — 空占位 clip
- 【可新建】`assets/resources/animations/player/walk.anim`
- 【可新建】`assets/resources/animations/player/parkour.anim`
- 【可新建】`assets/resources/animations/player/melee_attack.anim`
- 【可新建】`assets/resources/animations/player/skill.anim`
- 【可新建】`assets/resources/animations/player/die.anim`
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — playerMaxHp / playerMoveSpeed / playerParkourForwardSpeed / playerAttackDamage
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — `playAnim()`，clip 名映射
- 【仅只读参考】`assets/scripts/core/Billboard.ts` — Visual 子节点 Y 轴朝向
- 【仅只读参考】`assets/scripts/core/SortingOrder2D.ts` — Visual 世界 Y 排序
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `HP_CHANGED` 派发
- 【仅只读参考】`assets/scripts/core/GameEvents.ts`
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §player clip 名与路径
- 【仅只读参考】`AI_TASK_LIST.md` — P2-001 / P2 通用 AC

## 实施步骤

### S1: 占位图 `default_sprite`

若 `assets/resources/sprite/default_sprite.png` 不存在，创建最小占位 PNG（或通过 Cocos CLI `assets-import-asset` 导入）。供 Visual 节点 Sprite 引用，`sizeMode = RAW`，`anchorY = 0`。

### S2: 空动画 clip（ANIM_MANIFEST §player）

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: animation-clip`）在 `assets/resources/animations/player/` 创建 6 个 clip：

| 磁盘文件名 | Animation 组件 clip 名 | 循环 |
|---|---|---|
| `idle.anim` | `idle` | 是 |
| `walk.anim` | `walk` | 是 |
| `parkour.anim` | `parkour` | 是 |
| `melee_attack.anim` | `melee_attack` | 否 |
| `skill.anim` | `skill` | 否 |
| `die.anim` | `die` | 否 |

每个 clip：无关键帧，`duration = 0.1s`（见 ANIM_MANIFEST 占位约定）。

### S3: 实现 `Player.ts`

路径 `assets/scripts/character/Player.ts`，`@ccclass('Player')`，**禁止**另建 `PlayerController.ts`。

**节点引用**

- `@property` 绑定 `visualNode`（Visual 子节点，挂 Animation）
- 根节点取 `RigidBody2D`（§P0-A：物理在 Root）

**模式与输入（供 P2-014 接入）**

- 内部枚举/字段：`parkour` | `defense`，默认 `parkour`
- `setMoveDirection(dir: Vec2)`：缓存摇杆方向；跑酷段仅使用 `dir.x`（左右），防守段使用 `dir.x` + `dir.y`（全方向）
- `setMode(mode)`：切换跑酷/防守，供后续 `GameManager`（P1-D02）或测试调用

**移动（RigidBody2D 驱动，`fixedUpdate`）**

- 跑酷：`linearVelocity.z = GameConfig.playerParkourForwardSpeed`（自动前进）+ `linearVelocity.x = dir.x * GameConfig.playerMoveSpeed`
- 防守：`linearVelocity` 由 `dir` 归一化后 × `GameConfig.playerMoveSpeed`（XZ 平面）
- 禁止硬编码速度/伤害数值

**生命与受击**

- 初始 `_hp = GameConfig.playerMaxHp`
- `takeDamage(amount)`：扣血并通过 `EventManager.instance.emitEvent(GameEvents.HP_CHANGED, ...)` 通知 UI（P5 再接）
- `die` 时播放 `die` 动画、禁用移动

**攻击框架**

- `_hasBow` 标志，默认 `false`；`setHasBow(true)` 供道具系统（P2-012b）调用
- `tryAttack()`：无弓则 return；播放 `meleeAttack`（AnimUtil 映射 `melee_attack`）；伤害值读 `GameConfig.playerAttackDamage`（命中判定留 P4 接）

**大招框架**

- `castUltimate()`：播放 `skill` 动画；派发占位事件或预留 `onUltimateCast` 回调供 P4/P2-013c 接清场逻辑
- 不在本任务实现清场，仅方法 + 动画 + 事件钩子

**动画切换**

- 移动中：跑酷模式播 `parkour`，防守模式播 `walk`；静止播 `idle`
- 统一通过 `playAnim(visualNode, clipName)` 调用

**阶段事件（可选预埋）**

- `onLoad` 监听 `GameEvents.PHASE_CHANGED`（P1-D02 到位后自动切换 `setMode`）；当前无 GameManager 时以默认 `parkour` + 手测 `setMode` 即可

### S4: 创建 `pref_player.prefab`

通过 Cocos CLI `assets-create-asset-by-type`（`ccType: prefab`）创建，路径 `assets/resources/prefabs/character/pref_player.prefab`。

**节点层级（§P0-A，与 P2-002 等保持一致）**

```
pref_player (Root)
├── 组件: RigidBody2D + Collider2D（推荐 BoxCollider2D）+ Player.ts
└── Visual (子节点)
    ├── Sprite → default_sprite，anchorY=0，sizeMode=RAW
    ├── Animation → 挂 S2 六个 clip
    ├── Billboard → visualNode 指向自身（或留空用默认）
    └── SortingOrder2D → visualNode 指向自身
```

- `Player.ts` 的 `visualNode` 属性在 prefab 中指向 Visual 子节点
- **禁止**手写/篡改 `.meta` 的 uuid；组件绑定在编辑器或 CLI 序列化中完成

### S5: Prefab 自检与资源刷新

- Cocos CLI `assets-refresh` 确保脚本与 prefab 关联无 missing
- 在编辑器中打开 prefab 确认：无 missing script、Animation 含 6 clip、Sprite 有图

### S6: 编译与 AC 批量校验

按下方校验点逐条执行；失败则修复后重跑，报告写入 `.cursor/plans/reports/p2-001-player-report.md`（build 阶段）。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `test ! -f assets/scripts/character/PlayerController.ts`: 退出码 0
- [AC-3] `rg "class Player" assets/scripts/character/Player.ts`: 有匹配
- [AC-4] `test -f assets/resources/prefabs/character/pref_player.prefab`: 退出码 0
- [AC-5] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-7] `rg "default_sprite|Animation" assets/resources/prefabs/character/pref_player.prefab`: 有匹配
- [AC-8] `test -f assets/resources/animations/player/idle.anim && test -f assets/resources/animations/player/melee_attack.anim`: 退出码 0
- [AC-9] `rg "setMoveDirection|setMode|tryAttack|castUltimate" assets/scripts/character/Player.ts`: 四项均有匹配
- [AC-10] `rg "GameConfig\.(playerMaxHp|playerMoveSpeed|playerParkourForwardSpeed|playerAttackDamage)" assets/scripts/character/Player.ts`: 有匹配
- [AC-11] `rg "PlayerController" assets/scripts/character/`: 无匹配（与 AC-2 互补）

## 回滚策略

- **基线**：执行前记录 `git rev-parse HEAD`；新建文件清单见变更文件清单
- **失败恢复**：`git checkout -- assets/scripts/character/Player.ts`（若已提交则 revert）；删除本任务新建的 prefab、clip、default_sprite 及对应 `.meta`（由编辑器/CLI 生成部分勿手改 uuid）；`PlayerController.ts` 若误建则删除

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P1-002~007 基础设施 | ✅ 已存在 |
| P2-014 Joystick | 未建；本任务仅暴露 `setMoveDirection()` |
| P1-D02 GamePhase | 未建；`setMode()` + 可选 `PHASE_CHANGED` 监听预埋 |
| P5 血条 UI | 未建；本任务仅派发 `HP_CHANGED` |
| G1 手测 | 需 P2-002 + P3-002 完成后与滚木/场景联调 |
