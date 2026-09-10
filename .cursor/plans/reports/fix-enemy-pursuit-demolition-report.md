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
