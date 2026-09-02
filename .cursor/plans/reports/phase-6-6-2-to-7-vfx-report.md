# phase-6-6-2-to-7-vfx 执行报告

- **计划版本**：1
- **修订记录摘要**：首版；范围 6.2–6.7；跳过 6.1 / 6.8；无 MCP 场景
- **计划状态**：`done`（机器 AC 全过；Play 待用户）
- **本批**：仅脚本/数值；不改 Main.scene

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 6.2 JoystickHintUI 倒 8 + 触屏即停 | **完成** |
| 6.3 TweenUtil + Coin 掉落/吸附 + 道具 hop | **完成**（弧高入 GameConfig） |
| 6.4 Log 蓄力脉冲 + 失败淡出 | **完成** |
| 6.5 Boss 血条缓冲 | **完成**（HpBarUI lateUpdate 已有） |
| 6.6 Barrier/Wall HitFlash | **完成** |
| 6.7 HeroSelect 淡入/选中缩放/bob/淡出 | **完成** |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/ui/JoystickHintUI.ts` | ∞ 倒 8 循环；输入即停复位 |
| `assets/scripts/core/TweenUtil.ts` | 贝塞尔 / 淡出 / hopToWorld |
| `assets/scripts/item/Coin.ts` | 掉落抛物线 + 吸附弧 |
| `assets/scripts/game/CoinSystem.ts` | dropAt 传入 dropFrom |
| `assets/scripts/item/BowItem.ts` / `LogExtendItem.ts` | 拾取 hop；弧高读 Config |
| `assets/scripts/item/Log.ts` | 黄线蓄力脉冲；不够长淡出 |
| `assets/scripts/ui/HpBarUI.ts` | Boss 白条缓动（核对） |
| `assets/scripts/core/HitFlash.ts` | 闪红工具 |
| `assets/scripts/building/Barrier.ts` / `Wall.ts` | flashRed → HitFlash |
| `assets/scripts/ui/HeroSelectUI.ts` | 选中 ×1.12 缩放（核对） |
| `assets/scripts/core/GameConfig.ts` | figure8 / coin arc / log VFX / hitFlash / itemPickupArcHeight |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-6.2 | **通过** | `joystickHintFigure8` + sin/cos 倒 8；有输入 `_setVisible(false)` |
| AC-6.3 | **通过** | `TweenUtil.moveWorldParabola` / Coin drop+magnet / hopToWorld |
| AC-6.4 | **通过** | `_startChargePulse` / `_fadeOut` + TweenUtil |
| AC-6.5 | **通过** | `bufferSprite` lateUpdate lerp `hpBarBufferLerpSpeed` |
| AC-6.6 | **通过** | `HitFlash.flash`；Barrier.takeDamage / Wall.flashRed |
| AC-6.7 | **通过** | `_fadeIn` / 选中 scale 1.12 / CARD_BOB / `_fadeOut` |
| AC-COMPILE | **通过** | `npx tsc --noEmit` exit 0 |
| AC-NO-SCENE | **通过** | 未改 Main.scene |
| AC-PLAY | **待用户** | G1 蓄力淡出；G2 金币弧；G4 选卡；Barrier 闪红；Boss 白条 |

## 失败项

无机器失败。

## Play 清单（留给用户）

1. 跑酷无操作 3s：提示倒 8；一碰摇杆即停
2. 击杀：金币抛物落地再吸附；拾弓/加长有短弧
3. 黄线：滚木脉冲；蓝线不够长：淡出消失
4. Boss 扣血：红即时、白缓跟
5. 打 Barrier：闪红；选英雄卡：放大后淡出
