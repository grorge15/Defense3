---
slug: ultimate-two-wave-finale
版本: 1
状态: draft
创建: 2026-09-15
---

# 双轮集体大招收尾

## 业务目标
延长结尾表现：两轮既有集体大招，第一轮半血受击，第二轮伴随拉远，再保留最终死亡呈现与胜利结算。暂按“第一轮扣当前血量的 50%”理解；这是待审阅的数值口径，尚未实现。

## OpenSpec 引用
- Change：`openspec/changes/ultimate-two-wave-finale/`

## 风险等级
中。对应 AI_TASK_LIST §4.33/4.34 的既有结尾增量，跨伤害、异步动画和镜头完成边界；使用 Plan-Build，确认后由一个 build-agent 连续执行。

## 已核实接入点
- `UltimateSystem._runFinale` 目前先等待镜头，再由 `_playBigMoveAndFinish` 播一轮；调整该编排，不重写结算系统。
- `EnemyMinion` 与 `EnemyBoss` 均提供 `currentHp`、`isDead`、`takeDamage`；后者包含 `HitFlash.flash`、`HP_CHANGED` 和 `playEnemyHitVfx`。复用默认伤害来源的现有受击，不经 `HealthSystem` 或直接写私有 `_hp`。
- `clearAllEnemies` 已负责停刷、`playFinalDeath`、统一移除和延迟胜利；保留已验收的死亡链，仅调整调用边界。
- `CameraFollow.zoomOut` 接受完成回调，现有距离、时长及结束延迟均来自 `GameConfig`。
- 原 timing harness 明确断言“镜头先完成再播放”，须替换这部分断言；建造费用与相机终态断言保留。

## 禁做项
- 不修改场景、prefab、动画、美术、`.meta` 或现有点位布局；不增加角色大招动作或第二套相机控制器。
- 不改敌人普通伤害、掉落、复活规则；不使用第一轮的伤害触发最终死亡清理。
- 不按点位数重复扣全场血，不通过最大血量或向上取整造成低血敌人第一轮死亡。
- 不回退工作区已有修改，不改建造、引导、音频或无关旧计划/报告；不把旧测试删掉以掩盖回归。

## 变更文件清单
- 【可写】`assets/scripts/game/UltimateSystem.ts` — 两轮编排、半血命中及异步生命周期。
- 【可写】`assets/scripts/core/GameConfig.ts` — 新增第一轮伤害比例配置；若必要，新增加载/失效完成保护时限也统一放此处。
- 【可写】`.cursor/scripts/test-build-cost-ultimate-timing.cjs` — 更新旧顺序断言，覆盖新顺序、血量及退化流程。
- 【可写】`.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` — 补最小串联验证，保留普通死亡隔离及箭矢断言。
- 【可写】本计划及 `openspec/changes/ultimate-two-wave-finale/` — 执行勾选和经确认的规格修订。
- 【可新建】`.cursor/plans/reports/ultimate-two-wave-finale-report.md` — 验证结果与差异归属。
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts`、`EnemyBoss.ts`、`assets/scripts/core/EnemyHitVfx.ts`、`HitFlash.ts`、`assets/scripts/game/HealthSystem.ts`、`CameraFollow.ts`、`GameManager.ts`、`assets/scripts/game/SceneSetup.ts`。
- 【仅只读参考】`assets/resources/prefabs/VFX/Vfx_BigMove.prefab`、既有 `BigMove.anim`、`assets/scenes/Main.scene`。
- 【仅只读参考】`openspec/changes/ultimate-bigmove-clear/`、`openspec/changes/fix-build-cost-and-finale-timing/`、`openspec/changes/fix-tower-arrow-and-ultimate-death-cleanup/`，以及对应计划/报告；本增量替代旧单轮时序，不重做既有成果。

## To-dos
- [ ] T1：读取本计划、报告（若有）、上述规格及 git 状态；记录已有改动基线，核对仍是上述接入点。续跑只处理未完成项。
- [ ] T2：把单轮特效播放提取为可重复调用且每轮仅完成一次的内部步骤；先准备/验证本轮实例，再统一播放，防止同步完成回调在实例尚未登记齐时提前推进。每轮重新筛选、去重有效点位。
- [ ] T3：在第一轮统一起播边界结算一次全场伤害，取有效、activeInHierarchy、未死小怪/Boss 的实时 `currentHp`，乘配置比例传给 `takeDamage`；保留小数、不新增最小伤害。资源/点位不可用时仍推进一次该逻辑边界。不要对每个特效实例分别结算。
- [ ] T4：第一轮全部完成后，在同一执行边界启动第二轮与既有镜头拉远。用两个独立完成标志汇合，再调用原 `_finishFinale`；提前登记状态以支持零时长镜头或同步特效退化完成。
- [ ] T5：统一防重入、实例清理及失效保护：重复塔事件/按键/资源回调、动画事件与时长兜底竞争不得重复扣血、追加第三轮或提前清场；失效组件不再推进。镜头缺失、禁用或节点失活应完成镜头分支；运行中镜头失效也须有限收尾，正常可用镜头仍以实际终态回调为准。加载失败/超时、空点位、缺 clip/实例化失败只跳过不可用表现；晚到回调不得重启已完成轮次。
- [ ] T6：更新并运行指定 harness，记录真实伤害接入、两种完成先后顺序和兜底证据；执行差异检查，更新报告与 AC 状态。

## 校验点
- [AC-1] timing harness 覆盖每轮 N 个有效去重点位、恰好两轮、第一轮全场仅一次伤害；100→50、30→15、1→0.5，死亡/无效/不活动目标跳过，HP 事件和原受击调用可观测。
- [AC-2] 第二轮与拉远并行；镜头先结束、动画先结束、零时长同步完成均经过双完成汇合；第一轮不调用最终清理。
- [AC-3] 重复触发/重复及晚到回调、空点位、缺失资源/动画、实例化异常、缺失或失效镜头、组件销毁/禁用覆盖且无重复结算或悬挂实例。成功路径不额外插入固定等待。
- [AC-4] 原死亡清理、停刷、整批移除、无普通死亡奖励及胜利一次的 harness 通过；建造费用/箭矢测试保留通过。
- [AC-CHECK] `node .cursor/scripts/test-build-cost-ultimate-timing.cjs`、`node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` 退出码 0；`git diff --check` 通过。如现有 Cocos 类型环境可用，再运行 `npx tsc --noEmit`，区分既有错误与新增错误，禁止下载依赖或修改编译配置补环境。
- [AC-PLAY] 在正常点位下观察第一轮半血和受击、第二轮拉远、最终死亡及结束界面；属于补充表现验收，未具备预览环境须在报告注明，按项目规则不阻塞机器 AC 完成。
- 本任务为纯脚本，不触碰 scene/prefab，MCP 装配与 gate 全部不适用；若发现必须改资产，应先 replan，不擅自扩权。

## 回滚策略
以 T1 记录的工作区差异为基线，只撤销本任务增加的脚本/测试改动，不整文件覆盖已有修改；保留原 `clearAllEnemies`/最终死亡实现。若规格口径变更，先修订 change 与本计划，版本 +1，不重建已通过的清理逻辑。

## 修订记录
- v1（2026-09-15）：初始草案，当前血量 50% 暂定口径；复用全部既有资源和死亡清理。

## 执行报告须含
- 完成 todos、AC 结果、验证命令及输出摘要、已有差异归属、未做的视觉验证。
- MCP 指标占位：scene-open=0，scene-save=0，verify-mcp-gate=0，post-scene-save Patched=N/A，assets-reimport-asset=0，新建 prefab=0，是否续跑=待填，OpenSpec change=`openspec/changes/ultimate-two-wave-finale/`。

