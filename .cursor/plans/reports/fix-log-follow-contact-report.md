# fix-log-follow-contact 执行报告

- **计划版本**：1（首版）
- **修订记录摘要**：方案 2 — Dynamic + offset 跟随；黄蓝线 Y；小怪 AABB 挡路
- **计划状态**：`done`（机器 AC 全过；AC-2/3/4/EDITOR Play 待用户）
- **风险等级**：中

## To-dos 完成矩阵

| Todo | 状态 |
|---|---|
| 1.a Player Dynamic + 仅 linearVelocity | **完成** |
| 1.b Log `_followOffset` 跟随 | **完成**（rolling/charging 全 offset） |
| 1.c Log 黄/蓝线世界 Y 轮询 | **完成** |
| 1.d EnemyMinion AABB 挡路 | **完成** |
| 1.e MCP Yellow Y=220 / Blue Y=300 + 文档 | **完成** |
| 1.f tsc + gate | **完成**（手测待用户） |

## 修改文件列表

| 文件 | 摘要 |
|---|---|
| `assets/scripts/character/Player.ts` | Dynamic；有刚体只写 `linearVelocity`，禁叠加 `setPosition` |
| `assets/scripts/item/Log.ts` | 绑定瞬间 offset 跟随；解析/越过 YellowLine·BlueLine Y |
| `assets/scripts/enemy/EnemyMinion.ts` | 拟议位移与 Log `worldAABB` 相交则停 |
| `assets/scenes/Main.scene` | 黄线 Y 664→**220**；蓝线 Y 878→**300**；Node.* 补丁 44 tokens |
| `docs/SCENE_PLACEMENT.md` | 黄蓝线 Y + 滚木 offset 说明 |

## 校验点达成表

| AC | 结果 | 证据 |
|---|---|---|
| AC-1 | **通过** | `npx tsc --noEmit` exit 0 |
| AC-2 | **待用户** | 运行时 Y 差约 60–80，不漂到 ~200 |
| AC-3 | **待用户** | 黄线蓄力 / 蓝线固定或淡出 |
| AC-4 | **待用户** | 小怪不能穿滚木 |
| AC-S1 | **通过** | patch 后 0× `"_id": "Node.` |
| AC-S1b / GATE | **通过** | `verify-mcp-gate.ps1` exit 0 |
| AC-EDITOR | **待用户** | 打开 Main.scene 无红错 |

## verify-mcp-gate

```
PASS AC-S1 / AC-S1b / AC-P1 / AC-P2 / AC-P-FAKE / AC-P-EXTRA
MCP gate (machine): ALL PASS
gate=0
```

## 失败项

无机器失败。

## Play 清单

1. 开局玩家–滚木 Y 差约 60–80  
2. 前进 10s+ 间距仍同量级（不→200）  
3. 到 Y≈220 蓄力脉冲；到 Y≈300 固定或不够长淡出  
4. 预置/刷出小怪撞滚木停住，不穿模贴脸  
