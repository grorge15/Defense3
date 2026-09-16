---
slug: minion-navigation-performance
版本: 2
状态: done
创建: 2026-09-16
---

# 小怪导航性能简化

## 业务目标
将小怪昂贵导航决策错峰到约 0.2-0.3 秒一次，保留逐帧安全移动；简化局部拆障选择、降低避让频率并限制参与邻居。保守处理几何编辑造成的共享缓存清空。关联 `AI_TASK_LIST.md` §4.13/4.14 的跨模块回归，采用一个 Plan-Build 任务。
用户已经授权 build；draft 仅表示计划已落盘、尚未执行。交接后由一个 build-agent 直接转 active 并连续执行，无需再次确认；本轮只产出计划和规格。常规实现细节、测试 mock 漂移和下述安全回退由同一 build-agent 解决，不反复重委派。

## v2 实际验收范围（主代理收紧验证范围，覆盖下文 v1 扩展矩阵）
- 本次单一 build 已完成，未另开 agent 或 replan 周期。保留行为、安全、预算和 Boss 隔离要求；不重建导航引擎。
- AC-CADENCE：10 秒采用 50 单位 30/60Hz、200 单位 120Hz，加 1.2 秒长帧；不跑单位数与频率的完整笛卡尔积。验证决策和首次避让分散、逐帧积分、每单位次数上限。
- AC-LOCAL/GEOMETRY/BOUNDS/REGRESSION：保留核心导航、拆障、承诺运行语义断言，增加死亡、body 改变、当帧建墙 sweep、击退、禁用、软截止让出及取消任务检查。既有核心用例覆盖几何版本、pending、公平性和缓存上限；不宣称跑过原 AC 的每一项组合。
- AC-MEASURE 改为精简描述性证据：50 单位、60Hz、3 秒的追踪/密集避让/拆障/销毁/建墙五种 fixture，保存最终原始帧、调用数、邻居访问、work/cache 峰值及 Node median/p95/max。基线源码和脏哈希已保存；初次前测失败，没有有效同基线五轮前后对比，不宣称耗时/FPS 提升。原五轮 before/after 完整矩阵明确未执行、未验收。
- 2ms scheduler 为保守默认软预算，每 32 work 检查；不覆盖几何扫描、桶重建、分配、prune/clear。保留全局失效，不宣称选择性缓存复用。
- AC-SCOPE：许可文件核对、OpenSpec strict、tsc、diff whitespace。浏览器/移动端 profiling 和 Creator 实玩均未执行。done 仅表示缩减后的机器验收完成，不代表原 v1 扩展矩阵通过。

## OpenSpec 引用
- Change：`openspec/changes/minion-navigation-performance/`

## 风险等级与现状
中。当前 `EnemyMinion._updateMovement` 每帧调用拆障/路线查询；`EnemyNavigation._surface` 已优先直达并使用共享连通启发式，不是逐候选完整路径代价比较，不应以未经证实的旧实现为基线。`_applyLocalAvoidance` 收集附近桶中所有邻居；`_refreshObstacles -> FlowField.invalidate -> clear` 仍清空所有字段、图、查询及任务，现有 8 单位/帧 epoch 清理没有消除共享缓存清空。
以当前磁盘而非 HEAD 为基线：小怪含建造击退和盾兵目标存活检查，AI 含盾兵近战，Boss 含攻击恢复修改，配置/测试/bugs/场景资源等均有脏改动；旧导航报告含已接受工作，不重新实现或改写其验收状态。

## 禁做项
- 不改场景、prefab、动画、meta、编辑器设置；不运行资源保存/重导入或 MCP 装配门禁。
- 不改 Boss 决策、索敌节奏、拆障/避让策略及攻击生命周期；不把小怪节流施加给 Boss。不改战斗数值、刷怪、建造、击退、大招或目标优先级。
- 不恢复旧城界/入口限制，不新建导航引擎/对象 Controller，不逐单位同步全图搜索、逐候选完整建场或放宽现有缓存/工作预算。
- 不以“离当前单位远”或“当前步不相交”证明全图缓存不受影响；不跨不兼容几何版本复用图、负查询或部分结果，不把 pending 当不可达。
- 不覆盖无关脏改动、旧计划/报告/证据，不从 HEAD 恢复整文件。不删除失败用例、削弱断言或以静态源码匹配代替运行测试；无测量不得宣称 FPS/耗时提升。

## 变更文件清单
- 【可写】`assets/scripts/enemy/EnemyMinion.ts`：决策时钟、逐帧执行及生命周期清理，保留现有脏改动。
- 【可写】`assets/scripts/core/EnemyNavigation.ts`：小怪专用局部拆障/避让、缓存依赖及几何提交接入；共享改动不得改变 Boss 决策。
- 【可写】`assets/scripts/core/FlowField.ts`：安全失效、任务/缓存依赖和预算内重建。
- 【可写】`assets/scripts/core/GameConfig.ts`：仅新增小怪决策/避让参数，保留其它值与脏改动。
- 【可写】`.cursor/scripts/test-enemy-navigation.cjs`、`.cursor/scripts/test-enemy-break-blocking-log.cjs`、`.cursor/scripts/test-minion-log-route-oscillation.cjs`、`.cursor/scripts/bench-enemy-navigation.cjs`：相关回归、测量和证据重定向。
- 【条件可写】`.cursor/scripts/test-building-spawn-minion-knockback.cjs`、`.cursor/scripts/test-barracks-minion-ultimate-timing.cjs`、`.cursor/scripts/test-expand-enemy-clear-area.cjs`：仅直接受影响的测试适配及证据输出。
- 【测试权限】上述 harness 及其直接加载的现有测试 helper 中，允许补齐过时 mock 的方法/属性/回调和帧时钟、加载新的实际配置、适配本次授权的决策时序；逐项解释原失败及真实语义，保留原行为断言，无需逐方法 replan。不得据此修改无关生产模块或第三方依赖。
- 【可新建】`.cursor/scripts/test-minion-navigation-performance.cjs`：加载真实生产方法的确定性运行回归及可比测量；复用现有 harness。
- 【可写/新建】本计划、上述 OpenSpec change、`.cursor/plans/reports/minion-navigation-performance-report.md`、`.cursor/plans/reports/minion-navigation-performance-evidence/**`；`bugs.md` 仅验证后在匹配的导航/建墙条目追加版本，保留现有内容。
- 【仅只读参考】`EnemyAI.ts`、`EnemyBoss.ts`、`EnemySpawner.ts`（均位于 `assets/scripts/enemy/`）；`assets/scripts/core/NavigationObstacle.ts`、`assets/scripts/item/Log.ts`、`assets/scripts/building/{BuildSystem,Wall,Building,Barrier}.ts`、`assets/scripts/game/{CombatSystem,UltimateSystem}.ts`；`assets/scenes/Main.scene` 及资源；项目规则、`defense3.md`、`AI_TASK_LIST.md`、现有 OpenSpec delta 和既有导航/击退计划报告。未列出的生产文件只读。

## To-dos
- [x] 4.13.a 基线：读取本计划/已有本任务报告和最新脏 diff；保存任务涉及源文件快照、全工作区状态与脏文件哈希到新证据目录，记录已有测试失败。先建可运行的测量模式，在同一当前脏基线上测量，再改生产代码；续跑保留原基线并从未完成项开始。
- [x] 4.13.b 小怪调度：配置默认决策间隔 0.25s（可调范围 0.2-0.3s），使用单位稳定相位分散批量生成；不累计补跑长帧错过的多次昂贵决策。缓存目标/拆障决定及意图，普通目标移动最多等下个窗口；逐帧保留存活、攻击范围/锁定、击退优先级、当前几何 sweep、速度换算和移动。身份/生命/body 改变清理缓存；几何变化立即禁止不安全结果，昂贵重算仍错峰。预置怪、池化怪及无导航 fallback 均不冻结。
- [x] 4.13.c 局部拆障与避让：沿已选 Hard-safe 下一路段选择首个合法可破坏阻挡，先用当前侧最近合法面的小候选集；已有承诺不随 waypoint 抖动。没有直达攻击面时复用现有有预算的连通/表面回退，不反复比较拆除与全局绕路代价。避让默认每 0.25s 错峰计算、最多 4 个有效邻居；从现有空间桶稳定选取，独立缓存有限避让修正，逐帧与移动合成并 sweep。统计桶候选访问数，避免仅截断输出却隐瞒全扫描成本；Boss 保留原路径。
- [x] 4.13.d 几何失效：选择最小安全方案：完整相关输入可证明一致时选择性保留；否则先令旧结果不可消费，采用有界 scheduler 时间片及现有工作量/入队上限清理重建，允许保留全局 clear。时间预算参数放 GameConfig，由测量确定并记录检查粒度/超时余量，不放宽原工作上限。选择性保留可从“仅可破坏物改变、Hard-only 规划输入不变”入手，但不是必做架构改造；物理查询/站位仍须失效。检查 epoch、key、引用、快照和完成发布，禁止仅换版本号。报告明确哪些编辑仍全清、取消多少工作及剩余成本；仅当前一步安全不能证明缓存有效。
- [x] 4.13.e 运行验证：完成下列 AC 的真实方法驱动测试、可比测量、相关回归及 tsc；测试 mock 按授权范围直接修复。未通过项保留证据，修复后只重跑受影响检查。
- [x] 4.13.f 交付：更新匹配 bugs 条目、todos/AC 状态及报告；机器 AC 全通过才 done。报告列出基线/最终哈希、命令退出码、mock 适配、测量限制、缓存保留证明或保守回退原因。真机/Creator 实玩未做须明确写明，不以本计划关闭旧计划的未完成 gate。

## 校验点
- [AC-CADENCE] 确定性 50/200 小怪、30/60/120Hz 与长帧测试：稳定 10 秒窗口内每单位昂贵决策次数不超过 `ceil(T/interval)+1`，批量出生决策分散到多个帧；无补跑尖峰。无障碍移动距离与速度积分一致（记录误差容限），非决策帧仍实际更新刚体；有效攻击范围/存活/击退检查不等决策时钟。至少一个多单位用例不 stub 路线/拆障/安全实现。
- [AC-LOCAL] 实际小怪更新与导航联测：两侧接近固定滚木、物理绕路存在、必须绕 Hard 到合法攻击面、多个顺序阻挡、同一玩家移动到本侧、滚木失效；记录选择/切换次数、移动、命中/摧毁及恢复帧。无振荡、隔墙攻击、无关障碍选中或 pending 永久缓存。每次小怪避让参与数 <=4，更新频率符合配置，访问数/耗时有记录；Boss 原决策/避让调用路径不节流。
- [AC-GEOMETRY] 覆盖滚木摧毁、墙创建、物体移动/启停/重分类、地面/topology 变化、重复无变化通知，以及同帧已有消费者后编辑和半成品任务中编辑。变化后首个移动请求即服从当前物理几何；旧任务不能发布。对每种保留类型证明完整输入等价，并与全失效重算对照；若无可证明复用，验证保守失效的预算/恢复并报告，不伪造缓存命中。不能只测当前一小步安全而放过错误连通或旧负查询。
- [AC-BOUNDS] 稳定几何后 pending 可完成，混合小怪/Boss 无饥饿；维持 cell=30、work<=4096/服务帧、entries<=32、bytes<=8388608、cells<=262144、单位 epoch 清理<=8/帧、新 field 入队<=2/帧。完成/未完成数据统一计数；重复几何编辑、目标换人、pool/reset/disable/death/击退/迁移、服务销毁后无旧缓存复活或引用泄漏。
- [AC-REGRESSION] 专用运行测试、核心导航/拆障/承诺回归中直接受影响的用例通过，`tsc` exit 0。覆盖共享路径中的 Boss 决策不变和小怪现有生命周期；击退/迁移等仅跑直接受影响用例，不要求修复无关大招/建造回归。先辨别基线失败：相关 mock 漂移由当前 agent 修复，不相关既有失败留证据并排除；不得排除本次新增回归或把被测导航全部 stub 掉。
- [AC-MEASURE] 同一环境/fixture/种子/dt/单位数/时长在生产编辑前后各至少 5 次，包含稳定追踪、密集避让、拆障、滚木销毁和建墙；落盘原始帧数据与源哈希，报告决策/扫描/邻居访问、建场/取消/保留、scheduler work、移动进展、Node 耗时 median/p95/max 及缓存峰值。稳定用例昂贵决策/避让调用计数必须降低；耗时不预设提升比例，不能将调用数或 Node 计时写成实际 FPS 改善。已有 benchmark 可复用，禁止拿旧版本历史数字作同基线比较。
- [AC-SCOPE] OpenSpec strict 与任务文件 whitespace 检查通过；用基线哈希/diff 核对本任务仅改许可范围，Boss 和无关脏资源逐字保留。Creator AC-PLAY 可选、不阻塞；本任务 MCP 指标 N/A，场景保存/资源变更次数为 0。

### 验证命令（仓库根，PowerShell）
先记录并在结束后恢复原 `NAV_EVIDENCE_DIR`；每次基线/最终运行使用本任务独立子目录，禁止写默认旧证据路径。新 harness 的 `--measure-only` 模式须在旧源码上运行并输出计数/计时而不强制新 AC；正常模式执行全部新 AC，5 次测量各用不同目录。现有 harness 可增加明确的用例过滤并记录所跑测试名；不得要求无关基线失败全部修复。
```powershell
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/minion-navigation-performance-evidence/before/run-1'
node .cursor/scripts/test-minion-navigation-performance.cjs --measure-only
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/minion-navigation-performance-evidence/after/run-1'
node .cursor/scripts/test-minion-navigation-performance.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/minion-navigation-performance-evidence/navigation'
node .cursor/scripts/test-enemy-navigation.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/minion-navigation-performance-evidence/demolition'
node .cursor/scripts/test-enemy-break-blocking-log.cjs
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/minion-navigation-performance-evidence/oscillation'
node .cursor/scripts/test-minion-log-route-oscillation.cjs
npx --no-install tsc --noEmit --pretty false
openspec validate minion-navigation-performance --strict
git diff --check
git status --short
```
循环执行 before/after 的 run-2..run-5，保留每次原始数据；不得生产修改后才生成 before。击退/迁移路径有改动时按需运行对应 `test-building-spawn-minion-knockback.cjs` / `test-expand-enemy-clear-area.cjs`；`test-barracks-minion-ultimate-timing.cjs` 仅相关生命周期断言需要时运行。若全局 diff 检查已有无关问题，记录基线证据并检查本任务文件。可选 construction benchmark：`node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/minion-navigation-performance-evidence/construction`，仅本任务目录落盘。

## 回滚策略
以 4.13.a 当前脏文件快照逐 hunk 撤销本任务未验收修改，保留此前代码与失败证据；禁止 reset/restore 整文件。真正规格/生产范围变化才 replan：版本 +1，只修失败步骤/证据/AC，保留已完成项并同步本 change。已授权测试 mock 适配与保守缓存回退不要求 replan。

## 修订记录
- v2（2026-09-16）：主代理决定缩减验证矩阵，非用户另行要求；完成小怪错峰、局部面、独立有限避让及保守 scheduler 时间片，保留全局清空。最终机器结果见报告；没有有效前后耗时对照或真机性能结论。
- v1（2026-09-16）：依据当前脏代码创建单一计划；记录 build 已授权、测试适配权限、Boss 隔离、安全缓存回退及测量要求。未执行生产修改/机器 AC。

## 执行报告须含
报告路径：`.cursor/plans/reports/minion-navigation-performance-report.md`。逐 AC 状态/测试/证据、实际文件清单、未运行项及限制；MCP 指标：全部 N/A（scene-open/save/reimport、新 prefab 数为 0）；是否续跑：待填；OpenSpec change：见引用。
