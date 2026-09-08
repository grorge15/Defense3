---
slug: phase-6-6-1-import-frames
版本: 3
状态: draft
创建: 2026-09-04
---

# §6.1 导入序列帧 + 道具/陷阱/箭矢/升级 VFX（phase-6-6-1-import-frames）

## 业务目标

**v1（已达成）**：按路径策略 A，用中文帧目录填充 20 个角色空 clip；缺帧留空；更新 `ANIM_MANIFEST`；不改 `playAnim` 名。

**v2（本增量）**：在保留 v1 产物前提下，补齐 5 类视觉——道具 Y 轴浮动、电锯圆锯序列帧、箭矢飞行特效、蓝/黄升级特效（新建 clip + 至多 2 个 VFX prefab，建造完成触发）。继续路径策略 A；不搬帧目录。

**v3（本增量）**：在保留 v1/v2 已完成产物前提下，放宽 v1/v2 对 `soldier_*` clip 保持空的历史基线，为 `animations/soldier_melee/` 与 `animations/soldier_ranged/` 下的既有士兵 clip 添加序列帧；`soldier_melee` 使用 `sprite/frames/角色/佣兵2`，`soldier_ranged` 使用 `sprite/frames/角色/佣兵1`。攻击 clip 必须使用 Cocos Animation 帧事件触发现有攻击命中/发射逻辑：ranged/佣兵1 在 `frame_017`，melee/佣兵2 在 `frame_013`。具体帧事件函数名 build 时以现有 Soldier 脚本/组件为准，本计划不硬编码无依据函数名。

## 风险等级

**中** — v2 新建 clip/prefab 须 MCP `create-prefab-from-node`；v3 会修改士兵 `.anim` 并添加攻击帧事件，误改 `playAnim` 名、硬编码不存在的 Soldier 事件函数、或手写整份 prefab/scene 会破坏既有基线；Saw 若同时强转 euler + 序列帧易双重旋转感。

## 路径策略（写死：A）

**A — 保留中文/特效导入树，不强制搬到英文路径。**

| 决策 | 说明 |
|---|---|
| 帧目录 | 继续使用 `sprite/frames/角色/...`、`frames/动画-圆锯/`、`sprite/特效/...`；**禁止**为对齐英文约定批量搬家 |
| Manifest | 更新 `docs/ANIM_MANIFEST.md`：追加本批（saw / arrow_fx / upgrade_blue / upgrade_yellow）映射；注明「实际帧数以磁盘为准」 |
| Clip | v1：仅编辑已有角色 `.anim`。v2：**允许新建** `animations/saw/`、`animations/vfx/`（或 `projectile/`）下 clip。v3：仅编辑 `animations/soldier_melee/`、`animations/soldier_ranged/` 下既有士兵 clip |
| 备选 B | 搬家 — **本任务不做** |

## 禁做项（必填）

### 仍禁止
- **禁止**为角色缺帧凑帧（player `parkour`/`skill`；`log/roll`）。`soldier_*` 保持空是 v1/v2 历史基线，已被本 v3 明确放宽，仅允许按本计划指定目录补 `soldier_melee` 与 `soldier_ranged`。
- **禁止**改既有角色 `.anim` 文件名；**禁止**改脚本 `playAnim` / `AnimUtil` 映射名与调用字符串。
- **禁止**手写整份 `.meta` uuid；**禁止**手写整份 `.prefab` / `Main.scene` JSON；**禁止**用 `_fix_prefabs.mjs` 等脚本重建。
- **禁止**做 §6.2～6.7（摇杆提示等另 plan）；**禁止**新建无关 UI prefab。
- **禁止**改战斗数值、`GameConfig` 击杀/经济等（浮动幅度可用常量或 GameConfig 小字段，勿改玩法数值）。
- **禁止**脑补第二套「升级系统」；黄/蓝仅为建造完成反馈特效。
- **默认跳过**仍跳：`动画-木杆` → log/roll（用户未点名）；`roll.anim` 保持空占位。
- **禁止**改 `Main.scene` 结构做大装配（VFX 由脚本在建造点 instantiate，不预摆关卡实例）。

### 本增量允许（相对 v1 放宽）
- **允许**改 `pref_item_bow`、`pref_item_log_extend`、`pref_trap_saw`、`pref_projectile_arrow`（挂 Animation/clip、必要时 Visual）。
- **允许**新建 clip：`animations/saw/spin.anim`（或等价）、`animations/vfx/arrow_trail.anim` 或 `animations/projectile/arrow_fx.anim`、`animations/vfx/upgrade_blue.anim`、`animations/vfx/upgrade_yellow.anim`。
- **允许** MCP `create-prefab-from-node` 新建至多 2 个：`pref_vfx_upgrade_blue`、`pref_vfx_upgrade_yellow`（Root→Visual；**禁止**嵌套 Canvas/Camera）。
- **允许**小范围脚本：`BowItem.ts` / `LogExtendItem.ts`（或共用浮动工具）、`TweenUtil.ts`（若缺 float 辅助）、`SawTrap.ts`、`Arrow.ts`（可选）、`BuildPlot.ts` / `BuildSystem.ts`（建造完成播 VFX 后销毁）。

### v3 本增量允许（相对 v1/v2 放宽）
- **允许**编辑 `assets/resources/animations/soldier_melee/` 与 `assets/resources/animations/soldier_ranged/` 下既有士兵 `.anim`，为非空目标 clip 添加序列帧曲线。
- **允许**为 `soldier_melee` 与 `soldier_ranged` 的攻击 clip 添加 Cocos Animation 帧事件；帧事件函数名必须从现有 Soldier 相关脚本/组件确认，不得在计划或实现中脑补硬编码。
- **允许**最小修改 `assets/scripts/character/Soldier.ts`，把攻击伤害/发射时机接到现有 `AnimUtil.playAttackWithFrameHit` + `AttackFrameRelay` 帧事件链；不得改攻击数值、冷却、目标选择、`playAnim`/clip 名映射。
- **允许**更新 `docs/ANIM_MANIFEST.md` 记录 v3 士兵帧目录、clip 映射与攻击帧事件帧号。
- **允许**使用 MCP/编辑器刷新既有 soldier prefab/Animation 对 clip 的引用，仅限引用缺失或编辑器未识别更新时；不得改节点树或新建士兵 prefab。

## 变更文件清单

### v1 已达成（保留，勿回退）
- 【已达成】`docs/ANIM_MANIFEST.md` — 路径策略 A + 角色映射表
- 【已达成】20 角色有帧 clip 已填；缺帧 clip 仍空
- 【已达成】热修：clip 绑 **本节点** `cc.Sprite.spriteFrame`（非 `HierarchyPath("Visual")`）
- 【v1/v2 历史基线】`player/parkour`/`skill`、`soldier_*`、`log/roll` 保持空；其中 `soldier_*` 已被 v3 放宽，`player/parkour`/`skill` 与 `log/roll` 仍保持空

### v2 可写 / 可新建
- 【可写】`docs/ANIM_MANIFEST.md` — 追加本批帧→clip 映射
- 【可写】`assets/scripts/core/TweenUtil.ts` — 可选：Y 轴循环浮动 + stop（若现有 API 不足）
- 【可写】`assets/scripts/item/BowItem.ts`、`LogExtendItem.ts` — Visual 浮动；拾取/销毁 `stopTweensOn`
- 【可写】`assets/scripts/trap/SawTrap.ts` — 播圆锯 clip；**推荐写死：序列帧为主，程序 euler 关闭**（`spinSpeed=0` 或条件跳过 update 旋转）
- 【可写·可选】`assets/scripts/projectile/Arrow.ts` — 飞行中播箭矢 clip
- 【可写】`assets/scripts/building/BuildPlot.ts` 和/或 `BuildSystem.ts` — 建造完成 instantiate 蓝/黄 VFX，播完销毁
- 【可新建·MCP】`assets/resources/animations/saw/spin.anim`（4 帧，`frames/动画-圆锯`）
- 【可新建·MCP】`assets/resources/animations/vfx/arrow_trail.anim`（或 `projectile/arrow_fx.anim`；4 帧，`特效/主角远程攻击特效`）
- 【可新建·MCP】`assets/resources/animations/vfx/upgrade_blue.anim`（9 帧）、`upgrade_yellow.anim`（9 帧）
- 【可新建·MCP】`pref_vfx_upgrade_blue`、`pref_vfx_upgrade_yellow`（`create-prefab-from-node`；无 Canvas/Camera）
- 【可写·prefab】`pref_item_bow`、`pref_item_log_extend`（仅脚本/浮动所需，可不改树）、`pref_trap_saw`（挂 spin clip）、`pref_projectile_arrow`（挂 arrow clip）
- 【仅只读参考】v1 角色 clip/prefab；`Coin.ts` 的 `stopTweensOn` 用法；`BuildPlotType`

### v3 可写 / 可新建
- 【可写】`docs/ANIM_MANIFEST.md` — 追加 v3 soldier_melee / soldier_ranged 帧目录、clip 映射、攻击帧事件帧号
- 【可写】`assets/scripts/character/Soldier.ts` — 仅允许把 melee / ranged 攻击实际生效点改为现有帧事件链；不改数值/范围/冷却/clip 名
- 【可写】`assets/resources/animations/soldier_melee/*.anim` — 仅填充 `sprite/frames/角色/佣兵2` 序列帧；攻击 clip 在 `frame_013` 添加帧事件
- 【可写】`assets/resources/animations/soldier_ranged/*.anim` — 仅填充 `sprite/frames/角色/佣兵1` 序列帧；攻击 clip 在 `frame_017` 添加帧事件
- 【可写·条件】既有 soldier prefab/Animation 引用 — 仅当 clip 引用缺失或编辑器未识别更新时，用 MCP/编辑器刷新引用；不得改节点树
- 【只读参考】`assets/scripts/core/AnimUtil.ts`、`assets/scripts/core/AttackFrameRelay.ts` 与同类角色攻击实现 — 用于确认现有帧事件函数名和调用模式；不得新增脑补函数名
- 【不可新建】v3 不新建 prefab、scene 节点、中文帧目录副本或额外英文帧目录

### 本批帧映射（build 须按此绑）

| 磁盘路径 | PNG 数 | 目标 clip / 用途 |
|---|---|---|
| `sprite/frames/动画-圆锯` | 4 | `animations/saw/spin` → `pref_trap_saw` 循环 |
| `sprite/特效/主角远程攻击特效` | 4 | `animations/vfx/arrow_trail`（或 `projectile/arrow_fx`）→ `pref_projectile_arrow` |
| `sprite/特效/蓝色升级特效序列帧` | 9 | `animations/vfx/upgrade_blue` → `pref_vfx_upgrade_blue` |
| `sprite/特效/黄色升级特效序列帧` | 9 | `animations/vfx/upgrade_yellow` → `pref_vfx_upgrade_yellow` |
| （程序，无帧） | — | bow / log_extend Visual Y 浮动 |

> 曲线绑定：Animation 若挂在 **Visual 本节点**，只绑本节点 `cc.Sprite.spriteFrame`（沿用 v1 热修）；勿 `HierarchyPath("Visual")`。

### v3 士兵帧映射（build 须按此绑）

| 目标 | 磁盘路径 | 目标 clip / 用途 | 攻击帧事件 |
|---|---|---|---|
| `soldier_melee` | `sprite/frames/角色/佣兵2` | `animations/soldier_melee/` 下既有士兵 clip | 攻击 clip 在 `frame_013` 触发现有 melee 命中逻辑 |
| `soldier_ranged` | `sprite/frames/角色/佣兵1` | `animations/soldier_ranged/` 下既有士兵 clip | 攻击 clip 在 `frame_017` 触发现有 ranged 发射逻辑 |

> v3 路径策略仍为 A：不搬中文帧目录，不复制到英文目录，不改资源 uuid；帧数与文件名以磁盘为准。帧事件函数名必须从现有 Soldier 脚本/组件确认后绑定。

## 写死推荐（实施勿摇摆）

| 项 | 推荐 | 说明 |
|---|---|---|
| 道具浮动 | `TweenUtil` 对 Visual 本地 Y 正弦/往返 tween 循环 | 拾取 hop 前与 `onDestroy` 须 `stopTweensOn(visual)` |
| 电锯 | **序列帧为主**；**关闭**程序 euler（`spinSpeed=0`） | 避免帧动画 + Z 旋转双重转；勿保留慢转 |
| 箭矢特效 | **飞行中 Loop**；落地/销毁时 stop | 4 帧 trail 感；勿播一次就停在半空 |
| 蓝 VFX 触发 | `BuildSystem._onBuildComplete`（或 `BuildPlot` 完成回调） | **基础建造**：`wall` / `towerBasic` / `barracks` / `expandArea` |
| 黄 VFX 触发 | 同上 | **高级/英雄**：`towerAdvanced` / `heroShrine` |
| VFX 生命周期 | instantiate 于地块世界坐标 → 播 Normal 不循环 → 结束销毁 | 勿常驻场景 |

## To-dos（必填）

### v1（已完成 — 保持勾选）
- [x] `6.1.a`：更新 `docs/ANIM_MANIFEST.md`（路径策略 A 映射表 + 「实际帧数以磁盘为准」+ 缺帧留空说明）
- [x] `6.1.b`：MCP/编辑器确认有帧 PNG 为 SpriteFrame 类型（错则修正导入设置，不手写 uuid）
- [x] `6.1.c`：填充 player `idle/walk/melee_attack/die`；`parkour`/`skill` 保持空
- [x] `6.1.d`：填充 enemy_minion 四 clip
- [x] `6.1.e`：填充 enemy_boss 四 clip
- [x] `6.1.f`：填充 hero_01、hero_02 各四 clip
- [x] `6.1.g`：soldier_* 与 log/roll **确认仍为空占位**（不绑帧）
- [x] `6.1.h`：若 prefab Animation 未自动引用新曲线 → MCP 仅刷新已替换 clip 挂接（不改节点树）— **N/A**（prefab 已挂 clip 资源；曲线在 .anim 内刷新）
- [x] `6.1.i`：任务末机器 AC（见校验点）；`rg playAnim` 确认脚本名未变

### v2（新增 — 已完成）
- [x] `6.1.j`：ANIM_MANIFEST 追加本批 4 类帧→clip 映射（saw / arrow / upgrade_blue / upgrade_yellow）；注明浮动为程序动画
- [x] `6.1.k`：道具浮动 — `TweenUtil`（若需）+ `BowItem`/`LogExtendItem` 对 Visual 循环 Y 浮动；拾取/销毁 stop
- [x] `6.1.l`：新建 `saw/spin.anim`（4 帧）→ MCP 挂 `pref_trap_saw`；`SawTrap` 改播序列帧并关闭 euler
- [x] `6.1.m`：新建 arrow trail/fx clip（4 帧）→ MCP 挂 `pref_projectile_arrow`；飞行中 Loop（`Arrow.ts` 或 prefab 默认播）
- [x] `6.1.n`：新建 `upgrade_blue` clip + MCP `pref_vfx_upgrade_blue`；`BuildSystem`/`BuildPlot` 基础建造完成播放后销毁
- [x] `6.1.o`：新建 `upgrade_yellow` clip + MCP `pref_vfx_upgrade_yellow`；高级塔/英雄圣地建造完成播放后销毁
- [x] `6.1.p`：任务末一次机器 AC（AC-FLOAT / SAW / ARROW-FX / VFX-* + GATE/P3/EDITOR）；确认角色 `playAnim` 名未变、缺帧仍空、未做 log/roll

### v3（新增 — 待执行）
- [ ] `6.1.q`：ANIM_MANIFEST 追加 soldier_melee / soldier_ranged 帧目录、clip 映射、攻击帧事件帧号；注明 v1/v2 的 soldier 空占位基线已由 v3 放宽
- [ ] `6.1.r`：确认 `sprite/frames/角色/佣兵2`、`sprite/frames/角色/佣兵1` PNG 已作为 SpriteFrame 导入；不搬目录、不复制目录、不手写 `.meta` uuid
- [ ] `6.1.s`：`Soldier.ts` 复用现有 `playAttackWithFrameHit` / `AttackFrameRelay`，把 ranged 出弹+伤害、melee 伤害改为攻击 clip 帧事件触发；不改数值/冷却/目标选择
- [ ] `6.1.t`：填充 `assets/resources/animations/soldier_melee/` 下既有士兵 clip；攻击 clip 在 `frame_013` 添加 Cocos Animation 帧事件，调用现有 Soldier melee 命中逻辑
- [ ] `6.1.u`：填充 `assets/resources/animations/soldier_ranged/` 下既有士兵 clip；攻击 clip 在 `frame_017` 添加 Cocos Animation 帧事件，调用现有 Soldier ranged 发射逻辑
- [ ] `6.1.v`：如 soldier prefab/Animation 未自动识别更新 clip，仅用 MCP/编辑器刷新既有引用；不得改节点树或新建 prefab
- [ ] `6.1.w`：任务末一次机器 AC（AC-SOLDIER-* + GATE/P3/EDITOR 视 prefab 是否改动）；确认 `playAnim` 字符串未变、`player/parkour`/`skill` 与 `log/roll` 仍空、未搬中文帧目录

## 实施步骤

1. **S0 前置门**：本会话一次 MCP `assets-query-path`，确认绑定 **Defense3**。
2. **S1 文档**：ANIM_MANIFEST 追加本批映射（v2 为 6.1.j；v3 为 6.1.q）。
3. **S2 浮动（v2 已完成，勿重做）**：脚本侧 Visual Y 循环；拾取路径先 stop 再 hop（6.1.k）。无 MCP 也可先验；若改 prefab 树则同会话末再 save。
4. **S3 圆锯（v2 已完成，勿重做）**：确认 4 PNG 为 SpriteFrame → 建 `spin.anim`（Loop）→ 挂 saw Visual Animation → `spinSpeed=0`（6.1.l）。
5. **S4 箭矢（v2 已完成，勿重做）**：建 clip（Loop）→ 挂 arrow → 飞行中播（6.1.m）。
6. **S5 升级 VFX（v2 已完成，勿重做）**：同会话内搭临时节点 → `create-prefab-from-node` ×2 → 删临时节点；clip 绑 Visual 本节点 Sprite；BuildSystem 按 `BuildPlotType` 选蓝/黄 instantiate（6.1.n/o）。
7. **S6 士兵帧源确认（v3）**：确认 `sprite/frames/角色/佣兵2` 与 `sprite/frames/角色/佣兵1` 下 PNG 已导入为 SpriteFrame；保持路径策略 A，不搬中文帧目录。
8. **S7 Soldier 事件链（v3）**：确认并复用现有 `AnimUtil.playAttackWithFrameHit` / `AttackFrameRelay.onAttackFrameHit`；最小修改 `Soldier.ts`，让 ranged 出弹+伤害、melee 伤害在攻击帧事件触发，不在动画开始瞬间触发。若现有帧事件链不可用则硬阻塞并报告，不脑补第二套事件组件。
9. **S8 soldier_melee（v3）**：编辑 `animations/soldier_melee/` 下既有 clip，使用 `角色/佣兵2` 序列帧；攻击 clip 在 `frame_013` 添加 Cocos Animation 帧事件。
10. **S9 soldier_ranged（v3）**：编辑 `animations/soldier_ranged/` 下既有 clip，使用 `角色/佣兵1` 序列帧；攻击 clip 在 `frame_017` 添加 Cocos Animation 帧事件。
11. **S10 条件刷新（v3）**：仅当 soldier prefab/Animation 引用缺失或编辑器未识别更新时，用 MCP/编辑器刷新既有引用；不得改节点树、新建 prefab 或改 Main.scene。
12. **S11 验收**：任务末 **一次** save（若有 scene/prefab 写）→ 需要则 `scene-close` + `post-scene-save.ps1` → AC-GATE + 本任务新建/改过 prefab 的 AC-P3 + AC-EDITOR-MCP；脚本/文档 AC 用 rg。

> MCP 绑 vs 脚本：clip/sprite/Animation 挂接 → MCP；浮动与建造触发 → 脚本；可空子节点引用优先 `_resolveRefs`/`getChildByName`，减少无意义 set。

## 校验点

### v1 已达成（保留说明，勿回退）
- [AC-DOC] ~~v1~~ ANIM_MANIFEST 角色映射 + 缺帧清单 — **已达成**
- [AC-CLIP-FILLED] 20 角色有帧 clip — **已达成**
- [AC-CLIP-EMPTY] parkour/skill、soldier_*、log/roll 仍空 — **v1/v2 已达成**；v3 放宽 `soldier_*`，但 `parkour`/`skill` 与 `log/roll` 仍须保持空
- [AC-SCRIPT] 角色 `playAnim` 字符串未改 — **已达成**（v2 仍须保持）
- [AC-LOOP] idle/walk Loop；attack/die Normal — **已达成**
- 热修：clip 绑本节点 Sprite — **已达成**（v2 新 clip 同样遵守）

### v2 新增
- [AC-FLOAT] `pref_item_bow` / `pref_item_log_extend`：Visual 有 Y 浮动；拾取/销毁后 tween 停止（代码路径可见 stop）
- [AC-SAW] `saw/spin.anim` 有 4 帧且挂于 `pref_trap_saw`；wrapMode Loop；程序 euler 已关
- [AC-ARROW-FX] arrow trail/fx clip 有 4 帧且挂于 `pref_projectile_arrow`；飞行中循环约定落地
- [AC-VFX-BLUE] `upgrade_blue` clip + `pref_vfx_upgrade_blue` 合法（invalid:false）；建造完成可触达（`rg` BuildSystem/BuildPlot 蓝 prefab / type 分支）
- [AC-VFX-YELLOW] `upgrade_yellow` clip + `pref_vfx_upgrade_yellow` 合法；高级塔/圣地分支可触达
- [AC-MANIFEST-V2] ANIM_MANIFEST 含本批 4 类映射
- [AC-NO-REGRESS] `rg "playAnim"` 角色名未变；缺帧 clip 仍空；未绑 `动画-木杆`→roll

### v3 新增
- [AC-SOLDIER-MANIFEST] ANIM_MANIFEST 含 soldier_melee / soldier_ranged 帧目录、clip 映射、攻击帧事件帧号，并注明 soldier 空占位历史基线已被 v3 放宽
- [AC-SOLDIER-MELEE] `animations/soldier_melee/` 下目标既有 clip 使用 `sprite/frames/角色/佣兵2` 序列帧；攻击 clip 在 `frame_013` 有 Cocos Animation 帧事件
- [AC-SOLDIER-RANGED] `animations/soldier_ranged/` 下目标既有 clip 使用 `sprite/frames/角色/佣兵1` 序列帧；攻击 clip 在 `frame_017` 有 Cocos Animation 帧事件
- [AC-SOLDIER-EVENT] `Soldier.ts` 使用现有 `playAttackWithFrameHit` / `AttackFrameRelay` 帧事件链；ranged 出弹+伤害、melee 伤害不再在动画开始瞬间触发；报告记录确认来源；不得新增无依据事件函数名
- [AC-SOLDIER-NO-MOVE] 中文帧目录未搬迁、未复制到英文目录、未手写 `.meta` uuid
- [AC-NO-REGRESS-V3] `rg "playAnim"` 角色名未变；`player/parkour`/`skill` 与 `log/roll` 仍空；v1/v2 的已完成 saw / arrow / upgrade VFX / item float 不重建不回退

### MCP（改过 prefab 时，任务末一次）
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` exit 0
- [AC-P3] 本任务新建/改过的每个 prefab（bow/log_extend/saw/arrow + 至多 2 VFX）`assets-query-asset-info` → `invalid: false`
- [AC-EDITOR-MCP] 打开改过的目标 prefab → `system-query-logs` 无因此资源红错 / missing script

### 条件 / 不阻塞
- [AC-P3b] 新建 VFX / 改过 Animation 挂接时抽查引用非 null
- [AC-PLAY] 手测：道具浮动、电锯转、射箭特效、建初级塔蓝/高级塔黄 — 不阻塞机器 `done`

## 回滚策略

- **v1 基线**：勿回退已填 20 clip / ANIM_MANIFEST 角色表 / 热修曲线路径。
- **v2 失败**：删除本增量新建的 saw/vfx clip 与 `pref_vfx_upgrade_*`（及 `.meta`）；还原 bow/log_extend/saw/arrow prefab 与相关脚本到增量前；**不要**删帧 PNG 目录。
- **v3 失败**：仅回退 `soldier_melee` / `soldier_ranged` 本次编辑的 `.anim` 与 ANIM_MANIFEST v3 追加段；若仅帧事件函数名确认失败，保留已确认安全的文档证据并硬阻塞，不改 Soldier 脚本脑补入口；**不要**删除或移动 `角色/佣兵1`、`角色/佣兵2` 帧目录。
- 误开 euler+序列帧双重转：关 `spinSpeed`，保留 clip。

## 修订记录

- v1（2026-09-04）：draft→done；路径策略 A；20 角色 clip；缺帧留空；不做 6.2~6.7；无 OpenSpec；热修本节点 Sprite 绑定。
- v2（2026-09-07）：**replan 范围扩展**（非机器失败）。用户新增 5 类视觉：道具浮动、电锯序列帧、箭矢特效、蓝/黄升级 VFX。状态 done→**draft**。保留 v1 产物与 AC（6.1.a~i `[x]`）。新增 6.1.j~p。禁做放宽：允许改 bow/log_extend/saw/arrow prefab、新建 vfx clip + ≤2 upgrade prefab、小范围脚本；仍禁 6.2~6.7、凑缺帧、改 playAnim 角色 clip 名、手写整份 prefab/scene、脑补升级系统。默认仍跳过 `动画-木杆`。无 OpenSpec。
- v3（2026-09-08）：**replan 范围扩展**（非机器失败）。用户新增 `soldier_melee` / `soldier_ranged` 序列帧与攻击帧事件要求。版本 2→3，状态 done→**draft**。保留 v1/v2 已完成产物、报告口径与 AC；仅放宽 `soldier_*` 保持空的历史基线。新增 6.1.q~w；路径策略仍为 A，不搬中文帧目录。`soldier_melee` 使用 `角色/佣兵2`，攻击事件 `frame_013`；`soldier_ranged` 使用 `角色/佣兵1`，攻击事件 `frame_017`。帧事件必须复用现有 `AnimUtil.playAttackWithFrameHit` / `AttackFrameRelay` 机制触发 Soldier 命中/发射逻辑；不改数值、目标选择或 clip 名。无 OpenSpec。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| verify-mcp-gate | |
| post-scene-save Patched | 0/1 |
| assets-reimport-asset | |
| 本任务新建 prefab 数 | ≤2（upgrade blue/yellow） |
| 是否续跑 | yes（v3 从 6.1.q；跳过已勾选 6.1.a~p） |
| OpenSpec change | none |
