# Build Report: fix-friendly-target-reservation-and-joystick-onboarding

## Plan

- Version: v2. Revision permits only the Cocos watcher-generated `assets/scripts/core/AttackReservation.ts.meta` and adds its importer/range validation; accepted behavior and implementation remain unchanged.
- Risk: medium.
- Continuation: yes; resumed from `reservation-input.7` only.
- Git baseline before the original write: `b24aa01e115d620ec0c819c5fb1adff362c6dfab`.
- Final status: done. Plan state set to `done`.

## Todo Completion Matrix

| Todo | Status | Result |
|---|---|---|
| reservation-input.1 | Complete | Read the plan/rules, target OpenSpec delta, related plans/reports, bugs, target disk state, and dirty baseline. |
| reservation-input.2 | Complete | Added the pure `AttackReservation` ledger with idempotent tokens, target/attacker cleanup, pending totals, and stable minion allocation. |
| reservation-input.3 | Complete | Added readonly enemy HP and reservation cleanup to target/attacker/projectile lifecycle paths. |
| reservation-input.4 | Complete | Tower Soldier validates captured targets at hit frame, retargets legal Minions, or cancels only that hit. |
| reservation-input.5 | Complete | Added the constrained effective-input parkour gate and effective-input-only hint timing. |
| reservation-input.6 | Complete | Added and passed the real-TypeScript focused harness: 45 assertions across 11 scenarios. |
| reservation-input.7 | Complete | Final harness, TypeScript, OpenSpec strict, diff, metadata, and scope checks passed. |

## Changed Files And Diff Summary

- `assets/scripts/core/AttackReservation.ts` and the permitted watcher-created `.meta`: shared reservation ledger and TypeScript importer metadata.
- `assets/scripts/character/Soldier.ts`, `assets/scripts/game/CombatSystem.ts`, `assets/scripts/projectile/Arrow.ts`, `assets/scripts/enemy/EnemyMinion.ts`, and `assets/scripts/enemy/EnemyBoss.ts`: reservation allocation, hit-frame validation, ownership transfer, and lifecycle cleanup while preserving existing combat semantics.
- `assets/scripts/character/Player.ts`, `assets/scripts/ui/Joystick.ts`, and `assets/scripts/ui/JoystickHintUI.ts`: effective parkour first-input gating and hint recurrence.
- `.cursor/scripts/test-friendly-target-reservation-and-joystick-onboarding.cjs`: focused real-TypeScript harness.
- `bugs.md`: existing correct v2/v1/v6 records retained without continuation edits.
- `openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/`: pre-existing, unmodified target delta.
- This report, its evidence directory, and the v2 plan state/todo records: final verification evidence only.

No task-owned scene, prefab, animation, GameConfig, settings, or forbidden metadata resource changed. Existing dirty scene/prefab paths were preserved.

## AC Results

| AC | Result |
|---|---|
| AC-1 to AC-6 | Pass via focused harness. |
| AC-7 | Pass: exit 0; 45 assertions across 11 scenarios. |
| AC-COMPILE | Pass: `npx tsc --noEmit --pretty false`, exit 0. |
| AC-OPSX | Pass: strict target validation, exit 0; only pre-existing schema guidance was emitted. |
| AC-DIFF | Pass: `git diff --check`, exit 0. Metadata parses as `importer=typescript`, `imported=true`; no other metadata changed. The only scene/prefab status paths are the v1-recorded pre-existing dirty files. |
| AC-BUGS | Pass: existing versioned records cover the three issues; not rewritten on continuation. |
| AC-PLAY | Not run; non-blocking. |

## MCP Metrics

| Metric | Count/Value |
|---|---:|
| scene-open | 0 |
| scene-save | 0 |
| create-prefab-from-node | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| New prefabs | 0 |
| Continuation | yes |
| OpenSpec change | `openspec/changes/fix-friendly-target-reservation-and-joystick-onboarding/` |

## Failures And Blockers

None. The v1 scope blocker is resolved by the v2 authorization and successful importer/range check for the watcher-generated metadata. No replan is recommended.
