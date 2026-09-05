# phase-6-6-1-import-frames 执行报告

- **计划版本**：1
- **修订记录摘要**：路径策略 A；有帧填 clip、缺帧留空；不做 6.2~6.7
- **计划状态**：`done`（机器 AC 全过；AC-PLAY / 编辑器预览待用户）
- **是否续跑**：yes（6.1.a 文档已就绪；从 6.1.b/c 填 clip 续跑，未全场景 Survey 重开）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 6.1.a ANIM_MANIFEST 映射表 | **完成**（续跑前已有） |
| 6.1.b SpriteFrame 导入类型 | **完成**（抽查 `sprite-frame`） |
| 6.1.c player×4 | **完成** |
| 6.1.d enemy_minion×4 | **完成** |
| 6.1.e enemy_boss×4 | **完成** |
| 6.1.f hero_01/02×4 | **完成** |
| 6.1.g soldier/log 空占位 | **完成** |
| 6.1.h prefab 补绑 | **N/A**（clip 资源路径未变，仅曲线内容） |
| 6.1.i 机器 AC | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `docs/ANIM_MANIFEST.md` | 路径策略 A + 映射表（已有） |
| `assets/resources/animations/{player,enemy_minion,enemy_boss,hero_01,hero_02}/*.anim` | 20 个有帧 clip 写入 ObjectTrack→Visual/Sprite.spriteFrame |
| `.cursor/scripts/fill-anim-clips.mjs` | 从中文帧目录 `.meta` 读 `@f9941` 填 clip |

**未改**：`parkour`/`skill`、`soldier_*`、`log/roll`、Main.scene、脚本 `playAnim` 字符串、`.meta` uuid。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-DOC | **通过** | ANIM_MANIFEST 含映射表 + 「以磁盘为准」+ 缺帧表 |
| AC-CLIP-FILLED | **通过** | 20 clip 均有 `_tracks` + SpriteFrame uuid；帧数见 fill 报告 |
| AC-CLIP-EMPTY | **通过** | parkour/skill/log/soldier 仍 `_keys: []` |
| AC-SCRIPT | **通过** | playAnim 调用仍为 idle/walk/meleeAttack/die/attack/skill/roll/remoteAttack |
| AC-LOOP | **通过** | idle/walk wrapMode=2；attack/die/melee_attack wrapMode=1 |
| AC-GATE | **通过** | verify-mcp-gate exit 0（未改 prefab/scene） |
| AC-P3 | **通过** | 抽查 idle/die/attack anim `invalid:false` |
| AC-EDITOR-MCP | **待用户** | 编辑器打开 clip/prefab 预览播帧 |
| AC-PLAY | **待用户** | 不阻塞 done |

## MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 1 |
| post-scene-save Patched | 0 |
| assets-reimport-asset | 21（20 clip + 1 目录探测） |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes |
| OpenSpec change | none |

## 失败项

无机器失败。

## 备注

- 曲线绑定路径：`Visual` → `cc.Sprite` → `spriteFrame`（对齐角色 prefab 子节点名）。
- log/roll 按计划跳过序列帧。

### 热修（2026-09-04）

用户反馈动画编辑器 `Visual (missing)` / `SpriteFrame missing`：根因是 **Animation 挂在 Visual 本节点**，曲线却 `HierarchyPath("Visual")` 再找子节点。已改为只绑本节点 `cc.Sprite.spriteFrame`，并 reimport 20 clip。
