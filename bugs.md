# Bug 修复记录

> 每次 `/fix-bug`（或等价修复）**完成后**追加一条。同一 bug 多次修改时在原条目下叠加 `v2` / `v3`…，不要另开同名条目。  
> 每条须含：**现象**、**原因**、**解决**（各 1–3 句即可）。

---

## fix-log-follow-contact — 滚木跟随漂移 / 黄蓝线不触发 / 小怪穿滚木

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 开局玩家–滚木 Y 差约 60–80，跑一会儿漂到 ~200；越过黄/蓝线无蓄力/固定；小怪可穿过滚木贴脸。 |
| **原因** | ① `Log` 只对齐 X，Y 用 `velocity*dt` 独立积分，与玩家实际位移不同步；② `Player` 强制 Kinematic 且同时 `setPosition`+写速度，与 Dynamic 预制冲突；③ 黄蓝线过远且仅靠物理 `BEGIN_CONTACT`，位移跟随时接触不可靠；④ `EnemyMinion` 用 `setPosition` 追玩家，不把 Log 当障碍。 |
| **解决** | 玩家 Dynamic 仅写 `linearVelocity`；滚木绑定瞬间缓存世界 `_followOffset`，每帧 `player+offset` 跟随；黄/蓝线改合理 Y + 越过世界 Y 一次性触发；小怪移动前与 Log AABB 相交则本帧不穿入。计划：`.cursor/plans/fix-log-follow-contact.md`。 |

---

## fix-log-fixed-bow-saw — 固定后滚木转 / 拾弓不射 / 电锯不砍木

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 滚木蓝线固定后 Visual 仍在转；拾取弓后不攻击小怪；撞上电锯滚木不被砍短。 |
| **原因** | ① 固定后 `_updateRollVisual` 已停，但 Visual 上 `Billboard` 每帧改 euler；② `CombatSystem.attackRange`/`arrowSpeed`/`命中半径` 按「约 10 单位」写死，与百级像素世界不匹配，且箭 prefab 未绑时静默不射；③ `SawTrap` 只靠 `BEGIN_CONTACT`，玩家/滚木 `setPosition`+传感器时常无接触事件。 |
| **解决** | `Log` 固定/失败时禁用 Billboard、清零角速度并冻 Visual 旋转；`GameConfig` 扩大索敌/箭速/命中半径，`CombatSystem` 纠正旧 range≤20 并 `resources.load` 箭 prefab；`SawTrap` 增加 AABB/距离轮询砍木与伤玩家。未改 `Main.scene`。 |

---

## fix-coin-fly-arrow-pierce — 金币不落地直飞 / 箭穿透与限距

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 金币落地后常不吸附、UI 不加；箭矢首命即毁、可无限追踪。 |
| **原因** | ① `Coin` 先抛物线落地，且仅在 `coinMagnetRange=6` 内吸附，与百级世界尺度不匹配，拾取回调不触发则无 `COIN_CHANGED`；② `Arrow` 命中即 `destroy`，无穿透计数与最大飞行距离。 |
| **解决** | 取消落地弧，生成后立即飞向玩家（提速/拾取半径），`addCoins` 仍 emit `COIN_CHANGED` 同步 `CoinUI`；箭沿初始方向直线飞行，最多穿透 5 名敌人，超出 `arrowMaxDistance` 销毁。 |

---

## fix-build-spawn-under-plot — 建成物挂到对应 Plot_* 下

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | `Plot_Wall_R` 下 `pref_build_plot` 消失后，墙未生成在 `Plot_Wall_R` 下（其它地块同理）。 |
| **原因** | `BuildSystem._instantiateAt` 一律挂到 `buildingRoot`，忽略地块父节点。 |
| **解决** | `BuildPlot` 完成时把 `plotRoot`（父节点）一并 emit；墙/塔/兵营/碑/高级塔占位均 `addChild` 到该 `Plot_*`，本地坐标置零。 |

---

## fix-hpbar-visual-height — 血条按 Visual 高度抬升

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 血条与角色 Visual 重叠。 |
| **原因** | 跟随只用固定 `followOffsetY`，未读 Visual 实际高度。 |
| **解决** | `HpBarUI` 取锚点 `UITransform.contentSize.height × \|worldScale.y\|`，按 `anchorY` 算到顶部后再加间隙。 |

---

## fix-build-coin-log-boss — 建造飞币 / 固定滚木 / Boss 血条

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | ① 建造时 CoinUI 一次跳变而非随交付渐减；② 滚木固定后不挡物、不可打；③ Boss 血条像 1、未上移；④ Boss Label 显示 `100/100`。 |
| **原因** | ① BuildPlot 三参 `(delta,paid,cost)` 被 CoinUI 当成 balance；② `isAttackable` 在固定后为 false，collider 仍是 sensor，无血量；③ Boss 无 HealthSystem，`bindTarget` 写成 1/1，`visualNode` 常空；④ Label 写死 `hp/max`。 |
| **解决** | BuildPlot 直接 `CoinSystem.addCoins` + `CoinUI` 渐变与飞币；固定后滚木改 Static 固体、可攻击、玩家血条模板；Boss 解析 Visual、emit 满血、放大过小攻击距离；`showMaxInLabel=false` 只显示当前血量。 |

---

## fix-enemy-pool-boss-chase-log-block — 小怪池/Boss 追人/滚木挡玩家

### v1（2026-09-03）

| 项 | 说明 |
|---|---|
| **现象** | 小怪上限过低且死后不重生；Boss 不追玩家；固定滚木挡不住玩家。 |
| **原因** | `poolMaxEnemies/farSpawnMaxAlive` 过小且只 instantiate 不回收；Boss `pickTarget` 优先建筑且只写 `linearVelocity`；玩家 sensor+`setPosition` 不吃固体。 |
| **解决** | 上限 200 + 对象池，死后 5s 在原 SpawnPoint 重生；Boss 优先追玩家并用 `setWorldPosition`；玩家对固定滚木做 AABB 分离。 |
