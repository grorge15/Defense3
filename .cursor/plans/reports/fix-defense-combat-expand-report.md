# Defense Combat And Expansion Fixes Report

- Plan: `fix-defense-combat-expand`, v1, done.
- Date: 2026-09-09.
- Risk: medium.
- Continuation: first build after explicit user confirmation.
- Execution: main session followed build-agent instructions; no subagent delegation tool available.

## Completed
- Arrow no longer polls or damages logs, nor spends penetration slots on logs.
- Fixed log collider uses GameConfig local offset (-2, 10) and size (235, 19) at lock and length refresh. Original rolling offset is cached and restored outside fixed state. Visual length formula unchanged.
- Soldier attacks require cooldown plus animation completion. Removed fixed delayed unlocks; current-attack sequence guards hit/completion callbacks and is invalidated on reset, deactivate and death. Missing clip/component uses immediate existing damage path and releases lock.
- Expansion hide list executes after expansion content activation, not when its purchase plot is revealed. Serialized field name preserved.
- Three bug records updated: log v3, expansion v2, new ranged-soldier entry.

## Files
- `assets/scripts/projectile/Arrow.ts`
- `assets/scripts/item/Log.ts`
- `assets/scripts/core/GameConfig.ts`
- `assets/scripts/character/Soldier.ts`
- `assets/scripts/building/BuildSystem.ts`
- `bugs.md`, plan and this report.

## Verification
- AC-TSC: `npx tsc --noEmit`, exit 0.
- AC-DIFF: `git diff --check`, exit 0; task-owned hunks reviewed. Existing dirty prefab, navigation, hero and other changes preserved. No prefab or scene writes in this task.
- AC-REGRESSION: inline Node harness, exit 0. Harness transpiled actual TypeScript through `typescript.transpileModule`, loaded classes in a VM with mocked Cocos/dependencies, then invoked real methods. It was run from standard input, not retained as a test file.

Harness assertions:
1. Arrow contact path ignores a non-enemy log node without spending penetration; polling scans only Boss/minions; Boss damage and pierce accounting still work. Static check confirms no Log import/reference remains.
2. Log fixed refresh at lengths 1, 3, 10 always produces exact configured values; rolling refresh restores baseline offset and scaled width; lock entry makes collider solid.
3. Soldier cannot restart after cooldown alone; completion allows a subsequent attack; previous completion cannot unlock current attack; cooldown still gates completed attacks; missing Animation releases lock; reset and death invalidate prior hit/completion callbacks.
4. Expansion completion activates four barrier roots and hides the configured node. AST inspection confirms hero-spawn method no longer calls hide action (this part is static, not full purchase-flow simulation).

Output:
```text
PASS arrow contact/poll exclude log; enemy damage and pierce retained
PASS fixed collider locking/refresh at lengths 1/3/10; rolling dimensions/offset preserved
PASS attack completion + cooldown, stale completion/hit, missing animation, reset/death
PASS expansion completion hides list after activation; static check: hero spawn does not hide
```

## Limitations
- Cocos gameplay, physics contacts and actual animation event dispatch were not run. Mock tests validate script branches, not engine integration.
- AC-PLAY remains unperformed and nonblocking under the plan.
- No failures or blockers remain in machine checks.
- MCP operations: 0; new prefabs: 0; scene writes: 0. Pure-script task, MCP gates skipped.
