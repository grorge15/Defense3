# Fix Enemy Soldier Boss Combat

## Why
Nearby melee soldiers are considered only during a minion's hit-frame selection, so minions do not deliberately engage them. Boss character-range calculations mix root and target-collider distances, and a dead target can leave the Boss in a permanent attack state.

## Scope
- Let an aggroed minion temporarily engage a nearby living melee Soldier.
- Define character melee reach from the surfaces of the two participants' colliders.
- Make Boss range configuration authoritative and release attack recovery independently of target liveness.
- Tune the Boss cooldown to its attack clip timing.
