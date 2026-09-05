# Defense3 多 Agent 管线

已从 `桌面/多agent协助管线` 导入。与 `AI_TASK_LIST.md` §0 配合使用。

## 快速开始

1. **确认工作区根目录**为 `Defense3`（左侧资源管理器顶层应为本项目，而非上级文件夹）
2. **完全退出并重启 Cursor**（Windows：`Alt+F4` 关闭所有窗口，任务管理器确认无 Cursor 进程后再开）
3. 在 **Agent 聊天框**输入 `/`，应出现 `fix-bug`、`plan-task`、`new-feature`、`opsx-*` 等
4. 若仍不出现：在聊天框**手动输入** `/fix-bug 描述你的 bug`（有时可执行但菜单缓存未刷新）

## 命令列表与文件位置

| 输入 | 定义文件 |
|---|---|
| `/fix-bug` | `.cursor/commands/fix-bug.md` |
| `/plan-task` | `.cursor/commands/plan-task.md` |
| `/new-feature` | `.cursor/commands/new-feature.md` |
| `/build-plan` | `.cursor/commands/build-plan.md` — 单 agent 续跑；报告含 MCP 指标 |
| `/verify-plan` | `.cursor/commands/verify-plan.md` |
| `/replan` | `.cursor/commands/replan.md` — 只改失败步；同步 OpenSpec delta |
| `/summary` | `.cursor/commands/summary.md` |
| `/opsx-propose` / `explore` / `apply` / `archive` 等 | OpenSpec CLI 注入；规则见 `.cursor/rules/openspec.mdc` |

**Superpowers**：工具箱（`superpowers-gate.mdc`）——插件缺失不阻塞 Plan；澄清非强制。

**预制体 / 场景 MCP**：`cocos-mcp.mdc` + `defense3-workflow.mdc`。创建 prefab 强制 `create-prefab-from-node`。任务末：`post-scene-save.ps1`（改 Main 时）→ AC-GATE + P3 + EDITOR-MCP。同 slug 续跑、禁止碎片重委派（`multi-agent-orchestrator.mdc`）。

## OpenSpec

行为规格唯一真相在仓库根目录 `openspec/`；装配与机器 AC 在 `.cursor/plans/`。**禁止**同一 WHEN/THEN 维护两份。

| 项 | 说明 |
|---|---|
| Schema | 默认 **`defense3-lite`**：只生成 `proposal.md` + `specs/**`（无 design/tasks） |
| 配置 | `openspec/config.yaml`（Defense3 上下文 + 规则） |
| 项目规则 | `.cursor/rules/openspec.mdc` |
| 有玩法行为时 | `/opsx-propose` 或 plan-agent 写 change → plan 只写 **OpenSpec 引用** |
| 纯 MCP 装配 | **不建** OpenSpec change |
| 实现 | 优先 **`/build-plan <slug>`**；有 MCP 批次时不要用 `/opsx-apply` 重做 |
| 归档 | `/opsx-archive` 合并 delta → `openspec/specs/` |
| 修 bug | 先读 `openspec/specs/` + 未归档 delta + `bugs.md` |

**何时写 / 不写**

| 写 | 不写 |
|---|---|
| 阶段切换、战斗、建造链、金币/UI 反馈、胜负等可感知行为 | 挂点、坐标、批量实例化 prefab、只绑 `@property`、只改文档 |

## 使用经验（效率）

实践结论：**仪式留给决策不清的活；装配类用表 + 一次执行。**

| 类型 | 推荐 | 避免 |
|---|---|---|
| UI / 批量 prefab（结构雷同、范围已清） | **薄 plan（或合并多任务）→ 直接 `/build-plan`**；可跳过 OpenSpec | 一 prefab 一 slug；强制 brainstorming |
| 场景挂点 / 按表摆实例 | **不必 plan-agent**：`SCENE_PLACEMENT.md` + `@goal-agent` 或一句话目标直接装配；任务末一次 gate | 把放置表再抄成一整份 plan |
| 有玩法语义、跨系统行为 | OpenSpec lite + 短 plan → `/build-plan` | 口头每次复述黑盒效果 |

**反面教材**：`.cursor/plans/_archive_p2p3/`（旧 p2-*/p3-*）对每个预制体先 plan 再 build，固定开销重复极高，已停用。新工作只用 `phase-*.md`；场景搭建（旧 p3）尤其不值得为「摆节点」写长计划。

**正面对照**：`phase-5-5-1-coin-ui`、`phase-5-5-3-4-ui-prefabs`、`phase-5-5-5-to-5-8-ui` 等——短 plan、合并批次、直接 build，效率明显更高。

## `/fix-bug` 用法

```
/fix-bug 滚木到达蓝线后没有固定，直接滚出场景
```

- 小 Bug → `@goal-agent`（先证据 / systematic-debugging）
- 复杂/跨文件 → `@plan-agent`，第一步必须是根因定位；有行为回归则改 OpenSpec delta

## 命令菜单仍不显示时（排错）

1. 确认文件存在：`Defense3/.cursor/commands/fix-bug.md`
2. 工作区必须是 **Defense3 项目根**
3. 使用 **Agent 模式** 聊天输入框
4. 输入 `/fix` 过滤
5. 完全退出 Cursor 后重开
6. 临时：`按 .cursor/commands/fix-bug.md 流程修复：<描述>`

## 示例

有行为的新需求：

```
/opsx-propose add-coin-feedback
# 再薄 plan 或 /plan-task …，然后：
/build-plan <slug>
```

范围已清的 UI / prefab 批次：

```
# 已有短 plan 时直接：
/build-plan phase-5-5-5-to-5-8-ui
```

纯脚本小改：

```
@goal-agent …
```
