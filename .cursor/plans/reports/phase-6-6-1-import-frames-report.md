# phase-6-6-1-import-frames 执行报告

- **计划版本**：2
- **修订记录摘要**：v1 路径策略 A + 20 角色 clip；v2 补齐道具 Y 浮动、电锯/箭矢序列帧、蓝黄升级 VFX（≤2 prefab）
- **计划状态**：`done`（机器 AC 全过；AC-PLAY 待用户）
- **是否续跑**：yes（从 6.1.j；跳过已勾选 6.1.a～i；禁止全量 Survey / 禁止回退重填 v1 角色 clip）
- **OpenSpec change**：none
- **风险等级**：中

## v1 摘要（保留）

| Todo | 状态 |
|---|---|
| 6.1.a～i | **完成**（见 v1 报告；20 有帧 clip；缺帧留空；热修本节点 Sprite） |

## To-dos 完成矩阵（v2）

| Todo | 状态 |
|---|---|
| 6.1.j ANIM_MANIFEST 本批映射 | **完成** |
| 6.1.k TweenUtil.floatLocalY + Bow/LogExtend stop | **完成** |
| 6.1.l saw/spin + pref_trap_saw + spinSpeed=0 | **完成** |
| 6.1.m arrow_trail + pref_projectile_arrow Loop | **完成** |
| 6.1.n upgrade_blue clip + pref_vfx_upgrade_blue + BuildSystem 蓝分支 | **完成** |
| 6.1.o upgrade_yellow clip + pref_vfx_upgrade_yellow + 黄分支 | **完成** |
| 6.1.p 任务末机器 AC | **完成** |

## 修改文件列表（v2）

| 文件 | 摘要 |
|---|---|
| `docs/ANIM_MANIFEST.md` | 追加 saw/arrow/upgrade 映射；注明 bow/log_extend 程序 Y 浮动 |
| `assets/scripts/core/TweenUtil.ts` | `floatLocalY` |
| `assets/scripts/item/BowItem.ts` / `LogExtendItem.ts` | Visual 浮动；拾取/销毁 `stopTweensOn` |
| `assets/scripts/trap/SawTrap.ts` | 播 `spin`；默认 `spinSpeed=0` |
| `assets/scripts/projectile/Arrow.ts` | 飞行播 `arrow_trail`；销毁 stop |
| `assets/scripts/building/BuildSystem.ts` | `_playBuildUpgradeVfx` 蓝/黄；`resources.load` 兜底 |
| `assets/resources/animations/saw/spin.anim` | 4 帧 Loop（MCP 建空 + fill-v2） |
| `assets/resources/animations/vfx/arrow_trail.anim` | 4 帧 Loop |
| `assets/resources/animations/vfx/upgrade_blue.anim` / `upgrade_yellow.anim` | 各 9 帧 Normal |
| `assets/resources/prefabs/trap/pref_trap_saw.prefab` | Visual+Animation 挂 spin；spinSpeed=0 |
| `assets/resources/prefabs/projectile/pref_projectile_arrow.prefab` | Visual+Animation 挂 arrow_trail |
| `assets/resources/prefabs/VFX/pref_vfx_upgrade_blue.prefab` | MCP `create-prefab-from-node`；Root→Visual；无 Canvas/Camera |
| `assets/resources/prefabs/VFX/pref_vfx_upgrade_yellow.prefab` | 同上 |
| `.cursor/scripts/fill-anim-clips-v2.mjs` | 从特效/圆锯目录 `.meta@f9941` 填 clip |
| `assets/scenes/Main.scene` | 仅临时搭树→出 prefab→删实例；`post-scene-save` 清 `Node.*` |

**未改（强制）**：v1 角色 20 clip 文件名/曲线回填；角色 `playAnim` 字符串；`GameConfig` 玩法数值；6.2～6.7；无关 UI；`动画-木杆`→roll 绑定。

**附注**：会话中 `assets-refresh` 曾误触 `parkour.anim` 内容变化；已 `git checkout` 恢复为空占位并 reimport，保持 AC-CLIP-EMPTY。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-MANIFEST-V2 | **通过** | ANIM_MANIFEST 含圆锯/箭矢/蓝黄 + 程序浮动说明 |
| AC-FLOAT | **通过** | `floatLocalY` + Bow/LogExtend 拾取/销毁 `stopTweensOn` |
| AC-SAW | **通过** | spin 4 uuid；挂 saw；wrap Loop；prefab `spinSpeed: 0` |
| AC-ARROW-FX | **通过** | arrow_trail 4 uuid；挂 arrow；`Arrow.init` Loop 播 |
| AC-VFX-BLUE | **通过** | clip+prefab `invalid:false`；BuildSystem 蓝类型分支 |
| AC-VFX-YELLOW | **通过** | 同上；`towerAdvanced`/`heroShrine` |
| AC-NO-REGRESS | **通过** | playAnim 名未变；parkour 已恢复空；本任务未绑木杆→roll |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` exit 0 |
| AC-P3 | **通过** | saw/arrow/2×VFX + 4 clip `invalid:false` |
| AC-EDITOR-MCP | **通过** | 打开目标 prefab 后 `system-query-logs` error=[] |
| AC-S2 | **通过**（条件） | patch 后抽查 `GameRoot` nodeId=`ZRu_hTcRtE1zhxlSefMwyA`（非 `Node.*`） |
| AC-PLAY | **待用户** | 不阻塞 done |

## MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 3（Main 搭 VFX；reimport 后 GATE；S2） |
| scene-save | 2（删临时实例后 1；Node.* 抢救链 1） |
| verify-mcp-gate | 3（失败 1 → patch 后通过 2） |
| post-scene-save Patched | 1（末次 Patched=1 后 reimport；GATE 前磁盘 Node.*=0） |
| assets-reimport-asset | ~8（4 clip + Main×2 + parkour 恢复） |
| assets-refresh | 1（仅 animations 目录导入新建 clip 前） |
| create-prefab-from-node | 2（blue/yellow） |
| 本任务新建 prefab 数 | 2 |
| 是否续跑 | yes |
| OpenSpec change | none |

## 失败项

无机器失败（末态）。中间 AC-GATE 曾因 `scene-save` 写回 `Node.*` 失败，已按 `post-scene-save` → reimport 修复；**勿在 patch 后立刻 save 打开的脏场景**。

## 备注

- 曲线绑定：新 clip 均绑本节点 `cc.Sprite.spriteFrame`（无 `HierarchyPath("Visual")`）。
- VFX：`Billboard`/`SortingOrder2D` 的 `visualNode` 可空（组件挂在 Visual，运行时回退 `this.node`）。
- BuildSystem 蓝：`wall`/`towerBasic`/`barracks`/`expandArea`；黄：`towerAdvanced`/`heroShrine`；播完销毁。
