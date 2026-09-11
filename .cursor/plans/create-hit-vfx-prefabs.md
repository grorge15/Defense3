---
slug: create-hit-vfx-prefabs
版本: 1
状态: done（交付完成；verify-mcp-gate 受既有 Main.scene Node.* 基线问题影响）
创建: 2026-09-11
---

# 创建黄色/蓝色受击特效 prefab

## 业务目标
使用 `assets/resources/sprite/特效/受击/` 的两组三帧 PNG，在 Defense3 的 Cocos 编辑器/MCP 中创建两个可复用的世界特效 prefab。黄色与蓝色特效各自绑定独立的一次播放 Animation clip，实例化后由 `playOnLoad` 自动播放；本任务只交付资源与 prefab，不接入受击脚本或 `Main.scene`。

本任务为纯 prefab/动画资源装配，无玩家行为规格，不创建 OpenSpec change。

## 风险等级
中 — 新建两个 prefab、两个 Animation clip，并需要通过 Cocos 资源序列化；错误的帧引用、循环配置、嵌套 Canvas/Camera 或 MCP 工程绑定错误会使资源不可用。当前工作区已有未提交改动，执行时不得覆盖或回退它们。

## 禁做项
- 禁止手写或脚本整文件生成/重建 `.prefab`、`.anim`、`.scene` 或 `.meta`；禁止使用 `_fix_prefabs.mjs`、`_gen_prefabs.mjs` 等抢救脚本。
- 必须走 `scene-open` → `scene-create-node-by-type` 搭树 → 组件/尺寸设置 → `create-prefab-from-node`；禁止用 `assets-create-asset-by-type` 直接创建 Sprite/Label/Button prefab。
- 禁止修改 `assets/scenes/Main.scene` 的结构、节点、组件、引用、坐标或序列化内容；不得为了取临时节点而在 Main.scene 留下任何节点。
- 禁止保留 `Canvas`、`Camera` 或其包装层作为任一 `pref_*` 根或子树；禁止把 Visual 包在 Canvas 下。
- 禁止复制/改名/搬迁 `assets/resources/sprite/特效/受击/` 中的 PNG，禁止修改 PNG `.meta` 的 uuid；不得复制 Defense2 或其他工程资源。
- 禁止新建脚本、修改既有脚本、接入 `Player`/`HealthSystem`/`Wall`/`Barrier`/`BuildPlot`，禁止修改 `GameConfig`、场景实例或运行时生成逻辑。
- 禁止创建额外颜色、额外帧、额外 prefab 或无关动画 clip；不得修改既有 `blue_upgradeEffect`、`yellow_upgradeEffect` 或 `upgrade_*` 资源。
- `assets-refresh` 与 `assets-reimport-asset` 不得并行；同一交付轮次只选择需要的刷新路径。若进入 `_id` 补丁恢复链，必须先完成 `post-scene-save.ps1`，再串行 reimport、重新打开资源并复跑门禁。
- MCP 不可用、绑定工程不是 Defense3、或 MCP 连续失败两次时，必须停止并报告阻塞；禁止降级为手写 JSON。

## 变更文件清单

### 可新建（仅经 Cocos MCP/CLI/编辑器资源序列化）
- `assets/resources/prefabs/VFX/pref_vfx_hit_yellow.prefab`  — 黄色受击特效；prefab 根名必须为 `pref_vfx_hit_yellow`。
- `assets/resources/prefabs/VFX/pref_vfx_hit_blue.prefab` — 蓝色受击特效；prefab 根名必须为 `pref_vfx_hit_blue`。
- `assets/resources/animations/vfx/hit_yellow.anim` — 绑定 `frame_005` → `frame_006` → `frame_007` 的一次播放 clip。
- `assets/resources/animations/vfx/hit_blue.anim` — 绑定 `frame_008` → `frame_009` → `frame_010` 的一次播放 clip。
- 上述四个资源由 Cocos 自动生成/维护的 `.meta` 文件；不得手写 uuid。

### 可写（仅临时 MCP 会话；不得留下净结构变更）
- `assets/scene.scene` — 仅在确认该非 Main 场景可作为 staging 后，用于创建两个临时节点树；`create-prefab-from-node` 完成后删除临时节点，保存前确认无净结构变化。若 MCP 不需要保存 staging 场景则不保存。

### 仅只读参考
- `assets/resources/sprite/特效/受击/frame_005.png`、`frame_006.png`、`frame_007.png` — 黄色帧源及对应 `.meta`。
- `assets/resources/sprite/特效/受击/frame_008.png`、`frame_009.png`、`frame_010.png` — 蓝色帧源及对应 `.meta`。
- `assets/resources/animations/vfx/upgrade_blue.anim`、`upgrade_yellow.anim` — 现有 VFX clip 的 Cocos 序列帧结构参考，不修改。
- `assets/resources/prefabs/VFX/blue_upgradeEffect.prefab`、`yellow_upgradeEffect.prefab` — 现有 VFX 资源布局参考，不修改。
- `assets/scenes/Main.scene` — 只读基线；执行前后用哈希确认未改变。
- `.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/cocos-mcp.mdc`、`AI_TASK_LIST.md`、`defense3.md` — 项目与 MCP 约束参考。

## To-dos
- [ ] `hit-vfx.a`：记录当前 git 状态、`assets/scenes/Main.scene` 哈希及目标资源是否已存在；查询 `assets-query-path`，确认 MCP 绑定的是 Defense3 的 `assets`，否则停止。
- [ ] `hit-vfx.b`：在同一个 MCP `scene-open` 会话中，以 `scene-create-node-by-type` 搭建两个临时树；每棵树为 `pref_vfx_hit_yellow`/`pref_vfx_hit_blue` 根节点直接挂 `Visual` 子节点，Visual 直接承载 `UITransform`、`Sprite`、`Animation`、项目所需的 `Billboard` 与 `SortingOrder2D`，不得出现 Canvas/Camera 包装层。Sprite 使用实际帧尺寸、RAW 模式，SortingOrder2D 的 Sprite 锚点遵守项目 `anchorY=0` 约定。
- [ ] `hit-vfx.c`：确认六个 PNG 已被 Cocos 导入为 `cc.SpriteFrame`，并按颜色分组设置首帧；不得编造 uuid。若新资源未被资产库发现，按串行规则选择一次 `assets-refresh`，不得与 `assets-reimport-asset` 并行。
- [ ] `hit-vfx.d`：通过 Cocos MCP/CLI 创建 `hit_yellow.anim` 与 `hit_blue.anim`，不要手写 `.anim`。两者均为 `sample=10`、`speed=1`、`wrapMode=Normal`、非循环；黄色关键帧按 `frame_005/006/007` 顺序，蓝色按 `frame_008/009/010` 顺序，帧间隔使用项目既有 VFX 序列帧节奏。
- [ ] `hit-vfx.e`：将 `hit_yellow` 绑定到黄色临时树的 Visual `Animation`，将 `hit_blue` 绑定到蓝色临时树的 Visual `Animation`；每个 Animation 的 `_clips` 只包含对应 clip，`defaultClip` 指向对应 clip，`playOnLoad=true`，clip 为一次播放且不循环。Animation 曲线绑定 Visual 本节点的 `cc.Sprite.spriteFrame`，不得使用错误的额外层级路径。
- [ ] `hit-vfx.f`：分别执行 `create-prefab-from-node`，落盘为 `assets/resources/prefabs/VFX/pref_vfx_hit_yellow.prefab` 与 `pref_vfx_hit_blue.prefab`；创建成功后删除 staging 场景中的两个临时节点，不保存任何 Main.scene 结构变化。
- [ ] `hit-vfx.g`：任务末只做一次必要的资源/场景保存与关闭；若场景保存涉及 `_id`，按 `scene-close` → `powershell -File .cursor/scripts/post-scene-save.ps1` → 仅在 `Patched=1` 时串行 `assets-reimport-asset` → `scene-open` 恢复链执行，禁止手工逐 token 修复。若无 scene 净变更，不对 Main.scene 运行补丁链。
- [ ] `hit-vfx.h`：完成任务级机器验收：`AC-GATE`、两个 prefab 的 `AC-P3`、两个 prefab 的 `AC-EDITOR-MCP`，并核对 Main.scene 哈希与 git 状态；任一机器门禁失败则保持阻塞，不写 done。

## 实施步骤
1. **S0 前置门与基线**：查询 Defense3 工程绑定，记录目标路径、Main.scene 哈希和现有脏改动；目标资源若已存在先 query，幂等处理，禁止直接重复创建。
2. **S1 staging 搭树**：打开非 Main 的 `assets/scene.scene`（或 MCP 查询后确认的等价 staging 场景），同一会话内批量建立两个独立临时根节点及 `Visual` 子树，设置 Sprite 尺寸/帧、Animation、Billboard、SortingOrder2D。若 CLI 自动插入 Canvas/Camera，必须在本次会话中移除包装并提升直接子节点；无法移除则终止。
3. **S2 创建并绑定 clip**：由 Cocos MCP/CLI 创建两个 Animation clip，按本计划的帧序和 Normal/非循环配置绑定到各自 Visual 的本节点 Sprite；检查默认 clip 与 `playOnLoad`。
4. **S3 生成 prefab**：在同一 open 会话中调用两次 `create-prefab-from-node`，目标文件名严格使用 `pref_vfx_hit_yellow` 和 `pref_vfx_hit_blue`；随后删除两个 staging 临时节点，不改 Main.scene。
5. **S4 保存与资源状态**：只在资源已完成后落盘；刷新或重导入严格串行。场景如产生 `_id` patch，执行规定的 close/post-save/reimport/reopen 恢复链，否则跳过 Main.scene 写链。
6. **S5 任务级验收**：运行 `powershell -File .cursor/scripts/verify-mcp-gate.ps1`；对两个新 prefab 分别 `assets-query-asset-info`；分别打开目标 prefab 并用 `system-query-logs` 检查无红错/missing script；确认 Main.scene 哈希不变。

## 校验点
- [AC-NAME] 两个文件均存在且命名严格为 `pref_vfx_hit_yellow.prefab`、`pref_vfx_hit_blue.prefab`，路径均为 `assets/resources/prefabs/VFX/`；不存在 camelCase 或大写变体。
- [AC-FRAMES] 黄色 clip 只使用 `frame_005.png`、`frame_006.png`、`frame_007.png`；蓝色 clip 只使用 `frame_008.png`、`frame_009.png`、`frame_010.png`，每组顺序正确且资源类型为 `cc.SpriteFrame`。
- [AC-CLIP] `hit_yellow.anim`/`hit_blue.anim` 均存在、绑定到对应 prefab 的 Visual `Animation`，`defaultClip` 与 `_clips` 一致，`playOnLoad=true`，`wrapMode=Normal` 且不循环；动画轨道只驱动 Visual 本节点 Sprite 的 `spriteFrame`。
- [AC-STRUCT] 每个 prefab 为 `Root → Visual`；Visual 直接包含可视 Sprite 与 Animation（及约定的 Billboard/SortingOrder2D），无嵌套 Canvas、Camera、包装层或 1×1 占位尺寸。
- [AC-NO-MAIN] `assets/scenes/Main.scene` 执行前后哈希一致，且没有新增/删除节点、组件、引用、坐标或结构改动。

### MCP（任务末一次）
- [AC-GATE] 执行 `powershell -File .cursor/scripts/verify-mcp-gate.ps1`，退出码必须为 `0`；报告须粘贴完整输出。
- [AC-P3] 对 `pref_vfx_hit_yellow.prefab`、`pref_vfx_hit_blue.prefab` 分别执行 MCP `assets-query-asset-info`，结果必须为 `invalid: false`。
- [AC-EDITOR-MCP] 分别 `scene-open` 两个目标 prefab，再执行 `system-query-logs`（或等价日志查询）；不得有由本任务引入的 error、missing script 或资源加载红错。

### 条件 / 不阻塞
- [AC-P3b] 因两个 prefab 均为新建，使用 `scene-query-component` 抽查/核对两个 Visual 的 Sprite 与 Animation 引用均非 null、非 Missing；若查询接口可逐组件核对，两个 prefab 都必须核对。
- [AC-S2] 仅当 staging 场景实际保存并经过 `_id` patch/reimport 时执行；确认相关 nodeId 不匹配 `Node.<数字>`。
- [AC-PLAY] 可选手测：实例化黄色/蓝色 prefab，确认生成即播放三帧并自然停止；不接入受击调用，不阻塞机器 AC done。

## 回滚策略
- 在执行前保留 git 状态、Main.scene 哈希和目标资源存在性记录；不回退用户已有的脏改动。
- 若 MCP 搭树或绑定失败，删除本次会话误建的临时节点/新资源只能通过 Cocos MCP/编辑器操作；禁止手写文件抢救。保留帧 PNG 与其既有 `.meta`。
- 若任一 prefab 或 clip 未通过 AC-P3/AC-EDITOR-MCP，删除本次新建的对应资源后，从第一个失败 todo 续跑；已通过的另一颜色产物无需重建。
- 若 `Main.scene` 哈希变化或出现非本任务结构差异，立即停止，报告差异并走 replan；禁止用 git reset/checkout 覆盖用户改动。

## 修订记录
- v1（2026-09-11）：初始计划；双受击 VFX prefab、双一次播放 clip、MCP 创建链、Main.scene 零结构变更与任务级机器门禁。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| create-prefab-from-node | `2` 目标调用（实际值：） |
| verify-mcp-gate | |
| post-scene-save Patched | `0/1` |
| assets-refresh | `0/1` |
| assets-reimport-asset | `0/1` |
| 本任务新建 prefab 数 | `2` |
| 本任务新建 Animation clip 数 | `2` |
| Main.scene 哈希是否保持不变 | yes/no |
| 是否续跑 | yes/no |
| OpenSpec change | none（纯 MCP/prefab 装配） |
