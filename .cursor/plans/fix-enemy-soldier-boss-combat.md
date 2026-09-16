---
slug: fix-enemy-soldier-boss-combat
版本: 1
状态: done
创建: 2026-09-16
---

# 修复小怪、盾兵与 Boss 战斗状态

## OpenSpec 引用
- `openspec/changes/fix-enemy-soldier-boss-combat/`

## 目标
修复小怪不主动攻击近身盾兵、Boss 被盾兵挡住却不攻击、Boss 击杀目标后长时间原地攻击锁死的问题。用户允许按攻击动画时长调整 Boss 的 `attackCooldown`。

## 可写文件
- `assets/scripts/enemy/EnemyMinion.ts`
- `assets/scripts/enemy/EnemyAI.ts`
- `assets/scripts/enemy/EnemyBoss.ts`
- `assets/resources/prefabs/character/enemy/pref_enemy_boss.prefab`
- 直接覆盖本任务行为的现有 `.cursor/scripts/test-*.cjs`，或新增一个聚焦测试脚本
- 本 OpenSpec change、此计划、报告和本任务证据目录
- `bugs.md`：仅在验证成功后追加对应已有条目版本

## 只读文件
- `assets/scripts/character/Soldier.ts`、`assets/scripts/core/{GameConfig,AnimUtil,EnemyNavigation}.ts`
- 现有敌人导航、兵营/Boss、击退测试和相关 OpenSpec
- `Main.scene` 及其他 prefab/资源

## 禁做项
- 不改 Main.scene、meta、动画资源、导航决策频率、流场实现、伤害数值、盾兵脚本或生成规则。
- 不覆盖当前工作区中 Boss、Minion、prefab 的无关脏改动；先以当前磁盘为基线逐 hunk 修改。
- 不以 root-to-root 距离或未声明的最小攻击范围替代配置的角色攻击范围。
- 不让攻击冷却阻挡攻击结束后的正常移动和索敌；不允许旧攻击回调解锁新攻击。

## To-dos
- [x] 读取当前脏 diff、现有测试与 OpenSpec，确认 Boss `attack` 为 `1.3s`、speed `2`，当前 prefab `attackCooldown=0.8`。
- [x] 在 `EnemyAI` 建立复用的角色碰撞体表面距离检查，支持现有 Circle/BoxCollider2D；无有效碰撞体时保守回退根节点距离。
- [x] 在 `EnemyMinion` 于既有 0.2-0.3 秒决策窗口内选择近身有效盾兵作为临时战斗目标；每帧仍检查目标存活/距离/动画与伤害，失效立即恢复原追击目标。
- [x] 在 `EnemyBoss` 移除攻击距离隐式 clamp；所有角色停步、出手和圆形伤害使用同一配置范围和表面距离；攻击结束回调只校验生命周期和攻击序号，目标死亡后仍可释放锁定并在下一帧重索敌。
- [x] 维持 Boss prefab `attackCooldown=0.8`：动画实际约 `0.65s`，留下约 `0.15s` 恢复余量，不截断动画也不引入明显站桩。
- [x] 补充确定性回归并执行 TypeScript、聚焦战斗回归、OpenSpec strict、diff 检查；更新 bugs、计划状态和报告。

## 验收
- [AC-MINION] 玩家处于有效仇恨范围时，近身 barracks melee Soldier 会被小怪作为临时目标接近、停步、攻击；Soldier 死亡或离开范围后，小怪恢复追击原目标；不改变小怪 0.25 秒导航节流。
- [AC-RANGE] Boss 与盾兵的 Box/Circle/AABB 接触或处于 Inspector `attackTriggerRange` 内时可攻击；修改该 Inspector 值后不再被 28/48/56 等脚本下限重写；对建筑障碍仍使用既有障碍 LOS 逻辑。
- [AC-LIFECYCLE] Boss 在攻击帧杀死或失去原目标后，动画结束/回退超时会清除 `_isAttacking`；旧回调不会清除后续攻击；下一 update 可以重新锁定并移动或攻击。
- [AC-COOLDOWN] Boss attack 动画完整播放，冷却与实际时长相符，攻击完成后不会因自身状态产生额外站桩时间。
- [AC-SCOPE] 仅许可文件、本计划/OpenSpec/报告/bugs 发生本任务修改；不改场景结构。TypeScript、相关聚焦测试、OpenSpec strict 和 diff 检查通过。

## 验证命令
```powershell
npx --no-install tsc --noEmit --pretty false
node .cursor/scripts/test-barracks-boss-hit-feedback.cjs
node .cursor/scripts/test-building-spawn-minion-knockback.cjs
openspec validate fix-enemy-soldier-boss-combat --strict
git diff --check
```

MCP 指标：纯脚本和已存在 prefab 参数局部修改，不改场景；无 scene-open/save/reimport。Prefab 局部参数修改后仅在编辑器可用时做资源/日志检查，无法使用时如实记录为待手测。
