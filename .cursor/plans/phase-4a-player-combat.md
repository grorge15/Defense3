---
slug: phase-4a-player-combat
版本: 1
状态: done
创建: 2026-09-02
---

# §4.A 剩余项：相机跟随 + 射箭 + 受击（含 2.9 箭矢）

## 业务目标

补齐 `AI_TASK_LIST.md` **§4.A 未完成项**：**4.5 相机跟随**、**4.6 玩家射箭**、**4.7 玩家受击与死亡**；因 4.6 依赖缺失的 **2.9 `pref_projectile_arrow`**，本 plan **内含**箭矢 prefab + `Arrow.ts`。

**用户澄清**：选 **C**（整节缺口 + 新建 2.9）。

**不在范围**：4.1–4.4（已 done，仅只读）；§5 血条 UI；Boss AI；大招拉远（4.34 可后续扩同一 `CameraFollow`）。

## 风险等级

**中** — 新建箭矢/战斗脚本 + MCP 挂相机；改 `Player.ts`/`Main.scene`；须 AC-P* / AC-S*；注意清单中 **4.A 的 4.7（受击）** 与 **4.B 的 4.7（滚木推动）** 编号撞车，本 plan 仅做 **玩家受击**（slug `phase-4-4-6-player-hurt`）。

## 现状差距

| 任务 | 现状 | 缺口 |
|---|---|---|
| 4.1–4.4 | Joystick / Hint / parkour / defense 已交付 | 跳过 |
| **4.5** | Camera 固定开局位 | 无 `CameraFollow`；无偏移配置 |
| **2.9 / 4.6** | `Player.tryAttack` 仅播动画；无箭 | 无 `Arrow.ts`、`pref_projectile_arrow`、`CombatSystem` |
| **4.7** | `Player.takeDamage` / `_die` 已有；`SawTrap`/`EnemyMinion` 已调 `takeDamage` | 无独立 `HealthSystem.ts`；未统一 heal / 死亡契约 |

## 变更文件清单

### 2.9 箭矢（4.6 前置，本 plan 内建）

- 【可新建】`assets/scripts/projectile/Arrow.ts` — 飞向目标；命中 `takeDamage`；读 GameConfig
- 【可新建】`assets/resources/prefabs/projectile/pref_projectile_arrow.prefab` — MCP；可参考 `pref_projectile_hero_01` 结构

### 4.5 相机跟随

- 【可新建】`assets/scripts/game/CameraFollow.ts` — 跟随 `target`；偏移+平滑读 GameConfig；**不**做 Player 子节点；预留 `zoomOut` 空接口供 4.34
- 【可写】`assets/scripts/core/GameConfig.ts` — `cameraFollowOffset`、`cameraFollowSmooth`（或等价 Vec3+number）
- 【可写】`assets/scenes/Main.scene` — MCP：Camera 挂 `CameraFollow`；`target` 绑玩家（或 SceneSetup 补绑）
- 【可写】`assets/scripts/game/SceneSetup.ts`（可选）— `onLoad` 补绑 `CameraFollow.target`

### 4.6 射箭

- 【可新建】`assets/scripts/game/CombatSystem.ts` — 监听攻击输入；无弓 return；发射箭矢；冷却读 GameConfig
- 【可写】`assets/scripts/character/Player.ts` — `tryAttack` 走 CombatSystem 或委托发射；保留 `setHasBow` 门禁
- 【可写】`GameConfig.ts` — `playerAttackInterval` / 箭速等（若缺）

### 4.7 受击

- 【可新建】`assets/scripts/game/HealthSystem.ts` — `takeDamage` / `heal` / 死亡回调；maxHp 读 GameConfig 或 `@property`
- 【可写】`assets/scripts/character/Player.ts` — HP 逻辑迁到 `HealthSystem`（或组合调用）；仍 emit `HP_CHANGED`
- 【仅只读参考】`SawTrap.ts`、`EnemyMinion.ts` — 已调 `Player.takeDamage`，保持 API 兼容

### 参考

- 【仅只读参考】`assets/resources/prefabs/projectile/pref_projectile_hero_01.prefab`
- 【仅只读参考】`assets/scripts/item/BowItem.ts`、`Player.setHasBow`
- 【仅只读参考】`AI_TASK_LIST.md` §2.9、§4.5–4.7、§4.34

## To-dos

### 2.9 箭矢

- [x] **2.9.a**：新建 `Arrow.ts`：初始化方向/速度/伤害；飞行；碰 `EnemyMinion`（及可扩展 EnemyBoss）→ `takeDamage` → 销毁
- [x] **2.9.b**：MCP 创建 `pref_projectile_arrow`（场景搭树 → `create-prefab-from-node`）；Root+Collider(sensor)+Arrow；Visual+Sprite；无嵌套 Canvas；绑 `@property`
- [x] **2.9.c**：AC-P* + 编辑器打开无红错

### 4.5 相机跟随

- [x] **4.5.a**：`GameConfig` 增加 `cameraFollowOffset`（约 `(0,15,15)`）、`cameraFollowSmooth`
- [x] **4.5.b**：新建 `CameraFollow.ts`：`lateUpdate` 平滑跟随 `target.worldPosition + offset`；保持俯角（只改 position，不继承玩家旋转）
- [x] **4.5.c**：MCP：`Camera` 挂组件；`target` → 玩家实例；`scene-save` + AC-S*
- [x] **4.5.d**：（可选）`SceneSetup` 若 target 空则补绑

### 4.6 射箭

- [x] **4.6.a**：`GameConfig` 补攻击间隔、箭速（若缺）
- [x] **4.6.b**：新建 `CombatSystem.ts`：挂 GameRoot/SceneSetup 旁；`arrowPrefab`；无弓 return；冷却；`instantiate` 箭到 Effect 或世界；目标为最近敌人或指针前方（本 Phase：**最近 `EnemyMinion`**，与 Hero 类似）
- [x] **4.6.c**：`Player.tryAttack` 改为调用 CombatSystem 或发出攻击请求；触摸/按钮：若无独立攻击键，可用**点击屏幕空白**或 `CombatSystem` 在有弓后自动寻敌射击（二选一，build 选 **有弓后自动寻敌射击 + 冷却**，避免缺 UI）
- [x] **4.6.d**：MCP 挂 `CombatSystem`；绑 `arrowPrefab`、玩家引用

### 4.7 受击

- [x] **4.7.a**：新建 `HealthSystem.ts`：`maxHp`/`currentHp`；`takeDamage`/`heal`；死亡回调；emit `HP_CHANGED`（签名与现有 Player/Hero 兼容或统一为 `(node, hp, max)`）
- [x] **4.7.b**：`Player` 挂/组合 `HealthSystem`；`takeDamage` 转发；死亡停移动 + `die` 动画（现有 `_die` 迁入）
- [x] **4.7.c**：确认 `SawTrap`/`EnemyMinion` 仍能伤玩家（公开 API 不变）

## 实施步骤

1. **S1 前置门**：MCP 确认 Defense3；`tsc` 基线。
2. **S2（2.9）**：`Arrow.ts` + MCP `pref_projectile_arrow` + AC-P。
3. **S3（4.5）**：`CameraFollow` + GameConfig + MCP 挂 Camera + AC-S。
4. **S4（4.7）**：`HealthSystem` + 重构 `Player` HP（先于射箭，便于箭杀怪与受击并行测）。
5. **S5（4.6）**：`CombatSystem` + 接线 `Player`/`SceneSetup`；有弓自动寻敌射击。
6. **S6**：`tsc` + `verify-mcp-gate.ps1` + 编辑器无红错。
7. **S7 手测**：相机跟随；拾弓后箭杀小怪；电锯/怪扣血至死亡。

## 校验点

### 2.9

- [x] [AC-2.9-SCRIPT] `rg "class Arrow" assets/scripts/projectile/Arrow.ts` — 匹配
- [x] [AC-2.9-PREFAB] `pref_projectile_arrow.prefab` 存在
- [x] [AC-2.9-P1] 箭 prefab 无 `"_name": "Canvas"`
- [x] [AC-2.9-P3] MCP query `invalid: false`
- [x] [AC-2.9-EDITOR] 编辑器打开箭 prefab 无红错

### 4.5

- [x] [AC-4.5-SCRIPT] `rg "class CameraFollow|cameraFollowOffset" assets/scripts` — ≥2
- [x] [AC-4.5-SCENE] MCP：Camera 节点含 `CameraFollow`；`target` 非 null
- [x] [AC-4.5-S1] `rg '"_id": "Node\.' assets/scenes/Main.scene` — 0
- [x] [AC-4.5-S2] scene-open nodeId 非 `Node.<数字>`

### 4.6

- [x] [AC-4.6-COMBAT] `rg "class CombatSystem|setHasBow|arrowPrefab" assets/scripts/game/CombatSystem.ts` — ≥2
- [x] [AC-4.6-GATE] 无弓时不发射（代码路径或 Play：未拾弓无箭）
- [x] [AC-4.6-SCENE] MCP：`CombatSystem` 已挂且 `arrowPrefab` 非 null

### 4.7

- [x] [AC-4.7-HEALTH] `rg "takeDamage|heal|class HealthSystem" assets/scripts/game/HealthSystem.ts` — ≥3
- [x] [AC-4.7-PLAYER] `Player.takeDamage` 仍存在且委托 HealthSystem（或等价）

### 公共

- [x] [AC-COMPILE] `npx tsc --noEmit -p tsconfig.json` — 0
- [x] [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` — 0
- [x] [AC-EDITOR] Main.scene + 新建 prefab 无 missing / 红错
- [ ] [AC-PLAY] 用户手测：①相机跟玩家 ②拾弓后箭伤怪 ③受击扣血/死亡

## 回滚策略

- **基线**：build 前 git status；新建文件清单。
- **脚本失败**：删除新建 ts/prefab；`Player`/`GameConfig`/`Main.scene` `git checkout`。
- **场景失败**：`git checkout -- assets/scenes/Main.scene` + MCP reimport。

## 修订记录

- v1（2026-09-02）：初始计划；范围 C：4.5+4.6+4.7 + 内含 2.9；4.1–4.4 跳过；攻击输入采用有弓后自动寻敌射击。
