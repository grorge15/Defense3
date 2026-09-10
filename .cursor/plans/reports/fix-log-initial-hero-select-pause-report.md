# fix-log-initial-hero-select-pause Build Report

## Plan And Continuation

- Plan v2, 2026-09-09; status done; medium risk (world pause and independent UI clock).
- Continuation from P2. P1 was completed by the main thread. No scene survey or prefab assembly was repeated.
- v1 was draft; v2 confirms `0.4 + L * 0.2`. The stale conflicting `log-hero-select-pause` spec was removed by the main thread before implementation. Only `log-initial-and-selection-pause` remains authoritative.
- Git baseline HEAD: `0eaa18dc4db4a06313aed088ccd16c594ffec3a5`. Existing dirty GameConfig, Log, bugs, combat/navigation scripts and prefabs were retained. No reset/checkout was used.
- Main-thread scene/prefab/meta baseline: count 564, SHA256 `768b52a59cb295331ba45877f3022da2a9cb4207ee4b8d1c8590be69db6632f0`. PASS: main thread verified final count and SHA256 exactly match this baseline.

## Todo Matrix

| Todo | Status | Evidence |
|---|---|---|
| P1 | Complete, main thread | Confirmed formula, active v2 and synchronized spec |
| P2 | Complete | Initial/restart length 3; shared visual/collider mapping |
| P3 | Complete | BEFORE_DRAW updates only this UI; no tween or scheduled callback |
| P4 | Complete | Owned pause, lifecycle cleanup, duplicate-click guard and scene-launch cleanup |
| P5 | Complete | All machine AC passed; bugs recorded; final hash matches baseline; report completed |

## Changed Files

- `assets/scripts/core/GameConfig.ts`: added three initial-length/visual mapping constants. Existing fixed-collider and navigation changes retained.
- `assets/scripts/item/Log.ts`: changed field initialization, beginParkour reset and visual mapping only. Existing fixed collider implementation retained.
- `assets/scripts/ui/HeroSelectUI.ts`: replaced UI tweens with opening/idle/closing states, independent render-frame clock and scoped touch handlers. Cleanup restores transforms on valid nodes and releases only modal-owned, non-GameOver pause.
- `bugs.md`: existing `fix-log-visual-length-scale` receives v3; separate `fix-hero-select-world-pause` entry added after tests passed.
- Plan and this report: progress and verification evidence. OpenSpec was read only by this build agent.
- Test script belongs to the main thread and was not edited. No scene/prefab/meta writes or MCP calls.

## Test Entrypoints

- Real methods: `_onSelectRequested`, `_onCardPicked`, `beginParkour`, `onDisable`, `onDestroy`.
- New internal methods: `_onBeforeDraw`, `_closePanel`, `_cleanupPanel`, `_getOpacity`.
- Clock: `performance.now()` in milliseconds, advanced on `Director.EVENT_BEFORE_DRAW`. No global TweenSystem updates.
- Scene cleanup listens to `Director.EVENT_BEFORE_SCENE_LAUNCH`. Mock requirements are standard director events/pause APIs, `isValid`, GameManager.getPhase and existing basic cc UI APIs.
- Selection establishes closing state before invoking shrine; no post-callback UI writes can revive a synchronously closed/destroyed panel. The existing shrine selection/loading flow is unchanged.

## Acceptance Results

| Check | Result |
|---|---|
| `npx tsc --noEmit --pretty false` | PASS, exit 0 after final code changes; main thread independently reran successfully |
| `node .cursor/scripts/test-log-hero-select-pause.cjs` | PASS, 9 behavioral cases confirmed by main thread, including scene switch, BEFORE_DRAW GameOver automatic close and synchronous shrine hide without restarting a closing transition |
| Focused in-memory supplemental checks | PASS: direct duplicate picks, synchronous shrine hide, scene launch and same-frame GameOver; test file unchanged |
| `openspec validate fix-log-initial-hero-select-pause --type change --strict --no-interactive` | PASS, exit 0; final main-thread verification also exit 0 |
| `git diff --check` | PASS, final main-thread verification exit 0 before this status-only closeout; main thread owns the post-closeout rerun |
| Engine source review | Main thread confirms director.pause skips simulation systems, input/draw continue, and Game._calculateDT refreshes _startTime every frame so resume does not accumulate paused dt |
| Scene/prefab/meta | PASS: main-thread final count 564 and SHA256 exactly match baseline; no writes by this agent |
| Editor gameplay | NOT RUN; no claim of end-to-end physical/attack/spawn/async-loading gameplay verification |

## MCP Metrics

| Metric | Count |
|---|---|
| MCP calls | 0 |
| Scene sessions/saves | 0 |
| Prefabs created/rebuilt | 0 |
| MCP gates | Skipped: scripts/documents only |

## Failures And Remaining Work

- Initial hard block: duplicate contradictory spec. Resolved by main-thread removal before code edits; no replan remains necessary.
- One documentation apply_patch failed because a partial todo line did not match. Confirmed no partial bugs entry was written, then reapplied with exact lines successfully.
- All machine AC passed; no remaining build blocker. Editor gameplay remains a nonblocking manual check, including real async hero load and long selection dwell.
- No global director.pause hook, arbitrary new pause ownership mechanism or other game-script modification was introduced.
