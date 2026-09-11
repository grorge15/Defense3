## Why

敌人当前受伤入口只更新生命值，无法区分命中来源，也没有统一的受击特效生命周期。需要把来源类型传入伤害入口，并让敌人按来源显示已有的蓝色或黄色命中特效。

## What Changes

- EnemyMinion 和 EnemyBoss 暴露由 Inspector 绑定的受击 VFX Prefab 字段，并在受击时按来源播放对应颜色的 VFX。
- Hero 命中使用蓝色 VFX；Player/Arrow、Soldier ranged、Soldier melee 命中使用黄色 VFX。
- VFX 实例生成在 `GameRoot/Effect`，使用受击敌人的当前世界坐标，单次动画完成后回收。
- 伤害入口携带来源类型；只有 EnemyMinion/EnemyBoss 消费该来源并播放 VFX。

## Non-goals

- 不修改 `Main.scene`、任何现有 prefab 或 `.meta` 文件。
- 不由代码硬编码或自动加载 `pref_vfx_hit_blue` / `pref_vfx_hit_yellow` 路径；Prefab 由用户在 Inspector 绑定。
- 不为 Player、Hero、Soldier 或其他受击对象新增受击 VFX。
- 不改变伤害数值、目标选择、穿透规则、攻击冷却或死亡语义。

## Capabilities

### New Capabilities

- `enemy-hit-vfx-interface`

### Modified Capabilities

- 敌人受伤反馈与伤害来源传播。

## Impact

伤害调用方必须提供明确的来源类型；缺少 Inspector VFX 绑定时，受伤与死亡流程仍应正常执行且不触发代码侧资源 fallback。命中特效为一次性世界空间效果，挂在 `GameRoot/Effect` 下并在动画完成后释放。

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/enemy-hit-vfx-interface.md`。

## ADDED Requirements

### Requirement: Enemy hit VFX is source-aware

EnemyMinion and EnemyBoss SHALL accept a damage source type with each damage application and SHALL play the source-mapped hit VFX only after a valid, non-dead enemy receives damage.

#### Scenario: Hero projectile hits an enemy
- **WHEN** a Hero attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound blue hit VFX at its current world position.

#### Scenario: Player arrow hits an enemy
- **WHEN** a Player/Arrow attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound yellow hit VFX at its current world position.

#### Scenario: Soldier attacks an enemy
- **WHEN** a Soldier ranged or Soldier melee attack damages an active EnemyMinion or EnemyBoss
- **THEN** the enemy plays the Inspector-bound yellow hit VFX at its current world position.

### Requirement: VFX lifecycle and ownership

Each spawned hit VFX instance MUST be parented under `GameRoot/Effect`, preserve the selected world position at spawn time, play once, and be released after playback completes.

#### Scenario: Hit VFX completes
- **WHEN** a hit VFX animation reaches its end
- **THEN** its temporary instance is reclaimed and no orphan effect remains under `GameRoot/Effect`.

#### Scenario: Effect binding is absent
- **WHEN** an enemy receives valid damage but its Inspector VFX binding is empty
- **THEN** damage and death processing continue without a hardcoded resource load, crash, or unrelated VFX.

### Requirement: No VFX on non-enemy damage receivers

The source propagation change MUST NOT make Player, Hero, Soldier, buildings, logs, or other non-enemy receivers play these enemy hit VFX.

#### Scenario: Non-enemy receiver is damaged
- **WHEN** a non-enemy damage receiver takes damage
- **THEN** its existing damage behavior is preserved and no enemy hit VFX is spawned by this change.
