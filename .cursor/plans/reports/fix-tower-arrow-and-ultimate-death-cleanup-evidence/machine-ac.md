# Machine AC Evidence

Plan: `fix-tower-arrow-and-ultimate-death-cleanup`, v1.

| Check | Result |
|---|---|
| `node .cursor/scripts/test-tower-arrow-ultimate-death-cleanup.cjs` | Exit 0; 40 assertions across 8 scenarios. |
| `node .cursor/scripts/test-build-cost-ultimate-timing.cjs` | Exit 0; 37 assertions across 8 scenarios. |
| `npx tsc --noEmit --pretty false` | Exit 0. |
| `npx openspec validate fix-tower-arrow-and-ultimate-death-cleanup --strict` | Exit 0; change valid. |
| `npx openspec validate ultimate-bigmove-clear --strict` | Exit 0; change valid. |
| `git diff --check` | Exit 0. |

OpenSpec printed pre-existing schema guidance warnings about `rules` and `apply` arrays, but both strict validations completed successfully.

AC-PLAY was not run. This plan forbids MCP and scene work; no Creator play-test was performed.
