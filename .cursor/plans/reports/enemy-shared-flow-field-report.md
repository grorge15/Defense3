# enemy-shared-flow-field Build Report

## Plan

- Plan version: v3.
- Revision summary: three fixed stairs; entrance 2 always open; entrances 1/3 close only after their corresponding wall completes; castle boundary, legal stair portals, and walkable ground constrain routing.
- Risk level: medium-high.
- Continuation: yes. Continued the same build from disk state after delivery review failed the previous verification.
- Final status: done.
- Git baseline before first write: `db9209616830686a04d4264f292337382aa7c102`.
- OpenSpec change: `openspec/changes/enemy-shared-flow-field/`.

## Dirty Worktree Protection

Start-of-run unrelated dirty files were preserved and not reverted:

```text
M assets/resources/prefabs/ui/pref_ui_game_over.prefab
M assets/scenes/Main.scene
M assets/scripts/building/HeroShrine.ts
M assets/scripts/character/Hero.ts
M assets/scripts/enemy/EnemyBoss.ts
M bugs.md
?? assets/resources/sprite/UI/img_button.png
?? assets/resources/sprite/UI/img_button.png.meta
?? assets/resources/sprite/UI/label_down.png
?? assets/resources/sprite/UI/label_down.png.meta
?? openspec/changes/enemy-shared-flow-field/
```

Continuation also saw:

```text
M assets/resources/prefabs/item/pref_item_bow.prefab
M assets/resources/prefabs/ui/pref_ui_hero_select.prefab
?? assets/scripts/core/EnemyNavigation.ts.meta
?? assets/scripts/core/FlowField.ts.meta
```

This build did not open/save scenes and did not edit prefab/scene/meta files. Script `.meta` files were already present on continuation and are recorded as external/editor generated, not hand-written.

Reference hashes used for AC-DIFF:

```text
Main.scene SHA256 C8749D0CF5C1ED00DE71A195B563A5B4A6F41C1C955C0329A6E088BAC9179ED4
pref_ui_game_over.prefab SHA256 DFEF257CD5DC2823D258DB3446A623665F87ECF31B4B94E73F26ADB943CAC04D
pref_ui_hero_select.prefab SHA256 696D40662A10FF9D2B8E5593445A68071471937D03EB60189E30CC355D7105D0
Hero.ts SHA256 EA5A30E869D4AF87BA2D1F03B45A1A886CD31F57A2B1F1631ABF063DD3AF809D
Soldier.ts SHA256 08EB63A8FFB97057ED23B43FDB731A4EF3B6ABD5AAC484DE2FFA3B9C5C1FBC20
PathAgent.ts SHA256 6187D1B373C8F3DEF2F7840BD261422EECAB602321A496D66338E9BCA4D6B9D1
```

`Hero.ts` remains dirty from a prior fix (`角色通用投影1` death hiding) and was not touched by this build. `Soldier.ts` and `PathAgent.ts` have no diff.

## Todo Matrix

| Todo | Status | Notes |
|---|---|---|
| E1 | done | Read rules, plan v3, OpenSpec, git status/baseline, dirty overlaps, and relevant source; report restored to verifying during review continuation. |
| E2 | done | Added `FlowField.ts`: 20-unit grid, four-neighbor BFS, eight-direction descent, body offset expansion, walkable ground polygons, legal portal crossing, target replacement, query/retain cache ownership, sweep, and separation. |
| E3 | done | Added `EnemyNavigation.ts`; spawner exposes bounds/castle/walkable/entrance config; service fails closed without required ground/entrance config; respawn generation prevents duplicate reuse. |
| E4 | done | Minion/Boss movement uses shared navigation; minion 32/50 hysteresis and LOS damage are enforced; Boss lifecycle generation invalidates stale attack/death callbacks; BuildSystem wall completion invalidates navigation and records closed entrances. |
| E5 | done | Machine AC passed; `bugs.md`, report, and plan status updated after verification. |

## Changed Files

- `.cursor/plans/enemy-shared-flow-field.md`
- `.cursor/plans/reports/enemy-shared-flow-field-report.md`
- `.cursor/scripts/test-enemy-navigation.cjs`
- `assets/scripts/core/FlowField.ts`
- `assets/scripts/core/EnemyNavigation.ts`
- `assets/scripts/core/GameConfig.ts`
- `assets/scripts/core/GameEvents.ts`
- `assets/scripts/enemy/EnemySpawner.ts`
- `assets/scripts/enemy/EnemyMinion.ts`
- `assets/scripts/enemy/EnemyAI.ts`
- `assets/scripts/enemy/EnemyBoss.ts`
- `assets/scripts/building/BuildSystem.ts`
- `bugs.md`

External dirty files preserved: `Main.scene`, item/UI prefabs, `HeroShrine.ts`, `Hero.ts`, UI sprites, script `.meta` files.

## Review Gaps Closed

- `EnemyAI._damagePlayer` now requires `EnemyNavigation.hasLineOfSight`, not distance only.
- Boss `tryAttack` frame hit, recovery, disable/destroy, and death delayed callbacks are guarded by lifecycle generation.
- Tests now load actual `EnemyMinion`, `EnemyAI`, `EnemyBoss`, and `EnemySpawner` behavior for reviewed gaps.
- Pool stale respawn callback behavior is tested against actual `EnemySpawner` internals.
- `EnemyNavigation.nextVelocity` applies `stopDistance` only to the final target, not intermediate stair waypoints.
- Flow body keys and collision checks include collider offset relative to the root node.
- Already-built wall late configuration sync uses BuildSystem wall-complete records, not wall-node `active`.
- Target replacement is selected from the current reachable component and rejects unrelated far-wall blockage.
- `walkableGround` is required and enforced; missing ground or entrance configuration fails closed.
- Cache ownership distinguishes query from retained unit route fields; zero-ref fields are pruned after staleness, not deleted during candidate probes.

## AC Results

`npx tsc --noEmit --pretty false`:

```text
exit 0
```

`node .cursor/scripts/test-enemy-navigation.cjs`:

```text
exit 0
35 tests passed, including actual EnemyMinion/EnemyAI/EnemyBoss/EnemySpawner behavior and service 200-request entrance reuse.
```

Representative output from the latest passing script run:

```text
ok - AC-SERVICE: 200 same-body entrance route requests reuse one retained field
ok - AC-SERVICE: missing walkable ground or entrance configuration fails closed
ok - AC-SERVICE: wall completion recorded before late configure closes matching entrance
ok - AC-ACTUAL: EnemyMinion uses actual 32/50 hysteresis helper
ok - AC-ACTUAL: EnemyAI damage frame requires navigation line of sight
ok - AC-ACTUAL: EnemyBoss pickTarget keeps real priority and generation invalidates callbacks
ok - AC-ACTUAL: EnemySpawner stale pool callback does not respawn reused minion
enemy navigation core tests passed
```

`git diff --check`:

```text
exit 0
```

AC-SPEC was run by the main thread before this final report and no OpenSpec file was changed afterward:

```text
openspec validate enemy-shared-flow-field --type change --strict --no-interactive
exit 0
Change 'enemy-shared-flow-field' is valid
```

AC-DIFF:

```text
Main.scene/prefab/meta: existing external dirty files only; continuation hashes unchanged.
Hero.ts: existing external dirty diff only; continuation hash unchanged.
Soldier.ts: no diff.
PathAgent.ts: no diff.
```

## Inspector Binding Notes

`EnemySpawner` now exposes navigation binding fields:

- `navBoundsMin` / `navBoundsMax`: world XY bounds markers. Defaults use `GameConfig.enemyNavDefault*` when unbound.
- `walkableGround`: ordered world XY polygon markers for actual traversable ground. This is required for shared navigation; missing ground config fails closed.
- `castleArea`: ordered polygon marker nodes for castle/interior classification.
- `entrances`: three `EnemyEntranceBinding` entries with `id`, `outside`, `inside`, optional `closePlot`, `width`, `open`.
- Entrance 2 remains open even if serialized as closed.
- Entrance 1 and 3 should bind their corresponding wall plot roots. BuildSystem wall-complete records close by plot/side, so late service configuration still closes already-built 1/3.

Because this plan forbids scene edits, these Inspector bindings were not applied in `Main.scene`.

## AC-PLAY

Not run in editor/play mode. Non-blocking per plan. Remaining manual checks after configuring entrance/bounds/ground markers:

```text
remote spawn finds stairs
actual stair crossing
1/3 close independently and fallback to 2
tower/building obstacle invalidation
expand boundary update
two body sizes in crowding
Boss attack windup/recovery stop
respawn
old/new phase behavior
low-FPS movement
```

## MCP Metrics

Pure script/documentation work.

| Metric | Count |
|---|---:|
| MCP calls | 0 |
| scene-open | 0 |
| scene-save | 0 |
| post-scene-save | 0 |
| assets-refresh | 0 |
| assets-reimport-asset | 0 |
| New prefab created | 0 |

## Blockers

No hard blockers. Machine AC passed. Only non-blocking AC-PLAY remains because scene marker binding and editor play mode are outside this pure script/documentation build.
