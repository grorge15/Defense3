# configurable-game-audio build report

- Plan version: v3 (2026-09-15); v3 completes the permitted AC-6 loader-mock correction after v2 moved scene attachment and resource binding to the user.
- Risk level: medium.
- Continuation: yes. v3 resumes v2; scene/MCP work remains user-owned.
- Git baseline before the first v2 write: `530d617510e12a8adf4e248fafbc8f95a74757be`.

## Todo completion matrix

| Todo | Status | Evidence |
|---|---|---|
| A1 | complete | v2 plan, prior report, OpenSpec, rules, source paths, baseline, and working-tree state were reviewed before edits. |
| A2 | complete | Added `assets/scripts/core/AudioManager.ts` with Inspector cue settings, BGM/SFX channels, replay limits, source reuse, safe empty-clip handling, and lifecycle cleanup. |
| A3 | complete | Added `GameConfig` audio defaults: BGM `0.35`, SFX `0.8`, multiplier `1`, cap `8`, rate limits `0.1`/`0`. |
| A4 | complete | Added success-path calls for player, heroes, tower volleys, collection, build completion, hero spawn, and normal enemy deaths. |
| A5 | complete | `SceneSetup` exposes and resolves `AudioManager`; static requests no-op safely when it is unavailable. |
| A6 | complete | Added no-op `AttackReservation` and `AudioManager` loader mocks without changing assertions; both harnesses pass. |
| A7 | complete | OpenSpec consistency checked; user Inspector and listening work remains recorded below. |

## Changed files and diff summary

- Added `assets/scripts/core/AudioManager.ts`. AssetDB also generated `AudioManager.ts.meta`; no `.meta` or UUID was hand-edited.
- Added `.cursor/scripts/test-configurable-game-audio.cjs`.
- Updated the plan-owned scripts: `GameConfig`, `SceneSetup`, `CombatSystem`, `Hero`, `Soldier`, `CoinSystem`, `HeroShrine`, `EnemyMinion`, and `EnemyBoss`.
- Updated `.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` with loader-only `AttackReservation` and `AudioManager` mocks; gameplay code and test assertions are unchanged.
- `SceneSetup` listens for `BUILD_COMPLETE`; player and hero cues follow projectile initialization; the tower cue fires at most once after a launched volley; coin audio is only in the collection callback; normal deaths request audio outside `playFinalDeath`.
- No scene, prefab, existing audio resource, or OpenSpec behavior changes beyond the already-present v2 change were made. Existing concurrent `Player.ts`, `Main.scene`, prefab, and unrelated plan changes were preserved.

## AC results

| AC | Result | Evidence |
|---|---|---|
| AC-1 | pass | Audio harness verified eight cue configurations, null Hero 1 clip, defaults, intervals, and concurrency cap. |
| AC-2 | pass | Audio harness verified first-input BGM start, no duplicate loop, hide pause/show resume, and GameOver stop. |
| AC-3 | pass | Audio harness verified empty cues are silent and static checks place cues after each confirmed success point. |
| AC-4 | pass | Audio harness verified grouped tower volley playback and that both `playFinalDeath` implementations contain no normal-death cue. |
| AC-5 | pass | `node .cursor/scripts/test-configurable-game-audio.cjs` passed: 33 assertions across 4 scenarios. |
| AC-6 | pass | `node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` passed: 40 assertions across 8 scenarios. |
| AC-USER-INSPECTOR | pending user | Attach `AudioManager` to `SceneSetup`, assign the clips and values from the v2 plan, save, and reopen the scene. |
| AC-PLAY | pending user | Listen for BGM, attacks, death, coin, build, and hero-spawn audio after Inspector binding. |

## MCP metrics

| Metric | Count/value |
|---|---:|
| scene-open | N/A |
| scene-save | N/A |
| verify-mcp-gate | N/A |
| post-scene-save Patched | N/A |
| assets-reimport-asset | N/A |
| New prefabs | 0 |
| Continuation | yes |

## Remaining user verification

Machine acceptance is complete. User-owned scene verification remains: attach `AudioManager` to `SceneSetup`, bind the clips and numeric settings listed in the v3 plan, save and reopen the scene, then complete the listening check.
