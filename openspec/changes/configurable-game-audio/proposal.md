# 可配置游戏音频

## Why

当前游戏没有统一的音频配置或播放路径，已导入的背景音乐和关键反馈音效无法在玩法中可靠播放或由 Inspector 调整。

## What Changes

- 新增场景级、Inspector 可配置的背景音乐和短音效管理。
- 为成功的攻击、金币收集、建造、英雄生成和普通怪物死亡增加听觉反馈。
- 保护浏览器自动播放限制、高频事件和终结清场的既有行为。

## Impact

- Affected specs: `configurable-game-audio`
- Affected code: 场景初始化、战斗、英雄、塔兵、金币、英雄圣地和敌人死亡流程。
