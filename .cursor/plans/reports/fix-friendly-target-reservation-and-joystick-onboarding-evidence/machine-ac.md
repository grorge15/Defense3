# Machine AC Evidence

Plan: `fix-friendly-target-reservation-and-joystick-onboarding`, v2. Final continuation gate run 2026-09-12.

| Check | Result |
|---|---|
| `node .cursor/scripts/test-friendly-target-reservation-and-joystick-onboarding.cjs` | Exit 0; 45 assertions across 11 scenarios. It covers reservation ownership/release, minion allocation, Player-to-Arrow transfer, tower hit-frame retargeting, lifecycle cancellation, effective parkour input, and hint suppression/idle behavior. |
| `npx tsc --noEmit --pretty false` | Exit 0. |
| `npx openspec validate fix-friendly-target-reservation-and-joystick-onboarding --strict` | Exit 0; change valid. OpenSpec emitted pre-existing schema guidance about `rules` and `apply` arrays. |
| `git diff --check` | Exit 0. |
| `git diff --name-only`; `git ls-files --others --exclude-standard` | Reviewed against the v1 dirty baseline and continuation-start snapshot; task-owned paths are within the v2 allowlist. |
| AC-PLAY | Not run; non-blocking and this plan forbids MCP/scene work. |

All blocking machine AC passed.
