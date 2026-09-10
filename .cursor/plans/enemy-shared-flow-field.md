---
slug: enemy-shared-flow-field
版本: 3
状态: done
创建: 2026-09-09
---

# 小怪与 Boss 共享流场寻路

## 业务目标
接入城外寻找可达楼梯、固定楼梯通道、城内直通优先的共享流场和局部避让。共三个楼梯，2号常开，1/3号由对应墙建造完成关闭。Boss 保留原索敌优先级和重选规则。保留场景、美术、攻击伤害及英雄/士兵行为。

## OpenSpec 引用
- `openspec/changes/enemy-shared-flow-field/`
- 未归档 `openspec/changes/shared-path-agent/` 的敌人追踪语义由本次规格取代；英雄和士兵部分不变。当前 `openspec/specs/` 没有已归档基线，不修改历史 change。

## 风险等级
中高：入口缺少明确标记；体型、物理速度、攻击分离和动态障碍必须一致。

## 已有证据
- `EnemySpawner` 目前轮询 Far/Left/Right 的根和子刷怪点；死亡回调在原点重生，且闲置对象可先被池复用，需要一并避免重复复活/重复计数。
- `Main.scene` 有 `SpawnPoint_Far/F0/F1`、`Left/L0/L1`、`Right/R0/R1`，没有明确命名的楼梯内外节点；这些刷怪根均激活，不能用 active 代表区域开放，也不能认定 F0/F1 是楼梯端点。
- `EnemyBoss` 目前先向 `GameRoot/point` 集结，然后按 soldier/structure/hero/player 优先级追踪，使用独立 `PathAgent`；`update` 未以 `_isAttacking` 阻断移动。
- `EnemyMinion` 使用局部试探，玩家分离半径 48，并以 `max(attackRange, separation + 8)` 扩大攻击距离。只把距离改成 32 会导致无法近身。
- `AirWallAabb.collectAirWalls` 只收集名为 airWall 的碰撞体，无法代表新建建筑；`bodySize` 使用局部 collider.size，体型需考虑世界缩放和 offset。
- `BuildSystem._onHeroSpawned` 显示拓展地块；`_onExpandComplete` 才完成拓展。二者不可混作区域开放时刻。
- 参考 `CaseFlowField.ts` 提供 BFS、八向下降、20 格前瞻；其固定边界、30 单位格与外部 Point 依赖不可照搬。
- `bugs.md` 已有 `fix-path-agent-frame-drop`、`fix-boss-path-steer` 等同主题条目，成功后按对应主题升版。

## 禁做项
- 不修改任何 scene、prefab、meta，不移动/重命名资源，不生成静态布局，不回滚已有脏修改。
- 不给每只敌人建立 A* 或私有流场；不改变 Hero/Soldier 的 PathAgent 和索敌行为。
- 不恢复 LOG_FIXED 或以 PARKOUR_FINISHED 阻塞刷怪；不改刷怪间隔、伤害、血条、美术和旋转。
- 不硬编码参考工程坐标；不将未知楼梯位置猜成现有子刷怪点。

## 变更文件清单
- 【可写】`assets/scripts/enemy/EnemySpawner.ts`：入口配置、开放状态、随机选择、复活路线与池生命周期。
- 【可写】`assets/scripts/enemy/EnemyMinion.ts`：入口/追踪/攻击状态和最终移动。
- 【可写】`assets/scripts/enemy/EnemyAI.ts`：玩家攻击目标和帧命中一致性，移除新模式下 Barrier 抢先出手。
- 【可写】`assets/scripts/enemy/EnemyBoss.ts`：入口选择、当前目标追踪、攻击停移；保留现有索敌优先级、重选规则和圆形攻击伤害逻辑。
- 【可写】`assets/scripts/building/BuildSystem.ts`：墙建造完成关闭绑定入口；建造实际落地、拓展实际完成及隐藏障碍后通知地图失效。扩地不自动打开楼梯。
- 【可写】`assets/scripts/core/GameConfig.ts`：20 单位网格、20 格前瞻、32/50 迟滞和避让/安全步长配置。
- 【可写】`assets/scripts/core/GameEvents.ts`：如跨模块需要，新增导航障碍/入口状态变动事件，保留 Boss 优先级注释。
- 【可写】`bugs.md`：验证后按用户五点分别检索主题、升版或新增现象/原因/解决，不提前记录成功。
- 【可新建】`assets/scripts/core/FlowField.ts`：不依赖 cc 的网格、几何、BFS/缓存核心，可独立测试。
- 【可新建】`assets/scripts/core/EnemyNavigation.ts`：按 scene 持有的共享导航服务，入口状态、障碍快照、空间桶及移动约束。非对象 Controller，无需新增场景挂载。
- 【可新建】`.cursor/scripts/test-enemy-navigation.cjs`：使用已有 TypeScript 编译能力和 Node assert 的纯逻辑测试，无新增依赖。
- 【可写】本计划、对应 OpenSpec change；【可新建】`.cursor/plans/reports/enemy-shared-flow-field-report.md`。
- 【只读】`Main.scene`、角色/建筑 prefab、`BossSpawner.ts`、`PathAgent.ts`、`AirWallAabb.ts`、`AnimUtil.ts`、`CombatSystem.ts`、`Barrier.ts`、`Wall.ts`、`Tower.ts`、`Log.ts`、现有 specs/change、参考 `CaseFlowField.ts`。

## 实施设计
1. 在现有 EnemySpawner 暴露入口列表，每项包含入口ID(1/2/3)、Outside/Inside Node、通道宽度、可选生成点及关闭入口的建墙地块Node。推荐空节点树 `NavigationMarkers/Stairs_1/Outside,Inside`，另两个楼梯同样设置，无需碰撞体或脚本；可选 SpawnPoint 仅用于需要在楼梯外出生的配置，已有远端刷怪点继续可用。1/3绑定各自建墙地块，2常开且不绑定关闭地块。名称仅辅助查找，引用为准；不能绑定同一个pref_wall资源来区分两堵墙。
2. 墙未建成时1/2/3开放；对应墙 BUILD_COMPLETE 的 plotRoot 与入口关闭地块匹配，并在墙实际落地后关闭1或3，2不受影响。加载/导航晚初始化时从现有建造状态同步，不能错过先发生的事件。不把地块隐藏或墙节点active当作建成判据，不自动新增拆墙重开规则。取消旧的扩地解锁楼梯及最新解锁区域优先规则。入口和障碍同一轮更新，未入城怪重新选择可达开放入口，已入城怪不退回。楼梯中途关闭时不传送、不穿墙，依据当前合法侧及碰撞约束恢复或停止。
3. 以实际出生/当前位置判断城内外。城外先筛选同体型可达开放楼梯，普通怪随机选择，Boss沿用先前备用入口策略在可达候选中选距玩家最近入口；目标同侧时Boss直接按原索敌追踪，不强制进城。跨区时先到 Outside（能直走则直走，否则共享以Outside为目标的城外流场），再沿固定楼梯通道到 Inside，随后转城内目标流场。城外场也按体型/入口/障碍版本共享，不每怪A*。不瞬移预置或已出生的敌人到入口。已在城内的单位直接追踪；Boss目标在城外时反向通过合法楼梯。保留原激活时机，替换旧rally路线。池重生回调用世代/待复活状态校验，重置路点、攻击锁及邻居注册。
4. 格网使用世界 XY、固定边界和20单位格；按世界体型（含 collider offset/scale）分组复用。障碍取有效边界与实际阻挡的墙/建筑/固定滚木，不包含单位、UI、拾取 trigger、可行走地面。物理 sensor 但逻辑阻挡的建筑仍纳入。以体型膨胀障碍，直线检测、栅格和最终碰撞共用几何。
   城内分类独立配置 `CastleArea` 有序空节点多边形（至少3点，矩形4点，不自交），取世界XY及角色逻辑根位置，不按屏幕高度或Visual位置判断。入口Outside必须在城外侧，Inside必须在城内侧，两点间通道宽度须容纳体型。NavBounds用Min/Max空节点约束全地图计算范围，另以可走地面范围与障碍限定可达性，不能把城内多边形外全部视为可走。城内边界是区域分类而非物理墙；跨区许可只来自三条合法楼梯通道，直接视线、前瞻、避让和最终移动全部执行相同跨区检查。楼梯中保持过渡状态，不能仅因穿过多边形边缘就提前跳过Inside。扩地后更新有效CastleArea/地面数据，但不自动开启1/3。
5. 使用整数数组四邻 BFS，八邻选更小距离且校验斜邻两侧；同 scene/体型/目标格/障碍版本共用，小怪目标为玩家，Boss 目标由原索敌选择。Boss 与小怪目标不同时不得误用玩家距离场；按实际目标格共享、回收无使用者缓存，不能无限缓存历史目标或按每只敌人分配。每帧只更新一次服务与空间桶。目标格未变且障碍未变不重算；同格内位置变化仍实时影响直追方向。建筑实际创建后失效，注册障碍的销毁/禁用/变换在共享服务统一检测，避免每怪全场扫描。场景退出清理监听、缓存与注册。
6. 直线可达优先；否则沿 next 最多查看20格，选直线可达远点。目标落在阻挡格时找可达替代格但不穿墙，越界/无连通路径返回停止；障碍或目标变化后恢复。Int32 距离避免大地图溢出，不用无限扩张格网。
7. 局部空间桶仅搜索附近存活激活敌人，限幅排斥后归一化速度；重叠位置给稳定分离方向。最终通过扫掠/有限子步碰撞约束保证大 dt 不穿薄墙；只采用一个实际位移来源，避免刚体与 setWorldPosition 双倍积分。碰撞校正后才更新移动动画/朝向。
8. 小怪32单位进入攻击状态、超过50才离开；统一玩家分离以使32可达。迟滞带中停止追踪，实际攻击帧仍按32单位与无遮挡检查，不能把50变成伤害范围。新追踪不因 Barrier 优先攻击或旧 aggro 截断而停在建筑边。保留跑酷滚木阻挡约束。
9. Boss 保留近战士兵 > Structure(building/barrier/log，按建造序) > hero > player 的索敌、目标存活判断和原重选节奏；保留圆形范围伤害候选名单及现有伤害/范围。以当前目标所在格计算流场；建筑中心阻挡时选能从当前连通区到达的攻击接近格，绝不为开放目标而清除建筑障碍。前摇至恢复结束始终清零移动，不因目标跑出范围提前取消锁；死亡/重生/禁用清理旧动画回调。邻居避让不得推动攻击锁定中的 Boss。目标失效按原规则重选，无有效目标则停止。

## To-dos
- [x] E1：记录当前 git/场景/prefab 哈希及已有脏差异；核对入口/边界配置和调用方兼容，开始报告。
- [x] E2：实现独立流场核心、体型几何、共享缓存与核心测试。
- [x] E3：接入城内外分类、城外找楼梯、墙建造关闭入口与刷怪/池生命周期，处理已有敌人及BossSpawner实际出生位置。
- [x] E4：接入小怪/Boss 移动、避让及攻击状态，完成建造/拓展失效通知。
- [x] E5：完成机器 AC；通过后更新 bugs.md、报告和计划状态。

## 校验点
- AC-TYPE：`npx tsc --noEmit --pretty false`，exit 0。
- AC-CORE：`node .cursor/scripts/test-enemy-navigation.cjs`，exit 0。覆盖绕墙与不可达、斜穿角禁止、体型通道差异、格内复用/换格重算/障碍失效、Boss与小怪不同目标的缓存隔离与回收、建筑目标接近格、20格前瞻上限与扫掠薄墙、负坐标和边界、重叠避让、32/50临界、Boss原索敌优先级和锁期间目标移动、入口随机候选过滤、池旧回调不重复复活。另覆盖远端出生绕障到Outside、1/3各自关闭互不影响及全部转2号、建墙发生于追梯/楼梯中/已入城、初始化补同步、非楼梯边界不可跨越、多边形内外/通道过渡分类、反向跨区及入口按体型不可达。测试真实核心输出，非字符串存在断言。
- AC-SHARED：在核心计数测试中200个同体型请求同目标/障碍版本只构建一次距离场；不同体型分别复用；未发生失效的后续请求零重建。不得声称这等同实际帧率实测。
- AC-DIFF：`git diff --check`；scene/prefab/meta 与 E1 基线一致；Hero/Soldier/PathAgent 未被本次修改。
- AC-SPEC：`openspec validate enemy-shared-flow-field --type change --strict --no-interactive`，exit 0。
- AC-PLAY（配置入口/边界后手测，不阻塞纯脚本机器 AC）：远端找楼梯、实际楼梯进场、1/3随各自建墙关闭后改走2号、建塔实时绕行、扩地边界更新、两种体型拥挤、Boss前摇停移、复活、新旧阶段和低帧率测试。报告准确区分机器通过与尚未运行的编辑器体验。
- 本次纯脚本与文档，MCP资源门禁不适用，不打开/保存场景。

## 回滚与交付
仅撤回本次补丁；不得使用 git reset/checkout 覆盖用户改动。新增脚本 meta 由编辑器生成，不手写 UUID。报告记录修改文件、验证命令结果、入口/边界 Inspector 绑定说明及尚未手测内容。MCP调用/scene-save/新建prefab均为0。

## 修订记录
- v1（2026-09-09）：证据调研后 draft。plan-agent 未及时产出，主线程停止该代理并接手计划；等待用户确认后由一个 build-agent 执行。
- v2（2026-09-09）：按用户澄清保留 Boss 原索敌；流场按实际目标格分组，补充楼梯空节点标记与绑定设计。
- v3（2026-09-09）：按用户澄清固定三楼梯，2常开、1/3建墙关闭；补齐城外找入口、区域多边形与跨区通道约束。仍为draft，仅修订文档，未实现。
