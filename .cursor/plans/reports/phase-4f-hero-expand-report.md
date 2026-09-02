# phase-4f-hero-expand 执行报告

- **计划版本**：1（首版）
- **修订记录摘要**：首版，无相对上一版的步骤/校验点改动
- **计划状态**：`done`（机器 AC 全过；AC-EDITOR / AC-G4 待用户）
- **风险等级**：中
- **4.26 采用方案**：**场景 `GameRoot/UI/HeroSelect` + HeroSelectUI（优先路径已就绪）**；同时 **`HeroShrine.autoSelectOnActivate=true`（默认）** 便于 G4 跳过无卡面美术的 UI 直接选英雄 0。正式二选一手测请在 Inspector 关闭 `autoSelectOnActivate`。
- **禁止项**：未创建 `pref_ui_hero_select.prefab`（亦不存在）

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 4.26.a MCP 查/挂 BuildSystem | **完成**（已在 `GameRoot/World/Buildings`） |
| 4.26.b 场景 HeroSelect 树 **或** autoSelect | **完成**（两者均具备；G4 默认走 autoSelect） |
| 4.26.c HERO_SELECT_REQUESTED → onHeroSelected → pref_hero_* | **完成**（代码路径核对；autoSelect 直接 `onHeroSelected(0)`） |
| 4.26.d 禁止产出 pref_ui_hero_* | **完成**（未创建） |
| 4.27.a setFollowTarget + playerNode | **完成** |
| 4.27.b 英雄弹道 prefab 已绑 | **完成**（核对，无需补绑） |
| 4.27.c Play 跟随攻击 | **待用户** |
| 4.28.a expand/Barrier/高级塔引用 | **完成** |
| 4.28.b 选英雄后 expand / Barrier 逻辑 | **完成**（代码+引用；Play 待用户） |
| 4.28.c SCENE_PLACEMENT §4.F | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scenes/Main.scene` | MCP：BuildSystem 绑 `heroShrinePlots` / `expandPlots` / `towerAdvancedPlots` / `heroShrinePrefab` / `heroPrefab01/02` / `playerNode` / Barrier 四根；`SceneSetup.heroSelectUI`→HeroSelect |
| `assets/scripts/building/HeroShrine.ts` | `@property autoSelectOnActivate` 默认 true；为 true 时跳过 UI 直接选英雄 0 |
| `docs/SCENE_PLACEMENT.md` | 新增 §4.F 接线表；更新解锁表兵营→英雄碑说明 |

> 只读核对：`BuildSystem.ts`（`_onHeroSpawned`→`setFollowTarget`）、`Hero.ts`（`tryAttack`/`_spawnProjectile`）、`pref_hero_01/02` 弹道 uuid 已绑。

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-4.26-NO-PREFAB | **通过** | `Test-Path …/pref_ui_hero_select.prefab` → **False** |
| AC-4.26-WIRE | **通过** | MCP：`GameRoot/World/Buildings`+`BuildSystem`；`heroShrinePlots`/`heroShrinePrefab`/`heroPrefab01/02` 非空；兵营后 `_revealPlots(heroShrinePlots)` |
| AC-4.26-SELECT | **通过** | 场景 `GameRoot/UI/HeroSelect`（Mask/Card0/Card1，Card 尺寸 220×320）+`HeroSelectUI`；**且** `autoSelectOnActivate=true`（G4 默认） |
| AC-4.27-FOLLOW | **通过** | `setFollowTarget` 匹配 2；MCP `playerNode`=`GntZJUm790IHqkzwIPv1AO`（`pref_player`）非 null |
| AC-4.27-ATK | **通过** | `tryAttack|_spawnProjectile` 匹配 4；英雄 prefab 弹道 uuid 已绑 |
| AC-4.28-EXPAND | **通过** | MCP：`expandPlots` / `barrierWallL/R` / `barrierLongCenter` / `expandSideWalls` / `towerAdvancedPlots` 均非 null |
| AC-4.25-V | **不适用** | 本 plan 不涉及 PhaseTransition |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-S1 | **通过** | 磁盘 `Main.scene` `"_id": "Node.` 匹配数 **0** |
| AC-S2 | **通过** | `scene-query-node` Buildings `nodeId=c2ehRPx+azqEJmDic2ehRP`（非 `Node.*`）；HeroSelect=`AnfDVQsQpKpTslyd6Exaus` |
| AC-GATE | **通过** | `verify-mcp-gate.ps1` exit 0（见下） |
| AC-EDITOR | **待用户** | 编辑器打开 Main.scene 无 missing/红错 |
| AC-G4 | **待用户** | Play：建碑→（自动选或关 autoSelect 后点卡）→跟随攻击→拓展地块→Barrier/高级塔 |

## verify-mcp-gate 输出

```
PASS AC-S1: Main.scene has no Node.* _id
PASS AC-S1b: prefab instances have no null refs
PASS AC-P1: assets/resources/prefabs/character has no Canvas
PASS AC-P1: assets/resources/prefabs/building has no Canvas
PASS AC-P2-CANVAS: prefabs/ui has no Canvas
PASS AC-P2-CAMERA: prefabs/ui has no Camera
PASS AC-P2-SIZE: prefabs/ui has no UITransform 1x1 placeholder
PASS AC-P-FAKE: no default_sprite literal in prefabs
PASS AC-P-EXTRA: no default_sprite in __editorExtras__

MCP gate (machine): ALL PASS
gate_exit=0
```

## 失败项与障碍

- 无机器 AC 失败。
- **待用户**：AC-EDITOR、AC-G4 / Play 清单。
- **备注**：HeroSelect 卡面 `cardStyle*` / `heroIcon*` SpriteFrame 仍空（§5 补美术）；G4 依赖 `autoSelectOnActivate`。关闭该开关后可测场景 UI 点击（卡区有尺寸，无底图）。

## Play 清单（留给用户）

1. 推进至兵营建成 → 出现 `Plot_HeroShrine` → 建碑
2. **默认**：自动生成 `pref_hero_01`，相机/英雄跟随玩家并可射伤小怪
3. 出现 `Plot_Expand` → 购买完成后 Barrier 根与高级塔地块激活
4. （可选）Inspector 关闭 `HeroShrine.autoSelectOnActivate`，验证 `HeroSelect` 二选一面板点击
