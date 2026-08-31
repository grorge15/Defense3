---
slug: p2-010-hero
版本: 1
状态: done
创建: 2026-08-31
---

# P2-010 英雄 `pref_hero_01` / `pref_hero_02` + `Hero.ts`

## 业务目标

实现英雄唯一主脚本 `Hero.ts`（含跟随玩家身后、远程范围攻击、受击/死亡、`setHeroVariant(1|2)` 区分两名英雄），并产出 `pref_hero_01`、`pref_hero_02` 预制体及 ANIM_MANIFEST §hero_01/§hero_02 空动画 clip。数值读 `GameConfig`（`heroMaxHp`、`heroFollowSpeed`）；弹道使用 `pref_projectile_hero_01` / `pref_projectile_hero_02` 占位 prefab，完整弹道逻辑可后续与 P2-013 统一。禁止 `HeroController.ts`。

**澄清结论（用户确认）**：本阶段做完整逻辑框架，弹道 prefab 可占位，不合并完整弹道系统实现。

## 风险等级

**中** — 双英雄 prefab + 8 个 clip + 可选弹道占位 prefab；跟随与索敌逻辑需与 `Player.ts` 协调；不删除既有文件、无接口破坏性改动。

## 变更文件清单

- 【可新建】`assets/scripts/character/Hero.ts` — 英雄唯一主脚本
- 【可新建】`assets/resources/prefabs/character/pref_hero_01.prefab`
- 【可新建】`assets/resources/prefabs/character/pref_hero_02.prefab`
- 【可新建】`assets/resources/animations/hero_01/idle.anim` — 空占位 clip
- 【可新建】`assets/resources/animations/hero_01/walk.anim`
- 【可新建】`assets/resources/animations/hero_01/attack.anim`
- 【可新建】`assets/resources/animations/hero_01/die.anim`
- 【可新建】`assets/resources/animations/hero_02/idle.anim` — 同上 hero_02 四个 clip
- 【可新建】`assets/resources/animations/hero_02/walk.anim`
- 【可新建】`assets/resources/animations/hero_02/attack.anim`
- 【可新建】`assets/resources/animations/hero_02/die.anim`
- 【可新建】`assets/resources/prefabs/projectile/pref_projectile_hero_01.prefab` — 弹道占位（default_sprite）
- 【可新建】`assets/resources/prefabs/projectile/pref_projectile_hero_02.prefab` — 弹道占位
- 【仅只读参考】`assets/scripts/character/Player.ts` — 跟随目标、模式参考
- 【仅只读参考】`assets/scripts/enemy/EnemyMinion.ts` — 索敌/攻击模式参考
- 【仅只读参考】`assets/scripts/building/HeroShrine.ts` — 生成英雄入口（P2-009）
- 【仅只读参考】`assets/scripts/core/GameConfig.ts` — heroMaxHp / heroFollowSpeed
- 【仅只读参考】`assets/scripts/core/AnimUtil.ts` — `playAnim()`
- 【仅只读参考】`assets/scripts/core/Billboard.ts` / `SortingOrder2D.ts`
- 【仅只读参考】`assets/scripts/core/EventManager.ts` — `HP_CHANGED`
- 【仅只读参考】`docs/ANIM_MANIFEST.md` — §hero_01 / §hero_02
- 【仅只读参考】`defense3.md` — 跟随玩家、远程攻击、血条

## 实施步骤

### S1: 空动画 clip（hero_01 / hero_02）

在 `assets/resources/animations/hero_01/` 与 `hero_02/` 各创建 4 个 clip：`idle` / `walk` / `attack` / `die`，无关键帧，`duration = 0.1s`，循环规则见 ANIM_MANIFEST。

### S2: 弹道占位 prefab（可选最小实现）

在 `assets/resources/prefabs/projectile/` 创建 `pref_projectile_hero_01.prefab`、`pref_projectile_hero_02.prefab`（Sprite 占位即可，可无独立脚本；`Hero.tryAttack()` 实例化后向前位移/销毁由 Hero 侧简单驱动或留 `onProjectileSpawn` 回调）。

### S3: 实现 `Hero.ts`

路径 `assets/scripts/character/Hero.ts`，`@ccclass('Hero')`。

**节点与变体**

- `@property visualNode` — Visual（Animation + Sprite）
- 根节点 `RigidBody2D` 或 Kinematic 跟随（与 Player 一致用 RigidBody2D）
- `setHeroVariant(variant: 1 | 2)`：切换弹道 prefab 引用与动画 clip 路径（hero_01 / hero_02）

**跟随玩家**

- `setFollowTarget(player: Node | null)`：由 P2-009 / P4 在生成后调用
- `fixedUpdate`：保持于玩家身后固定偏移（`@property followOffset`），移动速度读 `GameConfig.heroFollowSpeed`；距离过远时向目标位置插值/追击
- 静止播 `idle`，移动播 `walk`

**远程攻击**

- `tryAttack()` 或自动攻击：检测范围内敌人（`EnemyMinion` 等），播放 `attack`，实例化对应 `pref_projectile_hero_0X`
- 攻击伤害/范围不硬编码击杀次数；血量读 `GameConfig.heroMaxHp`，伤害值可 `@property` 或后续扩展 GameConfig
- 弹道命中与池化留 P4/P2-013 深化

**生命与受击**

- `_hp = GameConfig.heroMaxHp`；`takeDamage(amount)` 派发 `HP_CHANGED`；死亡播 `die`、禁用跟随与攻击

### S4: 创建 `pref_hero_01` / `pref_hero_02`

路径 `assets/resources/prefabs/character/`，结构同 §P0-A：

```
pref_hero_* (Root)
├── Hero.ts + RigidBody2D + Collider2D
└── Visual (Sprite + Animation + Billboard + SortingOrder2D)
```

- 两 prefab 仅 `setHeroVariant` 默认值与 Animation clip 集不同
- **禁止**手写/篡改 `.meta` uuid

### S5: 自检与 AC 校验

报告写入 `.cursor/plans/reports/p2-010-hero-report.md`。

## 校验点

- [AC-1] `npx tsc --noEmit -p tsconfig.json`: 退出码 0
- [AC-2] `rg "class Hero" assets/scripts/character/Hero.ts`: 有匹配
- [AC-3] `test -f assets/resources/prefabs/character/pref_hero_01.prefab && test -f assets/resources/prefabs/character/pref_hero_02.prefab`: 退出码 0
- [AC-4] `rg "PlayerController|LogController" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-5] `rg "第[0-9]+下|hitsToKill|一击秒杀" assets/scripts/ && exit 1 || true`: 退出码 0
- [AC-6] `rg "default_sprite|Animation" assets/resources/prefabs/character/pref_hero_01.prefab`: 有匹配
- [AC-7] `test -f assets/resources/animations/hero_01/idle.anim && test -f assets/resources/animations/hero_02/attack.anim`: 退出码 0
- [AC-8] `rg "setFollowTarget|setHeroVariant|tryAttack|takeDamage" assets/scripts/character/Hero.ts`: 四项均有匹配
- [AC-9] `rg "GameConfig\.(heroMaxHp|heroFollowSpeed)" assets/scripts/character/Hero.ts`: 有匹配
- [AC-10] `test -f assets/resources/prefabs/projectile/pref_projectile_hero_01.prefab`: 退出码 0
- [AC-11] `test ! -f assets/scripts/character/HeroController.ts`: 退出码 0

## 回滚策略

- **基线**：`git rev-parse HEAD`
- **失败恢复**：删除本任务新建脚本、prefab、clip、弹道占位及 `.meta`；恢复误改 `Player.ts`

## 依赖与后续

| 依赖 | 状态 |
|---|---|
| P2-001 `Player.ts` | ✅ 跟随目标 |
| P2-009 `HeroShrine` | 计划/实现中；生成英雄实例 |
| P5 英雄血条 | 未建；`HP_CHANGED` |
| P2-013 `Arrow.ts` | 玩家箭弹道；英雄弹道可后续统一 |
