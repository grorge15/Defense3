## Why

Friendly attacks can resolve against an obsolete tower target, wasting an attack when that target dies or leaves range. Friendly units independently select low-health minions, causing avoidable overkill. At parkour start, the joystick tutorial neither appears immediately nor distinguishes a directional drag from a global touch that supplies a zero movement vector.

## What Changes

- Tower soldiers validate their captured target at the attack hit frame, retargeting to a legal in-range enemy when possible and cancelling damage when no replacement exists.
- Player ranged attacks and tower soldiers use one shared pending-damage reservation ledger to distribute attacks across living minions when a non-overkill choice exists. Boss targeting remains naturally focusable, and a sole enemy remains eligible for concurrent reservations.
- Reservations are released on resolution, cancellation, target death, and relevant owner/projectile destruction or disable paths.
- Parkour displays the joystick hint immediately, locks player movement until the first effective joystick direction, hides the hint when that input occurs, and redisplays it after three seconds without effective directional input.

## Non-goals

- Do not change enemy AI, enemy spawn rules, health/damage values, attack animations, attack-frame timings, arrow pierce/falloff rules, tower placement, scene wiring, prefabs, or joystick visuals.
- Do not alter Boss target priority or make Boss damage reservations suppress normal focus fire.
- Do not treat touch start, touch end, a zero vector, or a perpendicular-only parkour drag as effective movement input.

## Capabilities

### New Capabilities

- `friendly-attack-reservation`
- `parkour-joystick-onboarding`

## Impact

The work changes combat target selection and delayed-attack lifecycles across Player, CombatSystem, Soldier, Arrow, EnemyMinion, and EnemyBoss, and changes the handshake between Player, Joystick, and JoystickHintUI. Implementation scope, test coverage, and rollback are defined in `.cursor/plans/fix-friendly-target-reservation-and-joystick-onboarding.md`.
