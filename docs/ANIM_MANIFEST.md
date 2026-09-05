# 动画资源清单（ANIM_MANIFEST）

> P2 预制体按 clip 名挂空占位；P6 替换时**只换 clip 曲线内容，不改 clip 文件名与脚本 `playAnim` 调用**。

## 路径策略 A（现行）

**保留中文导入树，不强制搬到英文 `player/idle/` 等路径。**

| 项 | 约定 |
|---|---|
| **帧目录** | `assets/resources/sprite/frames/角色/...`、`动画-木杆/`（禁止为对齐旧英文约定批量搬家） |
| **帧文件名** | `frame_*.png`（按文件名排序入 clip；**实际帧数以磁盘为准**） |
| **clip 路径** | `assets/resources/animations/{entity}/{action}.anim` |
| **clip 名** | 与 action 同名（如 `idle`、`walk`、`melee_attack`） |
| **占位 clip** | 无有效帧，duration≈0.1s；缺帧实体保持空，禁止凑帧 |
| **帧率参考** | 有帧 clip 默认 sample=10；idle/walk 循环，攻击/死亡不循环 |

### 实际导入路径映射（绑帧以本表为准）

| 磁盘路径（`sprite/frames/` 下） | PNG 数（磁盘） | entity / clip | wrapMode |
|---|---|---|---|
| `角色/主角/待机` | 4 | player / idle | Loop |
| `角色/主角/移动` | 5 | player / walk | Loop |
| `角色/主角/攻击1` | 8 | player / melee_attack | Normal |
| `角色/主角/死亡` | 9 | player / die | Normal |
| `角色/骷髅兵/待机` | 8 | enemy_minion / idle | Loop |
| `角色/骷髅兵/移动` | 7 | enemy_minion / walk | Loop |
| `角色/骷髅兵/攻击` | 8 | enemy_minion / attack | Normal |
| `角色/骷髅兵/死亡` | 10 | enemy_minion / die | Normal |
| `角色/骷髅BOSS/待机` | 12 | enemy_boss / idle | Loop |
| `角色/骷髅BOSS/移动` | 8 | enemy_boss / walk | Loop |
| `角色/骷髅BOSS/攻击` | 12 | enemy_boss / attack | Normal |
| `角色/骷髅BOSS/死亡` | 16 | enemy_boss / die | Normal |
| `角色/英雄1/待机` | 5 | hero_01 / idle | Loop |
| `角色/英雄1/移动` | 5 | hero_01 / walk | Loop |
| `角色/英雄1/攻击1` | 7 | hero_01 / attack | Normal |
| `角色/英雄1/死亡` | 6 | hero_01 / die | Normal |
| `角色/英雄2/待机` | 6 | hero_02 / idle | Loop |
| `角色/英雄2/移动` | 5 | hero_02 / walk | Loop |
| `角色/英雄2/攻击1` | 6 | hero_02 / attack | Normal |
| `角色/英雄2/死亡` | 9 | hero_02 / die | Normal |
| `动画-木杆` | 10 | log / roll（可选） | — |

> **实际帧数以磁盘为准**；勿裁到下方「历史英文区间表」假想范围。

### 缺帧 → 必须留空（禁止凑帧）

| entity | clip | 原因 |
|---|---|---|
| player | parkour, skill | 无对应中文目录 |
| soldier_melee | idle, melee_attack, die | 磁盘无士兵帧 |
| soldier_ranged | idle, remote_attack, die | 磁盘无士兵帧 |
| log | roll | 默认不做序列帧；程序旋转已够；勿强制绑 `动画-木杆` |

### 循环约定

| 类型 | clips | wrapMode |
|---|---|---|
| 循环 | idle, walk | Loop |
| 不循环 | attack, die, melee_attack | Normal（播完停） |

> 脚本调用 clip 名用 camelCase：`meleeAttack` / `remoteAttack`；磁盘 action 用 snake_case：`melee_attack` / `remote_attack`；`AnimUtil` 负责映射。

---

## 历史约定（英文目标目录，已降级）

> 下列为早期英文路径/区间设想，**仅作历史参考**；现行以「实际导入路径映射」与磁盘 PNG 为准。

| 项 | 旧约定 |
|---|---|
| **源素材暂存** | 项目根 `temp_frames/`（本任务不存在、不切片） |
| **旧运行时路径设想** | `assets/resources/sprite/frames/{entity}/{action}/frame_XXX.png` |

### player（历史）

| clip | 旧目标目录 | 旧帧区间 | 循环 |
|---|---|---|---|
| idle | `sprite/frames/player/idle/` | frame_000 ~ frame_007 | 是 |
| walk | `sprite/frames/player/walk/` | frame_008 ~ frame_015 | 是 |
| parkour | `sprite/frames/player/parkour/` | frame_016 ~ frame_023 | 是 |
| melee_attack | `sprite/frames/player/melee_attack/` | frame_024 ~ frame_031 | 否 |
| skill | `sprite/frames/player/skill/` | frame_032 ~ frame_039 | 否 |
| die | `sprite/frames/player/die/` | frame_040 ~ frame_047 | 否 |

### enemy_minion / enemy_boss / hero_* / soldier_*（历史）

旧英文目录与区间表已废弃；士兵与 parkour/skill 仍无帧 → 保持空占位。

### log（历史）

| clip | 说明 |
|---|---|
| roll | 程序旋转驱动；clip 为空占位，duration=0.1s |

## 验收命令（P6 替换后）

```bash
# 有帧目录（中文树）
ls "assets/resources/sprite/frames/角色/主角/待机/"
rg "playAnim|\.play\(" assets/scripts/character/Player.ts
```
