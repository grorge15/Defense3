# shared-path-agent Build Report

## Plan

- Plan version: v1
- Revision summary: v1 initial plan for shared PathAgent pursuit/follow movement.
- Final plan status: done
- Risk level: medium
- Continuation: no. No existing `.cursor/plans/reports/shared-path-agent-report.md` was present at start.
- OpenSpec change: `openspec/changes/shared-path-agent/`
- Git baseline before first write: `4b8d3e81e3ca38834a4404a1f30a5db44f43ac20`

## Dirty Worktree Protection

Start-of-run `git status --short` and `git status --porcelain=v1 -uall` both returned no entries, even though the build request warned about many existing dirty files. No unrelated dirty files were reverted, reset, checked out, or touched.

Tracked scope after implementation from `git diff --name-only`:

```text
assets/scripts/character/Hero.ts
assets/scripts/character/Soldier.ts
assets/scripts/core/GameConfig.ts
assets/scripts/enemy/EnemyBoss.ts
assets/scripts/enemy/EnemyMinion.ts
```

`git status --short` additionally shows the planned new file:

```text
 M assets/scripts/character/Hero.ts
 M assets/scripts/character/Soldier.ts
 M assets/scripts/core/GameConfig.ts
 M assets/scripts/enemy/EnemyBoss.ts
 M assets/scripts/enemy/EnemyMinion.ts
?? assets/scripts/core/PathAgent.ts
```

No `assets/scenes/Main.scene`, `.prefab`, or `.meta` file was changed. `PathAgent.ts.meta` was not hand-written because project rules forbid hand-writing meta UUIDs; Cocos may generate it on editor import if needed.

## Todo Matrix

| Todo | Status | Notes |
|---|---|---|
| SPA.1 | done | Surveyed rules, plan, OpenSpec, report absence, git baseline/status, and scope. |
| SPA.2 | done | Read `AirWallAabb.ts`, `GameConfig.ts`, four callers, plus relevant target/attack references. |
| SPA.3 | done | Added per-unit `PathAgent` with cached target, low-frequency repath, waypoints, line probe, grid A*, and steering fallback. |
| SPA.4 | done | Added non-combat path parameters to `GameConfig.ts`. |
| SPA.5 | done | `EnemyMinion.ts` uses `PathAgent.nextDirection`; aggro, barrier priority, separation, log blocking, attack/death paths remain. |
| SPA.6 | done | `EnemyBoss.ts` uses `PathAgent.nextDirection`; priority, 5s retarget, attack range, and stuck slide fallback remain. |
| SPA.7 | done | `Hero.ts` uses `PathAgent` only for follow offset/leash movement; attack still clears velocity and stops follow. |
| SPA.8 | done | `Soldier.ts` uses `PathAgent` only after the tower branch returns; ranged/tower soldiers remain stationary. |
| SPA.9 | done | Repath is interval-gated; active waypoint Vecs, node/open arrays, maps, sets, and probes are object members reused across frames. |
| SPA.10 | done | TypeScript check passed. |
| SPA.11 | done | `rg` caller checks passed; ranged branch inspected. |
| SPA.12 | done | AC-PLAY scenarios listed below as pending manual play checks; non-blocking per plan. |
| SPA.13 | done | No scene/prefab work; MCP skipped. |
| SPA.14 | done | This report written. |

## PathAgent Parameters

- `pathRepathInterval = 0.35`: minimum full route refresh interval.
- `pathTargetMoveThreshold = 24`: target displacement needed to invalidate cached route at the next refresh window.
- `pathWaypointReachDistance = 18`: waypoint arrival threshold.
- `pathGridSize = 32`: fallback A* grid cell size.
- `pathProbeStep = 24`: line-of-sight probe spacing.
- `pathProbePadding = 1.08`: AABB probe expansion for grid cells.
- `pathMaxNodes = 180`: single A* budget.
- `pathNearestCellRadius = 3`: nearest walkable cell search radius for blocked endpoints.
- `pathBoundsPadding = 160`: search area padding around start/target bounds.

Fallback conditions: no route, blocked endpoints, exceeded search budget, or no active waypoint causes `AirWallAabb.steerDirection(...)` to provide the direction.

## Call Points

- `EnemyMinion.ts`: pursuit velocity direction now comes from `PathAgent.nextDirection`; speed scaling, `EnemyAI.findNearestBarrier`, aggro range, melee halt/attack, peer/player separation, and rolling-log velocity adjustment remain after direction selection.
- `EnemyBoss.ts`: chase direction now comes from `PathAgent.nextDirection`; target priority table, retarget cadence via `GameConfig.bossRetargetInterval`, melee attack gate, attack frame event, and stuck-sideways slide compatibility remain.
- `Hero.ts`: follow movement toward clamped `followOffset`/leash destination now uses `PathAgent`; ranged attack still clears velocity and returns before follow movement.
- `Soldier.ts`: only barracks/melee flow reaches `PathAgent`; tower deployment branch still clears velocity, idles, checks attack range, and returns.

## Changed Files

- `assets/scripts/core/PathAgent.ts`: new shared path follower, line probe, grid A*, waypoint following, low-frequency repath, fallback steering.
- `assets/scripts/core/GameConfig.ts`: added path-only movement parameters.
- `assets/scripts/enemy/EnemyMinion.ts`: added agent instance/reset and replaced pursuit direction source.
- `assets/scripts/enemy/EnemyBoss.ts`: added agent instance/reset and replaced chase direction source.
- `assets/scripts/character/Hero.ts`: added agent instance/reset and replaced follow direction source.
- `assets/scripts/character/Soldier.ts`: added airWall collection plus agent for melee pursuit only.
- `.cursor/plans/shared-path-agent.md`: synchronized status/todos to done per build request.
- `.cursor/plans/reports/shared-path-agent-report.md`: new execution report.

## AC Results

`npx tsc --noEmit -p tsconfig.json`:

```text
exit 0
npm notice
npm notice New major version of npm available! 10.9.2 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice
```

`rg "class PathAgent|PathAgent" assets/scripts/core/PathAgent.ts`:

```text
export class PathAgent {
```

`rg "path|Path|repath|waypoint|grid|probe" assets/scripts/core/GameConfig.ts`:

```text
    /** PathAgent full repath 最小间隔（秒），避免每帧 A*。 */
    static readonly pathRepathInterval = 0.35;
    /** 目标移动超过该距离后，下次 repath 窗口刷新路径。 */
    static readonly pathTargetMoveThreshold = 24;
    /** waypoint 视为抵达的半径（世界单位）。 */
    static readonly pathWaypointReachDistance = 18;
    static readonly pathGridSize = 32;
    /** 直线可达 probe 步长。 */
    static readonly pathProbeStep = 24;
    /** AABB probe 尺寸膨胀，降低贴墙穿插。 */
    static readonly pathProbePadding = 1.08;
    static readonly pathMaxNodes = 180;
    static readonly pathNearestCellRadius = 3;
    static readonly pathBoundsPadding = 160;
```

`rg "PathAgent" assets/scripts/enemy/EnemyMinion.ts assets/scripts/enemy/EnemyBoss.ts assets/scripts/character/Hero.ts assets/scripts/character/Soldier.ts`:

```text
assets/scripts/character/Soldier.ts:import { PathAgent } from '../core/PathAgent';
assets/scripts/character/Soldier.ts:    private readonly _pathAgent = new PathAgent();
assets/scripts/character/Hero.ts:import { PathAgent } from '../core/PathAgent';
assets/scripts/character/Hero.ts:    private readonly _pathAgent = new PathAgent();
assets/scripts/enemy/EnemyBoss.ts:import { PathAgent } from '../core/PathAgent';
assets/scripts/enemy/EnemyBoss.ts:    private readonly _pathAgent = new PathAgent();
assets/scripts/enemy/EnemyMinion.ts:import { PathAgent } from '../core/PathAgent';
assets/scripts/enemy/EnemyMinion.ts:    private readonly _pathAgent = new PathAgent();
```

Scope check from `git diff --name-only` before report/plan synchronization:

```text
assets/scripts/character/Hero.ts
assets/scripts/character/Soldier.ts
assets/scripts/core/GameConfig.ts
assets/scripts/enemy/EnemyBoss.ts
assets/scripts/enemy/EnemyMinion.ts
```

No scene/prefab diff was present. The new untracked `assets/scripts/core/PathAgent.ts` is intentionally outside `git diff --name-only` because it is a new untracked file.

Final `git diff --name-only` after synchronizing plan/report:

```text
.cursor/plans/shared-path-agent.md
assets/scripts/character/Hero.ts
assets/scripts/character/Soldier.ts
assets/scripts/core/GameConfig.ts
assets/scripts/enemy/EnemyBoss.ts
assets/scripts/enemy/EnemyMinion.ts
```

Final `git status --short`:

```text
 M .cursor/plans/shared-path-agent.md
 M assets/scripts/character/Hero.ts
 M assets/scripts/character/Soldier.ts
 M assets/scripts/core/GameConfig.ts
 M assets/scripts/enemy/EnemyBoss.ts
 M assets/scripts/enemy/EnemyMinion.ts
?? .cursor/plans/reports/shared-path-agent-report.md
?? assets/scripts/core/PathAgent.ts
```

Final `npx tsc --noEmit -p tsconfig.json`:

```text
exit 0
```

Preservation checks:

```text
Soldier tower branch keeps velocity zero, idles, tries ranged attack in attackRange, and returns before PathAgent.
EnemyMinion still calls findNearestBarrier, beginAttack/applyAttackDamage, peer/player separation, and log velocity blocking.
EnemyBoss still uses BOSS_TARGET_PRIORITY, bossRetargetInterval, attackTriggerRange, playAttackWithFrameHit, and stuck side-slide logic.
Hero still applies followOffset, heroFollowDistance/heroFollowLeash, _isAttacking stop, and tryAttack after follow update.
```

## AC-PLAY

Not run in editor/play mode in this build. Pending manual checks from `openspec/changes/shared-path-agent/specs/path-agent/spec.md`:

- Pursuer routes around blocker instead of pushing into blocked edge.
- Route-unavailable fallback continues local steering without breaking combat/collision/animation.
- Moving target refreshes path only on bounded refresh cadence.
- Dead/invalid/switched targets do not keep stale intermediate movement indefinitely.
- Boss priority/attack semantics unchanged.
- Minion aggro/barrier/separation/log semantics unchanged.
- Hero follow offset/leash and attack stop unchanged.
- Melee soldier pursues; ranged soldier remains stationary.

AC-PLAY is explicitly non-blocking for done in this plan.

## MCP Metrics

Pure script build; no scene or prefab work was performed.

| Metric | Count / Value |
|---|---|
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | skipped |
| post-scene-save Patched | skipped |
| assets-reimport-asset | 0 |
| New prefabs created by this task | 0 |
| Continuation | no |
| OpenSpec change | `openspec/changes/shared-path-agent/` |

## Failures / Blockers

No machine blocker. `AC-PLAY` remains pending manual/editor play verification only.
