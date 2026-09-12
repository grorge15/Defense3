# Scope Evidence

Baseline before the first write contained unrelated modifications to `Main.scene`, `GameConfig.ts`, project settings, animation, and prefab assets, plus the draft plan, navigation document, and OpenSpec change directory as untracked files. Those unrelated files were not edited by this run.

Task implementation files are limited to:

- `assets/scripts/building/BuildPlot.ts`
- `assets/scripts/game/CameraFollow.ts`
- `assets/scripts/game/UltimateSystem.ts`
- `.cursor/scripts/test-build-cost-ultimate-timing.cjs`
- `openspec/changes/fix-build-cost-and-finale-timing/`
- `openspec/changes/ultimate-bigmove-clear/specs/ultimate-bigmove-clear/spec.md` (minimal timing synchronization permitted by the plan)
- `bugs.md`
- this evidence directory and the corresponding build report

`git diff --check` passed. No `Main.scene`, prefab, `.meta`, `GameConfig.ts`, asset, or project-setting edit was introduced by this task.
