/**
 * Shared pending-damage ledger for delayed friendly attacks.
 * It deliberately knows nothing about Cocos nodes or combat components.
 */
export type AttackReservationToken = {
    readonly attacker: object;
    readonly target: object;
    readonly damage: number;
    released: boolean;
};

export class AttackReservation {
    private static readonly _byTarget = new Map<object, Set<AttackReservationToken>>();
    private static readonly _byAttacker = new Map<object, Set<AttackReservationToken>>();

    static reserve(attacker: object, target: object, damage: number): AttackReservationToken {
        const token: AttackReservationToken = {
            attacker,
            target,
            damage: Math.max(0, damage),
            released: false,
        };
        this._add(this._byTarget, target, token);
        this._add(this._byAttacker, attacker, token);
        return token;
    }

    static release(token: AttackReservationToken | null | undefined): void {
        if (!token || token.released) {
            return;
        }
        token.released = true;
        this._remove(this._byTarget, token.target, token);
        this._remove(this._byAttacker, token.attacker, token);
    }

    static releaseForTarget(target: object | null | undefined): void {
        this._releaseAll(this._byTarget, target);
    }

    static releaseForAttacker(attacker: object | null | undefined): void {
        this._releaseAll(this._byAttacker, attacker);
    }

    static pendingDamage(target: object | null | undefined): number {
        if (!target) {
            return 0;
        }
        let total = 0;
        for (const token of this._byTarget.get(target) ?? []) {
            if (!token.released) {
                total += token.damage;
            }
        }
        return total;
    }

    /**
     * Candidates must already be in the caller's stable target order.
     * Prefer the first candidate that remains above zero after this hit.
     */
    static selectMinion<T extends object>(
        candidates: readonly T[],
        damage: number,
        currentHp: (candidate: T) => number,
    ): T | null {
        for (const candidate of candidates) {
            if (currentHp(candidate) - this.pendingDamage(candidate) - damage > 0) {
                return candidate;
            }
        }
        return candidates[0] ?? null;
    }

    private static _add(
        index: Map<object, Set<AttackReservationToken>>,
        key: object,
        token: AttackReservationToken,
    ): void {
        let tokens = index.get(key);
        if (!tokens) {
            tokens = new Set<AttackReservationToken>();
            index.set(key, tokens);
        }
        tokens.add(token);
    }

    private static _remove(
        index: Map<object, Set<AttackReservationToken>>,
        key: object,
        token: AttackReservationToken,
    ): void {
        const tokens = index.get(key);
        if (!tokens) {
            return;
        }
        tokens.delete(token);
        if (tokens.size === 0) {
            index.delete(key);
        }
    }

    private static _releaseAll(
        index: Map<object, Set<AttackReservationToken>>,
        key: object | null | undefined,
    ): void {
        if (!key) {
            return;
        }
        const tokens = Array.from(index.get(key) ?? []);
        for (const token of tokens) {
            this.release(token);
        }
    }
}
