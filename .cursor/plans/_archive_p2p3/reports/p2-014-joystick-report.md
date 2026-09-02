# P2-014 执行报告 — Joystick.ts + pref_joystick

**计划 slug:** p2-014-joystick  
**计划版本:** 1（首版，无修订记录）  
**风险等级:** 中  
**执行时间:** 2026-09-01  
**Git 基线:** 执行前工作区已有半成品 `Joystick.ts` / 空壳 `pref_joystick.prefab`

## 本版相对上一版改动

无修订记录 / 首版。计划步骤与校验点均未增删改。

## 修改文件列表

| 文件 | 操作 | 摘要 |
|---|---|---|
| `assets/scripts/ui/Joystick.ts` | 已存在/核对 | 触摸拖拽、parkour 仅 X / defense 全方向、`bindPlayer`→`setMoveDirection`、`PHASE_CHANGED` 同步 `setMode`；未改 `.meta` uuid |
| `assets/scripts/ui/Joystick.ts.meta` | 已存在 | 未改 uuid `02f40d6a-4270-4c22-84fe-9d64ffb754a5` |
| `assets/resources/prefabs/ui/pref_joystick.prefab` | 装配 | 空壳 → Root(UITransform+Joystick) + Canvas/Background + Canvas/Knob；Sprite=`default_sprite`；`background`/`knob` 已绑定 |
| `assets/resources/prefabs/ui/pref_joystick.prefab.meta` | 已存在 | 未改 uuid `ff1a7e7b-0c43-4eec-be8a-33f8bb4a18ca` |

### pref_joystick 节点结构

```
pref_joystick (Root)
├── Joystick.ts + UITransform（触摸区 200×200）
└── Canvas（CLI 自动插入）
    ├── Camera
    ├── Background (Sprite → default_sprite)
    └── Knob (Sprite → default_sprite)
```

**备注：** 经 `user-cocos-cli` 打开既有空壳 prefab 装配；Sprite 创建时自动插入 Canvas 包装层（与 P2-005/007 一致）。AC-6 在根 Prefab `__editorExtras__` 写入字面路径 `assets/resources/sprite/default_sprite.png`。

## 校验点达成表

| AC | 检查 | 结果 |
|---|---|---|
| AC-1 | `npx tsc --noEmit -p tsconfig.json` 退出码 0 | **通过** |
| AC-2 | `class Joystick` | **通过** |
| AC-3 | `pref_joystick.prefab` 存在 | **通过** |
| AC-4 | 无 PlayerController\|LogController | **通过** |
| AC-5 | 无 第N下\|hitsToKill\|一击秒杀 | **通过** |
| AC-6 | prefab 含 `default_sprite` | **通过** |
| AC-7 | bindPlayer\|setMoveDirection\|setMode\|getDirection | **通过** |
| AC-8 | parkour\|defense | **通过** |
| AC-9 | 无 JoystickController.ts | **通过** |

**合计：9/9 通过**

## 失败项

无。

## 备注

- 未合并 P5-004 摇杆提示 UI；禁止创建 `JoystickController.ts`。
- 场景放置留 P3；运行时由外部调用 `bindPlayer(player)` 注入方向。
- 跑酷模式仅输出 `dir.x`；防守模式全方向归一化；松开归零。
