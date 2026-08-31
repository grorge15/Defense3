# 动画资源清单（ANIM_MANIFEST）

> 权威帧区间定义。P2 预制体制作时按 clip 名挂空占位符；P6 替换时**只换 clip 资源，不改 clip 名与脚本调用**。

## 帧文件命名与导入

| 项 | 约定 |
|---|---|
| **源素材暂存** | 项目根 `temp_frames/`（仅导入用，不参与 `resources.load`） |
| **运行时路径** | `assets/resources/sprite/frames/{entity}/{action}/frame_XXX.png` |
| **帧文件名** | `frame_000.png` ~ `frame_NNN.png`（3 位补零） |
| **clip 路径** | `assets/resources/animations/{entity}/{action}.anim` |
| **clip 名** | 与 action 同名（如 `idle`、`walk`） |
| **占位 clip** | 无关键帧，duration=0.1s；P2 阶段必须创建并挂入 Animation 组件 |
| **帧率参考** | `temp_frames/` 中 `frame_XX_Y.Ys.jpg` 表示参考时间轴（约 1.5s/帧），导入后按动作调整 clip sample |

## 帧区间表（导入目标）

> 美术未到位前用空 clip；到位后将下列帧复制/切片到对应目录，按区间建 clip。

### player

| clip | 目标目录 | 帧区间 | 循环 |
|---|---|---|---|
| idle | `sprite/frames/player/idle/` | frame_000 ~ frame_007 | 是 |
| walk | `sprite/frames/player/walk/` | frame_008 ~ frame_015 | 是 |
| parkour | `sprite/frames/player/parkour/` | frame_016 ~ frame_023 | 是 |
| melee_attack | `sprite/frames/player/melee_attack/` | frame_024 ~ frame_031 | 否 |
| skill | `sprite/frames/player/skill/` | frame_032 ~ frame_039 | 否 |
| die | `sprite/frames/player/die/` | frame_040 ~ frame_047 | 否 |

> 脚本调用 clip 名用 camelCase：`meleeAttack`；磁盘 action 目录用 snake_case：`melee_attack`；`AnimUtil` 负责映射。

### enemy_minion

| clip | 目标目录 | 帧区间 | 循环 |
|---|---|---|---|
| idle | `sprite/frames/enemy_minion/idle/` | frame_000 ~ frame_003 | 是 |
| walk | `sprite/frames/enemy_minion/walk/` | frame_004 ~ frame_011 | 是 |
| attack | `sprite/frames/enemy_minion/attack/` | frame_012 ~ frame_017 | 否 |
| die | `sprite/frames/enemy_minion/die/` | frame_018 ~ frame_025 | 否 |

### enemy_boss

| clip | 目标目录 | 帧区间 | 循环 |
|---|---|---|---|
| idle | `sprite/frames/enemy_boss/idle/` | frame_000 ~ frame_005 | 是 |
| walk | `sprite/frames/enemy_boss/walk/` | frame_006 ~ frame_013 | 是 |
| attack | `sprite/frames/enemy_boss/attack/` | frame_014 ~ frame_021 | 否 |
| die | `sprite/frames/enemy_boss/die/` | frame_022 ~ frame_031 | 否 |

### hero_01 / hero_02

| clip | 目标目录 | 帧区间 | 循环 |
|---|---|---|---|
| idle | `sprite/frames/hero_01/idle/` | frame_000 ~ frame_005 | 是 |
| walk | `sprite/frames/hero_01/walk/` | frame_006 ~ frame_013 | 是 |
| attack | `sprite/frames/hero_01/attack/` | frame_014 ~ frame_019 | 否 |
| die | `sprite/frames/hero_01/die/` | frame_020 ~ frame_027 | 否 |

> `hero_02` 同理，目录改为 `hero_02/`。

### soldier_ranged / soldier_melee

| clip | soldier_ranged | soldier_melee | 循环 |
|---|---|---|---|
| idle | frame_000~003 | frame_000~003 | 是 |
| remote_attack | frame_004~009 | — | 否 |
| melee_attack | — | frame_004~009 | 否 |
| die | frame_010~015 | frame_010~015 | 否 |

### log

| clip | 说明 |
|---|---|
| roll | 程序旋转驱动；clip 为空占位，duration=0.1s |

## 验收命令（P6 替换后）

```bash
ls assets/resources/sprite/frames/player/idle/
rg "playAnim|\.play\(" assets/scripts/character/Player.ts
```
