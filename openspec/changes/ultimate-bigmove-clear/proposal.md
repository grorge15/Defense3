## Why

当前大招收尾在触发时立即清空敌人，玩家看不到大招特效，也无法保证镜头拉远、特效播放和胜利结算形成明确的时序。场景还需要由用户配置多个大招表现点位，并在同一时刻播放既有 `Vfx_BigMove/BigMove`。

## What Changes

- 大招触发后立即锁定玩家移动，并复用现有跟随相机的拉远能力。
- 根据 `SceneSetup` 暴露并传入 `UltimateSystem` 的 `Node[]` 点位，同时生成并播放一次 BigMove VFX。
- 等待本次 BigMove 播放完成后，才停止刷怪、清空所有 `EnemyMinion`/`EnemyBoss`，并继续现有胜利结算。
- 对空或失效点位提供不阻塞胜利流程的运行时兜底；不改变用户在场景中摆放和绑定点位的职责。

## Non-goals（禁做）

- 不修改 `Main.scene`、任何 prefab、动画资源或场景点位绑定。
- 不新增第二套相机控制、结束 UI 或新的大招资源。
- 不改变高级塔完成事件、玩家大招入口或现有胜利结果语义之外的战斗规则。

## Capabilities

### New Capabilities

- `ultimate-bigmove-clear`

### Modified Capabilities

- 既有大招收尾与胜利结算时序。

## Impact

涉及运行时大招收尾、场景配置注入、相机复用和临时 VFX 实例生命周期。既有 `Vfx_BigMove.prefab` 与 `BigMove.anim` 作为只读资源复用；场景编辑和资源制作由用户或其他任务负责。

## Execution pointer

装配、文件清单与机器 AC 见 `.cursor/plans/ultimate-bigmove-clear.md`。
