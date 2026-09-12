---
slug: fix-minion-log-route-oscillation
版本: 3
状态: done
创建: 2026-09-12
---

# 修复小怪滚木路线振荡

## 业务目标
修复小怪在追玩家和接近滚木之间反复切换、无法攻击的问题。用户已明确授权“请修改代码”；本计划交接后由一个 build-agent 立即执行，无需再次确认。关联 AI_TASK_LIST.md §4.13 的回归修复；跨模块行为及回归验证采用 Plan-Build。

## OpenSpec 引用
- Change：`openspec/changes/fix-minion-log-route-oscillation/`

## 风险等级与证据
中：共享导航同时服务 Boss，须保持调度和生命周期契约。
用户已诊断 `C:/Users/Admin/Downloads/enemy-nav-debug.json`：900 帧/15 秒，458 次 target-move/obstacle-move 切换、459 次 resetUnit、净移动 0.62/累计路程 1180、零攻击；障碍版本始终 5，pending jobs/field builds/cancels 均为 0，目标始终 Player。敌人在北侧约 (-91,1765)，滚木矩形 [-119.5,115.5]×[1632.519,1651.519]，却复用南侧站位 (-122.38,1593.829)。代码存在逐帧重新选障碍、分支切换 reset、固定顺序首个可达表面及按连通区共享站位的问题。
已有 EnemyNavigation.ts、EnemyMinion.ts、bugs.md 未提交修改，全部作为工作基线保留。父会话已运行两套基线：导航 2 项及拆障多项 Boss 测试因同一 Vec2.length mock 缺失失败。

## 禁做项
- 不改 scene、prefab、meta、数值、碰撞规则、目标优先级、攻击时序或 Boss 生产脚本；不删除诊断或之前修改。
- 不逐帧全场/全表面扫描或同步全图 BFS；不为每个候选创建完整流场；不另建寻路引擎或放宽共享预算。
- 不将 pending、接触重叠、临时 waypoint 变化当作已确认不可达；不永久锁定无效拆障目标。
- 不跳过/删掉现有失败测试，不以修改断言代替修复 mock；不覆盖旧报告或其它任务证据。

## 变更文件清单
- 【可写】`assets/scripts/core/EnemyNavigation.ts`：主要实现，承诺状态、表面选择和缓存隔离。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts`：仅必要的目标/拆障分支 reset 与生命周期接入。
- 【条件可写】`assets/scripts/core/FlowField.ts`：仅能最小暴露已有廉价、有预算的距离查询时考虑修改；无此 API 则保留只读，采用最近可达启发式，不要求新路径代价算法。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs`：仅最小补全 Vec2.length mock，保持真实欧氏长度语义。
- 【可写】`.cursor/scripts/test-enemy-break-blocking-log.cjs`：仅修复 Boss AC-POOL 的旧死亡定时 mock；捕获并调用实际 Animation FINISHED 回调，保留旧 hit/recovery/death 生命周期断言，不改 Boss 生产脚本。
- 【可新建】`.cursor/scripts/test-minion-log-route-oscillation.cjs`：复用已有 harness，加载实际生产脚本，集中实现本次回归。
- 【可写】`bugs.md`：验证通过后检索 `enemy-break-blocking-log` 及同主题现有条目，在匹配条目追加下一 v 版本，包含现象/原因/解决/验证；保留脏修改，不重复建条目。
- 【可写】本计划及 `openspec/changes/fix-minion-log-route-oscillation/` 下 `.openspec.yaml`、`proposal.md`、`specs/minion-log-route-commitment/spec.md`：进度、验收证据或必要 delta 同步。
- 【可新建】`.cursor/plans/reports/fix-minion-log-route-oscillation-report.md`、`.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/**`：仅任务基线副本、日志、机器结果；不得放生产代码。
- 【只读】输入 debug JSON；`AI_TASK_LIST.md`、`defense3.md`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,cocos-mcp,openspec}.mdc`；`openspec/specs/` 及既有未归档导航/拆障 changes。
- 【只读】`assets/scripts/core/{GameConfig,NavigationObstacle}.ts`、`assets/scripts/enemy/EnemyBoss.ts`、`assets/scripts/item/Log.ts`、`.cursor/scripts/bench-enemy-navigation.cjs`、既有导航计划/报告；其它文件默认只读。

## To-dos
- [x] S1：置 active；读取当前差异和已有报告，保存相关脏文件基线。复用父会话基线证据，不重做已完成调查；补 mock，创建独立回归脚本并先取得复现失败证据。新脚本支持 NAV_EVIDENCE_DIR，不依赖 Downloads 文件存在才能回归。
- [x] S2：在导航服务保存每单位的原目标/生命、真实 body（含 offset）/攻击范围、障碍及版本和接近点。优先复验有效承诺再求新候选；版本变更重验当前几何，pending 可保留承诺但运动仍须当前物理 sweep。先检查完整原目标直线可达性，兼容同一 Player 节点移到同侧；不得用选中 waypoint 的短线判定完成拆障。销毁/失活/不再可攻击、真实换目标、生命周期/body 改变、已确认拓扑或站位不可达时清理或重选；重叠只做现有安全恢复/攻击判断。
- [x] S3：表面优先选择通过真实 body 全线检测的同侧合法近点。绕行仅在已有廉价、有预算距离 API 可用时比较物理代价，否则允许最近可达启发式，并在报告注明非全局最短物理路线。保持原始阻路障碍选择规则。候选与已选站位缓存区分来源侧/位置、body、障碍版本和目标条件；共享连通数据，禁止同一区域南北单位串用站位。冷查询分片/共享，承诺稳定后无每帧表面重扫，不为候选新建整图场。
- [x] S4：检查 target-move 和 obstacle-move 两条实际路径，取消临时候选变化导致的破坏性 reset，避免建立承诺后立刻 reset 自己。resetUnit/releaseUnit 必须清除此单位全部承诺及引用，不清别人的状态；保留真实目标变化、死亡、禁用、销毁、入池/复活清理及诊断。
- [x] S5：执行下列机器 AC，记录结果；通过后更新 bugs.md、报告和勾选项，置 verifying → done。失败保持未完成并报告；仅必要 replan 时升版本，保留通过 AC/产物，不重新构建已接受工作。

## 校验点
- [AC-REPLAY] 确定性 fixture 使用日志中的位置、waypoint、滚木矩形和 body/offset，重现同一目标下 blocker/no-blocker 交替。允许在底层路线采样边界注入观察到的 waypoint 序列，但必须运行真实 Minion 与导航服务的承诺、分支及 reset 逻辑，不 mock 待验证的承诺结果。修复前复现切换，修复后有效承诺期间无无效 target/obstacle 切换及 reset；记录输入序列、注入边界和计数。日志缺少 HighPlatform 墙体碰撞数据，不要求精确全场景数值回放或未知几何下 15 秒内成功。
- [AC-ATTACK] 独立、完整已知几何 fixture 使用真实表面查询、碰撞约束及 Minion 移动/攻击链，验证合法接近并至少一次实际扣除滚木血量；按 fixture 距离、配置速度与攻击时序设定明确帧上限。输出攻击次数、净位移、累计路程及最终距离，不能以静止或 mock 命中通过。
- [AC-SURFACE] 独立北/南同侧直达及同连通区交替查询测试；含 offset body、阻住最近一面而另一面可达的绕行案例。断言选点合法、真实路径不穿障碍；启发式 fallback 须明确记录，不要求全局最短，不能只断言非 null。
- [AC-LIFE] 覆盖滚木移除/失活后恢复、同一 Player 移到同侧且完整直线可达后释放、真实换目标、reset/release、禁用/死亡/复活和 body/topology 变化；pending/短暂重叠保留仍有效承诺，已确认不可达点重选/安全等待；双单位互不清理状态。
- [AC-BUDGET] 稳定承诺预热后 200 单位×300 帧的 surfaceScans 增量为 0，blocker 全扫描不随重复帧增长；冷绕行查询共享、每帧 work/缓存不超现有配置，无每候选完整场。记录 surfaceScans、blockingScans、建场/取消/工作量、缓存条目/字节和生命周期释放结果。
  construction benchmark 非默认门禁；仅本项预算测试暴露问题、需要进一步定位时运行，并将输出写入本任务证据目录。
- [AC-REGRESSION] 新回归、既有导航和拆障 harness 全通过（含修复 mock 后 Boss 项）；TypeScript、OpenSpec strict、diff 检查通过。所有结果写入本任务证据目录，不改已有证据。
- [AC-PLAY] Creator 实玩/重采日志为补充，不阻塞机器通过；未运行须明确报告。纯脚本任务跳过全部 MCP 场景门禁。

### 验证命令（仓库根目录，PowerShell）
每条单独执行；三套测试各用独立证据目录，禁止沿用 harness 默认旧任务输出路径。父会话已将基线生成的旧报告恢复至初始干净状态，后续不得再写旧路径。
```powershell
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/navigation'
node .cursor/scripts/test-enemy-navigation.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/demolition'
node .cursor/scripts/test-enemy-break-blocking-log.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/fix-minion-log-route-oscillation-evidence/regression'
node .cursor/scripts/test-minion-log-route-oscillation.cjs
npx --no-install tsc --noEmit --pretty false
openspec validate fix-minion-log-route-oscillation --strict
git diff --check
git status --short
```
验证结束恢复进入任务前 NAV_EVIDENCE_DIR 值。逐项报告退出码和 AC 对应测试名；核对 diff 仅落于允许清单。

## 回滚策略
按 S1 当前脏文件快照逐 hunk 撤回本任务修改，不用 git restore/reset 覆盖前序工作。保留失败证据；不改场景、资源或旧报告。尚未执行的步骤与 AC 不得勾选。

## 修订记录
- v1（2026-09-12）：依据已诊断日志创建；实现已授权，补充同节点目标移动的完整直线释放及最小 harness mock 修正。
- v2（2026-09-12）：仅调整验证范围：确定性分支复现与完整已知几何攻击验证分离；不要求未知全场景回放，construction benchmark 改为预算异常时按需运行。既有步骤及其它 AC 保留；行为未变，OpenSpec delta 无需修改。
- v3（2026-09-12）：在本次修复授权范围内，由父会话确认扩展测试适配范围，修复既有 Boss 死亡动画变更导致的 harness 漂移：AC-POOL 改捕获真实 FINISHED 回调，不再寻找已不存在的 0.8s schedule；仅扩展该测试文件权限，保留已通过步骤及断言。表面最近点暴露 flow 到达容差提前停步，S3/S4 同范围修复合法终段并增加专用回归，攻击时序不变。

## 执行报告须含
AC 状态/测试名/证据路径、实际允许文件差异、FlowField 是否必要及理由、剩余限制。MCP 指标全部 N/A（无场景/资源改动）；是否续跑：接续父会话诊断及基线，首次 build 报告；OpenSpec change：见本计划引用。

完成报告：`.cursor/plans/reports/fix-minion-log-route-oscillation-report.md`。12 项专用、55 项导航、27 项拆障及 tsc/OpenSpec strict/diff 检查全部通过。FlowField 与 Boss 生产脚本未改；最近可达启发式不保证全局最短路线，完整 HighPlatform 实玩未验证。
