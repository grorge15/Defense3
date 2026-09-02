---
slug: phase-4h-ultimate-end
版本: 1
状态: done
创建: 2026-09-02
---

# §4.H 大招与收尾：Barrier + 高级塔事件核对 + Ultimate + 相机拉远（4.31–4.34）

## 业务目标

按 `AI_TASK_LIST.md` **4.31–4.34（范围 A）**：
- **4.31** 拓展区 Barrier 可被怪攻击并挡路（G5 部分）
- **4.32** 核对双高级塔 → `BOTH_ADVANCED_TOWERS_COMPLETE`（已有则只验）
- **4.33** 新建 `UltimateSystem`：高级塔完成后允许大招，清全场怪
- **4.34** 实装 `CameraFollow.zoomOut`；大招后拉远并 `setPhase(GameOver)`；**不建**结束 UI prefab（留 §5.8）

**用户澄清**：选 **A**。禁止新建 `pref_ui_game_over`；`pref_skill_ultimate` 可选占位或跳过（大招以逻辑清场为准）。

## 风险等级

**中** — 清场需安全遍历敌人；改 EnemyAI/Boss 索敌；相机拉远与跟随冲突须处理。

## 现状差距

| 任务 | 现状 | 本 plan |
|---|---|---|
| **4.31** | `Barrier` 有 HP/`takeDamage`/非 sensor Collider | 小怪/Boss **不打** Barrier；需扩展索敌或接触伤害 |
| **4.32** | `BuildSystem._onAdvancedTowerBuilt` 已 emit 事件 | **核对**计数与双侧完成 |
| **4.33** | 无 `UltimateSystem`；`Player.castUltimate` 空回调 | **新建**系统 |
| **4.34** | `zoomOut` 空实现；无 GameOverUI | **实装 zoomOut** + GameOver 阶段；无 UI prefab |

## 变更文件清单

- 【可写】`assets/scripts/building/Barrier.ts` — 可选挂 `HealthSystem`；保持 `takeDamage` API；死亡禁用碰撞
- 【可写】`assets/scripts/enemy/EnemyAI.ts` / `EnemyMinion.ts` — 索敌：若路径上/近距有 Barrier 则优先攻击 Barrier（或 Boss 已有 building 优先级则注册 Barrier 为建筑目标）
- 【可写】`assets/scripts/enemy/EnemyBoss.ts` — `registerTargets` 注入 barriers；或 `Building` 基类兼容
- 【仅只读参考】`BuildSystem.ts` — 4.32 核对；必要时修双塔计数
- 【可新建】`assets/scripts/game/UltimateSystem.ts` — 听 `BOTH_ADVANCED_TOWERS_COMPLETE`→解锁；输入/自动触发 `Player.castUltimate`；清场 `EnemyMinion`/`EnemyBoss`（及刷怪暂停可选）
- 【可写】`assets/scripts/character/Player.ts` — `onUltimateCast` 绑 UltimateSystem；解锁前 `castUltimate` no-op
- 【可写】`assets/scripts/core/GameConfig.ts` — 大招伤害/清场、zoom 距离与时长
- 【可写】`assets/scripts/game/CameraFollow.ts` — 实装 `zoomOut`（增大 offset 或后移；暂停跟随或缓动）
- 【可写】`assets/scripts/game/GameManager.ts` — 大招后 `setGameOver()` / `setPhase(Ultimate)` 再 `GameOver`
- 【可写】`assets/scenes/Main.scene` — MCP 挂 UltimateSystem；绑 Player/CameraFollow
- 【禁止新建】`pref_ui_game_over`、`UIManager` 完整 UI（§5）
- 【可选】`pref_skill_ultimate` — 若做则 MCP；否则报告跳过 2.21

## To-dos

### 4.31 Barrier 防守

- [ ] **4.31.a**：确认场景 Barrier 实例 Collider 非 sensor、active 在拓展后为 true
- [ ] **4.31.b**：小怪近距优先 `Barrier.takeDamage`（或路径阻挡物理已足够 + Boss 打 Barrier）；至少一种生效
- [ ] **4.31.c**：Barrier 死亡后不再挡路（已有则核对）

### 4.32 高级塔事件

- [ ] **4.32.a**：核对 `_onAdvancedTowerBuilt` 左右各一后 emit `BOTH_ADVANCED_TOWERS_COMPLETE`
- [ ] **4.32.b**：缺计数则补 `_advancedTowerCount`；不重复 emit

### 4.33 大招

- [ ] **4.33.a**：新建 `UltimateSystem`：解锁标志；`clearAllEnemies()`（deactivate/destroy 场景内 Minion/Boss）
- [ ] **4.33.b**：绑 `Player.onUltimateCast`；解锁后允许一次或多次（读 GameConfig）
- [ ] **4.33.c**：触发方式：解锁后 **点击/空格/自动一次**（build 选一种，报告写明）；无独立按钮 prefab
- [ ] **4.33.d**：MCP 挂组件并接线

### 4.34 拉远与 GameOver（无结束 UI）

- [ ] **4.34.a**：`CameraFollow.zoomOut(distance, duration)` 缓动 offset 或目标点
- [ ] **4.34.b**：大招成功后调用 zoomOut，再 `GameManager.setGameOver()`
- [ ] **4.34.c**：**禁止**新建 `pref_ui_game_over`；Console/阶段即可验收

## 实施步骤

1. **S1**：前置门；核对 Barrier 场景与 BuildSystem 双塔逻辑。
2. **S2（4.31）**：敌人打 Barrier / 物理挡怪验收。
3. **S3（4.32）**：修或确认高级塔事件。
4. **S4（4.33）**：UltimateSystem + Player 接线。
5. **S5（4.34）**：zoomOut + GameOver phase。
6. **S6**：`tsc` + gate + 手测 G5/G6 子集（无结束 UI）。

## 校验点

- [AC-4.31] `rg "takeDamage|Barrier" assets/scripts/enemy assets/scripts/building/Barrier.ts` — 怪可伤 Barrier 或报告物理挡怪证据
- [AC-4.32] `rg "BOTH_ADVANCED_TOWERS_COMPLETE" assets/scripts/building/BuildSystem.ts` — emit 存在且有双侧计数
- [AC-4.33-SYS] `rg "class UltimateSystem|clearAllEnemies|BOTH_ADVANCED" assets/scripts/game/UltimateSystem.ts` — ≥2
- [AC-4.33-PLAYER] `onUltimateCast` 已绑（rg 或 SceneSetup）
- [AC-4.34-ZOOM] `CameraFollow.zoomOut` 非空实现（rg 有 offset/tween/lerp）
- [AC-4.34-PHASE] 大招后 `setPhase(GameOver)` 或 `setGameOver` 路径存在
- [AC-4.34-NO-UI] 未新建 `pref_ui_game_over`
- [AC-COMPILE] `npx tsc --noEmit` — 0
- [AC-S1/S2/GATE/EDITOR] 改 scene 时跑 MCP 门禁
- [AC-PLAY-G5] Barrier 挡/可受伤
- [AC-PLAY-G6] 双高级塔→可大招清怪→镜头拉远→阶段 GameOver（无 UI）

## 回滚策略

- 删除 `UltimateSystem.ts`；revert Barrier/EnemyAI/CameraFollow/Player/BuildSystem/Main.scene。

## 修订记录

- v1（2026-09-02）：范围 A；4.31–4.33 + zoomOut；结束 UI / skill prefab 非必须。
