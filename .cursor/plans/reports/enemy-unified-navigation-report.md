# Enemy Unified Navigation Report

Plan: `enemy-unified-navigation` v2

Status: completed. Risk: high, because this continues the accepted v1-v3 shared navigation implementation and changes enemy movement and combat target selection. This was a continuation from baseline commit `7811e198f2c1b399a2dcd80ae1cbb2b68f88379d`.

## Completion Matrix

| Todo | Result |
|---|---|
| UNAV.1 | Done: unified configuration, explicit obstacle enum, and serialization-only legacy compatibility. |
| UNAV.2 | Done: physical normal route first, bounded shared one-candidate diagnostic, component-label fix. |
| UNAV.3 | Done: generic Minion/Boss/AI obstacle damage and original-target resumption. |
| UNAV.4 | Done: physical gap, hard/ignore/destructible, multi-collider, dynamic, and lifecycle regressions. |
| UNAV.5 | Done: focused checks passed and evidence persisted. |

## Changed Files

- `assets/scripts/core/FlowField.ts`: fixed disconnected-component labeling and removed portal/castle crossing gates; legacy area fields are inert compatibility data.
- `assets/scripts/core/EnemyNavigation.ts`, `NavigationObstacle.ts`: unified physical area, editor `Enum` obstacle classification, shared incremental candidate diagnostics, multi-collider handling, and CircleCollider2D envelope support.
- `assets/scripts/enemy/EnemyAI.ts`, `EnemyMinion.ts`, `EnemyBoss.ts`: generic actionable obstacle selection/hits, correct nonlethal invalidation behavior, actual body envelopes, and Boss Building-behind-Log diversion priority.
- `assets/scripts/building/Building.ts`, `Barrier.ts`, `assets/scripts/item/Log.ts`: invalidate navigation on effective destruction.
- `assets/scripts/building/BuildSystem.ts`, `assets/scripts/core/GameEvents.ts`, `assets/scripts/enemy/EnemySpawner.ts`: remove runtime entrance routing/configuration updates; keep legacy binding deserialization compatibility.
- `.cursor/scripts/test-enemy-navigation.cjs`: 44 core assertions, including metadata-inert physical flow and real fixed-Log contact.
- `.cursor/scripts/test-enemy-break-blocking-log.cjs`: 27 lifecycle/demolition assertions using current Minion Circle and Boss Box collider envelopes.
- `bugs.md`: appended the existing `enemy-break-blocking-log` v3 entry.

Foreign changes observed before and during this work, including `Main.scene`, prefabs, settings, historical evidence, user HeroShrine hunks, and the editor-generated `NavigationObstacle.ts.meta`, were preserved. This implementation did not manually edit scene, prefab, or metadata files.

## Acceptance Evidence

| Check | Result |
|---|---|
| `git diff --check` | Pass |
| `npx tsc --noEmit --pretty false` | Pass |
| `openspec validate enemy-unified-navigation --strict` | Pass |
| `test-enemy-navigation.cjs` | Pass, 44 assertions |
| `test-enemy-break-blocking-log.cjs` | Pass, 27 assertions |
| construction benchmark | Pass: grid `125x127`, cell `30`, cap `4096`, slice p95 `6.571ms`, slice max `11.1739ms` |

`AC-UNIFIED` verifies closed legacy portal/castle metadata cannot change line clear or direction, while a real full-height collider wall remains blocked. `AC-COMPONENTS` verifies the `0..140 x 0..60` full-height divider remains unreachable. Lifecycle evidence verifies both roles move, attack once, destroy, and resume; locked Building-behind-Log, unrelated Building/Barrier, dynamic classification, pooling, and multi-collider cases pass.

Evidence:

- `.cursor/plans/reports/enemy-unified-navigation-evidence/test-enemy-navigation/logic-results-v3.json`
- `.cursor/plans/reports/enemy-unified-navigation-evidence/test-enemy-break-blocking-log/tests.json`
- `.cursor/plans/reports/enemy-unified-navigation-evidence/construction-jobs-v3.json`

## Hashes

| File | SHA-256 |
|---|---|
| `FlowField.ts` | `18d70e3798edbea3b2498e1e71117a73f1f8f2def218df3a35849c58180b68d3` |
| `EnemyNavigation.ts` | `29e1a79461ab8672dec0f959bf404331deb66445c331e6f5e007314dc29dbeb3` |
| `NavigationObstacle.ts` | `93b55270dcc8f3ccb0dd85ea584bffe49d23842b2497f369603ccfc7b192ee99` |
| `EnemyAI.ts` | `7847c585a5eac2af4ab03c70ea1ba074f2a3cf5bcff723196b0ac51922b10743` |
| `EnemyMinion.ts` | `27b900d174300d358cd2ebc6e5297a8f0f16e2cbace55efbec0267c14b1aaeb7` |
| `EnemyBoss.ts` | `fe1e2b0b081868b9f512a5170b576eef022a51b8ce2baa98a2cff534b0a0a288` |
| core harness | `6e3820ebe4296527acf3375f8f5e828861d81e42308a24c9e2b3fddc17e8c80e` |
| lifecycle harness | `2a891a1b0a05886aa83c749594abb874ff4c7cb18f45c89dd97e2229abdbc1f3` |
| benchmark harness | `2ee2e7294aeeeecea54830548c689b670c73e145b33c1786639db344932af633` |
| `Main.scene` (foreign, unedited) | `9f2d532543a5669a5de622c248130b61ee8bf7fd69cc0c481503150c33deaf8b` |

## MCP And Remaining Risk

| Metric | Value |
|---|---:|
| MCP/scene operations | 0 |
| scene saves | 0 |
| Creator trace | not run; not required by this pure-script plan |

There are no machine-acceptance blockers. Runtime Creator play/trace remains supplementary validation only and was not performed.

## Editor Configuration

`EnemySpawner` now requires only the existing walkable-ground polygon, with optional navigation bounds. The polygon must cover the spawn positions and the intended movement area. Castle and entrance fields no longer appear in its Inspector or constrain routes.

Add `NavigationObstacle` on the same node as a blocking `BoxCollider2D` to override inferred classification. Its `kind` dropdown contains `Ignore`, `Hard`, and `Destructible`. Existing fixed attackable Log and living Building/Barrier objects are destructible by default; Wall and airWall objects are hard by default. A destructible marking needs an existing Log/Building/Barrier damage implementation; unsupported objects remain solid and cannot be demolished. Ignore changes navigation classification, not the physics collision matrix.

Only one Log is assumed. Other buildings can coexist: the service evaluates whether removing a candidate individually enables the original objective. It does not plan a sequence that requires removing multiple obstacles. A normal route is always preferred, and a hard enclosure with no useful removable obstruction remains unreachable.
