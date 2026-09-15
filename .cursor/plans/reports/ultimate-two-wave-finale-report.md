# Build Report: ultimate-two-wave-finale

- Plan version: v1.
- Revision summary: the confirmed implementation replaces the single post-zoom BigMove with two collective waves. The first wave applies 50% of each eligible enemy's current HP through `takeDamage`; the second wave and existing camera pullback complete through a one-time join before the accepted final-death cleanup.
- Risk: medium. This was a fresh build, not a continuation; no prior report existed.

## Todo Completion

| Todo | Status | Evidence |
| --- | --- | --- |
| T1 | Complete | Read plan, rules, OpenSpec delta and historical finale specs; recorded `b1eea41b57a1818698ff550b7d4e95fdabf1f681` before writes. |
| T2 | Complete | `UltimateSystem._playBigMoveWave` filters/de-duplicates every wave and registers all completion handlers before playback. |
| T3 | Complete | `_applyFirstWaveDamage` selects active, live Minion/Boss instances and calls `takeDamage(currentHp * GameConfig.ultimateFirstWaveDamageRatio)` exactly once. |
| T4 | Complete | `_startSecondWaveAndZoom` starts both branches together and joins independent completion flags before `_finishFinale`. |
| T5 | Complete | One-shot wave flags, callback guards, VFX cleanup on disable/destroy, camera/load fallbacks, and late callback rejection are implemented. |
| T6 | Complete | Both focused harnesses, TypeScript check, OpenSpec strict validation, and diff check passed. |

## Changed Files

- `assets/scripts/game/UltimateSystem.ts`: introduced two-wave orchestration, one-time current-HP damage, callback-safe VFX lifecycle, camera/load fallbacks, and cleanup guards.
- `assets/scripts/core/GameConfig.ts`: added the first-wave damage ratio plus bounded camera and VFX-load fallback constants.
- `.cursor/scripts/test-build-cost-ultimate-timing.cjs`: replaced obsolete single-wave/camera-first assertions with 48 assertions for two waves, 100→50/30→15/1→0.5, duplicate points/callbacks, both completion orders, and degradation paths.
- `.cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs`: added the required `HitFlash` loader mock so the existing final-death regression harness runs against current sources.
- `.cursor/plans/ultimate-two-wave-finale.md`: marked all todos complete and recorded the confirmed current-HP interpretation.

Pre-existing workspace changes were preserved. `assets/scenes/Main.scene`, `bugs.md`, and the unrelated barracks/minion-knockback planning artifacts remained outside this plan's write scope.

## Acceptance Results

| Check | Result |
| --- | --- |
| AC-1 / AC-2 / AC-3 | Pass: timing harness, 48 assertions across 8 scenarios. |
| AC-4 | Pass: death-cleanup harness, 40 assertions across 8 scenarios. |
| AC-CHECK | Pass: both Node harnesses, `npx tsc --noEmit --pretty false`, and `git diff --check` exited 0. |
| OpenSpec | Pass: `npx openspec validate ultimate-two-wave-finale --strict` exited 0. The CLI emitted a non-blocking archive-order information message for the pre-existing unarchived base capability. |
| AC-PLAY | Not run: no interactive Cocos preview was used; non-blocking by plan. |

## MCP Metrics

| Metric | Value |
| --- | --- |
| scene-open | 0 |
| scene-save | 0 |
| verify-mcp-gate | 0 |
| post-scene-save Patched | N/A |
| assets-reimport-asset | 0 |
| new prefab | 0 |
| continuation | No |

No blockers or replan target. This plan is not a bug-fix slug, so `bugs.md` was not changed for this work.
