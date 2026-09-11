# fix-log-one-sided-lock 执行报告

## 结果

计划已完成。滚木支持按 Saw 与 Player 在滚木本地 X 轴的相对位置进行单侧截短；固定成功后定位到 `GameRoot/World/BuildPlots/LogFixPoint`，固定视觉 X 为 2.0 倍，并使用统一固定碰撞体配置。

## 改动

- `assets/scripts/item/Log.ts`
  - 新增单侧截短入口和左右保留边界。
  - 同步滚动阶段 Visual 的 X 缩放/位置与 BoxCollider2D 的宽度/偏移。
  - 固定成功后定位 `LogFixPoint`。
  - 固定态使用 Visual X 2.0 倍、`GameConfig` 固定碰撞体参数、Static/non-sensor。
- `assets/scripts/trap/SawTrap.ts`
  - 在轮询和接触命中路径中比较 Saw/Player 的滚木本地 X，选择截短侧。
- `bugs.md`
  - 更新滚木固定碰撞/视觉条目 v4。

## 验证

| AC | 状态 | 证据 |
|---|---|---|
| AC-1 | 通过 | `npx tsc --noEmit --pretty false` |
| AC-2 | 通过 | 源码检查 `cutFromSide`、左右边界、Visual/Collider 同步 |
| AC-3 | 通过 | 最小长度与正宽度保护存在 |
| AC-4 | 通过 | `LogFixPoint` 定位、固定 Visual X=2.0，未写 Player 坐标 |
| AC-5 | 通过 | 固定 collider 复用 `GameConfig`，设置 Static/non-sensor 并 `apply()` |
| AC-6 | 通过 | `git diff --check`；本任务未修改 Main.scene/prefab/meta |
| AC-7 | 通过 | OpenSpec change 含 proposal 与 spec |
| AC-PLAY | 未执行 | 未启动 Cocos 实机手测 |

## MCP 指标

| 指标 | 次数/值 |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 0（纯脚本任务） |
| post-scene-save Patched | 0 |
| assets-reimport-asset | 0 |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | no |
| OpenSpec change | `openspec/changes/fix-log-one-sided-lock/` |

