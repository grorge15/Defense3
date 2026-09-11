# Ten-step player guidance build report

Plan version: v1. Revision summary: first build attempt; GUIDE.a through GUIDE.c completed. Risk level: medium. Continuation: no.

## Todo matrix

| Todo | Status | Evidence |
| --- | --- | --- |
| GUIDE.a | Complete | Read plan, report absence, OpenSpec, rules, current disk and recorded baseline `610b65ef357e74460507fad0b0ca96fd1fa8ddaa`; snapshots are in `%TEMP%\\defense3-ten-step-player-guidance-baseline`. |
| GUIDE.b | Complete | Added one-shot growth-item event, BuildPlot remaining-cost/status reads, and BuildSystem completed-plot history. |
| GUIDE.c | Complete | Replaced the old bow-only guide with ordered ten-step controller, SceneSetup binding, lifecycle suppression, nearest target selection and focused VM regression. |
| GUIDE.d | Blocked | Cocos prefab/scene assembly was interrupted before a prefab could be created or Main.scene saved. |
| GUIDE.e | Not run | Requires completed scene/prefab assembly. |
| GUIDE.f | Blocked | Final machine gate cannot run until GUIDE.d succeeds. |

## Changed files

| File | Summary |
| --- | --- |
| `assets/scripts/core/GameEvents.ts` | Added `LOG_EXTEND_ITEM_CONSUMED`. |
| `assets/scripts/core/GameConfig.ts` | Added central guidance refresh, tolerance, placement and safe-area constants. |
| `assets/scripts/item/LogExtendItem.ts` | Exposes consumption state and emits exactly once at successful consume. |
| `assets/scripts/building/BuildPlot.ts` | Exposes non-negative remaining cost and complete state. |
| `assets/scripts/building/BuildSystem.ts` | Records completed plot roots for this scene instance and exposes a read-only query. |
| `assets/scripts/game/CombatGuideController.ts` | Implements target progression, wall prerequisites, funding diversion, completion history and lifecycle handling. |
| `assets/scripts/game/SceneSetup.ts` | Resolves the preplaced guide UI and injects existing scene references. |
| `assets/scripts/ui/GuideIndicatorUI.ts` | New display-only component for world-to-UI projection and pause-safe visual hiding. |
| `.cursor/scripts/test-ten-step-player-guidance.cjs` | New real-TypeScript VM regression test. |
| `.cursor/plans/ten-step-player-guidance.md` | Marked the completed implementation todos and plan active. |

Existing user changes to `assets/resources/prefabs/VFX/pref_vfx_hit_blue.prefab` and `assets/resources/prefabs/VFX/pref_vfx_hit_yellow.prefab` were preserved and are outside this task.

## AC results

| AC | Result | Evidence |
| --- | --- | --- |
| AC-SPEC | Pass | `openspec validate ten-step-player-guidance --type change --strict --no-interactive` returned valid; status reports proposal and player-guidance spec complete. |
| AC-TS | Pass before MCP assembly | `npx --no-install tsc --noEmit` returned 0 after the import fix. |
| AC-GUIDE | Pass | `node .cursor/scripts/test-ten-step-player-guidance.cjs` passed nearest growth pickup, one-shot consumption, fixed/bow transition, wall prerequisites, affordability diversion, early right-tower history, empty enemy list and termination. |
| AC-PAUSE-REGRESSION | Pass | `node .cursor/scripts/test-log-hero-select-pause.cjs` returned 0. |
| AC-SCOPE | Partial | `git diff --check` passed before the editor interruption. Final scope check remains pending. |
| AC-GATE / AC-P3 / AC-P3b / AC-EDITOR-MCP | Not run | No committed guide prefab or saved Main.scene exists. |

## MCP metrics

| Metric | Value |
| --- | --- |
| Defense3 path check | 1 successful: `db://assets/scenes/Main.scene` resolved to this repository |
| assets-refresh | 1 successful for `db://assets/scripts` |
| scene-open | 1 successful for Main.scene |
| transient source tree | `UI/GuideIndicatorSource`, `GuideIndicatorUI`, `DirectionArrow`, `TargetArrow` created only in the unsaved open editor session |
| confirmed SpriteFrame binding | Direction arrow bound to `指向箭头-指向.png` |
| target SpriteFrame/component reference | Unconfirmed; batch call was interrupted |
| scene-save | 0 |
| post-scene-save | 0 |
| assets-reimport-asset | 0 |
| new prefab persisted | 0 |
| verify-mcp-gate | 0 |

## Blocker and replan target

After the successful scene setup calls, `cocos-cli/scene-query-current` hung twice and was externally interrupted. The final property-batch call was also interrupted. Per `.cursor/rules/cocos-mcp.mdc`, retries are exhausted and this run must not handwrite a prefab or Main.scene as a fallback.

Replan or resume target: `GUIDE.d`. Reconnect or stabilize the Defense3 Cocos CLI, query the still-open scene state, finish the two SpriteFrame/component bindings, create `pref_ui_guide_indicator` using `create-prefab-from-node`, instantiate it under `UI`, delete the temporary source tree, save once, run post-scene processing, then complete GUIDE.e and the task-level MCP gate.

AC-PLAY, AC-PLAY-UI and AC-PLAY-RESET remain pending user/editor testing; they do not block completion once the required machine gates pass.

## v2 continuation — world prefab guidance

Plan version: v2. Revision: replaced the unfinished projected UI marker with world-space `DirectionArrow` and `TargetArrow` prefabs. Risk: medium. Continuation: yes, resumed at GUIDE.d with the v1 business-state work preserved.

### Todo matrix

| Todo | Status | Evidence |
| --- | --- | --- |
| GUIDE.a–c | Complete (carried forward) | v1 implementation and passing AC-SPEC, AC-TS, AC-GUIDE, and prior pause regression are retained. |
| GUIDE.d | Complete | Rebuilt both world prefabs through Cocos `create-prefab-from-node`; installed `GameRoot/GuideIndicator`, `GameRoot/DirectionArrow`, and `GameRoot/TargetArrow`; removed `UI/GuideIndicatorSource`. |
| GUIDE.e | Blocked | All v2 checks passed except `test-log-hero-select-pause.cjs`, which overflows TypeScript's stack while transpiling `HeroSelectUI.ts`. |
| GUIDE.f | Blocked | This report records the v2 results, but plan completion waits for the required pause regression. |

### v2 changed files

| File | Summary |
| --- | --- |
| `assets/scripts/ui/GuideIndicatorUI.ts` | Replaced screen projection with world-space `atan2` rotation, fixed-spacing prefab pooling, BuildPlot child targeting, sin bobbing, and pause-safe hiding. |
| `assets/scripts/core/GameConfig.ts` | Marked arrow measurements as world units and removed the unused UI safe margin. |
| `.cursor/scripts/test-ten-step-player-guidance.cjs` | Added real-module coverage for BuildPlot anchoring, world rotation, pooling, bobbing, zero distance, and pause hiding. |
| `assets/resources/prefabs/VFX/{DirectionArrow,TargetArrow}.prefab` | Rebuilt through Cocos MCP as `Root -> Visual` world prefabs with the requested SpriteFrames. |
| `assets/scenes/Main.scene` | Added the three GameRoot nodes and bindings, removed the old UI source, and applied the required node-ID post-save patch. |
| `docs/SCENE_PLACEMENT.md` | Documented world hierarchy, resources, dimensions, and ownership. |

Other dirty files were present before this continuation and were preserved. `git diff --check` passed; the shared Main.scene contains unrelated concurrent edits and the required post-save ID remap.

### AC results

| AC | Result | Evidence |
| --- | --- | --- |
| AC-SPEC | Pass | Strict OpenSpec validation returned 0 and status reports complete proposal/specs. |
| AC-TS | Pass | `npx --no-install tsc --noEmit` returned 0. |
| AC-GUIDE | Pass | Ten-step regression returned 0, including the new world presentation test. |
| AC-PAUSE-REGRESSION | Blocked | Two runs of `node .cursor/scripts/test-log-hero-select-pause.cjs` ended in `RangeError: Maximum call stack size exceeded` inside `typescript.js` while transpiling the existing HeroSelectUI chain; an `--stack_size=8192` run did not complete within 60 seconds. |
| AC-SCOPE | Partial | `git diff --check` returned 0. Shared worktree changes are outside this plan's baseline and were not reverted. |
| AC-GATE | Pass | `verify-mcp-gate.ps1` passed S1, S1b, P1, P2, P-FAKE, and P-EXTRA. |
| AC-P3 | Pass | Both rebuilt prefab assets report `invalid: false`. |
| AC-P3b | Pass | Each prefab has only `Root -> Visual`, a SpriteFrame, RAW size mode, and no Canvas or Camera; the Main component has non-null base-node and DirectionArrow prefab references. |
| AC-S2 | Pass | `post-scene-save.ps1` patched 71 Node.* tokens, left zero, synchronized the library, and Main.scene reopened with compressed IDs. |
| AC-EDITOR-MCP | Pass with non-resource CLI history | Main.scene and both prefabs opened. MCP reports no Missing Script or resource error; its retained error log only contains this run's earlier failed `/Visual` query, before the correct component suffix was discovered. |

### MCP metrics

| Metric | Value |
| --- | --- |
| scene-open | 5 v2 opens: initial Main, patched Main, both prefabs, final Main |
| scene-save | 1 |
| post-scene-save | `Patched=1`, 71 tokens patched, 0 remaining |
| assets-refresh | 1 (`assets/scripts/ui`) |
| assets-reimport-asset | 1 (Main.scene, after patch) |
| verify-mcp-gate | 1, pass |
| prefab disposition | DirectionArrow and TargetArrow rebuilt through `create-prefab-from-node`, then reused as GameRoot base instances |
| temporary Canvas wrappers | CLI-generated wrappers were deleted before the only save; none persisted in assets or Main.scene |

### Blocker and resume target

Resume at GUIDE.e after stabilizing the existing `test-log-hero-select-pause.cjs` TypeScript transpile stack failure, then rerun that exact command, update the AC row, mark GUIDE.e/f complete, and finalize the plan. Gameplay checks AC-PLAY, AC-PLAY-WORLD, and AC-PLAY-RESET remain user/editor evidence and do not block machine completion.
