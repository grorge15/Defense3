# Defense3 多 Agent 管线

已从 `桌面/多agent协助管线` 导入。与 `AI_TASK_LIST.md` §0 配合使用。

## 快速开始

1. **确认工作区根目录**为 `Defense3`（左侧资源管理器顶层应为本项目，而非上级文件夹）
2. **完全退出并重启 Cursor**（Windows：`Alt+F4` 关闭所有窗口，任务管理器确认无 Cursor 进程后再开）
3. 在 **Agent 聊天框**输入 `/`，应出现 `fix-bug`、`plan-task`、`new-feature` 等
4. 若仍不出现：在聊天框**手动输入** `/fix-bug 描述你的 bug`（有时可执行但菜单缓存未刷新）

## 命令列表与文件位置

| 输入 | 定义文件 |
|---|---|
| `/fix-bug` | `.cursor/commands/fix-bug.md` |
| `/plan-task` | `.cursor/commands/plan-task.md` |
| `/new-feature` | `.cursor/commands/new-feature.md` |
| `/build-plan` | `.cursor/commands/build-plan.md` — 执行前读计划「修订记录」，报告中写明本版相对上一版的改动 |
| `/verify-plan` | `.cursor/commands/verify-plan.md` |
| `/replan` | `.cursor/commands/replan.md` |
| `/summary` | `.cursor/commands/summary.md` |

## `/fix-bug` 用法

```
/fix-bug 滚木到达蓝线后没有固定，直接滚出场景
```

- 小 Bug → `@goal-agent` 先定位根因再最小修复
- 复杂/跨文件 → `@plan-agent` 出计划，第一步必须是根因定位

## 命令菜单仍不显示时（排错）

1. 确认文件存在：`Defense3/.cursor/commands/fix-bug.md`
2. 工作区必须是 **Defense3 项目根**，不是 `Desktop` 或多项目父目录
3. 使用 **Agent 模式** 的聊天输入框（不是普通编辑器的命令面板 `Ctrl+Shift+P`）
4. 输入 `/fix` 过滤，不要只扫一眼完整列表
5. 完全退出 Cursor 后重开（Reload Window 有时不够，需清 slash 菜单缓存）
6. 临时替代：直接发  
   `按 .cursor/commands/fix-bug.md 流程修复：<你的 bug 描述>`

## 示例

```
/plan-task 执行 AI_TASK_LIST.md 任务 P2-001 玩家预制体
```

审阅 `.cursor/plans/p2-001-player.md` 后：

```
/build-plan p2-001-player
/verify-plan p2-001-player
```

小任务（如 P1-001）可直接 `@goal-agent`，但仍须跑该任务的 AC 命令。
