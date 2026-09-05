---
slug: phase-6-6-1-import-frames
版本: 1
状态: done
创建: 2026-09-04
---

# §6.1 导入序列帧替换空 clip（phase-6-6-1-import-frames）

## 业务目标

按 `docs/ANIM_MANIFEST.md` 精神，用 `assets/resources/sprite/frames/` 下**已导入**的中文路径序列帧，填充对应空 `.anim` clip 曲线；缺帧实体/动作**保持空占位**（禁止凑帧）。不改脚本 `playAnim` clip 名与调用；不重命名既有 `.anim` 文件。

## 风险等级

**中** — clip/SpriteFrame 须经编辑器或 Cocos MCP 绑定；误改 `.meta` uuid 或整文件手写 prefab 会破坏资源；帧数与旧 manifest 区间表不一致，必须以磁盘为准。

## 路径策略（写死：A）

**A — 保留中文导入树，不强制搬到英文 `player/idle/` 等路径。**

| 决策 | 说明 |
|---|---|
| 帧目录 | 继续使用 `assets/resources/sprite/frames/角色/...`、`动画-木杆/`；**禁止**为对齐旧英文约定批量搬家 |
| Manifest | 更新 `docs/ANIM_MANIFEST.md`：增加「实际导入路径映射表」；注明「实际帧数以磁盘为准」；旧英文目标目录表降为历史约定 |
| Clip | 仅编辑已有 `assets/resources/animations/{entity}/{action}.anim`；曲线引用现有 spriteFrame UUID |
| 备选 B | 搬到英文路径须 MCP/资源移动 + uuid 风险说明 — **本任务不做** |

## 禁做项（必填）

- **禁止**从 `temp_frames/` 切片（目录不存在；帧已在中文树）。
- **禁止**路径策略 B：批量搬迁/重命名帧目录到英文 `sprite/frames/{entity}/{action}/`。
- **禁止**为缺帧 clip 编造、复制、拉伸凑帧（player `parkour`/`skill`；soldier_* 全部；log `roll` 若跳过序列帧）。
- **禁止**改 `.anim` 文件名；**禁止**改脚本 `playAnim` / `AnimUtil` 映射名与调用字符串。
- **禁止**手写整份 `.meta` uuid；**禁止**手写整份 `.prefab` / `Main.scene` JSON；**禁止**用 `_fix_prefabs.mjs` 等脚本重建。
- **禁止**新建无关 UI prefab；**禁止**改 `Main.scene` 结构（本任务非场景装配）。
- **禁止**做 §6.2～6.7（VFX/摇杆提示等另 plan）。
- **禁止**改 `playAnim` 业务逻辑、战斗数值、`GameConfig`。
- prefab：仅把**已替换**的 clip 挂回/刷新对应角色 `Animation`；已挂则只刷新曲线，不重做 prefab 树。
- log：默认**跳过**序列帧，`roll.anim` 保持空占位（程序旋转已够）；勿强制绑 `动画-木杆`。

## 变更文件清单

- 【可写】`docs/ANIM_MANIFEST.md` — 实际导入路径映射表；帧数「以磁盘为准」；循环约定不变
- 【可写】`assets/resources/animations/player/{idle,walk,melee_attack,die}.anim` — 绑已有主角帧
- 【可写】`assets/resources/animations/enemy_minion/{idle,walk,attack,die}.anim` — 绑骷髅兵帧
- 【可写】`assets/resources/animations/enemy_boss/{idle,walk,attack,die}.anim` — 绑骷髅 BOSS 帧
- 【可写】`assets/resources/animations/hero_01/{idle,walk,attack,die}.anim` — 绑英雄1帧
- 【可写】`assets/resources/animations/hero_02/{idle,walk,attack,die}.anim` — 绑英雄2帧
- 【可写·条件】对应角色 prefab（`pref_player` / `pref_enemy_*` / 英雄相关）— 仅刷新 Animation 上已替换 clip 引用（若编辑器未自动同步）
- 【可写·检查】帧 PNG 的 SpriteFrame 导入类型（经 MCP/编辑器；不手写 `.meta`）
- 【保持空·勿改内容凑帧】`player/parkour.anim`、`player/skill.anim`；`soldier_melee/*`、`soldier_ranged/*`；`log/roll.anim`
- 【仅只读参考】`docs/ANIM_MANIFEST.md`（改前基线）、`assets/scripts/**/AnimUtil.ts` 与各角色 `playAnim` 调用、既有空 clip、中文帧目录

### 实际导入路径映射（build 须按此绑）

| 磁盘路径（`sprite/frames/` 下） | PNG 数 | entity / clip |
|---|---|---|
| `角色/主角/待机` | 4 | player / idle |
| `角色/主角/移动` | 5 | player / walk |
| `角色/主角/攻击1` | 8 | player / melee_attack |
| `角色/主角/死亡` | 9 | player / die |
| `角色/骷髅兵/待机` | 8 | enemy_minion / idle |
| `角色/骷髅兵/移动` | 7 | enemy_minion / walk |
| `角色/骷髅兵/攻击` | 8 | enemy_minion / attack |
| `角色/骷髅兵/死亡` | 10 | enemy_minion / die |
| `角色/骷髅BOSS/待机` | 12 | enemy_boss / idle |
| `角色/骷髅BOSS/移动` | 8 | enemy_boss / walk |
| `角色/骷髅BOSS/攻击` | 12 | enemy_boss / attack |
| `角色/骷髅BOSS/死亡` | 16 | enemy_boss / die |
| `角色/英雄1/待机` | 5 | hero_01 / idle |
| `角色/英雄1/移动` | 5 | hero_01 / walk |
| `角色/英雄1/攻击1` | 7 | hero_01 / attack |
| `角色/英雄1/死亡` | 6 | hero_01 / die |
| `角色/英雄2/待机` | 6 | hero_02 / idle |
| `角色/英雄2/移动` | 5 | hero_02 / walk |
| `角色/英雄2/攻击1` | 6 | hero_02 / attack |
| `角色/英雄2/死亡` | 9 | hero_02 / die |
| `动画-木杆` | 10 | log 可选；**本任务默认跳过** |

### 缺帧 → 必须留空

| entity | clip | 原因 |
|---|---|---|
| player | parkour, skill | 无对应中文目录 |
| soldier_melee | idle, melee_attack, die | 磁盘无士兵帧 |
| soldier_ranged | idle, remote_attack, die | 磁盘无士兵帧 |
| log | roll | 默认不做序列帧；程序旋转 |

### 循环约定（与 manifest 一致）

| 类型 | clips | wrapMode |
|---|---|---|
| 循环 | idle, walk | Loop |
| 不循环 | attack, die, melee_attack | Normal（播完停） |

> 帧序列：目录内全部 `frame_*.png` 按文件名排序入 clip；**勿裁到**旧区间表假想 000~007。

## To-dos（必填）

- [x] `6.1.a`：更新 `docs/ANIM_MANIFEST.md`（路径策略 A 映射表 + 「实际帧数以磁盘为准」+ 缺帧留空说明）
- [x] `6.1.b`：MCP/编辑器确认有帧 PNG 为 SpriteFrame 类型（错则修正导入设置，不手写 uuid）
- [x] `6.1.c`：填充 player `idle/walk/melee_attack/die`；`parkour`/`skill` 保持空
- [x] `6.1.d`：填充 enemy_minion 四 clip
- [x] `6.1.e`：填充 enemy_boss 四 clip
- [x] `6.1.f`：填充 hero_01、hero_02 各四 clip
- [x] `6.1.g`：soldier_* 与 log/roll **确认仍为空占位**（不绑帧）
- [x] `6.1.h`：若 prefab Animation 未自动引用新曲线 → MCP 仅刷新已替换 clip 挂接（不改节点树）— **N/A**（prefab 已挂 clip 资源；曲线在 .anim 内刷新）
- [x] `6.1.i`：任务末机器 AC（见校验点）；`rg playAnim` 确认脚本名未变

## 实施步骤

1. **S1 文档**：先改 `ANIM_MANIFEST.md`（映射表 + 磁盘帧数优先），避免 build 仍按英文假想路径找帧。
2. **S2 前置门**：本会话一次 MCP `assets-query-path`，确认绑定 **Defense3**。
3. **S3 导入检查**：对上表有帧目录抽查 SpriteFrame；批量同会话内完成，勿每帧 save+gate。
4. **S4 填 clip（MCP/编辑器）**：按映射表把 spriteFrame 写入对应 `.anim` 曲线；设 sample/duration 合理；idle/walk 循环，攻击/死亡不循环；**缺帧跳过**。
5. **S5 prefab**：仅当 Animation 仍指向空曲线或引用断裂时，MCP 补绑；优先依赖已挂 clip 资源刷新，少动 Inspector。
6. **S6 验收**：有帧 clip 编辑器可播；无帧仍空；脚本 `rg "playAnim"` 名不变；任务末一次 AC-GATE（若改过 prefab）及 AC-P3/EDITOR-MCP。

> MCP 绑 vs 脚本：本任务 **无** `_resolveRefs` 兜底项；clip/sprite 绑定一律编辑器或 MCP。禁止手写整份 anim/prefab JSON 冒充。

## 校验点

- [AC-DOC] `ANIM_MANIFEST.md` 含实际导入路径映射；注明帧数以磁盘为准；缺帧清单可见
- [AC-CLIP-FILLED] 上表 20 个有帧 clip（player×4 + minion×4 + boss×4 + hero_01×4 + hero_02×4）编辑器预览有序列帧
- [AC-CLIP-EMPTY] `parkour`/`skill`、全部 `soldier_*`、`log/roll` 仍为空占位（无凑帧）
- [AC-SCRIPT] `rg "playAnim" assets/scripts` — 调用字符串相对任务前无改动（含 `meleeAttack`/`remoteAttack` 等 camelCase）
- [AC-LOOP] idle/walk 循环；attack/die/melee_attack 不循环

### MCP（改过 prefab 或需门禁的 anim/sprite 交付时，任务末一次）

- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` exit 0（改过 prefab 必跑；仅 anim+sprite 若 gate 覆盖相关检查则同样任务末一次）
- [AC-P3] 本任务改过的角色 prefab（若有）`assets-query-asset-info` → `invalid: false`
- [AC-EDITOR-MCP] 打开改过的 prefab → `system-query-logs` 无因此资源红错 / missing script

### 条件 / 不阻塞

- [AC-P3b] 仅当改过 Animation clip 挂接时抽查
- [AC-PLAY] 进 Prefab/动画预览播 idle→walk→attack；不阻塞机器 `done`
- 纯文档+anim、未改 prefab → AC-P3/EDITOR 可标 N/A，仍须 AC-CLIP-* 与 AC-SCRIPT

## 回滚策略

- 基线：任务前 git 中空 `.anim` + 未改的 `ANIM_MANIFEST.md` + 未动的 prefab
- 失败：还原本任务改过的 `.anim` / manifest / prefab；**不要**删除中文帧目录 PNG
- 误绑凑帧：删除错误曲线关键帧，恢复空占位 duration≈0.1s

## 修订记录

- v1（2026-09-04）：draft；路径策略 A；有帧填 clip、缺帧留空；不做 6.2~6.7；无 OpenSpec。

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
| 本任务新建 prefab 数 | 0（禁新建） |
| 是否续跑 | yes/no |
| OpenSpec change | none |
