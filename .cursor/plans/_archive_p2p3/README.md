# 旧 P2/P3/P4 计划归档

按 `AI_TASK_LIST.md` v3.1：旧技术切片 plan 已停用，新工作只建 `phase-N-*.md`。

**不要**再执行 `/build-plan p2-xxx` / `p3-xxx` / `p4-xxx`。做新 Phase plan 时，将此处产物列为【仅只读参考】。

## 旧 → 新 Phase 对照

| 旧 slug | 约状态 | 归入新 Phase |
|---|---|---|
| p2-001-player, p2-002-log, p2-003-enemy-minion, p2-014-joystick, p2-013（部分）, p3-001~003 | 多已 done | **Phase 1**（接线 + 补齐跑酷链） |
| p2-004-enemy-boss, p2-012-items | 部分 done / draft | **Phase 2** |
| p2-005~008, p2-006, p3-004, p4-005 | 混杂 done/draft/active | **Phase 3** |
| p2-009~011 | 多已 done | **Phase 4** |
| p2-013（barrier 等）, p3-005 | draft | **Phase 5** |
| （无完整结束 plan） | — | **Phase 6** 新建 |

## 目录

| 路径 | 内容 |
|---|---|
| `_archive_p2p3/<slug>.md` | 旧计划（21 份） |
| `_archive_p2p3/reports/<slug>-report.md` | 已执行 build 报告（14 份） |

## 新建计划

```
/plan-task 执行 AI_TASK_LIST.md Phase 1，slug=phase-1-parkour
```

根目录保留：`_TEMPLATE.md` 与 `phase-*.md`。
