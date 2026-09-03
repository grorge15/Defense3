---
slug: fix-log-follow-contact
版本: 1
状态: done
创建: 2026-09-03
---

# 修复：滚木跟随漂移 / 黄蓝线触发 / 小怪穿滚木

> **For agentic workers:** 按 To-dos 顺序执行；改 `Main.scene` 时遵守 `cocos-mcp.mdc` 五步与串行纪律。提交仅在用户明确要求时进行。

**Goal:** 运行时保持场景中玩家–滚木约 60–80 的 Y 间距不漂移；黄/蓝线可触发；小怪不能穿过滚木。

**Architecture:** 玩家 Dynamic 仅用 `linearVelocity`；滚木每帧按绑定瞬间的世界空间 offset 贴合玩家（禁止独立积分 Y）；黄蓝线以越过世界 Y 为主触发；小怪移动前做与 Log 的 AABB 阻挡。

**Tech Stack:** Cocos Creator 3.8 / TypeScript；Defense3 MCP（改 scene 时）。

**设计依据:** `docs/superpowers/specs/2026-09-03-log-follow-contact-design.md`

## 业务目标

1. 场景摆位 Y 差 60–80，运行时保持同量级，不再漂到 ~200。  
2. 滚木越过黄线进入蓄力、越过蓝线按长度固定/失败。  
3. 跑酷段小怪被滚木挡住，不能穿模贴脸。

## 风险等级

中：改玩家刚体驱动方式与 `Main.scene` 黄蓝线坐标；不删资源、无接口破坏性改名。

## 全局约束

- 数值进 `GameConfig`；禁止魔法数散落。  
- 玩家逻辑只在 `Player.ts`；滚木只在 `Log.ts`。  
- 禁止手写整份 `.prefab` / `Main.scene`；MCP 改 scene 后跑门禁。  
- Visual 细线已修，本计划不改 `_refreshLengthVisual` 的 contentSize 行为。

## 变更文件清单

- 【可写】`assets/scripts/character/Player.ts` — Dynamic + 仅速度驱动  
- 【可写】`assets/scripts/item/Log.ts` — offset 跟随 + 黄蓝线 Y 判定  
- 【可写】`assets/scripts/enemy/EnemyMinion.ts` — 与 Log AABB 挡路  
- 【可写】`assets/scripts/core/GameConfig.ts` — 可选：线触发防抖/偏移常量（若需要）  
- 【可写】`assets/scripts/game/ParkourLineZone.ts` — 与逻辑触发共用防重复（可选加固）  
- 【可写】`docs/SCENE_PLACEMENT.md` — 更新黄蓝线 / 滚木相对 Y  
- 【可写·MCP】`assets/scenes/Main.scene` — 黄线/蓝线本地 Y 调到跑酷合理距离  
- 【仅只读参考】`assets/scripts/game/SceneSetup.ts`、`pref_player`/`pref_log`、`defense3.md`

## To-dos

- [ ] `1.a`：`Player` — 保持/使用 Dynamic；去掉强制 Kinematic；`update` 只写 `linearVelocity`，删除 `setPosition` 位移  
- [ ] `1.b`：`Log` — `bindPlayer`/`beginParkour` 记录 `_followOffset`；rolling/charging 用 `player.world + offset` 跟随，删除 `y += v*dt`  
- [ ] `1.c`：`Log` — 解析黄/蓝线节点，越过 Y 一次性调用 `enterChargeZone` / `tryLockAtFinish`  
- [ ] `1.d`：`EnemyMinion` — 移动前与场景 `Log` AABB 相交则取消本帧穿入（挡路）  
- [ ] `1.e`：MCP 调整 `YellowLine`/`BlueLine` 本地 Y；更新 `SCENE_PLACEMENT.md`  
- [ ] `1.f`：`tsc` + 预览手测四点；若改 scene 则 `verify-mcp-gate.ps1` + 编辑器验收

## 实施步骤

### S1 — Player Dynamic 速度驱动（`1.a`）

**文件:** `assets/scripts/character/Player.ts`

- [ ] 将 `onLoad` 中刚体改为 Dynamic（与 `pref_player` `_type: 1` 一致），保留 `gravityScale=0`、`fixedRotation`、`allowSleep=false`：

```typescript
if (this._rb) {
    this._rb.type = ERigidBody2DType.Dynamic;
    this._rb.gravityScale = 0;
    this._rb.fixedRotation = true;
    this._rb.allowSleep = false;
    this._rb.linearVelocity = new Vec2(0, 0);
}
```

- [ ] `update` 中计算 `_velocity` 后**只**同步刚体，删除 `getPosition`/`setPosition` 块：

```typescript
if (this._rb) {
    this._rb.linearVelocity = this._velocity;
} else {
    // 无刚体兜底：仅此时用位移，避免 Dynamic 双驱动
    this.node.getPosition(this._tmpPos);
    this._tmpPos.x += this._velocity.x * dt;
    this._tmpPos.y += this._velocity.y * dt;
    this.node.setPosition(this._tmpPos);
}
```

- [ ] 更新类注释：标明 Dynamic + `linearVelocity`，禁止与 `setPosition` 叠加。

### S2 — Log offset 跟随（`1.b`）

**文件:** `assets/scripts/item/Log.ts`

- [ ] 增加字段：

```typescript
private readonly _followOffset = new Vec3();
private _hasFollowOffset = false;
```

- [ ] 在 `bindPlayer` 成功拿到 `Player` 后调用 `_captureFollowOffset()`；`beginParkour` 在已 bind 时再捕获一次：

```typescript
private _captureFollowOffset(): void {
    if (!this._pushPlayer) {
        this._hasFollowOffset = false;
        return;
    }
    this.node.getWorldPosition(this._selfPos);
    this._pushPlayer.node.getWorldPosition(this._playerPos);
    Vec3.subtract(this._followOffset, this._selfPos, this._playerPos);
    this._hasFollowOffset = true;
}
```

- [ ] `update` rolling：

```typescript
this._pushPlayer.node.getWorldPosition(this._playerPos);
if (!this._hasFollowOffset) {
    this._captureFollowOffset();
}
this._selfPos.set(
    this._playerPos.x + this._followOffset.x,
    this._playerPos.y + this._followOffset.y,
    this._playerPos.z + this._followOffset.z,
);
this.node.setWorldPosition(this._selfPos);
const velocity = this._pushPlayer.getVelocity();
if (this._rb) {
    this._rb.linearVelocity = new Vec2(velocity.x, velocity.y);
}
this._updateRollVisual(dt, velocity.length());
```

- [ ] charging：Y 偏移可乘 `0.5`（相对玩家减速蓄力），X 仍贴合；或保持全 offset、仅玩家侧已减速——与现网「充电半速」一致时用：

```typescript
this._selfPos.set(
    this._playerPos.x + this._followOffset.x,
    this._playerPos.y + this._followOffset.y * 0.5,
    this._playerPos.z + this._followOffset.z,
);
```

（若半速导致与玩家相对位突变，改为整段仍用全 offset，仅视觉脉冲表示蓄力——实现时以「不突变、不漂到 200」为准，优先**全 offset**。）

**推荐默认：** rolling/charging 均用全 `_followOffset`，避免充电瞬间跳变；蓄力表现继续靠 `_startChargePulse`。

### S3 — 黄蓝线 Y 触发（`1.c`）

**文件:** `assets/scripts/item/Log.ts`（主）、可选 `ParkourLineZone.ts`

- [ ] `onLoad`/`start` 解析场景节点 `YellowLine` / `BlueLine`（`find` 或 `@property` 可空 + 运行时查找）。  
- [ ] 字段 `_yellowTriggered` / `_blueTriggered`。  
- [ ] 在跟随 `update` 末尾（未 lock/fade）：

```typescript
private _pollParkourLines(): void {
    if (!this._yellowTriggered && this._yellowLine) {
        this._yellowLine.getWorldPosition(this._tmpLinePos);
        this.node.getWorldPosition(this._selfPos);
        if (this._selfPos.y >= this._tmpLinePos.y) {
            this._yellowTriggered = true;
            this.enterChargeZone();
        }
    }
    if (!this._blueTriggered && this._blueLine) {
        this._blueLine.getWorldPosition(this._tmpLinePos);
        this.node.getWorldPosition(this._selfPos);
        if (this._selfPos.y >= this._tmpLinePos.y) {
            this._blueTriggered = true;
            const canLock = this.getCurrentLength() >= GameConfig.blueLineMinLogLength;
            this.tryLockAtFinish(canLock);
        }
    }
}
```

- [ ] `ParkourLineZone`：若逻辑已触发，`_triggered` 已 true 则 no-op（保持兜底，防双触发）。

### S4 — 小怪挡滚木（`1.d`）

**文件:** `assets/scripts/enemy/EnemyMinion.ts`

- [ ] 缓存/查找 `Log`（`scene.getComponentInChildren(Log)`，可在 `setTarget` 或首次 `update`）。  
- [ ] 在 `setPosition` 之前：用拟议新位置与 Log 的 `BoxCollider2D` 世界矩形做相交；若相交则**不应用**该帧位移（速度清零或停在旧位）。  
- [ ] 辅助：从 collider `worldAABB` 或 `offset+size` + 节点世界坐标估算 `Rect`；无 collider 则用节点位置 ± `segment` 近似。  
- [ ] 不改变索敌：仍只打玩家 / Barrier。

### S5 — 场景黄蓝线坐标（`1.e`）

**前置:** MCP `assets-query-path` 确认 Defense3。

| 节点 | 当前本地 Y（约） | 建议本地 Y（相对玩家 0） | 说明 |
|------|------------------|-------------------------|------|
| `YellowLine` | 664.7 | **220** | 跑酷中段蓄力 |
| `BlueLine` | 878.7 | **300** | 终点固定；须 > 黄线 |

- [ ] `scene-open` → `scene-update-node` 改两线 `_lpos.y` → **一次** `scene-save`。  
- [ ] 跑 AC-S1 / `verify-mcp-gate.ps1`；非法 `_id` 则 close → patch → reimport → open。  
- [ ] 更新 `docs/SCENE_PLACEMENT.md` 黄蓝线坐标与「滚木相对玩家 Y≈60–80、跟随用 offset」说明。  
- [ ] **不要**为「紧挨」强行把 `pref_log` 改到 y=0；保留场景 60–80 摆位。

### S6 — 校验（`1.f`）

- [ ] `npx tsc --noEmit` — 退出码 0  
- [ ] 预览手测：  
  1. 开局 Y 差约 60–80  
  2. 前进 10s+ 间距仍约该量级（不→200）  
  3. 到黄线蓄力、到蓝线固定或失败淡出  
  4. 小怪撞滚木停住/绕不开穿模  
- [ ] 若改过 scene：`powershell -File .cursor/scripts/verify-mcp-gate.ps1` + 编辑器打开 `Main.scene` 无红错  

## 校验点

- [AC-1] `npx tsc --noEmit` — 退出码 0  
- [AC-2] 手测：运行时 Y 差稳定在场景量级（约 60–80），不漂到 ~200  
- [AC-3] 手测：黄线 → charging；蓝线 → `LOG_FIXED` 或失败淡出  
- [AC-4] 手测：小怪不能穿过滚木  
- [AC-S1] 改 scene 后：`rg '"_id": "Node\.' assets/scenes/Main.scene` — 0 匹配  
- [AC-S1b] `verify-mcp-gate.ps1` — 退出码 0  
- [AC-EDITOR] 编辑器打开 `Main.scene` 无 missing script / 无红错 — **必选**

## 回滚策略

- 基线：改前记录 `Player.ts` / `Log.ts` / `EnemyMinion.ts` / `Main.scene` 中黄蓝线 Y。  
- 失败：还原上述脚本；scene 用 git checkout 或 MCP 改回原 Y（664.7 / 878.7）。

## 修订记录

- v1（2026-09-03）：确认方案 2；A 改为 Dynamic + offset 跟随（保留 60–80，修漂移到 200）；含黄蓝线 Y 与挡怪。
