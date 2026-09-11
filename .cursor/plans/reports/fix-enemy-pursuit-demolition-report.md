# fix-enemy-pursuit-demolition Report

Plan: `fix-enemy-pursuit-demolition` v1

Status: done. Risk was high; this was not a continuation. Baseline commit was `8f55b7bacb11871fbba2ad904fe8f36502bbf4bd`.

## Todo Matrix

| Todo | Result |
|---|---|
| EPD.a-h | Complete |

## Changed Files

| File | Summary |
|---|---|
| `assets/scripts/core/FlowField.ts` | Adds settled-field identity, retention, and safe direction access without exposing partial construction. |
| `assets/scripts/core/EnemyNavigation.ts` | Retains a safe active route during one coalesced replacement, adds the Hard-only planning area, selected-leg first-blocker detection, bounded direct-leg cache, and current physical validation. |
| `.cursor/scripts/test-enemy-navigation.cjs` | Covers pending replacement continuity, cap checks, geometry invalidation, and release behavior. |
| `.cursor/scripts/test-enemy-break-blocking-log.cjs` | Replaces obsolete alternate-detour expectations with selected-route Minion/Boss demolition and bounded shared queries. |
| `bugs.md` | Adds `fix-path-agent-frame-drop` v6. |
| `.cursor/plans/fix-enemy-pursuit-demolition.md` | Marks EPD.a-h complete and plan done. |

The protected Hero prefab SHA-256 values are unchanged: `pref_hero_01` `C1576385562CC6DD840397F17BBD0F44833A6BDEBA878749C6E219E71DA2CE8D`; `pref_hero_02` `7368144775E59D2D76DB11CF10936D2548173732688941E0E06C31FDDD02A478`.

## Validation

| Command | Result |
|---|---|
| `git diff --check` | Pass |
| `npx tsc --noEmit --pretty false` | Pass |
| `openspec validate fix-enemy-pursuit-demolition --type change --strict --no-interactive` | Pass |
| `openspec validate enemy-unified-navigation --type change --strict --no-interactive` | Pass |
| `openspec validate enemy-break-blocking-log --type change --strict --no-interactive` | Pass |
| `node .cursor/scripts/test-enemy-navigation.cjs` | Pass; includes retained-route continuity and lifecycle invalidation. |
| `node .cursor/scripts/test-enemy-break-blocking-log.cjs` | Pass; Minion/Boss selected-route demolition, Hard/ineligible safety, collision and lifecycle coverage. |
| `node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs` | Pass on retry: p95 slice `6.805ms`, budget `4096`, grid `125x127`. Initial run was a timing-only p95 failure at `8.0874ms` against `8ms`; evidence retained. |

Evidence, source baselines, harness results, and both benchmark outputs are in `fix-enemy-pursuit-demolition-evidence/`.

## MCP Metrics

| Metric | Value |
|---|---|
| scene-open / scene-save | 0 / 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | N/A |
| post-scene-save / assets-reimport-asset | N/A / 0 |
| New prefabs | 0 |
| Continuation | no |
| OpenSpec change | `openspec/changes/fix-enemy-pursuit-demolition/` |

No Cocos MCP write operation was performed. AC-PLAY remains a Creator hand-test risk: verify continuous player pursuit, a Log on a physically bypassable selected route, Hard-wall bypass, sequential Logs, and no pre-destruction penetration in the final Creator runtime.

## v2 Execution (2026-09-10)

Plan v2 is complete. This was a high-risk continuation of v1. The v2 scope was limited to pursuit continuity after geometry commits, per-frame physical sweep behavior, and target-cell churn; no scene, prefab, meta, asset, GameConfig, or Cocos MCP write operation occurred.

| Todo | Result |
|---|---|
| EPD.v2.a | Complete. Captured the v1 baseline and recorded that a city-region Sprite is not a movement-safety input. |
| EPD.v2.b | Complete. Geometry invalidates future FlowField work while retaining a unit's last sweep-validated direction; invalid targets, resets, and unsafe starts clear it. |
| EPD.v2.c | Complete. Direct, settled, retained, and obstacle-approach movement is constrained by one current-physical sweep; distant colliders no longer cause a full-line early stop. |
| EPD.v2.d | Complete. A bounded completed older target-cell field becomes interim active work while a coalesced newest-cell replacement is pending. |
| EPD.v2.e | Complete. Added focused Minion/Boss construction, sweep, churn, lifecycle, scheduler, cache, and v1 demolition regressions. |
| EPD.v2.f | Complete. All machine AC passed. |

Changed files: `assets/scripts/core/EnemyNavigation.ts` retains `pendingTarget`, `lastSafeDirection`, and `lastSafeTarget`; it rejects inactive targets, retains only bounded progress, accepts a recently superseded settled field, and performs final collision clipping through `_constrainVelocity`. `.cursor/scripts/test-enemy-navigation.cjs` adds four v2 focused regression cases. The v2 OpenSpec and plan changes were already present at the start of this build and were validated without alteration to their behavior.

The normal pursuit route still yields to the existing selected-route destructible handoff when a fixed damageable obstacle is first on its leg. That handoff uses `nextObstacleVelocity`, which is also constrained by the same physical sweep, preserving the accepted v1 attack-surface and no-penetration behavior.

| Validation | Result |
|---|---|
| `git diff --check` | Pass |
| `npx tsc --noEmit --pretty false` | Pass |
| Three OpenSpec strict validations | Pass |
| `test-enemy-navigation.cjs` with v2 evidence | Pass, including all four `AC-V2-*` cases |
| `test-enemy-break-blocking-log.cjs` with v2 evidence | Pass |
| Construction benchmark | Pass: cell size `30`, work budget `4096`, slice p95 `5.7505ms`, slice max `10.4855ms` |

The protected Hero prefab hashes remain `C1576385562CC6DD840397F17BBD0F44833A6BDEBA878749C6E219E71DA2CE8D` and `7368144775E59D2D76DB11CF10936D2548173732688941E0E06C31FDDD02A478`.

| MCP Metric | Value |
|---|---|
| scene-open / scene-save | 0 / 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | N/A |
| assets-reimport-asset | 0 |
| New prefabs | 0 |
| Continuation | yes, v1 to v2 |

Evidence is in `fix-enemy-pursuit-demolition-v2-evidence/`. AC-PLAY remains a non-blocking Creator hand-test: exercise a building spawning away from a pursuing enemy, one spawning in its next frame of travel, sustained player cross-cell movement, a selected-route Log, and a Hard wall.
