---
slug: fix-defense-combat-expand
version: 1
status: done
created: 2026-09-09
---

# Defense Combat And Expansion Fixes

## Goal
Fix the three reported issues: fixed-log friendly fire and collider geometry, ranged attack interruption, and expansion hide timing.

## OpenSpec
- `openspec/changes/fix-defense-combat-expand/`

## Risk
Medium: shared soldier attack lifecycle and log collider refresh paths.

## Evidence
- Arrow polls attackable logs and damages them in its contact handler.
- Log fixed collider currently derives from Visual dimensions; length refresh can overwrite collider size.
- Soldier.tryAttack does not guard _isAttacking; remote_attack lasts 1.1 seconds versus default 1.0 second cooldown. Fixed delayed unlock callbacks can also affect later attacks.
- BuildSystem calls _hideExpandUnlockNodes in _onHeroSpawned instead of _onExpandComplete.
- Existing bugs.md topics include fix-expand-unlock-hide-list and fix-log-visual-length-scale. Search again before updating records.

## Files
Writable:
- `assets/scripts/projectile/Arrow.ts`: remove log damage from both polling and contact paths.
- `assets/scripts/item/Log.ts`: enforce fixed-state collider geometry without changing unfixed growth.
- `assets/scripts/core/GameConfig.ts`: fixed log collider offset (-2, 10), size (235, 19), in local collider units.
- `assets/scripts/character/Soldier.ts`: guard attacks until clip completion; protect fallback unlocks against stale attacks and reset/death.
- `bugs.md`: one record/update per user-reported issue, after verification.
- This plan and `.cursor/plans/reports/fix-defense-combat-expand-report.md`.
Read-only:
- `assets/scripts/core/AnimUtil.ts`, `assets/scripts/core/AttackFrameRelay.ts`.
- Existing animation assets, prefabs, scene, OpenSpec navigation changes, and workflow rules.
Additional writable:
- `assets/scripts/building/BuildSystem.ts`: move hide-list application to expansion completion; update tooltip while preserving serialized field name.

## Forbidden
- No prefab, scene, meta, navigation, Boss targeting, damage balance, or visual length formula changes.
- Do not reset or revert unrelated work.
- Do not rename hideWhenExpandUnlocked or alter its Inspector references.
- Do not make fixed collider width depend on log length or Visual scale.

## Todos
- [x] Inspect current implementation, animation duration, relevant bug records and specs directory (no published specs present).
- [x] User confirmed; current disk/git state and execution instructions reviewed. No delegation tool available; executed continuously in the main session.
- [x] Remove friendly log hits without consuming arrow pierce slots; preserve Boss damage to logs.
- [x] Apply configured fixed collider geometry on locking and subsequent collider refresh paths; preserve unfixed behavior.
- [x] Require cooldown and animation completion before another ranged attack. Use actual clip completion; missing-animation fallback must not deadlock. Remove fixed delayed unlocks and guard callbacks by attack sequence across reset/death.
- [x] Move hide action to expansion completion after expansion content activation.
- [x] Run TypeScript and focused regression verification; update bugs.md and write report.

## Acceptance
- AC-TSC: `npx tsc --noEmit` exits 0.
- AC-REGRESSION: execute focused tests or a documented harness for both arrow hit paths, fixed collider refresh, cooldown shorter than clip, stale unlock callback, missing animation, and expansion reveal versus completion. Static checks alone must be labeled as such.
- AC-DIFF: verify only allowed files changed by this task and no prefab/scene edits.
- AC-PLAY (nonblocking): arrows pass logs without damage; fixed local collider reads specified values; ranged attacks finish; hide-list nodes remain during expansion purchase and hide when expansion appears.
- MCP gates skipped: pure script changes.

## Rollback
Revert only task-owned hunks if required; preserve preexisting edits. Stop and report if current code invalidates the proposed approach.

## Report
Include tests and limitations, per-issue changes, git diff summary, and whether gameplay was observed. MCP operations: 0. New prefabs: 0.

## Revision
- v1 (2026-09-09): initial draft awaiting confirmation.
- v1 execution (2026-09-09): user confirmed; script changes and machine checks complete. Gameplay verification remains optional and unperformed.
