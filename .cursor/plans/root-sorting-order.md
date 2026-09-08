---
slug: root-sorting-order
版本: 1
状态: draft
创建: 2026-09-08
---

# Root Sorting Order

## 业务目标
将运行时 2D 渲染排序改为由 prefab 根节点世界 Y 决定：`SortingOrder2D` 挂在 prefab 根节点，按根节点 `worldPosition.y` 计算基础 order，并写入子树内可渲染 2D Sprite/Sorting2D 或 Cocos 3.8 等价排序字段。

本任务以用户新要求和 OpenSpec change 作为行为源，覆盖项目旧 P0 中“SortingOrder2D 取 Visual 世界 Y”的口径。若旧文档或规则继续误导后续任务，build-agent 可做最小文档同步，但不得扩大到无关渲染重构。

## OpenSpec 引用
- Change：`openspec/changes/root-sorting-order/`
- 勿在此复述 WHEN/THEN；行为以该目录 `specs/**` 为准。

## 风险等级
中。原因：同时触碰运行时排序脚本与多个 prefab 组件摆放，玩家可见遮挡关系会变化；需确认 Cocos 3.8 当前可写排序 API。

## 禁做项
- 不实现或修改 `Main.scene` 结构。
- 不把 `Sorting2D` 只挂到 prefab 根节点来替代子节点渲染排序；根节点本身不渲染时这种做法无效。
- 不在每个 Sprite 上挂 `SortingOrder2D`；每个需要排序的 prefab 根节点最多一个 `SortingOrder2D`，Sprite/Visual 子节点只保留可被写入 order 的 `Sorting2D` 或等价 renderer。
- 不删除、替换或重建现有 Sprite、Animation、Billboard、碰撞、脚本、资源引用。
- 不改 prefab 节点树，除必要的组件迁移、补挂、删除重复排序组件、局部属性绑定外。
- 不改战斗、移动、动画、寻路、阶段切换、建造、经济或 UI 流程。
- 不回退 unrelated dirty changes，包括但不限于 `.cursor/plans/shared-path-agent.md`、`.cursor/plans/reports/shared-path-agent-report.md`、`PathAgent.ts`、Hero/Soldier/GameConfig/EnemyBoss/EnemyMinion 等已有改动。
- 不手写整份 `.prefab` JSON，不用脚本整文件生成或重建 prefab；prefab 改动必须通过 Defense3 Cocos MCP/编辑器局部调整。
- 不并行执行 `assets-refresh` 与 `assets-reimport-asset`。

## 变更文件清单
- 【可写】`assets/scripts/core/SortingOrder2D.ts` — 改为从挂载节点根 `this.node.worldPosition.y` 计算；遍历/缓存子树可写 2D renderer order 目标。
- 【可写】`assets/resources/prefabs/character/pref_player.prefab` — MCP 局部调整：根节点挂 `SortingOrder2D`；`Visual` 或子孙 Sprite 节点保留/补挂可写排序组件。
- 【可写】`assets/resources/prefabs/character/enemy/pref_enemy_minion.prefab` — MCP 局部调整同上。
- 【可写】`assets/resources/prefabs/building/pref_tower_basic.prefab` — MCP 局部调整同上。
- 【可写，谨慎】`assets/resources/prefabs/character/pref_hero_01.prefab`、`assets/resources/prefabs/character/pref_hero_02.prefab`、`assets/resources/prefabs/character/pref_soldier_melee.prefab`、`assets/resources/prefabs/character/pref_soldier_ranged.prefab`、`assets/resources/prefabs/character/enemy/pref_enemy_boss.prefab`、`assets/resources/prefabs/building/pref_tower_advanced.prefab`、`assets/resources/prefabs/building/pref_barracks.prefab`、`assets/resources/prefabs/building/pref_wall.prefab`、`assets/resources/prefabs/building/pref_hero_shrine.prefab`、`assets/resources/prefabs/item/*.prefab`、`assets/resources/prefabs/trap/*.prefab`、`assets/resources/prefabs/projectile/*.prefab`、`assets/resources/prefabs/vfx/*.prefab` — 仅 survey 发现同主题排序层级错误且同批修正必要时纳入；优先覆盖用户点名三类。
- 【可写，谨慎】`docs/SCENE_PLACEMENT.md`、`defense3.md`、`.cursor/rules/defense3-workflow.mdc`、`AI_TASK_LIST.md` — 仅在仍明确写着 Visual-Y 规则且会误导后续任务时，做最小文字同步；避免无关大改。
- 【可新建】`.cursor/plans/reports/root-sorting-order-report.md` — build-agent 完成或硬阻塞时写执行报告。
- 【仅只读参考】`openspec/changes/root-sorting-order/` — 行为规格引用；build 时只因 replan 同步才改。
- 【仅只读参考】`.cursor/rules/defense3-workflow.mdc`、`.cursor/rules/cocos-mcp.mdc`、`.cursor/rules/multi-agent-orchestrator.mdc`、`.cursor/rules/openspec.mdc` — 工作流、MCP 和 OpenSpec 约束。
- 【仅只读参考】`.cursor/plans/_TEMPLATE.md`、`.cursor/plans/shared-path-agent.md`、`.cursor/plans/reports/shared-path-agent-report.md` — 模板和 unrelated dirty 保护参考。
- 【仅只读参考】`tsconfig.json`、Cocos 3.8 类型定义、现有 `Sorting2D`/`UIRenderer` 使用处 — 确认实际 API 与编译。

## To-dos
- [ ] `root-sorting-order.a`：读取 git 状态、现有报告、OpenSpec change、`SortingOrder2D.ts`、用户点名三个 prefab 的当前组件位置；记录 unrelated dirty changes，不回退。
- [ ] `root-sorting-order.b`：确认 Cocos 3.8 当前可写排序字段：优先 `Sorting2D.sortingOrder`，否则使用项目现有等价 `UIRenderer.priority` 或类型定义中可编译字段；在报告中记录最终字段。
- [ ] `root-sorting-order.c`：更新 `SortingOrder2D.ts`：组件挂载节点作为排序根；每次 `lateUpdate` 或带失效重解析的缓存遍历 descendants；按根 `this.node.worldPosition.y` 计算 `Math.round(-this.node.worldPosition.y * 100) + offset`；写入所有可排序 2D renderer；无目标时安全跳过。
- [ ] `root-sorting-order.d`：保留 `offset` 为 prefab 根级偏移；如子 renderer 不存在独立 offset 字段，不额外发明 per-child offset；可选支持 `includeInactive = false`，但不得改变默认可见对象行为。
- [ ] `root-sorting-order.e`：通过 Defense3 Cocos MCP 批量局部调整 `pref_player`、`pref_enemy_minion`、`pref_tower_basic`：根节点挂 `SortingOrder2D`；`Visual` 子节点或实际 Sprite 子孙挂 `Sprite + Sorting2D` 或 Cocos 3.8 等价排序目标；移除错误位置的重复 `SortingOrder2D`，不重建节点树。
- [ ] `root-sorting-order.f`：survey 同类 prefab；只有发现相同“根不渲染但排序组件挂错/缺失导致玩家可见遮挡错误”的同主题问题，才按同一 MCP 会话纳入谨慎可写 prefab，并在报告列出纳入理由。
- [ ] `root-sorting-order.g`：若旧 Visual-Y 文档口径仍会误导后续任务，最小同步 `docs/SCENE_PLACEMENT.md`、`defense3.md`、`.cursor/rules/defense3-workflow.mdc` 或 `AI_TASK_LIST.md` 中相关表述；不做 unrelated 文档整理。
- [ ] `root-sorting-order.h`：Prefab 改动完成后保存一次，执行任务级 MCP gate、P3/editor 检查；若 `post-scene-save.ps1` 报 patch，按规则 reimport、reopen 后再 gate。
- [ ] `root-sorting-order.i`：写 `.cursor/plans/reports/root-sorting-order-report.md`，包含 dirty 保护、三个点名 prefab before/after 组件位置、最终 renderer 字段、gate 输出和未纳入同类 prefab 原因。

## 实施步骤
1. S1：Survey。读取当前脚本、类型、prefab 组件分布与 git dirty 状态；确认 Cocos MCP 绑定到 Defense3 工程。
2. S2：脚本实现。将排序根固定为 `this.node`；计算使用根节点 `worldPosition.y`；对子树所有可写 2D renderer 应用同一基础 order 加根级 `offset`；缓存方案须能处理子节点/组件变化或在 `lateUpdate` 安全解析。
3. S3：Prefab 调整。用 MCP 打开并局部修改目标 prefab；必要时从 Visual 上迁移 `SortingOrder2D` 到根，Visual/descendant 保留 Sprite 与 Sorting2D/等价 renderer order 目标。
4. S4：文档同步。仅修正旧 Visual-Y 口径，声明新规则为 root-Y；不改阶段、坐标、命名、数值等无关内容。
5. S5：保存与门禁。Prefab 批量处理后任务末保存一次，执行 AC-GATE、AC-P3、AC-EDITOR-MCP；不得为每个 prefab 单独反复 gate。

## 校验点
- [AC-1] `npx tsc --noEmit -p tsconfig.json` 退出码 0。
- [AC-2] `rg "this\\.node\\.worldPosition\\.y|visualNode\\.worldPosition\\.y" assets/scripts/core/SortingOrder2D.ts` 显示公式使用 `this.node.worldPosition.y`，且不存在 `visualNode.worldPosition.y` 作为排序来源。
- [AC-3] `SortingOrder2D.ts` 中排序公式等价于 `Math.round(-this.node.worldPosition.y * 100) + offset`。
- [AC-4] `pref_player`、`pref_enemy_minion`、`pref_tower_basic` 根节点存在 `SortingOrder2D`；其 `Visual` 或实际 Sprite descendant 存在可被写入排序的 `Sorting2D` 或 Cocos 3.8 等价 2D renderer order 目标。
- [AC-5] 无 renderer/Sorting2D 的 descendant 被安全跳过，不产生运行时异常。
- [AC-6] 报告列出三个点名 prefab 的 before/after 组件位置和最终写入字段：`Sorting2D.sortingOrder` 或 `UIRenderer.priority`。

### MCP（改过 prefab/scene 时，任务末一次）
- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` exit 0。
- [AC-P3] 本任务改过的每个 prefab 经 MCP `assets-query-asset-info` 返回 `invalid: false`。
- [AC-EDITOR-MCP] MCP `scene-open` 本任务目标 prefab 后查询日志；无由目标 prefab 引发的红错或 missing script。

### 条件 / 不阻塞
- [AC-P3b] 若新增/迁移关键 `@property` 或排序组件引用，打开目标 prefab 抽查关键组件非 Missing。
- [AC-S2] 本任务不改 `Main.scene`；除非意外触发 scene `_id` patch，否则不跑。
- [AC-PLAY] 对照 OpenSpec scenarios 做视觉检查：不同 root Y 的单位/建筑遮挡稳定，Visual 子节点渲染可正确排序；不阻塞 done。

## 回滚策略
- 脚本失败：仅回退本任务对 `assets/scripts/core/SortingOrder2D.ts` 的改动，保留 unrelated dirty changes。
- Prefab 调整失败：用 Cocos MCP/编辑器将本任务触碰 prefab 恢复到本任务前组件位置；不得用手写整份 JSON 或从其他工程拷贝替代。
- 文档同步失败：仅撤销本任务新增/修改的 root-Y 文字，保留其他文档改动。
- 若 MCP 不可用或未绑定 Defense3，停止 build 并写报告；不得降级手写 prefab。

## 修订记录
- v1（2026-09-08）：初始。创建 root-Y 排序行为 OpenSpec 引用与执行计划；明确覆盖旧 Visual-Y 口径。

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
| 本任务新建 prefab 数 | 0 |
| 本任务改动 prefab 数 | |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/root-sorting-order/` |

### 必填证据
- Dirty 保护：列出 build 前 unrelated dirty changes，并确认未回退。
- `pref_player` before/after：`SortingOrder2D` 所在节点；Sprite/Sorting2D 或 renderer order 目标所在节点。
- `pref_enemy_minion` before/after：`SortingOrder2D` 所在节点；Sprite/Sorting2D 或 renderer order 目标所在节点。
- `pref_tower_basic` before/after：`SortingOrder2D` 所在节点；Sprite/Sorting2D 或 renderer order 目标所在节点。
- 最终写入字段：`Sorting2D.sortingOrder` 或 `UIRenderer.priority`，附类型/编译验证依据。
- `npx tsc --noEmit -p tsconfig.json` 输出摘要。
- `verify-mcp-gate.ps1` 输出。
- AC-P3 / AC-EDITOR-MCP 结果。
