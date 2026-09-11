---
slug: ten-step-player-guidance
版本: 2
状态: active
创建: 2026-09-11
---

# 十步玩家引导与金币不足时的敌人指引

## 业务目标

增加从第一次增长道具到左右最终箭塔的十步指引，使用用户指定的两张绿色箭头；购买目标资金不足时临时指向最近敌人，资金恢复后继续原目标。保留现有关卡和建造系统，仅补齐进度观察、目标选择与可见提示。

任务规模：中任务；走 Plan-Build。关联 `AI_TASK_LIST.md` 4.30 战斗引导的增量扩展，不重跑旧阶段任务。单个 build-agent 执行本计划到机器 AC 或硬阻塞；本次仅产出计划及规格，不实施脚本或 MCP 写入。

## OpenSpec 引用

- Change：`openspec/changes/ten-step-player-guidance/`
- 行为唯一真相为该 change；本计划只规定实现落点、装配和验证，不复制 Scenario 正文。

## 风险等级

中。v2仅替换未验收显示：GameRoot下两个世界箭头prefab，涉及世界渲染和Main.scene装配。当前仓库存在大量用户未提交修改；尤其 `Main.scene`、`BuildSystem.ts`、`Log.ts`、`HeroSelectUI.ts`，必须基于当前磁盘增量修改。

## v2续跑边界与已接受结果

- 保留 `GUIDE.a/b/c` 已完成，S1/S2业务契约和十步/付款/完成历史不重建；仅修订GUIDE.d–f及对应显示接线、配置和AC。
- 保留现有报告 `.cursor/plans/reports/ten-step-player-guidance-report.md`：v1 AC-SPEC、AC-TS、AC-GUIDE、AC-PAUSE-REGRESSION已通过；AC-SCOPE部分完成，MCP门禁未跑。这些历史结果不等于v2世界显示已验收。后续报告追加v2记录，不覆盖v1证据。
- 用户指定 `DirectionArrow`、`TargetArrow` 两世界prefab在GameRoot下，替换Canvas投影/屏幕边缘夹取。目标上下浮动15像素按项目约定解释为基准±15世界单位；方向箭头沿玩家到目标世界直线按GameConfig间距排布。
- 当前已有未跟踪的 `assets/resources/prefabs/VFX/DirectionArrow.prefab`、`TargetArrow.prefab`及meta，场景含 `GuideIndicatorSource`；来源未确认。检查创建记录和MCP资源结构，合格复用；来源无证据或结构不合格经MCP合法重建，不凭文件存在接受。

## 已核对现状与默认衔接方案（v1调查基线；完成状态见上节）

- `CombatGuideController.ts` 目前仅在 CombatGuide 阶段显示可选拾弓 marker；`SceneSetup._ensureCombatGuide()` 动态确保该系统组件存在。扩展现有跨对象引导系统，不再增加第二个业务主控。
- `LogExtendItem._consume()` 有一次性 `_consumed` 防重，增长发生在拾取动画回调；目前没有消费事件。滚木已有上限，不能拿“长度变大”推断第一次拾取。
- `Log.getPhase()` 能证明 `fixed` / `failed`；实际代码没有可订阅的 `LOG_FIXED` 常量。`PARKOUR_FINISHED` 在固定结果之前发出，不能单独作为成功证据。
- `BuildPlot` 私有 `_paidAmount` / `_isComplete`；完成事件提供 `buildType` 与稳定的 `plotRoot`，地块组件随后销毁。付款先更新已付金额再广播金币变化；保持该顺序。
- `BuildSystem` 两墙完成才开放初始塔，祭坛建成后还要选择并召唤英雄才开放拓展区。默认第4步嵌入左墙→右墙的前置子流程；第7步完成后等待英雄选择/召唤，拓展可买再继续第8步。不增加主步骤，不自动建墙，不改解锁条件。
- “金币不够”默认指**当前实际可购买目标的剩余费用**。第1–3步免费；等待锁定目标开放期间不采用后续地块价格。前置墙按当前那面墙计算。
- `HeroSelectUI` 使用 `director.pause()`；世界 update 停止后普通 lateUpdate 不能负责隐藏旧箭头。世界显示组件须使用暂停期间仍执行的渲染回调清理可见状态，不能调用 resume 或接管暂停所有权。
- 两张用户指定素材已在仓库并已目视确认：`指向箭头-指向.png`，128×196，原始朝左；`箭头-目标.png`，91×95，原始朝下。直接复用，不生成新图片。
- `docs/SCENE_PLACEMENT.md` 当前仅“继续”，不能作为完整关卡布局依据。补充本任务挂点与引用表即可；以当前场景 MCP query 的稳定路径/实际组件为最终依据，不重建整份关卡文档。
- v2不再创建合并UI引导prefab；仅使用用户指定两个世界箭头资源。现有 PhaseTransition 显隐与规则的历史差异、其他未归档改动不归本任务修复。

## 禁做项

- 不新增或重建玩家、滚木、弓、增长道具、敌人、建筑、地块、摇杆、英雄选择或结算 prefab；不移动已有玩法节点、调整费用/掉落/攻击/移动/固定门槛。
- 不修改建造解锁链，不增加强制输入锁、自动操作、金币补偿、自动刷怪、英雄默认选择。
- 不拆分 `Player.ts` / `Log.ts` 主脚本职责；不再新增 `*GuideController.ts` 与现有系统争用同一目标。
- 不直接读其他组件的私有字段，不用残存建筑实例推断永久完成记录，不用地块 active / 销毁代替完成事件。
- 静态显示挂点/两个基础箭头实例须MCP预摆GameRoot下，禁止运行时生成静态关卡布局。随目标距离变化的额外DirectionArrow属于用户要求的动态引导效果，可由绑定prefab运行时instantiate并复用池，不每帧创建/销毁。
- 不手写/整文件生成 `.prefab` 或 `Main.scene`；不改 `.meta` uuid、不复制其他项目资源，不直接使用 `assets-create-asset-by-type` 创建 Sprite/Label/Button prefab。
- 两个世界prefab不得含Canvas/Camera/Widget/BlockInputEvents或输入监听，不挂UI/Canvas；不使用convertToUINode、Canvas尺寸/边缘夹取，不用default_sprite占位。不改全局相机投影、SortingOrder2D或Billboard实现。
- 不修改 `PhaseTransition.ts`、`HeroSelectUI.ts` 的阶段/暂停机制，不顺手修复现有寻路、显隐、伤害等历史问题。
- 不实现跨局存档、首次玩家标记或原地重开系统；新局验证采用重新加载 Main.scene。同局引导停用/启用不能重复创建资源或清空已接受进度。
- 不覆盖现有用户未提交改动；不以 git reset/checkout 整文件恢复共享文件，不提交、归档或执行其他计划。
- 不并行执行 refresh 与 reimport；不每个节点/每个步骤反复 save+gate；MCP 错绑/不可用不降级手写资源。

## 变更文件清单

### 可写（build 阶段）

| 文件 | 本次允许内容 |
| --- | --- |
| `assets/scripts/game/CombatGuideController.ts` | 已完成；v2仅必要世界显示目标/组件适配，不重写十步业务 |
| `assets/scripts/game/SceneSetup.ts` | v2解析GameRoot下显示系统和两个世界资源，保留原初始化顺序 |
| `assets/scripts/core/GameEvents.ts` | 追加增长道具成功消费事件，保留全部既有名称与签名 |
| `assets/scripts/core/GameConfig.ts` | 集中刷新周期、浮点比较容差、世界箭头尺寸/间距/池上限/浮动/原图方向参数；删除已无引用的UI安全边距 |
| `assets/scripts/item/LogExtendItem.ts` | 暴露只读消费状态，并在一次成功接受消费处广播事件；不改变物理、半径、动画和增长行为 |
| `assets/scripts/building/BuildPlot.ts` | 新增只读剩余费用与完成状态查询；不改变原有分批扣款与事件先后 |
| `assets/scripts/building/BuildSystem.ts` | 最小增量记录按 plotRoot 标识的已完成历史，提供引导初始化/恢复需要的只读快照；不改原业务分支 |
| `assets/scripts/ui/GuideIndicatorUI.ts` | 已存在；v2原位改世界显示/池，保留类名及meta身份，不再做UI投影 |
| `assets/resources/prefabs/VFX/DirectionArrow.prefab`、`TargetArrow.prefab` | MCP核验来源/结构后复用、修正或重建；其他VFX只读 |
| `assets/scenes/Main.scene` | MCP装配GameRoot下显示挂点和两个基础实例/引用，核实后清理仅本任务旧UI源树；不动其他布局 |
| `docs/SCENE_PLACEMENT.md` | 追加本任务世界层级、尺寸、可见图层、阶段职责、引用表；不覆盖现有内容 |
| `.cursor/plans/ten-step-player-guidance.md` | 状态、todo 勾选、AC与修订记录 |

### 可新建

| 文件 | 内容 |
| --- | --- |
| 上述两个世界prefab缺失时 | 用用户指定现有名称，经MCP create-prefab-from-node创建，不另建合并UI prefab |
| `.cursor/scripts/test-ten-step-player-guidance.cjs` | 运行真实TS模块的状态/适配集成回归；参考已有 VM+TypeScript 测试方式 |
| `.cursor/plans/reports/ten-step-player-guidance-report.md` | 续跑记录、测试结果、门禁输出、MCP指标与手测证据 |
| 新脚本/prefab 对应 `.meta` | 仅由 Cocos 导入自动生成；禁止手写 UUID |

本轮规划独占写入的文件仅本计划和 `openspec/changes/ten-step-player-guidance/**`；build 如需行为变更先 replan，同步该 change，不直接扩规格后实现。

### 仅只读参考

- `AGENTS.md`、`.codex/agents/plan-agent.toml`、`.cursor/rules/{multi-agent-orchestrator,defense3-workflow,cocos-mcp,openspec}.mdc`、`.cursor/plans/_TEMPLATE.md`、`AI_TASK_LIST.md`、`defense3.md`、`bugs.md`。
- `assets/scripts/{item/Log,item/BowItem,character/Player,enemy/EnemyMinion,enemy/EnemyBoss,game/GameManager,game/GamePhase,game/CoinSystem,game/PhaseTransition,game/CombatSystem,ui/HeroSelectUI,ui/HpBarUI,ui/JoystickHintUI}.ts`。
- `assets/resources/sprite/UI/指向箭头-指向.png`、`assets/resources/sprite/UI/箭头-目标.png` 及其 `.meta`；所有其他既有 prefab/贴图/动画。
- `.cursor/scripts/{verify-mcp-gate,post-scene-save}.ps1`、`.cursor/scripts/test-log-hero-select-pause.cjs`、`package.json`、`tsconfig.json`。
- `openspec/config.yaml`、`openspec/schemas/defense3-lite/**`、现有 `openspec/specs/**`（当前无已归档能力）以及未归档的 `fix-log-one-sided-lock`、`fix-log-initial-hero-select-pause`、`fix-defense-combat-expand` 等相关变化。不得改写它们。

## To-dos

- [x] `GUIDE.a`：批判性读取本计划、已有报告、当前 git/磁盘状态与相关规格；保存本任务前差异清单/共享可写文件副本；只核对以下绑定表的现场缺口，确认 Defense3 MCP。
- [x] `GUIDE.b`：补最小只读状态与增长道具消费事件，定义目标快照/完成历史；编写边界测试驱动后续实现。
- [x] `GUIDE.c`：原位扩展引导主控，接入 SceneSetup 幂等初始化，完成十步/前提/资金/生命周期；使行为回归通过。
- [x] `GUIDE.d`：从阻塞点续跑；核验两个世界prefab/GuideIndicatorSource来源，改世界直线箭头池/目标浮动；MCP装配GameRoot、清理本任务旧UI树并补放置表。
- [ ] `GUIDE.e`：保留v1通过记录；针对v2显示改动复验类型/引导测试与规格；一次save→close→post-scene→必要reimport→reopen→任务级门禁。
- [ ] `GUIDE.f`：既有报告追加v2结果/MCP指标，保留v1历史；补世界显示手测或记待用户，机器AC通过后更新状态。

## 实施步骤

### S1. 进度数据和初始化

1. 保留 `SceneSetup._ensureCombatGuide` 的单实例保障；组件 `onLoad` 注册事件，`start` 在全部 onLoad 后同步实际初始阶段。不得依赖 `setPhase(RunParkour)` 一定触发事件，当前初始值相同会被忽略。
2. 主控持有 `stepId`、第四步前置子状态、已完成集合、当前实际行动目标、临时敌人覆盖模式。业务步骤不使用 GamePhase 枚举替代；GamePhase 只做生命周期和可用性输入。提供最小只读诊断快照供测试，不每帧刷日志。
3. 增长道具事件在 `_consumed` 从 false 转 true 的成功消费入口触发一次，携带道具、受益滚木身份；主控过滤为当前玩家关联滚木。动画完成/长度上限不影响计数。只读 `isConsumed` 排除仍在飞行但已消费的目标。
4. 第二步检查现有滚木 `getPhase()`，成功状态一旦接受保存本局记录；不要新增或假设已经存在 `LOG_FIXED`。保持 Log.ts 只读，不干扰未提交的固定点与单侧裁切工作。
5. `BuildSystem` 按已有 `BUILD_COMPLETE.plotRoot` 保存单局完成记录及只读查询；首次查询/启用时同步该历史，主控持续保存稳定身份，不以数组下标、当前建筑血量、地块存活状态替代。事件同时验证目标类型和目标挂点；地块真实完成后即生效，无须等建筑异步资源加载。
6. `BuildPlot` 剩余费用接口基于自己的总费用/已付款，限制为非负；同次决策读取余额和已付快照，允许 `GameConfig` 小数容差。完成事件优先推进，再为新目标做余额判断，防止最后一笔款导致回指敌人。
7. 同局停用期间保留进度，不重复订阅；恢复从系统只读状态核对。销毁解除所有全局/渲染回调。新 Main.scene 实例建立新单局记录；不依赖 NextLevel 按钮占位回调。

### S2. 目标解析与固定映射

世界目标使用运行时对象引用，按稳定路径解析一次并校验；非空跨对象引用经 MCP/SceneSetup 注入。下面是已读当前场景的映射，不是新坐标放置任务。

| 目标 | 当前场景定位/数据 | 实现用途 |
| --- | --- | --- |
| 玩家、滚木 | 复用 `SceneSetup.player/log` | 玩家世界XY为所有最近距离原点；不修改物理/位置 |
| 增长道具 | `GameRoot/World/ParkourContent/LogExtendItemRoot` 下有效 `LogExtendItem` | 可低频重建候选集合，使用世界XY距离平方排序 |
| 固定点 | `GameRoot/World/BuildPlots/LogFixPoint`，当前局部(0,1632.019,0) | 第二步目标；只是读取，不重定位该点 |
| 弓道具 | 在当前场景解析 `BowItem` 组件对应的 `pref_item_bow` 实例 | 使用实体组件，不假定实例名与资源名一致；完成以 `Player.hasBow` 为准 |
| 左/右前置墙 | `GameRoot/World/BuildPlots/Plot_Wall_L` / `Plot_Wall_R` | 第4步子目标，左未完成优先 |
| 左初始箭塔 | `GameRoot/World/BuildPlots/Plot_Tower_1`，当前X=-182.868 | 固定左侧身份，不因玩家/镜头位置变化交换 |
| 右初始箭塔 | `GameRoot/World/BuildPlots/Plot_Tower_2`，当前X=183.226 | 固定右侧身份 |
| 兵营/祭坛/拓展 | 同一 BuildPlots 下 `Plot_Barracks` / `Plot_HeroShrine` / `Plot_Expand` | 查询该挂点实际可用地块与系统完成历史 |
| 左/右最终箭塔 | 同一 BuildPlots 下 `Plot_TowerAdvanced_L` / `Plot_TowerAdvanced_R`，当前X=-178.328 / 188.91 | 固定左右身份；完成后不重购 |
| 敌人 | 当前场景中 `EnemyMinion` 与 `EnemyBoss` | 合并候选后过滤 valid/activeInHierarchy/isDead；不复用 CombatSystem 的 Boss 优先和攻击范围策略 |
| 世界相机/显示根 | Main根下Camera与GameRoot | 查询现有世界相机visibility/世界Sprite图层；UI/Canvas不是显示父节点 |

候选重选默认每0.15秒（写入 GameConfig），状态事件立即标脏并在下一安全决策点处理；已绑定目标的世界位置每帧更新。无敌人时继续低频刷新，允许新生成敌人进入集合。禁止每帧全场景深遍历；同距使用稳定身份排序，避免闪动。缺必需静态目标只打印一次诊断并保持待处理，不创建替代物、不按坐标臆造节点。

### S3. 世界呈现与MCP装配（v2仅替换未完成显示步骤）

保留 `GuideIndicatorUI.ts` 文件/类名及meta以免迁移，职责改为纯世界显示适配。MCP预摆 `GameRoot/GuideIndicator`（空节点+显示组件）、`GameRoot/DirectionArrow` 与 `GameRoot/TargetArrow`（两个独立prefab基础实例）。用户称小箭头为 `guideWire`（复用DirectionArrow prefab）、终点大箭头为 `bigArrow`（复用TargetArrow prefab）；均是当前指引的世界效果对象。运行时额外guideWire也挂GameRoot，不把显示节点重挂到BuildPlot下，不保留旧Canvas显示副本。

| 资源/节点 | 世界结构与配置 |
| --- | --- |
| `DirectionArrow.prefab` | 用户指定现有名字；Root→Visual，Visual用指定朝左贴图，RAW128×196、默认scale0.35；世界方向旋转校正原始朝左基向量 |
| `TargetArrow.prefab` | 用户指定现有名字；Root→Visual，Visual用指定朝下贴图，RAW91×95、默认scale0.5；根定位目标，Visual偏移/浮动 |
| GameRoot显示组件 | 绑定两个基础实例、DirectionArrow prefab、必要世界引用；不带Sprite/触摸拦截，保持暂停恢复检测 |
| 世界层/排序 | MCP核对已正常渲染世界Sprite及主相机visibility，使用对应世界可见层；按当前已接入SortingOrder2D装配，只对箭头配置必要offset，不改全局排序/Billboard，不套用Canvas配置 |

1. **目标点**：建造目标使用实际有效 `BuildPlot.node.worldPosition`，不能用可能带偏移的Plot父节点替代；其他目标用自身真实世界位置。Target根随该点移动，Direction链也使用同一目标点。BuildPlot失效/销毁即隐藏旧显示并交给既有目标刷新/完成逻辑。
2. **方向链guideWire**：先用玩家与目标世界坐标相减求世界XY向量，`atan2(dy, dx)`求角度，并对朝左原图作旋转校正，使所有小箭头朝目标；用GameConfig已有起距64、间距72、上限8摆放多个guideWire。短距离限制起点不越目标，零距离隐藏方向链而保留有效bigArrow，防止NaN/重叠。用setWorldPosition，避免GameRoot变换造成局部/世界混淆，不投影到UI计算角度。
3. **实例与池**：基础guideWire与终点bigArrow由MCP预摆对应prefab实例，首个有效目标出现即把bigArrow定位在终点并激活复用；额外guideWire从绑定DirectionArrow prefab运行时instantiate，只在需求增大时扩池，减少时隐藏并复用，不克隆来源未核实的旧UI源节点。不每帧instantiate，不为每次换目标重建bigArrow；销毁显示系统时清理本任务额外实例。
4. **终点bigArrow浮动**：Target根跟随实际目标，Visual以GameConfig目标偏移52为基准，以 `sin` 随运行时间产生Y方向±15世界单位（峰峰30）的循环，周期0.75秒；只修改bigArrow显示对象，不动BuildPlot。累积未暂停dt，恢复不补算暂停时长。
5. **暂停与失效**：保留EVENT_BEFORE_DRAW检测director.isPaused并隐藏整组，回调不推进浮动时间；world update暂停仍能隐藏。恢复重新评估；死亡/失败/结束/无效目标走已完成的生命周期，不被迟到事件唤醒。镜头移动不改变世界锚点，屏外自然裁剪，无边缘UI标记。
6. **渲染**：世界Sprite可带UITransform作为尺寸组件，但不能因此挂Canvas。验证世界相机可见、正确贴图、方向不被Billboard覆盖、排序可读。只调箭头本身层/排序/Visual参数；当前SortingOrder2D及相关未归档修改不得在此任务重写。

须MCP落盘/绑定：两个合法资源及贴图，GameRoot显示挂点/基础实例，DirectionArrow prefab引用和不可空跨对象引用。可空Visual/组件及SceneSetup已有系统引用优先 `_resolveRefs`。

MCP任务级顺序：

1. 从GUIDE.d续跑，读取报告与新增差异，仅检查两个目标资源/源树/显示挂点；assets-query-path核对Defense3。先查MCP调用记录是否证明create-prefab-from-node，再assets-query-asset-info、scene-open及组件查询验证Root→Visual/贴图/无Canvas/Camera/Missing。结构inspect不能单独证明创建来源。
2. 来源与结构合格则复用；不合格或无创建证据，保存任务局部资产/引用基线后用MCP场景Empty根→scene-create-node-by-type搭世界树→组件/尺寸/贴图→**create-prefab-from-node**合法重建，再MCP定向更新仅本任务引用；不手写JSON/meta。沿用用户指定DirectionArrow/TargetArrow名字，不为旧命名模板擅自改名，UUID由编辑器维护。
3. 同一次Main编辑会话幂等装配GameRoot三静态节点和两prefab基础实例、批量绑定；核实GuideIndicatorSource确为v1临时树后MCP仅删除该树/本任务旧UI引用，不删其他UI。不得同时保留两套有效引导。
4. 全部完成后一次scene-save→scene-close→post-scene-save.ps1；Patched=1才串行reimport→reopen，不复用旧Comp.*；refresh/reimport不得并行。
5. 两资源AC-P3，Main及两资源AC-EDITOR-MCP；新建/重建/改关键绑定做AC-P3b，补丁/reimport才AC-S2；任务末一次完整AC-GATE。工具失败最多重试2次，仍失败报告硬阻塞并保留a–c，不全量重扫重建。

## 校验点

### 机器AC（build必跑）

- [AC-SPEC] `openspec validate ten-step-player-guidance --type change --strict --no-interactive` 退出0；`openspec status --change ten-step-player-guidance --schema defense3-lite --json` 显示 proposal/specs 完整。
- [AC-TS] `npx --no-install tsc --noEmit` 退出0；本地已有 `node_modules/typescript` 与 `temp/tsconfig.cocos.json`。先记录未修改基线，若现有错误阻碍通过，不扩大范围修复；报告区分既有/新增问题并走硬阻塞或定向replan，不写假通过。
- [AC-GUIDE] `node .cursor/scripts/test-ten-step-player-guidance.cjs` 退出0。加载真实TS模块及Cocos最小替身，不只做源码字符串匹配或镜像实现。覆盖规格的十步与生命周期，以及如下高风险交互矩阵。
- [AC-PAUSE-REGRESSION] `node .cursor/scripts/test-log-hero-select-pause.cjs` 退出0，确认新引导不破坏现有选择弹窗暂停/恢复流程。
- [AC-SCOPE] `git diff --check` 无本任务新增空白错误；`git diff --stat` 和未跟踪清单对照白名单，证明旧资源/价格/解锁分支/输入控制没有本任务改动。共享文件必须与任务前保存副本比对，不能只与HEAD比。

行为测试矩阵只列覆盖点，具体预期以 OpenSpec change 为准：

| 测试组 | 必测数据/事件 |
| --- | --- |
| 启动/拾取 | 初始阶段通知缺失；双通道重复拾取；玩家/推动滚木消费；满长度消费；长度变化无拾取；消费后动画未结束；无道具；未拾取已固定 |
| 固定/弓 | PARKOUR_FINISHED早于结果；fixed/failed；预先持弓；无有效弓；固定点缺失 |
| 顺序/历史 | 完整十步+两墙子流程；右塔提前完成；重复BUILD_COMPLETE；同类型其他plotRoot；地块销毁；已建建筑后来死亡；恢复查询完成历史 |
| 金币 | 免费且余额0；前置墙/七个付费主目标；部分支付；等于remaining；小数容差；扣款事件重入；敌人死亡但金币未到账；其他目标花钱导致再缺钱；临时分支中当前目标完成 |
| 最近/空集 | 不同父节点的世界XY距离；Boss与小怪混合；距离同值；目标死亡/隐藏/销毁；新敌人生成；无敌人后钱够；玩家移动导致最近对象改变 |
| 生命周期 | 选英雄等待与暂停时不执行world update仍隐藏；恢复；输/赢/玩家死/Log失败；迟到事件；同局disable/enable；新场景释放回调并重置 |
| 世界显示（v2，保留其余已通过业务覆盖） | 世界四向旋转；实际BuildPlot子节点偏移；±15浮动/暂停计时；间距/上限/池增减复用；零/短距离不越目标；GameRoot父变换；镜头移动不改锚点；无UI投影/夹取；失效/结束隐藏 |

### MCP（改过 prefab/scene 时，任务末一次）

- [AC-GATE] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` 退出0，报告粘贴完整输出；不另写rg重跑内含的S1/P1/P2。
- [AC-P3] 对DirectionArrow.prefab、TargetArrow.prefab分别执行MCP `assets-query-asset-info`，`invalid: false`。
- [AC-EDITOR-MCP] MCP分别打开Main.scene和两个世界prefab，查询本次打开后的错误日志，无关联红错/Missing Script；保留查询结果与时间范围。
- [AC-P3b] 新建/重建/改关键绑定时：两个Visual/SpriteFrame有效，无Canvas/Camera；Main中显示系统唯一，两基础实例在GameRoot下，方向prefab引用和世界可见层正确。分别记录合法创建证据，结构inspect不可冒充来源证明。
- [AC-S2] 仅做过 post-scene ID补丁/reimport时，reopen后抽查相关根/新实例 nodeId，不能为 `Node.<数字>`。

### 不阻塞done的玩法证据

- [AC-PLAY] 对照 OpenSpec change 完整跑十步含前置墙；在墙/塔/拓展处试低金币→最近敌人→金币恢复；检查正常建成和提前建右塔两条路线。
- [AC-PLAY-WORLD] 实际摇杆下检查GameRoot方向箭头链、实际BuildPlot上的目标箭头和±15浮动；记录正常/金币不足/弹窗暂停/镜头移动证据，检查间距/旋转/池复用，屏外自然裁剪且无UI边缘副本。
- [AC-PLAY-RESET] 重新加载Main，检查首步重置和无重复世界箭头；GameOver/固定失败不残留指引。
- 无法取得真人玩法证据可写“待用户”，不伪造通过；本计划不把AC-PLAY升级为done阻塞项。机器AC失败依工作流必须阻塞。

## 回滚策略

- GUIDE.a将当前共享文件和diff基线保留在本机临时目录/报告引用，记录已有修改，不以HEAD当作用户基线。
- 代码失败只撤销本任务新增函数/字段/事件订阅与对应调用；`BuildSystem`的用户现有解锁、扩展显隐修改全部保留。
- v2只撤销本次世界显示适配和MCP定向装配，不撤销a–c；对待核实资源先保存局部基线/引用记录，编辑器定向恢复/重绑本任务引用，不手写meta。GuideIndicatorSource来源确认后才清理，其他UI不重建。
- Main.scene恢复通过MCP定向撤销本次实例/绑定后遵循同一save/post-scene链；严禁整文件覆盖掉任务开始后的其他改动。
- 验证失败保留已完成todo与报告；replan仅修失败步骤和AC、版本加一，同步相关OpenSpec delta。再次build从首个未完成项继续，不重建已验收prefab。

## 修订记录

- v2（2026-09-11）：用户改为GameRoot下两个世界prefab，定向替换GUIDE.d–f；保留a–c及v1已通过AC/报告。新增实际BuildPlot定位、±15世界浮动、等间距方向箭头池、来源核验/MCP必要重建及世界显示AC。

- v1（2026-09-11）：初稿；明确十步、双墙前置/英雄选择衔接、余额按剩余费用、用户指定两张箭头和单UI资源方案。未实施代码或场景。

---

## 执行报告须含（build-agent）

记录实际可写文件与基线、已完成todo、AC输出/命令退出码、阻塞和手测缺口。规格校验通过只表示规划文档有效，不能作为玩法已实现证据。

### MCP 指标

| 指标 | 次数/值 |
| --- | --- |
| scene-open | 待填写 |
| scene-save | 待填写（目标1次最终保存） |
| verify-mcp-gate | 待填写（目标1次完整门禁） |
| post-scene-save Patched | 待填写0/1 |
| assets-reimport-asset | 待填写 |
| 本任务新建/复用/重建prefab数 | 待填写（目标资源2，逐项记来源和处置） |
| 是否续跑 | yes，保留a–c，从d继续 |
| OpenSpec change | openspec/changes/ten-step-player-guidance/ |
| 已接受AC / 首个未完成todo | 待填写 |
