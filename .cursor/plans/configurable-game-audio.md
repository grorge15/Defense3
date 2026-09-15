---
slug: configurable-game-audio
版本: 1
状态: blocked
创建: 2026-09-15
---

# 可配置游戏音频接入

## 业务目标
为场景提供一个可在 Inspector 配置的音频管理器，并在已确认的玩法成功节点播放 BGM 和音效。保持既有战斗、建造、终结清场的行为和时序不变。

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
- 不手写完整 `Main.scene` JSON；只通过 Cocos MCP 在现有 `SceneSetup` 节点上挂组件、绑定资源并保存。

## 变更文件清单
- 【可写】`.cursor/plans/configurable-game-audio.md` — 执行状态和完成 todo。
- 【可写】`assets/scripts/core/GameConfig.ts`、`assets/scripts/game/SceneSetup.ts`、`assets/scripts/game/CombatSystem.ts`、`assets/scripts/character/Hero.ts`、`assets/scripts/character/Soldier.ts`、`assets/scripts/game/CoinSystem.ts`、`assets/scripts/building/HeroShrine.ts`、`assets/scripts/enemy/EnemyMinion.ts`、`assets/scripts/enemy/EnemyBoss.ts`。
- 【可写】`assets/scenes/Main.scene` — 仅经 MCP 添加 AudioManager 与 Inspector 资源/参数绑定。
- 【可新建】`assets/scripts/core/AudioManager.ts`、`.cursor/scripts/test-configurable-game-audio.cjs`、`openspec/changes/configurable-game-audio/**`、`.cursor/plans/reports/configurable-game-audio-report.md`。
- 【仅只读参考】`assets/resources/audio/**`、`GameEvents.ts`、`GameManager.ts`、`UltimateSystem.ts`、相关既有 OpenSpec change、`.cursor/rules/*.md`。

## To-dos
- [x] A1：记录基线，读取计划、OpenSpec、相关音频/战斗代码，确认 Cocos 工程绑定；Main.scene 因缺失依赖阻塞。
- [ ] A2：新增 AudioManager，暴露 BGM 与每个 cue 的 clip、启用、倍率、间隔；实现通道、限频、并发、空素材安全跳过和清理。
- [ ] A3：将 GameConfig 默认值接入 AudioManager：BGM 0.35、SFX 0.8、倍率 1、并发 8；攻击/死亡/金币 0.1 秒，建造/英雄生成 0 秒。
- [ ] A4：在成功节点发出 cue：玩家箭、Hero 1/2 投射物、塔齐射、金币收集、英雄生成、普通敌人死亡。
- [ ] A5：通过 MCP 将 AudioManager 加到 `SceneSetup` 并绑定用户指定资源；Hero1 clip 保持 null。
- [ ] A6：新增音频静态测试；执行它和既有塔箭/终结回归测试。
- [ ] A7：按场景保存链与机器门禁验收，写报告与完成 todos。

## 实施步骤
1. AudioManager 使用一个循环 AudioSource 专用于 BGM，并为短音效建立可回收 source；空 clip、禁用、全局静音、限频、并发满和未交互 BGM 都跳过且不排队。
2. 首次 pointer/touch/key 输入才启动 BGM；隐藏时暂停 BGM、停止短音效，恢复时仅非 GameOver 阶段恢复；GameOver/销毁时停止音频、注销全部监听。
3. 通过 MCP：`assets-query-path` 确认工程，查现有组件，有则更新无则加；任务末一次保存、close、post-scene-save、必要时 reimport、reopen、一次 AC。

## 校验点
- [AC-1] Inspector 含 BGM 和八个 cue 的 clip、enabled、volumeMultiplier、minInterval；Hero1 默认 null，其余映射正确。
- [AC-2] BGM 仅首次输入后启动，阶段切换不叠播；GameOver/隐藏/销毁正确停止。
- [AC-3] cue 仅在对应成功路径播放；失败攻击、缺投射物、扣金币、空资源无音也不抛错。
- [AC-4] 塔单次齐射最多一声；终结清场没有普通死亡 cue。
- [AC-5] `node .cursor/scripts/test-configurable-game-audio.cjs` exit 0。
- [AC-6] `node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` exit 0。
- [AC-7] `powershell -File .cursor/scripts/verify-mcp-gate.ps1` exit 0。
- [AC-EDITOR-MCP] 重新打开 Main.scene 后相关组件可查询，日志无本任务 error 或 missing script。
- [AC-PLAY] 手测各 cue；不阻塞机器完成。

## 回滚策略
- 回滚本任务新增的 AudioManager、测试、OpenSpec、计划报告及定向脚本/场景组件变更；保持音频源与其他改动不动。

## 修订记录
- v1（2026-09-15）：用户确认完整可配置音频接入与素材映射。

---

## 执行报告须含（build-agent）

### MCP 指标
| 指标 | 次数/值 |
|---|---|
| scene-open | |
| scene-save | |
| verify-mcp-gate | |
| post-scene-save Patched | 0/1 |
| assets-reimport-asset | |
| 本任务新建 prefab 数 | 0 |
| 是否续跑 | yes/no |
| OpenSpec change（若有） | `openspec/changes/configurable-game-audio/` |
