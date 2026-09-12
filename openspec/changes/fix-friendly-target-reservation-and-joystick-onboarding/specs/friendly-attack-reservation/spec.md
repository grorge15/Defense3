## ADDED Requirements

### Requirement: Tower hit-frame target validation

A tower Soldier SHALL validate its target at the attack hit frame. A target is legal only when it remains valid, active, alive, and within the Soldier's configured attack range at that frame.

#### Scenario: Captured tower target becomes illegal before the hit frame

- **WHEN** a tower Soldier has started an attack and its captured target dies, is destroyed, becomes inactive, or leaves attack range before the hit frame
- **THEN** the Soldier selects a legal replacement using normal friendly target allocation and applies the existing one attack's damage and projectile presentation to that replacement

#### Scenario: No legal tower replacement exists at the hit frame

- **WHEN** a tower Soldier's captured target is illegal at the hit frame and no legal replacement exists in range
- **THEN** the attack animation and cooldown complete normally, no damage or replacement projectile is applied, and the obsolete reservation is released

### Requirement: Friendly pending-damage allocation

Player ranged attacks and tower Soldier attacks SHALL register pending damage for their intended target before delayed resolution. When selecting among living minions, they MUST prefer a candidate whose remaining health after existing reservations and this attack's pending damage remains positive over a candidate that would be overkilled, when such a candidate exists. Stable existing distance ordering resolves ties.

#### Scenario: Multiple minions have unequal unreserved health

- **WHEN** a Player or tower Soldier starts an attack while multiple living minions are eligible and a nearer low-health minion is already covered by pending damage
- **THEN** it selects another eligible minion that can absorb its pending damage without avoidable overkill

#### Scenario: Only one minion is eligible

- **WHEN** exactly one living minion is eligible for Player or tower Soldier attacks
- **THEN** multiple friendly attackers may reserve and attack that minion even when their combined pending damage exceeds its remaining health

#### Scenario: Boss is selected

- **WHEN** existing Player or Soldier targeting selects a living Boss
- **THEN** the Boss remains eligible for normal concurrent focus and pending minion allocation does not redirect that attack

### Requirement: Reservation lifecycle is bounded

Each pending-damage reservation MUST be released exactly once when its associated damage resolves, is cancelled, its target dies or is destroyed, or its attacker/projectile is disabled or destroyed. A stale reservation MUST NOT influence later target selection.

#### Scenario: Reserved target dies before resolution

- **WHEN** a reserved minion or Boss dies, is disabled, or is destroyed before its attack resolves
- **THEN** all reservations for that target are released and future target selection ignores them

#### Scenario: Player projectile does not reach its reserved target

- **WHEN** a Player arrow is cancelled, exceeds its existing lifetime, or is destroyed before resolving its reservation
- **THEN** its reservation is released without changing the arrow's existing pierce, falloff, or damage semantics

#### Scenario: Attacker lifecycle ends during a delayed attack

- **WHEN** a Player attack or tower Soldier attack is cancelled by attacker death, reset, deactivation, disable, or destruction
- **THEN** its unresolved reservation is released and no late callback can apply it
