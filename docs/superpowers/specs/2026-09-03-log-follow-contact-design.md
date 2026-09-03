# 滚木跟随漂移 + 黄蓝线/挡怪 — 设计

**日期：** 2026-09-03  
**状态：** 已确认  
**范围：** C（位置漂移、黄蓝线触发、小怪穿滚木）；不含 Visual 细线（已修）

## 问题证据

1. **场景 Y 差 60–80，运行时漂到 ~200**  
   - 磁盘 `pref_log` 覆盖约 `(0.6, 84.5, 0)`，玩家 `(0,0,0)`。  
   - `Log` 仅 X 对齐玩家，Y 用 `getVelocity().y * dt` 独立积分 → 与玩家实际位移不同步则间距放大。  
2. **玩家应为 Dynamic**  
   - `pref_player` RigidBody2D `_type: 1`（Dynamic）。  
   - `Player.onLoad` 仍强制 Kinematic，且 `update` 同时 `setPosition` + 写 `linearVelocity` → 与 Dynamic 目标冲突，易双倍/不同步。  
3. **黄蓝线可「穿过」无效果**  
   - 线 Y≈665/879；`ParkourLineZone` 只靠滚木物理 `BEGIN_CONTACT`；滚木位移驱动时接触不可靠。  
4. **小怪穿滚木**  
   - `EnemyMinion` `setPosition` 追玩家，不把 Log 当障碍。

## 方案（已选：逻辑判定）

- 玩家：Dynamic + 仅 `linearVelocity` 驱动。  
- 滚木：`bind` 时缓存世界空间 `_followOffset`；每帧 `logPos = playerPos + offset`（禁止独立 Y 积分）。  
- 黄蓝线：场景改到合理 Y；`Log` 用越过 Y 触发（一次性）；`ParkourLineZone` 兜底。  
- 小怪：与 Log AABB 重叠则本帧不穿入。

## 成功标准

- 开局与跑一段时间后 Y 差仍约场景 60–80（不漂到 ~200）。  
- 越过黄线蓄力、蓝线固定/失败。  
- 小怪不能穿过滚木实体。  
- `tsc` 通过；若改 scene 则 MCP 门禁 + 编辑器无红错。

## 非目标

- 不改 Visual contentSize 逻辑（已修）。  
- 不把小怪索敌改成打滚木。  
- 不整文件手写 prefab/scene。
