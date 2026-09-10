---
slug: fix-log-initial-hero-select-pause
版本: 2
状态: done
创建: 2026-09-09
---

# 滚木初始配置与英雄选择暂停

## 业务目标及规格
滚木初始逻辑长度3；调整初始视觉；英雄选择期间停止世界模拟而保持弹窗可操作。
行为规格：`openspec/changes/fix-log-initial-hero-select-pause/`。风险中等，暂停涉及模拟与UI不同时间来源。

## 已有证据
- Log的字段初始化及beginParkour都使用logMinLength=1；应新增initial值而非把min改成3。
- 当前Visual X倍率为1+length*0.2，滚动碰撞体宽度同步；固定碰撞体尺寸有独立配置。
- HeroSelectUI通过tween淡入回调才允许点击，直接director.pause会让它无法进入可点击状态。
- 本地Creator3.8.8的director.tick在暂停时跳过组件、调度器、物理和TweenSystem，仍派发触摸及BEFORE_DRAW；可以在绘制前单独驱动此弹窗的过渡。
- Player死亡会setGameOver后director.pause；关闭选择界面不可误恢复GameOver。
- 当前npx tsc --noEmit --pretty false通过，工作树存在用户和其他任务改动，保留这些修改。

## 已确认视觉映射
用户明确选择公式 `0.4 + 长度 * 0.2`。长度1/2/3/4/10对应倍率0.6/0.8/1.0/1.2/2.4。
以编辑器 authored Visual X为基准乘倍率，不动YZ，滚动碰撞体同步，固定尺寸保持现有配置。

## 文件清单与禁做
- 可写：`assets/scripts/core/GameConfig.ts`、`assets/scripts/item/Log.ts`、`assets/scripts/ui/HeroSelectUI.ts`、`bugs.md`。
- 可新建：`.cursor/scripts/test-log-hero-select-pause.cjs`，以及`.cursor/plans/reports/fix-log-initial-hero-select-pause-report.md`。
- 可维护：本计划及对应OpenSpec。
- 只读：`HeroShrine.ts`、`Player.ts`、`game/GameManager.ts`、`UIManager.ts`、本地引擎director.ts、现有specs、scene、prefab。
- 不修改scene/prefab/meta、不改全局游戏阶段、不禁用世界节点、不改角色主脚本、不改变滚木最小长度1/最大10、蓝线固定门槛3、固定碰撞体及rotation；不恢复/撤销其他任务修改。

## To-dos
- [x] P1：用户已确认公式，主线程读取git状态并同步规格；计划转active，build执行前保留现有脏修改基线。
- [x] P2：GameConfig新增初始长度3和选定视觉参数；Log字段初始化及beginParkour均应用，继续保持增长/缩短上下限和滚动碰撞同步。
- [x] P3：HeroSelectUI在弹窗出现时暂停director，以BEFORE_DRAW和非模拟时钟仅更新自身淡入、浮动、选择反馈及淡出。不调用全局TweenSystem推进，不使用暂停后不会执行的schedule等待恢复。
- [x] P4：关闭完成、外部禁用/销毁时清理UI帧监听与临时状态，仅释放此弹窗发起的暂停；原本暂停或GameOver不resume。选中后现有召唤流程保留，异步生成英雄也不应在弹窗关闭前开始世界模拟。单剩一英雄自动选择不闪现弹窗或误暂停。处理重复开关、重复点击、场景切换和同帧死亡。
- [x] P5：完成机器AC；之后按两个用户问题分别更新bugs.md（滚木复用已有视觉主题升版），输出报告。

## 验收
- `npx tsc --noEmit --pretty false` exit0。
- `node .cursor/scripts/test-log-hero-select-pause.cjs` exit0：通过可控cc替身驱动真实脚本方法，覆盖初始/重置长度3、选定映射和极限长度、滚动碰撞同步/固定碰撞不变、打开暂停、暂停时弹窗仍完成淡入可点击、关闭恢复、重复点击及生命周期清理、原本暂停/GameOver不误恢复。不得仅断言实现字符串。
- 本地引擎行为核对配合编辑器手测：物理、攻击计时、刷怪、世界动画冻结，弹窗动画/触摸持续，恢复不补算暂停期间dt。未实机运行须在报告注明，不能以替身测试声称完整玩法已测。
- `openspec validate fix-log-initial-hero-select-pause --type change --strict --no-interactive` exit0。
- `git diff --check` exit0；scene/prefab/meta与任务基线一致。纯脚本文档，MCP门禁跳过。

## 回滚与修订
只撤回本任务补丁，不使用reset/checkout覆盖现有改动。报告写明验证结果、残余手测项及MCP调用0次。
v1：调研后draft；plan-agent未返回产物，停止后主线程整理。视觉语义待用户确认，尚未修改游戏脚本或记录修复成功。
v2：用户确认公式0.4+length*0.2，授权继续修复，执行阶段。主线程负责测试脚本与独立校验，一个build-agent负责游戏脚本、bugs与报告，写集分离。

完成记录（2026-09-09）：P1–P5 完成，9组真实脚本行为测试、tsc、OpenSpec strict、git diff --check 均通过；主线程确认 scene/prefab/meta 聚合 count564、SHA256 `768b52a59cb295331ba45877f3022da2a9cb4207ee4b8d1c8590be69db6632f0` 与基线一致。报告已落盘；编辑器玩法手测未执行，不阻塞机器验收完成。
