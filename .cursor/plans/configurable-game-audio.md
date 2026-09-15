---
slug: configurable-game-audio
版本: 3
状态: complete
创建: 2026-09-15
---

# 可配置游戏音频接入

## 业务目标
为场景提供一个可在 Inspector 配置的音频管理器，并在已确认的玩法成功节点播放 BGM 和音效。场景组件挂载与资源绑定由用户手动完成；脚本、自动化测试和行为规格继续交付。既有战斗、建造、终结清场的行为和时序保持不变。

## OpenSpec 引用
- Change：`openspec/changes/configurable-game-audio/`
- 行为以该目录 specs 为准。

## 风险等级
中。

## 禁做项
- 不重命名、移动、删除或重新导入现有音频资源；不手改资源 `.meta` 或 UUID。
- 不创建或修改 prefab，不增加设置 UI，不持久化用户音量偏好，不添加大招音效。
- 不修改攻击伤害、攻击预约、投射物生成、建造耗费、英雄选择或终结清场业务时序。
- 不把普通死亡音效接入 `playFinalDeath` 或 UltimateSystem 的终结清场通路。
- 不打开、写入、保存、重导入或修复 `assets/scenes/Main.scene`；不运行 Cocos MCP 场景操作、`post-scene-save.ps1` 或 `verify-mcp-gate.ps1`。

## 变更文件清单
- 【可写】`.cursor/plans/configurable-game-audio.md` — 执行状态和完成 todo。
- 【可写】`assets/scripts/core/GameConfig.ts`、`assets/scripts/game/SceneSetup.ts`、`assets/scripts/game/CombatSystem.ts`、`assets/scripts/character/Hero.ts`、`assets/scripts/character/Soldier.ts`、`assets/scripts/game/CoinSystem.ts`、`assets/scripts/building/HeroShrine.ts`、`assets/scripts/enemy/EnemyMinion.ts`、`assets/scripts/enemy/EnemyBoss.ts`。
- 【可新建】`assets/scripts/core/AudioManager.ts`、`.cursor/scripts/test-configurable-game-audio.cjs`、`openspec/changes/configurable-game-audio/**`。
- 【可写】`.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` — 补齐当前源码导入所需的无行为 mock，不修改测试断言或玩法代码。
- 【可写】`.cursor/plans/reports/configurable-game-audio-report.md` — 更新脚本实施与机器验收；用户的场景挂载和试听保留为待验证项。
- 【仅只读参考】`assets/resources/audio/**`、`assets/scenes/Main.scene`、`GameEvents.ts`、`GameManager.ts`、`UltimateSystem.ts`、相关既有 OpenSpec change、`.cursor/rules/*.md`。

## To-dos
- [x] A1：记录基线，读取计划、OpenSpec、相关音频/战斗代码，确认 Cocos 工程绑定；Main.scene 因缺失依赖不能由 MCP 打开。
- [x] A2：新增 AudioManager，暴露 BGM 与每个 cue 的 clip、启用、倍率、间隔；实现通道、限频、并发、空素材安全跳过和清理。
- [x] A3：将 GameConfig 默认值接入 AudioManager：BGM 0.35、SFX 0.8、倍率 1、并发 8；攻击/死亡/金币 0.1 秒，建造/英雄生成 0 秒。
- [x] A4：在成功节点发出 cue：玩家箭、Hero 1/2 投射物、塔齐射、金币收集、建造完成、英雄生成、普通敌人死亡。
- [x] A5：将 AudioManager 解析路径接入 SceneSetup，使业务 cue 在场景已手动挂载时可用，未挂载、禁用或资源为空时保持静音且不影响玩法。
- [x] A6：补齐既有塔箭、终结清场回归的 `AttackReservation` 与 AudioManager 无行为 mock；新增音频与既有回归测试均已通过。
- [x] A7：已检查脚本与 OpenSpec 一致性，并更新报告；Inspector 挂载和试听保留为用户验证项。

## 实施步骤
1. AudioManager 使用一个循环 AudioSource 专用于 BGM，并为短音效建立可回收 source；空 clip、禁用、全局静音、限频、并发满和未交互 BGM 都跳过且不排队。
2. 首次 pointer/touch/key 输入才启动 BGM；隐藏时暂停 BGM、停止短音效，恢复时仅非 GameOver 阶段恢复；GameOver/销毁时停止音频、注销全部监听。
3. 业务脚本仅向 SceneSetup 已解析的 AudioManager 发送类型化 cue。未解析到组件时无操作并有限告警，且不抛异常、不改变原回调返回值或时序。
4. 用户完成下方 Inspector 清单后保存场景；代码交付不包含任何场景文件或 MCP 操作。

## 用户手工 Inspector 挂载与绑定清单
1. 在 Cocos Creator 中打开 `assets/scenes/Main.scene`，选择现有 `SceneSetup` 节点，添加 `AudioManager` 组件，并将 `SceneSetup` 上的 AudioManager 引用指向该组件。
2. 将 `assets/resources/audio/bgm` 指定给 BGM cue；开启循环，启用该 cue，音量倍率设为 1，最小间隔设为 0。
3. 依次将 `playerAttack`、`arrowShoot`、`shandian`、`monsterDie`、`gold`、`build`、`升级2` 指定给玩家普攻、箭塔齐射、Hero2 普攻、普通敌人死亡、金币收集、建造完成、英雄生成 cue；每项启用且音量倍率设为 1。
4. Hero1 普攻 cue 保持启用但 clip 为空；`jianyu`、`bo`、`nengliang`、`huijian3` 不绑定。
5. 将玩家普攻、箭塔齐射、Hero1 普攻、Hero2 普攻、普通敌人死亡和金币收集的最小间隔设为 0.1 秒；建造完成、英雄生成设为 0 秒。
6. 将 BGM 音量设为 0.35，SFX 音量设为 0.8，全局静音关闭，短音效并发上限设为 8；保存场景并重新打开，确认字段和引用仍存在。

## 校验点
- [AC-1] AudioManager 的 Inspector 序列化字段含 BGM 和八个 cue 的 clip、enabled、volumeMultiplier、minInterval；Hero1 默认 null，推荐绑定映射见用户清单。
- [AC-2] BGM 仅首次输入后启动，阶段切换不叠播；GameOver/隐藏/销毁正确停止。
- [AC-3] cue 仅在对应成功路径播放；失败攻击、缺投射物、扣金币、空资源、未挂载 AudioManager 无音也不抛错。
- [AC-4] 塔单次齐射最多一声；终结清场没有普通死亡 cue。
- [AC-5] `node .cursor/scripts/test-configurable-game-audio.cjs` exit 0。
- [AC-6] `node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` exit 0。
- [AC-USER-INSPECTOR] 用户按清单挂载、绑定并保存后，重开场景确认配置保留；Hero1 静音、Hero2 普攻为 `shandian`、英雄生成是 `升级2`。
- [AC-PLAY] 用户试听 BGM、攻击、死亡、金币、建造与英雄生成；不阻塞脚本机器完成。

## 回滚策略
- 回滚本任务新增的 AudioManager、测试、OpenSpec、计划及定向脚本改动；不触及场景、音频源与其他改动。

## 修订记录
- v2（2026-09-15）：用户选择手动挂载场景组件。保留 A1 和所有行为规格；移除 Main.scene/MCP 写入及依赖场景的机器门禁，新增明确 Inspector 绑定清单。
- v3（2026-09-15）：仅补齐 AC-6 的基线测试 mock，保留 v2 已完成实现和验收。
- v1（2026-09-15）：用户确认完整可配置音频接入与素材映射。

---

## MCP 指标

本版本不执行 MCP 场景操作，以下字段不适用；用户手工场景操作不计入自动化指标。

| 指标 | 次数/值 |
|---|---|
| scene-open | N/A |
| scene-save | N/A |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | N/A |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes |
| OpenSpec change（若有） | `openspec/changes/configurable-game-audio/` |
