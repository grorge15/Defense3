---
slug: fix-enemy-navigation-performance
版本: 2
状态: done
创建: 2026-09-09
---

# 滚木接触与建造触发的敌人导航性能回归修复

## 业务目标
修复两项新报性能回归：城内预置 enemy 与 log 碰撞时 FPS 从约 55 降至 25（不是仅存在就掉帧）；建造地块时降至 5–10。重点消除起点落入膨胀障碍/阻挡格时的候选搜索爆炸，并验证是否对应实际滚木接触热路径。仅优化计算、缓存与失效传播，不改变玩法。多文件中任务，用户确认后由一个 build-agent 连续执行；当前仅落盘计划，不实现、不记 bugs 成功记录。

## OpenSpec 引用
- `openspec/changes/enemy-shared-flow-field/`

## 风险等级
中高：共享缓存、实时几何与碰撞安全跨模块。既有 35 项逻辑测试不证明性能达标。

## 已有证据与待核实项
- `FlowField.direction` 在 `lineClear` 前调用 `_fieldFor` 并可能全图 BFS；`_canReach` 调用 `direction`。`nearestReachableWalkable` 对每个候选再次走该链，8 圈合计 288 个外围候选，加原目标最多 289 次查询。
- `EnemyNavigation._prepareFrame` 每帧执行全 scene `BoxCollider2D` 扫描、排序和字符串签名，并重建空间桶。当前版本号既在 `invalidate` 增长，又可能在 `_refreshObstacles` 增长；只做到“每帧一次扫描”不足以消除该成本。
- `BuildSystem._invalidateEnemyNavigation` 先 emit、再直接 invalidate；服务已订阅该事件。墙完成还经 `syncClosedEntranceFromPlot`、`EnemySpawner` 墙事件再次触发失效。
- body key 使用宽高 `ceil` 与 offset 十分位取整；Minion/Boss 的尺寸和 offset 来自 worldAABB 与位置相减。整数边缘浮点抖动、相同 key 内不同实际形状复用是否安全，尚需采样验证，不能宣称已确诊。
- 建造动画是否改变实际 blocker collider、父级 transform 或仅 Visual，尚需实际运行采样；Tower 当前明确缩放 Visual，不足以证明 blocker 每帧变化。逐帧记录变化 collider 的身份、前后 AABB、enabled/active、父级 transform 与动画时间，区分重复通知、数值噪声和真实几何变化。
- 已读工作流、任务清单、bugs、现有导航 spec/report 与 `fix-defense-combat-expand` 草稿。旧 bugs 主题 `fix-path-agent-frame-drop` 已有 v1–v3；不得用旧“通过”覆盖本次新回归。
- 滚木接触核心反例已复现，但实际游戏根因尚未完全证实。`Log.isAttackable` 依赖 locked、非 fading、HP 和 active，导航仅在此条件下收录 Log 为障碍；分别验证 rolling/charging/fixed/failed，不能把所有滚木接触都归为固定障碍导航问题。
- `EnemyMinion.update` 在导航计算后仍执行 `_biasVelocityAwayFromPlayer` 与 `_adjustVelocityAgainstLog` 再写刚体速度；后处理使用的可视/物理 AABB 与导航 body 可能不一致。记录各阶段输入/输出速度、起点、physical/visual AABB、sensor 状态，判断阻挡起点如何产生、是否被后处理再次推入。按下列条件可写范围修复体型稳定化与最终速度一致性，无需为这些已知路径另走 replan；不改滚木几何，不并入另一草稿。

### 实际 scene 配置（主线程只读解析确认）
- bounds 引用 __id76 `leftM`=(-1922.807,-498.633)、__id77 `rightU`=(1809.26,3306.767)，同 parent11。
- parent11 Ground -> 10 GameRoot -> 1 Main 的 pos 均 0、scale 均 1、quat 均 identity，以上 local XY 即世界 XY；20 格得到 187x191=35717 格，比默认 16800 格更大。基准另加该实际 bounds 档，不能只测默认小图。
- ground 的 leftU=(-2561.155,3579.052)、rightM=(2365.143,-908.41) 超出 bounds，作为配置边界限制提示，不是已证实主性能根因；不修 bounds/ground/祖先 transform、不猜其他场景引用。

### 主线程实测，plan-agent未独立复跑
实际 `FlowField.ts` 通过 TypeScript `ts.transpileModule` + Node `vm` 执行；使用 `perf` 保存计时器。bounds 为 (-1200,-1200)–(1200,1600)，cellSize=20，矩形 ground、无 castle，body=40x40、offset=0；网格 120x140=16800 格，lookahead 使用当前配置 20。

| 样本 | 操作 | 耗时 | buildCount / cache / 结果 |
|---|---|---:|---|
| CLEAR-200 | from(0,0) 至 target(200,200)，连续 200 次 nearestReachableWalkable | 33ms | builds=1 |
| UNREACHABLE-COLD | 全高度墙 x=100..140，target(600,200)，单次 nearestReachableWalkable | 1633ms | builds=289，cache=289，null |
| INVALIDATE-5 | 无障碍查询，每次前 invalidate，共 5 次 | 71ms | builds=5 |
| LOG-OVERLAP-COLD | 默认 bounds，log rect x[-100,100], y[-20,20]，from(0,25)、target(300,200)、40x40 body；无 ground/castle 的纯核心隔离测试，单次 nearestReachableWalkable | 2559ms | builds=289，cache=289，null |

LOG-OVERLAP-COLD 中角色膨胀体与 log 重叠，起点阻挡导致每个候选均不可达。此样本特意无 ground/castle，不可混称带配置的服务/编辑器测试；其他前三项保持矩形 ground。增加接触边界 y=40 的正负 epsilon、障碍内部与有效点落入阻挡网格的重复请求组，确认安全停止/恢复及计数，而非只测分隔墙。

这些是 assistant 主线程本轮只读实测的 Node 核心微基准，不包含 Cocos 帧循环、渲染、物理或真实 scene 配置，不得换算为游戏 FPS。首次 Node stdin 顶层 `performance` TDZ 已通过改名 `perf` 修正，仅为基准启动问题，不算业务失败。后续收到原始输出/环境信息，在报告追加来源与版本，不伪造历史重复样本。

## 禁做项
- 禁止修改或生成 scene、prefab、meta、动画资源、坐标、Inspector 绑定；实际 scene 仅只读获取配置、引用、尺寸、数量。禁止运行时生成静态布局，禁止任何 scene-save/reimport/装配操作。
- 禁止新增每怪 A*，或退回直追/局部转向以绕开共享导航；不减敌人数、刷怪频率、碰撞精度、更新正确性来换 FPS；不调粗 20 格或改变攻击/楼梯规则。
- 不跳过 `lineClear` 的地面、体型 offset、边界及 portal 约束；不取消 sweep、防穿角、LOS、避让限速或不可达安全停止。
- 不忽略真实动画 collider 更新，不仅依靠“动画结束后 invalidate”或固定秒级轮询；不得为了缓存命中缩小实际碰撞体，或把不同安全通行形状随意合并。
- 不混入 `fix-defense-combat-expand` 的箭矢友伤、滚木尺寸、士兵攻击动画、扩地隐藏时机。特别是 BuildSystem 与 GameConfig 的共享文件仅改本任务相关 hunks，不覆盖其他任务。
- 不更新既有导航计划已接受工作，不重建资源，不撤销外部 dirty 文件。范围必须扩大时先 replan。

## 变更文件清单
以下为未来 build 的许可；本次仅写本计划。

【可写】
- `assets/scripts/core/FlowField.ts`：直通优先、共享占用/连通图、缓存有界、计数与生命周期。
- `assets/scripts/core/EnemyNavigation.ts`：障碍注册/变化检测、合并失效、快照一致性、body 分类与调试统计。
- `assets/scripts/building/BuildSystem.ts`：仅去重导航通知，保持完成状态与事件顺序语义。
- `assets/scripts/enemy/EnemySpawner.ts`：仅墙事件导航失效去重，保留停止对应侧刷怪和晚配置同步。
- `assets/scripts/core/GameConfig.ts`：仅导航缓存预算/诊断配置，不动玩法数值。
- `.cursor/scripts/test-enemy-navigation.cjs`：复用现有实际类加载与 mock，增加正确性和服务计数回归。
- `.cursor/plans/fix-enemy-navigation-performance.md`：状态、todo、AC 证据与定向版本修订。
- `bugs.md`：仅在 build 验证成功后；两个用户问题分别留记录，先检索旧主题，适用时同条 v4/v5 更新，分别写现象/原因/解决，不合并为一条、不提前宣告修复。

【可新建】
- `.cursor/scripts/bench-enemy-navigation.cjs`：可重复核心/服务基准，读取实际 TS 与只读 scene 配置；不生成资源、不自动改 scene。
- `.cursor/plans/reports/fix-enemy-navigation-performance-report.md`：基线、逐项 AC、前后对比、限制与原始输出。
- `.cursor/plans/reports/fix-enemy-navigation-performance-evidence/`：基准 JSON、帧耗时 CSV、性能截图/trace；不得存生成的 scene/prefab。

【条件可写】
- `assets/scripts/enemy/EnemyMinion.ts`、`assets/scripts/enemy/EnemyBoss.ts`：当采样/回归证明 body key 抖动或导航与后处理最终速度不一致时，允许稳定实际物理体型计算、统一导航输入与最终速度安全约束，并补实际类测试；报告对应证据与 hunks，直接在本计划内执行。不得改伤害、索敌、攻击时序、碰撞几何、滚木各阶段行为或现有合法脱离语义，不以改变玩法掩盖性能问题。

【仅只读参考】
- `.cursor/rules/{multi-agent-orchestrator,defense3-workflow,openspec,cocos-mcp}.mdc`、`.cursor/plans/_TEMPLATE.md`、`AI_TASK_LIST.md`、`defense3.md`。
- `openspec/`、`.cursor/plans/enemy-shared-flow-field.md` 及其 report、`.cursor/plans/fix-defense-combat-expand.md`。
- `assets/scenes/Main.scene`、所有 prefab/meta/动画、`docs/SCENE_PLACEMENT.md`：解析实际引用与父变换，不猜配置，不落盘。
- `assets/scripts/enemy/EnemyAI.ts`、`assets/scripts/building/{Building,Wall,Tower,Barracks,Barrier,BuildPlot}.ts`、`assets/scripts/item/Log.ts`：检查碰撞生命周期、建造/动画调用链；Log.ts 保持只读，不并入滚木几何修复任务。
- `assets/scripts/core/{GameEvents,EventManager,PathAgent,AirWallAabb}.ts`、`package.json`、`tsconfig.json`：保持其他对象导航和接口。

## To-dos
- [x] NAVPERF.a：核对热路径、现有规格/草稿和 dirty 状态，收录主线程核心基准，区分确证与假设。
- [x] NAVPERF.b：用户确认 build 后，一个 build-agent 读取当前计划、report、git/disk、共享文件 diff；保存基线 hash 与原始未修 TS 快照到证据目录，跳过已接受步骤。确认实际 scene 配置，建立复现与指标。
- [x] NAVPERF.c：先建立可对照基准/诊断，采集未修核心、服务及游戏两项回归；明确 body key/动画失效证据，锁定预算及比较环境，不把诊断开销计入无诊断 FPS。
- [x] NAVPERF.d：实现直通零 BFS、共享占用/连通分量一次计算、替代点查询和有界缓存；补对应反例测试。
- [x] NAVPERF.e：合并建造/墙失效，分离几何变化检测与邻居桶更新，消除稳定场景每帧全 scene 扫描/排序/串签名；验证新增、移除、动画与同帧更新。
- [x] NAVPERF.f：执行逻辑、计数、冷/热微基准和真实游戏前后对比；失败仅修失败点，无证据不得标性能通过。
- [x] NAVPERF.g：机器算法计数、逻辑与微基准 AC 通过后分别更新两项 bugs 和计划状态；游戏测量可用则采样，不可用则注明 pending、环境限制及尚未证实 FPS 恢复，不阻塞 build 完成。bugs 区分已验证算法修复与待游戏验证的用户症状，禁止把机器通过写成 FPS 已恢复。机器硬阻塞写出已完成项/待证据，续跑从首个未完成 todo 开始。

## 实施步骤
1. 复现与诊断：基准使用相同源文件转译与 vm 装载，复用现有测试习惯，不新装依赖。分别记录冷启动与预热样本，至少 5 轮，输出中位数/p95、buildCount、占用/连通图构建数、访问格数、候选数、命中率、cache entries/bytes 峰值。服务另计 fullSceneScan、trackedColliderChecks、signatureBuild、invalidateRequests、effectiveCommits、geometryChanges、bodyKey 种数、prepareFrame/BFS/接近点 CPU 毫秒。
2. 直通：在创建距离场前验证完整通行条件；直通/到达结果不产生或持有虚假 field。审计 `fieldIdFor`、query/retain/release 及单位从绕障切回直通、死亡、复用、invalidate 的所有权，避免 ref 泄漏/误减；服务配置缺失仍 fail closed。
3. 替代目标：先检测实际起点与 body 的通行/图接入条件；确定阻挡且无合法接入时立即安全停止，不遍历候选建场。按完整 area revision + 稳定安全 body 类型共享占用网格及四向合法连通分量，一次 O(V+E) 标记，不按候选/怪物建场；入口开放、宽度与区域边的合法性纳入图。候选只做连通查询与既有接近线过滤，保留圈序、最近距离和稳定 tie-break。精确起点到网格的接入须验证，不得把 cell 标签当作任意点可达证明。只为最终需要绕障的选定目标构造距离场；无解热查询不得重算图或目标场。不新增传送/穿透式脱离逻辑：阻挡时保持安全停止，现有物理/合法外向运动解除接触后及时恢复；如需改变解穿透语义先 replan。
4. body 与缓存：先测实际 worldAABB key，选稳定物理几何推导或有证据的安全等价分类；占用构建体型和 key 必须一致，精确 sweep/LOS 仍用真实 body。测试整数边缘误差、offset 正负、不同宽高/缩放、窄楼梯，真实形变必须拆类或失效。所有占用图、分量图、目标场、负结果和队列均明确 entries/bytes 上限；GameConfig 集中预算，报告列具体值。采用 LRU/代际淘汰，明确活跃引用超预算时安全释放/重求策略，不能让 refs 使内存无界或沿过期场移动。
5. 失效：生产者只走一种通知路径，服务标 dirty 而非每次递增/clear。在下一次依赖导航/碰撞的查询前同步实际几何；同帧同一建造事务的重复通知合并一次有效提交，无真实几何/拓扑变化提交为零。bounds、ground、castle、portal 开闭/宽度同样纳入 revision，不能仅以矩形签名认定相同。
6. 障碍检测：首次/结构变化时发现并维护 collider 集合；注册/节点生命周期/变换事件或已跟踪集合的轻量检查保证新增、销毁、active/enabled、死亡、固定滚木、扩地均不漏。静态稳定帧不得遍历全 scene、排序全部障碍或构造全串签名；邻居桶每帧维护不再驱动全场障碍刷新。动画若真改变 collider，每帧只提交该帧几何快照一次，不能整个动画结束后才刷新。若同帧首次查询后再次真实变更，后续查询必须看到新状态，记录为独立实际变更事务，不可借“每帧一次”读取旧障碍；只合并尚未消费的重复通知。

## 校验点与验证方法
- [AC-SCOPE] `git status --short`、`git diff --check`、`git diff --stat`，逐项对照起始 dirty/hashes，证明无本任务 scene/prefab/meta/OpenSpec/其他草稿改动；不能要求工作区原本干净。
- [AC-TSC] `npx tsc --noEmit --pretty false` exit 0；依赖缺失记录环境阻塞，不擅自下载或改配置。
- [AC-LOGIC] `node .cursor/scripts/test-enemy-navigation.cjs` exit 0；保留现有覆盖并新增直通 ref 生命周期、同 key 体型安全、障碍新建/移除/动画、bounds/portal 变化、缺配置、跨区/楼梯、防穿角、不可达/建筑接近点、攻击 LOS/迟滞/锁定、复活清理。不得仅改旧断言以迎合优化。
- [AC-FAST] 清空缓存后 200 次有效直通 `direction` 和 `nearestReachableWalkable`，距离场 BFS=0、连通图构建=0，安全检查仍执行；绕障转直通后无引用泄漏。
- [AC-UNREACHABLE] 复现 289 builds 样本，冷查询最多一次共享连通图构建、目标距离场构建=0、结果 null；随后同版本同体型至少 200 次查询图/场新增均为 0。换其他起点但同连通区也复用，不产生每怪搜索。可达替代点与隔墙无解反例均正确。
- [AC-LOG-CONTACT] LOG-OVERLAP-COLD 阻挡起点查询距离场/连通图构建均为 0，不进入逐候选可达搜索；200 次内部及接触边缘正负微抖重复请求不随候选数/怪数建图，warm 同几何同体型无重建。另测准确点可走但所在格中心受阻的边界反例，不误穿障碍或无限沿旧场移动。通过加载实际 Minion/Boss 类的服务测试验证 rolling/charging/fixed 区别、后处理最终速度及大 dt：阻挡安全停止、现有合法脱离后恢复，不传送、不加深穿透、不取消碰撞。需要体型稳定化或最终速度一致性修复时按条件可写范围直接执行，不因已知设计路径另设人工阻塞；实际游戏接触表现另记 AC-PLAY 证据。
- [AC-INVALIDATE] 同帧建墙完成多路通知在下一次查询前只提交一次真实几何/拓扑变更；重复无变化通知零有效提交。稳定 300 帧 fullSceneScan/全量排序签名新增=0；新增、消失、移动、动画真实变化、入口关闭、晚配置及同帧消费后的第二次变更均及时可见且不漏障碍。
- [AC-CACHE] 运行至少 10000 次跨目标格/体型查询和 1000 次障碍版本更新，entries/bytes 始终不超过报告声明预算；同体型平移无浮点伪 key 爆炸；两种真实体型不误复用；释放/销毁后无残留单位引用，场景切换缓存清理。
- [AC-BENCH，机器完成项] `node .cursor/scripts/bench-enemy-navigation.cjs` exit 0，输出上述四个原始样本及新增 warm、body 抖动、服务失效、实际 bounds 样本。修前后相同机器/Node/TS/输入、至少 5 轮；报告源 hash、运行命令、样本、中位数/p95 与差异，明确微基准改善或残留热点；微小耗时噪声可增加批量复测。不设未经用户要求的耗时降幅门槛；必须满足对应算法计数/正确性 AC，不能以墙钟偶然改善替代。
- [AC-PERF-GAME，遵循 AC-PLAY 默认非阻塞] 环境可运行时必须采样，使用同一 Cocos 3.8.8 预览环境、分辨率、设备、电源/性能设置和真实 scene 配置，对滚木接触及相同建造操作采集修前/后对比。建议至少 3 轮、预热 10 秒、稳定记录 30 秒，建造前 5 秒至完成后 10 秒；报告实际采样长度及限制。第一项包含同怪数无接触对照、接触前/中/脱离后及 rolling/charging/fixed 分组，不以怪物仅存在的样本替代接触复现。保留怪数、建筑类型/数量、动画时段、帧耗时 p50/p95/p99、>50ms/>100ms 帧数、导航 CPU 与 trace；FPS 用总帧数/总时长。对照用户报告的滚木接触 55->25 FPS、建造 5–10 FPS 如实展示测量结果，不自行设置 FPS/改善百分比硬门槛或附加批准流程。缺少运行环境时标 pending 并说明缺失证据，不阻塞机器 AC 通过后的 build 完成；缺少可比修前样本同样注明限制，不得凭 Node、逻辑测试或单侧游戏样本宣称 FPS 已恢复。
- [AC-PLAY，默认非阻塞] 肉眼走查原导航规格、建造动画与碰撞表现。能运行则采集上述真实性能强证据；不可运行如实 pending。性能采样允许运行现有 scene，不允许保存配置/结构修改。报告必须分别列机器 build 完成状态与游戏 FPS 验证状态。
- MCP 资源机器门禁不适用：纯脚本、无资源编辑，不跑 save/post-scene/gate。只读工具可选，不可用时可结构化读取磁盘配置继续；游戏计时证据缺失须如实报告。

## 执行结果（2026-09-09，v2）
- 机器 build done：AC-SCOPE/TSC/LOGIC/FAST/UNREACHABLE/LOG-CONTACT/INVALIDATE/CACHE/BENCH 通过；44 项逻辑测试和五轮原始/扩展基准，完整证据见 `.cursor/plans/reports/fix-enemy-navigation-performance-report.md` 及同名 evidence 目录。
- f 的游戏对比仅交付环境限制记录，AC-PERF-GAME/AC-PLAY 保持 pending：主线程证实 Creator 预览仍加载中间旧编译块；1–4 FPS 或 47/55 FPS 瞬时样本不代表最终补丁，不宣称 FPS 已恢复。未改 temp 产物、未 reimport，诊断开关最终关闭。
- 实际 bounds 无解冷建图中位数仍约 291ms，保留冷启动风险；热 200 次约 8.19ms，体型平移/跨目标格 200 次约 9.82ms，不新增图/目标场。无用户自设降幅门槛。
- bugs 原寻路主题分别追加 v4（滚木接触）与 v5（建造），均区分机器算法修复和待实玩验证。并行任务修改保留并在报告归属说明；本代理未写 Log/scene/prefab/meta/OpenSpec 或其他草稿。

## 回滚策略
- 修改前记录 git HEAD、相关文件 hash 和用户已有 diff；FlowField/EnemyNavigation 当前为未跟踪文件，也必须保留磁盘基线，不能用 git checkout 假设有已提交版本。
- 失败只恢复本任务 hunks，不删除用户未跟踪文件、不 reset、不覆盖并行 `fix-defense-combat-expand` 改动；先保留失败基准/trace。
- 回滚优化不回滚既有导航功能。replan 版本 +1，仅改失败步骤/证据/AC，保留已完成和已接受项；若不得不改变玩法或文件范围，停止扩大并先重新确认，必要时同步相关 OpenSpec delta。

## 修订记录
- v2（2026-09-09）：按复核定向移除自设 FPS/耗时降幅硬门槛及附加批准流程，游戏测量改为默认非阻塞；Minion/Boss 体型稳定化与最终速度一致性列条件可写，Log.ts 仍只读。保留已完成调研、实测来源、基准和算法 AC；未实施代码，既有 OpenSpec 无语义变更无需 delta。
- v1（2026-09-09）：初始计划，同轮发布前纳入滚木接触触发澄清、LOG-OVERLAP 2559ms 主线程实测、实际 35717 格配置与阻挡起点 AC；待用户确认 build，未实现、未更新 bugs 成功记录。

## 执行报告须含
两项回归分别列修前/后实测、代码与数据 hash、环境、命令、计数/时间/内存表、原始 trace 路径、每项 AC 状态及阻塞原因；明确区分用户报告、核心微基准、服务 mock、真实游戏测量，不推断未观察到的 FPS。

| MCP 指标 | 次数/值 |
|---|---|
| 只读查询 | 待填，无 MCP 可记 0 |
| scene-open | 待填，仅只读必要时 |
| scene-save | 0（禁止） |
| verify-mcp-gate | N/A |
| post-scene-save / Patched | N/A |
| assets-refresh / assets-reimport-asset | 0（禁止） |
| 新建 prefab | 0 |
| 是否续跑 | yes/no |
| OpenSpec change | openspec/changes/enemy-shared-flow-field/ |
