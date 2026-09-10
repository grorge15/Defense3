---
slug: enemy-break-blocking-log
版本: 3
状态: done
创建: 2026-09-09
---

# 敌人拆除阻路固定滚木

## 业务目标

补齐小怪与Boss的固定滚木阻路处理、表面攻击和恢复追踪闭环，同时保护现有共享导航性能。用户本轮已采纳行为；本计划供本轮后续一个build-agent连续执行，不再次询问是否需要功能。

## OpenSpec 引用

- Change：`openspec/changes/enemy-break-blocking-log/`

## 风险等级

中高。涉及导航可达性判定、攻击入口和池复活，但限定于现有五个生产脚本，不引入通用拆障系统。关联 AI_TASK_LIST 4.13 / 4.14 / 4.19 的既有能力补充，不重做已完成任务。

## 已核实基线

- 已阅读规则、模板、AI_TASK_LIST、设计相关章节、当前脏源码及共享导航/性能报告。`openspec/specs/`目前无可用已归档正文；未归档共享导航及防守修复增量须保留，不在本任务归档或改写。
- `EnemyNavigation._entranceUsable` 要求端点及整个入口线段可通行；中间入口被Log覆盖时，直接把Log节点传给普通跨区目标流程仍会被拒绝。`nextVelocity` 返回零也可能是到达、攻击停步、无配置、碰撞或不可达，不能据此认定Log阻路。
- `FlowField.nearestReachableWalkable` 可返回与原目标不等价的替代位置；非null不证明原目标实际可达。当前复用连通分量、正负接近缓存、真实body和有界LRU，必须在其上做小幅扩展。
- Minion先做玩家中心32/50距离分支，可能尚未调用导航就停止；EnemyAI目前伤害仅到玩家。新阻路判断不能被此早退或旧滞回状态吞掉。移动使用 `bodyForCollider`，不能改回随移动变化的 swept AABB 作为体型缓存键。
- Boss已有Log普通目标、结构优先级、周期重选、圆形伤害与生命代次保护；Log伤害是 `bossAttackDamage`，不是 `bossBuildingDamage`。临时目标不得混入 `_targetList` 破坏原选择。
- Log已有 `isAttackable/getPhase/getBoxCollider/takeDamage`；摧毁会禁用collider并淡出。默认无需改Log。导航下一消费帧的已追踪几何检查可发现移除；同帧显式失效可从新增伤害路径通知服务，保持几何提交合并。
- Minion现有攻击回调只检查死亡状态，reset后旧Visual relay回调仍可能进入新生命；死亡入池和恢复回调也需同代次保护。不得为此重构共享动画工具。
- 主线程本轮已运行既有44测试及tsc全通过，并保存五个核心脚本本轮前快照供review；该基线记为已接受，不是本plan-agent重跑所得。build优先复用主线程快照，报告记录其实际路径，不重复全量survey。主线程继续负责测试可扩展面及验收风险复核，build-agent负责实现和新增证据。
- 性能报告已验收一次场景发现、每帧已追踪障碍检查、共享正负查询；实际bounds冷连通图约291ms仍是已记录风险，不能以热查询或Node耗时宣称游戏FPS恢复。

## 禁做项

- 本轮规划仅写本计划和对应OpenSpec目录；不实施代码，不写bugs或执行会改旧报告的测试命令。
- build不改场景、prefab、meta、坐标、Inspector绑定、动画资源、碰撞矩阵或数值；不运行资源保存、refresh、reimport、post-scene-save或MCP gate。
- 不拆墙/其它建筑，不全局过滤Log障碍，不改城界或关闭入口规则；不靠传送、写坐标或无约束直线运动接近Log。
- 不把最近滚木、零速度、原目标附近任意可达格、经过固定帧数未移动当作充分阻路证据。
- 不逐敌逐帧全场查Log，不逐表面候选调用完整BFS，不增加无界缓存或精确移动起点键，不重做流场/寻路调度/通用目标系统。
- 不修改现有44测试的语义以让回归通过，不复制整套测试替身，不覆盖既有性能evidence或旧报告。
- 脏工作树多人并行：禁止checkout/reset/clean/stash覆盖现有改动；禁止把整文件HEAD版本当回滚基线。禁止独立第二个build-agent重做已完成项。

## 变更文件清单

以下是后续build的上限授权，不表示每个文件必须改。超出生产文件清单先记录原因并局部replan。

### 可写

- `assets/scripts/core/EnemyNavigation.ts`：已追踪Log身份、阻路判定、实际表面接近/命中查询、临时路线状态与缓存失效。
- `assets/scripts/core/FlowField.ts`：仅补充真实目标可达性/共享连通与表面集合查询所缺的小接口，复用现有图、快路径、预算和缓存；不重写算法。
- `assets/scripts/enemy/EnemyMinion.ts`：分离原目标与临时目标，移动/停步/攻击选择，生命周期清理。
- `assets/scripts/enemy/EnemyAI.ts`：复用冷却及帧结算通道，增加限定Log的单体攻击校验；保留玩家32/50及LOS规则。
- `assets/scripts/enemy/EnemyBoss.ts`：临时目标与原锁定目标分离，Log表面攻击及圆形攻击去重，保留普通索敌和生命周期约束。
- `.cursor/scripts/test-enemy-navigation.cjs`：只增加可选 `NAV_EVIDENCE_DIR` 输出目录支持，必要时最小扩展已导出harness；原44用例保持完整。
- `.cursor/plans/enemy-break-blocking-log.md`：逐项状态、证据和版本记录。
- `openspec/changes/enemy-break-blocking-log/**`：仅需求确有修订时同步增量，正常build只读。
- `bugs.md`：仅build全部机器验收通过后，检索已有同主题并补版本；一点一条，保留并行内容。本轮规划禁止写。

### 可新建

- `.cursor/scripts/test-enemy-break-blocking-log.cjs`：专用功能/生命周期/共享计数验收；通过 `NAV_HARNESS_ONLY=1` 导入现有loadTs/mock等，加载真实生产方法，不复制引擎替身。
- `.cursor/plans/reports/enemy-break-blocking-log-report.md`：唯一任务报告。
- `.cursor/plans/reports/enemy-break-blocking-log-evidence/**`：本任务基线哈希/增量diff、测试输出、计数和可选实玩证据；禁止写到旧slug目录。

### 仅只读参考

- `assets/scripts/item/Log.ts`、`assets/scripts/core/GameConfig.ts`、`assets/scripts/core/GameEvents.ts`、`assets/scripts/core/AnimUtil.ts`、`assets/scripts/core/AttackFrameRelay.ts`。
- `assets/scripts/enemy/EnemySpawner.ts`、`assets/scripts/building/BuildSystem.ts`、`assets/scripts/character/Player.ts`：既有分配/复活/事件/伤害规则。
- `assets/scenes/Main.scene`、`assets/resources/prefabs/character/enemy/pref_enemy_minion.prefab`、`assets/resources/prefabs/character/enemy/pref_enemy_boss.prefab`、`docs/SCENE_PLACEMENT.md`：读取真实入口/父变换/body绑定，测试输入禁止反写资源。
- `.cursor/scripts/bench-enemy-navigation.cjs`：默认写旧evidence，本任务不直接运行；选择专用测试直接计数验收，不扩展benchmark系统。
- `.cursor/plans/reports/fix-enemy-navigation-performance-report.md`及同名`-evidence/`、`.cursor/plans/reports/enemy-shared-flow-field-report.md`、`.cursor/plans/reports/fix-defense-combat-expand-report.md`。
- `openspec/changes/enemy-shared-flow-field/`、`openspec/changes/fix-defense-combat-expand/`、`openspec/changes/fix-log-initial-hero-select-pause/`及所有其它计划/增量。
- `.cursor/rules/`、`AI_TASK_LIST.md`、`defense3.md`、`openspec/config.yaml`及`openspec/schemas/defense3-lite/`。

## To-dos

- [x] EBL.a：规划调研及基线交接完成；主线程44测试通过；确认替代位置误判、入口拒绝接近、旧evidence写入风险。
- [x] EBL.b：单build-agent读计划/相关增量/现有报告/实际磁盘差异，记录当前HEAD、相关文件哈希和脏增量；识别并行修改所有权。扩展测试的独立输出目录后，将原44回归输出写到本slug；旧基准不动。
- [x] EBL.c：先新增针对当前缺口的失败用例，覆盖下方机器AC；复用harness并统一实际Log/导航/敌人加载身份。主线程已审查真实update/命中/恢复链与只读场景fixture。
- [x] EBL.d：最小补充共享阻路与表面查询，再接Minion/AI及Boss临时目标；保留原索敌和所有非Log障碍限制。
- [x] EBL.e：接攻击帧/冷却/代次清理及摧毁失效，跑真实方法联动与池复活反例；共享缓存做正负及体型隔离压力验证。
- [x] EBL.f：原44项正文未改且全通过，专用31项、tsc、OpenSpec strict、diff check和范围检查通过；主线程审查无新增阻塞。
- [x] EBL.g：全部机器AC通过后更新bugs单条记录、报告及done状态；Creator实玩与FPS未验证。

## 实施步骤

以下是范围与安全边界，不要求预先实现完整算法设计；build可选择满足AC的最小接口及数据结构，不添加通用规划框架。

1. 将“原目标真正可达”定义为能沿当前合法地面/入口到达原目标有效追踪或攻击集合。对玩家不得把隔Log的近邻格当可达，对原本就是结构的Boss目标应使用合法攻击表面，不能要求走入结构中心。先穷尽现有合法替代入口/绕行；距玩家很近但隔Log的早停分支也必须走这一判断。
2. 从导航已追踪collider维护固定且可攻击的Log候选身份。仅在原目标不可达时作限定因果查询：只在私有只读诊断视图忽略当前候选Log的碰撞几何，证明原目标可合法到达；其它Log及非Log障碍、bounds、地面和portal原样保留。该视图不可传给实际移动/最终sweep，不修改实时area或collider。现有关卡滚木场景不需要设计多障碍拆除顺序求解器。
3. Log接近走专用表面目标而非Log中心的普通入口状态机。由实际body/offset和Log AABB生成外侧根节点站位与对应表面点，从敌人当前可达连通区域筛选；最近点失败仍检查其它边/可达段。用真实area校验站位、接近线、入口跨越和最后sweep。开放中间入口被Log阻挡时仍允许停在敌人当前侧，不要求整条入口预先可通行。精确边缘/薄障碍用现有精确几何检查，不能只采中心格。
4. 分清站位距离、body到表面距离和攻击命中条件，避免把旧root到玩家中心的stopDistance叠加到Log站位而提早停步。Log伤害线只允许接触该Log表面，不豁免中间非Log障碍。既有普通玩家距离和Boss其它目标伤害规则不扩改。
5. 原目标留在原字段，临时Log另存；不要调用普通setTarget(Log)覆盖玩家，也不插入Boss普通优先级。临时处理期间保留有效原目标；失效/外部分配按既有规则处理并重查。恢复后回到原周期重选机制，不永久锁定也不每帧resetUnit。导航证明原路恢复后停止开启新的拆木攻击，已有攻击锁和恢复安全结束。
6. Minion复用EnemyAI冷却但明确捕获本次攻击目标/生命代次/攻击代次；帧回调再次验证Log状态和真实表面距离。Boss保留圆形候选结算，临时Log与现有列表去重，Log使用bossAttackDamage，小怪使用minionAttackDamage。范围外、目标变化、死亡/disable/destroy/reset后的回调不能命中；旧恢复和入池回调不能修改新生命。无Visual兜底也只结算一次。
7. 在现有服务/FlowField中共享判定结果：键区分实际几何版本、body及offset、起点连通区域、原目标条件及Log身份；角色影响的攻击距离等也须隔离。移动目标的精确终端条件不能被错误量化，必要时做廉价精确复核，不能随起点平移重建图。共享正/负结果、候选表面扫描，复用同一连通图，不给每个候选建目标BFS；临时诊断图使用独立身份并纳入既有容量约束。沿用32 entries/8MiB/最大cells限制，不新建无界旁路Map。实际地形变化、Log状态、入口变化及服务释放使相关缓存失效；unit release/reset清理所有临时引用。

## 校验点

所有下列机器项阻塞done；矩阵是测试覆盖和证据要求，不在计划重复行为Scenario正文。

| AC | 测试与判定证据 |
|---|---|
| AC-ENTRY | 专用测试真实EnemyNavigation + FlowField，三入口、地面及城界齐全；覆盖两侧关闭、中间端点被Log占据和端点空但跨线被Log挡住两种。小怪/Boss能得到向可达外表面的非零合法移动，最终进入可命中范围；不是只断言选到了Log。另读取Main.scene当前绑定/父变换形成只读入口几何fixture，记录来源；不将无portal简图当真实入口验收。 |
| AC-SAME | 城内同侧与城外同侧阻路；含原目标附近approach非null但原目标攻击集合不可达反例，必须触发正确分支。含距玩家中心已进入32/50范围但隔Log的Minion早停反例。 |
| AC-ALTERNATE | 原目标直达、同侧绕行、另一开放入口可用三类；均保持原目标，无临时拆木；不能仅验证一个选中入口不可达就拆。 |
| AC-NONLOG | 无Log、移除Log仍被非Log封闭、非法城界捷径、已关闭入口、缺失导航配置；全部无错误临时目标且无穿越/隔墙伤害。既有Boss正常攻击建筑不因此删除。 |
| AC-MOVING | 真实Log的rolling/charging/failed/非激活/不可攻击状态不进入拆除；原移动Log接触处理和最终sweep回归保留。 |
| AC-SURFACE | 长Log、正负body offset、不同body尺寸/旋转缩放、最近面不可达但另一面可达、接触epsilon及非Log贴边；断言实际站位无重叠、可达且可伤害。使用真实bodyForCollider而非swept AABB键；大dt和后处理也不穿透。 |
| AC-RESUME | 真实Log.takeDamage至摧毁，检查HP事件、collider禁用与后续导航移除；自身/他人摧毁两种均恢复有效原目标。原目标失效、外部分配、移动后绕路可达、旧临时路线释放均覆盖；Boss普通优先级/重选规则保留。 |
| AC-DAMAGE | 加载真实Minion+AI、Boss和Log方法，验证帧前零伤害、命中帧对应GameConfig伤害、冷却内不重复、小怪单体、Boss圆形候选Log去重、无Visual兜底、帧前Log失效或离开范围不扣血。不能仅mock takeDamage计次代替真实HP闭环。 |
| AC-POOL | 捕获旧hit/recovery/death回调，再依次死亡、disable、reset/复活及新攻击后重放；不得扣血、解锁新攻击或再入池。Minion与Boss均覆盖，原目标/临时目标/导航引用/冷却状态正确；已有Spawner池回归保留。 |
| AC-SHARED | 稳定版本同体型同连通区同目标200敌人、300帧，分正结果/无Log/非Log封闭负结果；预热后新增全场扫描=0、候选完整扫描=0、诊断图/BFS重建=0。每帧已追踪collider检查不乘敌人数；保留旧10障碍300帧=3000检查基线。冷查询构建数按body/版本/有界候选变化，不随200敌人数增长，报告精确计数而非只称缓存命中。 |
| AC-CACHE | 不同body/offset/可达区域不串结果，目标换格及同格终端条件改变正确复核；入口/Log移除及时失效，不变通知不推进版本。10000查询/1000版本、LRU及独立byte压力、release/reset/destroy后清理；包括诊断视图和正负缓存的总entries/bytes不超过既有预算。 |
| AC-REGRESSION | 原44测试全部通过，不删减/放宽断言；新专用测试全通过；tsc exit 0。原直达零图/零场、重叠零图/零BFS及移动body稳定缓存等计数保留。 |
| AC-SPEC | defense3-lite严格校验通过；只有proposal/specs及schema元数据，无design/tasks。 |
| AC-SCOPE | 对本任务起始脏基线检查增量、写集和旧evidence哈希；不要求工作树干净。并行差异只归因不恢复；scene/prefab/meta及只读源无本任务修改。git diff --check通过，外部既有失败独立记录处理。 |

### 验证命令与执行顺序

从 `C:/Users/Admin/Defense3` 执行；先落地测试输出目录支持，再运行以下原44回归。`NAV_EVIDENCE_DIR`是EBL.b要求新增的接口，目前尚不存在；不得先运行默认输出命令污染旧基准。

```powershell
$env:NAV_EVIDENCE_DIR = '.cursor/plans/reports/enemy-break-blocking-log-evidence'
node .cursor/scripts/test-enemy-navigation.cjs
node .cursor/scripts/test-enemy-break-blocking-log.cjs
npx tsc --noEmit --pretty false
openspec validate enemy-break-blocking-log --type change --strict --no-interactive
git diff --check
git status --short
Remove-Item Env:NAV_EVIDENCE_DIR
```

专用测试在导入harness期间设置并恢复 `NAV_HARNESS_ONLY=1`，不得对整轮测试保持该变量导致跳过原44项；报告记录确切通过数量、退出码和JSON证据路径。脚本输出目录以仓库根解析；新测试默认仅stdout或本任务evidence。旧benchmark不运行，使用AC-SHARED/CACHE直接计数；可记录冷/热耗时但不增加硬件依赖阈值。

### 手测与验收风险

- AC-PLAY：预览确认当前磁盘脚本已编译后复现中间入口+固定Log、小怪/Boss走近扣血摧毁恢复；观察碰撞和动画，不保存场景。默认非阻塞，缺少实玩必须明确记录。
- 主线程重点审核真实入口fixture、非null替代点反例、原目标是建筑的有效攻击集合、Boss既有主动Log目标与临时Log去重、同格目标移动及冷查询成本。机器测试必须有实际速度推进/表面命中闭环，单纯mock导航返回目标不可验收。
- 既有mock Log默认isAttackable=true且phase=idle，并非本行为证据；新增测试应加载真实Log必要方法，并统一cc/component类身份，不能由不同mock实例使getComponent失配而假通过。
- Cocos物理/动画运行时不是Node VM可完全证明的；保留性能报告关于旧编译缓存和冷图约291ms的限制，不将该历史风险转化为本轮大型调优任务。

## 回滚策略

- build写入前保存任务相关当前脏文件哈希及局部diff到本slug证据目录；回滚仅反向撤销本任务hunk，不恢复HEAD整文件，不清理未跟踪文件。
- 同一文件出现并行新增内容时先重新读取并归因；仅重叠到无法安全编辑才阻塞交接。缓存/攻击AC失败保留失败用例与证据，只修关联步骤。
- replan版本+1，保留EBL.a、已通过AC及产物；仅修失败步骤/缺失证据，必要时同步本change，禁止重做已接受性能优化。

## 修订记录

- v3（2026-09-10）：用户实测固定后仍停步。真实入口与小怪尺寸复现 `canReach=true / entranceUsable=false / blockingLog=null / velocity=0`：全图连通绕过了固定入口路线的要求。仅修复阻路查询与实际入口路线的一致性，保留 v2 已完成项。用户另已授权场景编译；允许通过可用 Creator 编译/预览接口验证最新产物，不修改场景结构、资源或坐标。
- [x] EBL.v3-route：共享可达性同时满足实际入口端点、开放/宽度、通道、方向及终点可达条件；过渡义务由单位独立记录，共享键区分侧别/阶段；已通过实际入口连续移动到攻击的回归。
- [x] EBL.v3-visual：固定滚木后处理由真实body导航约束，不再用128x128美术框截断；真实Visual尺寸的下侧接近回归通过，滚动/蓄力逻辑保留。
- [x] EBL.v3-test：原44项及专用39项通过，含本轮8项实际入口、Visual、逆向、过渡缓存及200单位300帧验证。新证据存 `enemy-break-blocking-log-evidence/v3/`，旧记录保留。
- [x] EBL.v3-gate：tsc、OpenSpec和diff检查通过；Creator官方CLI调试构建退出36，确认构建bundle含两处修复，浏览器成功加载Main且记录LOCK OK。完整双侧关闭后拆木实玩与持续FPS仍未验收，不以启动成功代替闭环。
- v2（2026-09-09，build局部修订）：主线程快照仅在tool store，已按本轮授权在任务evidence/baseline保存当前脏源码字节快照、manifest及dirty.diff；主线程基线仍接受。明确Boss普通锁定Log也共用表面路线，不改变priority；表面查询含接触、半攻击距离、攻击距离内三层有界站位。原AC不删减；首批21专用测试、44回归和tsc通过，剩余矩阵继续补齐。
- v2执行完成：31专用测试与44回归全通过，所有机器AC证据见本slug报告和evidence；本轮唯一build-agent，未执行旧benchmark、MCP或资源写入，未验证Creator实玩/FPS。
- v1（2026-09-09）：用户已采纳行为的初版；纳入主线程44测试/tsc基线及五核心脚本快照、harness复用、旧evidence保护和非null替代位置误判风险。规划阶段OpenSpec严格校验通过；无阻塞，未实施代码。

## 执行报告须含

- 版本、状态、是否续跑、起始脏基线及并行归因；每todo和每AC逐项证据，测试数量及退出码；新增共享计数/缓存上限、失败项、AC-PLAY未验证风险。
- MCP指标：scene-open=0，scene-save=0，refresh/reimport=0，create-prefab-from-node=0，新prefab=0；post-scene-save/资源gate=N/A。本任务纯脚本，无MCP装配流程。
- OpenSpec change路径、bugs最终更新位置（仅验收后）、回滚范围；不得声称已有游戏FPS恢复证据。
