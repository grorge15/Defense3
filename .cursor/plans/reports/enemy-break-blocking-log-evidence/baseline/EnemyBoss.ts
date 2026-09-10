import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { Barracks } from '../building/Barracks';
import { Barrier } from '../building/Barrier';
import { Building } from '../building/Building';
import { Tower } from '../building/Tower';
import { Hero } from '../character/Hero';
import { Player } from '../character/Player';
import { Soldier } from '../character/Soldier';
import { AirWallAabb } from '../core/AirWallAabb';
import { playAnim, playAttackWithFrameHit } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { FlowBody, stableFlowBody } from '../core/FlowField';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { VisualFacing } from '../core/VisualFacing';
import { Log } from '../item/Log';
import { HpBarUI } from '../ui/HpBarUI';

const { ccclass, property } = _decorator;

export type BossTargetKind = 'player' | 'hero' | 'soldier' | 'building' | 'barrier' | 'log';

export interface BossTargetRegisterPayload {
    node: Node;
    kind: BossTargetKind;
    /** Structure 建造顺序（越小越先建成、越优先）；非 Structure 可省略 */
    buildOrder?: number;
}

/**
 * 索敌优先级：soldier > Structure(building/barrier/log) > hero > player。
 * Structure 内再按 buildOrder 升序（建造顺序）。
 */
const BOSS_TARGET_PRIORITY: Record<BossTargetKind, number> = {
    soldier: 40,
    building: 30,
    barrier: 30,
    log: 30,
    hero: 20,
    player: 10,
};

type BossTargetEntry = {
    node: Node;
    kind: BossTargetKind;
    priority: number;
    buildOrder: number;
};

export interface BossTargetOptions {
    buildings?: Node[];
    heroes?: Node[];
    player?: Node | null;
}

@ccclass('EnemyBoss')
export class EnemyBoss extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '已废弃：Boss 攻击现在使用 attackTriggerRange 圆形范围' })
    attackLength = 4;

    @property({ tooltip: '已废弃：Boss 攻击现在使用 attackTriggerRange 圆形范围' })
    attackWidth = 2;

    @property({ tooltip: 'Boss 圆形攻击半径（世界单位）' })
    attackTriggerRange = 3.5;

    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 2;

    private _rb: RigidBody2D | null = null;
    private _collider: Collider2D | null = null;
    private _hp = GameConfig.bossMaxHp;
    /** 事件维护的索敌表：priority 高者优先，同级按 buildOrder */
    private readonly _targetList: BossTargetEntry[] = [];
    private _playerNode: Node | null = null;
    private _lockedTarget: Node | null = null;
    private _retargetTimer = 0;
    private _targetScanTimer = 0;
    private _nextBuildOrder = 1;
    private _stuckFrames = 0;
    private readonly _lastPos = new Vec3();
    private readonly _velocity = new Vec2();
    private readonly _facingDir = new Vec2(0, 1);
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private _attackTimer = 0;
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _lifeGeneration = 0;
    private _currentLocomotionClip = '';
    private readonly _visualFacing = new VisualFacing();

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(Collider2D);
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        this._visualFacing.bind(this.visualNode);
        this._hp = GameConfig.bossMaxHp;
        // 近战停步/出手距离（百级像素）；追击无上限
        if (this.attackTriggerRange < 20 || this.attackTriggerRange > 80) {
            this.attackTriggerRange = 56;
        }
        if (this.attackLength < 20) {
            this.attackLength = 160;
        }
        if (this.attackWidth < 10) {
            this.attackWidth = 80;
        }
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this._collider) {
            this._collider.sensor = false;
        }
        EventManager.instance.onEvent(
            GameEvents.BOSS_TARGET_REGISTER,
            this._onTargetRegister,
            this,
        );
    }

    start(): void {
        this._bootstrapExistingTargets();
        this.scheduleOnce(() => {
            this._bindEmbeddedHpBar();
            EventManager.instance.emitEvent(
                GameEvents.HP_CHANGED,
                this.node,
                this._hp,
                GameConfig.bossMaxHp,
            );
        }, 0);
    }

    onDestroy(): void {
        this._lifeGeneration += 1;
        this._isAttacking = false;
        EventManager.instance.offEvent(
            GameEvents.BOSS_TARGET_REGISTER,
            this._onTargetRegister,
            this,
        );
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
    }

    onDisable(): void {
        this._lifeGeneration += 1;
        this._isAttacking = false;
        this._stopMovement();
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
    }

    registerTargets(options: BossTargetOptions): void {
        if (options.player) {
            this._upsertTarget(options.player, 'player');
        }
        for (const n of options.buildings ?? []) {
            if (n) {
                this._upsertTarget(n, 'building');
            }
        }
        for (const n of options.heroes ?? []) {
            if (n) {
                this._upsertTarget(n, 'hero');
            }
        }
        this._injectSceneDefenseTargets();
        this._targetScanTimer = GameConfig.bossTargetScanInterval;
    }

    /** 扫描场景内已有防守目标（Boss 晚于塔/兵营生成时补表） */
    private _bootstrapExistingTargets(): void {
        if (!this._playerNode && this.node.scene) {
            const p = this.node.scene.getComponentInChildren(Player);
            if (p) {
                this._upsertTarget(p.node, 'player');
            }
        }
        this._injectSceneDefenseTargets();
    }

    private _injectSceneDefenseTargets(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        for (const t of scene.getComponentsInChildren(Tower)) {
            if (t.node.activeInHierarchy) {
                this._upsertTarget(t.node, 'building');
            }
        }
        for (const b of scene.getComponentsInChildren(Barracks)) {
            if (b.node.activeInHierarchy) {
                this._upsertTarget(b.node, 'building');
            }
        }
        for (const h of scene.getComponentsInChildren(Hero)) {
            if (h.node.activeInHierarchy) {
                this._upsertTarget(h.node, 'hero');
            }
        }
        for (const soldier of scene.getComponentsInChildren(Soldier)) {
            if (
                soldier.node.activeInHierarchy &&
                !soldier.isDead &&
                this._isMeleeSoldier(soldier)
            ) {
                this._upsertTarget(soldier.node, 'soldier');
            }
        }
        for (const barrier of scene.getComponentsInChildren(Barrier)) {
            if (barrier.isAlive()) {
                this._upsertTarget(barrier.node, 'barrier');
            }
        }
        for (const log of scene.getComponentsInChildren(Log)) {
            if (log.isAttackable()) {
                this._upsertTarget(log.node, 'log');
            }
        }
    }

    private _onTargetRegister = (...args: unknown[]): void => {
        const payload = (args[0] ?? null) as BossTargetRegisterPayload | null;
        if (!payload?.node?.isValid || !payload.kind) {
            return;
        }
        this._upsertTarget(payload.node, payload.kind, payload.buildOrder);
    };

    private _isStructure(kind: BossTargetKind): boolean {
        return kind === 'building' || kind === 'barrier' || kind === 'log';
    }

    private _upsertTarget(node: Node, kind: BossTargetKind, buildOrder?: number): void {
        if (!node?.isValid) {
            return;
        }
        if (kind === 'player') {
            this._playerNode = node;
        }
        const priority = BOSS_TARGET_PRIORITY[kind];
        const idx = this._targetList.findIndex((e) => e.node === node);
        let order = buildOrder;
        if (order === undefined) {
            if (this._isStructure(kind)) {
                order = this._nextBuildOrder++;
            } else {
                order = Number.MAX_SAFE_INTEGER;
            }
        } else if (this._isStructure(kind)) {
            this._nextBuildOrder = Math.max(this._nextBuildOrder, order + 1);
        }
        if (idx >= 0) {
            const cur = this._targetList[idx];
            if (priority > cur.priority) {
                cur.kind = kind;
                cur.priority = priority;
            }
            if (this._isStructure(kind) && order < cur.buildOrder) {
                cur.buildOrder = order;
            }
            return;
        }
        this._targetList.push({ node, kind, priority, buildOrder: order });
    }

    /**
     * Structure > hero > player；同级 Structure 按建造顺序（buildOrder 小优先）。
     */
    pickTarget(): Node | null {
        this._pruneDeadTargets();
        if (this._targetList.length === 0) {
            this._bootstrapExistingTargets();
        }

        let bestPriority = Number.NEGATIVE_INFINITY;
        for (const e of this._targetList) {
            if (!this._isTargetAlive(e.node)) {
                continue;
            }
            if (e.priority > bestPriority) {
                bestPriority = e.priority;
            }
        }
        if (bestPriority === Number.NEGATIVE_INFINITY) {
            return null;
        }

        let best: BossTargetEntry | null = null;
        let bestDistSq = Number.POSITIVE_INFINITY;
        for (const e of this._targetList) {
            if (e.priority !== bestPriority || !this._isTargetAlive(e.node)) {
                continue;
            }
            const distSq = this._distSq(e.node);
            if (
                !best ||
                e.buildOrder < best.buildOrder ||
                (e.buildOrder === best.buildOrder && distSq < bestDistSq)
            ) {
                best = e;
                bestDistSq = distSq;
            }
        }
        return best?.node ?? null;
    }

    private _distSq(node: Node): number {
        this.node.getWorldPosition(this._selfPos);
        node.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        return dx * dx + dy * dy;
    }

    /** 每 bossRetargetInterval 重索敌；期间锁当前目标（死亡则立刻重选） */
    private _resolveChaseTarget(dt: number): Node | null {
        this._retargetTimer -= dt;
        const lockedAlive =
            !!this._lockedTarget?.isValid && this._isTargetAlive(this._lockedTarget);
        if (!lockedAlive || this._retargetTimer <= 0) {
            this._lockedTarget = this.pickTarget();
            this._retargetTimer = GameConfig.bossRetargetInterval;
            EnemyNavigation.get(this.node.scene)?.resetUnit(this.node);
        }
        return this._lockedTarget;
    }

    private _pruneDeadTargets(): void {
        for (let i = this._targetList.length - 1; i >= 0; i--) {
            const e = this._targetList[i];
            if (!e.node?.isValid || !this._isTargetAlive(e.node)) {
                this._targetList.splice(i, 1);
            }
        }
    }

    tryAttack(): void {
        if (this._isDead || this._attackTimer > 0) {
            return;
        }

        // 无索敌距离：追当前锁定目标；仅近战距离内出手
        const target =
            this._lockedTarget?.isValid && this._isTargetAlive(this._lockedTarget)
                ? this._lockedTarget
                : this.pickTarget();
        if (!target) {
            return;
        }

        const dist = this._distanceToTargetSurface(target);
        const melee = Math.max(this.attackTriggerRange, 48);
        if (dist > melee) {
            return;
        }

        target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        if (dist > 0.001) {
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            if (centerDist > 0.001) {
                this._facingDir.set(dx / centerDist, dy / centerDist);
            }
        }
        this._visualFacing.faceByTarget(this.visualNode, this.node, target);

        const generation = this._lifeGeneration;
        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;
        if (this.visualNode) {
            // boss frame_007 → 0.7s
            playAttackWithFrameHit(
                this.visualNode,
                'attack',
                () => {
                    if (this._lifeGeneration === generation && !this._isDead && this._isAttacking) {
                        this._applyCircleAttack();
                    }
                },
                0.75,
            );
        } else {
            this._applyCircleAttack();
        }
        this.scheduleOnce(() => {
            if (this._lifeGeneration !== generation) {
                return;
            }
            this._isAttacking = false;
        }, 1.2);
    }

    takeDamage(amount: number): void {
        if (this._isDead) {
            return;
        }
        this._hp -= amount;
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.bossMaxHp,
        );
        if (this._hp <= 0) {
            this._die();
        }
    }

    get isDead(): boolean {
        return this._isDead;
    }

    reset(): void {
        this._lifeGeneration += 1;
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.bossMaxHp;
        this._targetList.length = 0;
        this._playerNode = null;
        this._lockedTarget = null;
        this._retargetTimer = 0;
        this._nextBuildOrder = 1;
        this._stuckFrames = 0;
        this._attackTimer = 0;
        this._isDead = false;
        this._canMove = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
        this._facingDir.set(0, 1);
        EnemyNavigation.get(this.node.scene)?.resetUnit(this.node);
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
        }
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            this._visualFacing.reset(this.visualNode);
            playAnim(this.visualNode, 'idle');
        }
        this._bootstrapExistingTargets();
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.bossMaxHp,
        );
        this._bindEmbeddedHpBar();
    }

    update(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canMove || this._isDead || dt <= 0) {
            return;
        }

        if (this._isAttacking) {
            this._stopMovement();
            return;
        }

        this._scanTargetsByInterval(dt);

        // 每 5s 重索敌；soldier > Structure > hero > player（Structure 按建造序）
        const target = this._resolveChaseTarget(dt);
        if (!target) {
            this._velocity.set(0, 0);
            this._stopMovement();
            this._updateLocomotionAnim(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        const dist = this._distanceFromSelfToTargetSurface(target);

        if (centerDist > 0.001) {
            this._facingDir.set(dx / centerDist, dy / centerDist);
        }
        this._visualFacing.faceByTarget(this.visualNode, this.node, target);

        const melee = Math.max(this.attackTriggerRange, 48);
        if (dist <= melee) {
            this._stopMovement();
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const size = this._bodySize();
        EnemyNavigation.get(this.node.scene)?.nextVelocity(
            {
                unit: this.node,
                target,
                role: 'boss',
                speed: GameConfig.bossMoveSpeed,
                dt,
                body: { width: size.w, height: size.h, offsetX: size.offsetX, offsetY: size.offsetY },
                stopDistance: melee,
                preferEntranceNearestTo: this._playerNode,
            },
            this._velocity,
        );
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x);
        this._updateStuck(centerDist);
        this._updateLocomotionAnim(true);
    }

    private _scanTargetsByInterval(dt: number): void {
        this._targetScanTimer -= dt;
        if (this._targetScanTimer > 0) {
            return;
        }
        this._targetScanTimer = GameConfig.bossTargetScanInterval;
        this._injectSceneDefenseTargets();
    }

    private _updateStuck(targetDist: number): void {
        const moved =
            Math.abs(this._selfPos.x - this._lastPos.x) +
            Math.abs(this._selfPos.y - this._lastPos.y);
        this._lastPos.set(this._selfPos);
        if (targetDist > this.attackTriggerRange && moved < 0.08) {
            this._stuckFrames += 1;
        } else {
            this._stuckFrames = 0;
        }
    }

    private _applyCircleAttack(): void {
        const candidates = this._collectAttackCandidates();
        const radius = Math.max(this.attackTriggerRange, 48);
        const radiusSq = radius * radius;

        this.node.getWorldPosition(this._selfPos);

        for (const node of candidates) {
            if (!this._isTargetAlive(node)) {
                continue;
            }
            if (this._distanceFromSelfToTargetSurfaceSq(node) > radiusSq) {
                continue;
            }
            this._dealDamageToNode(node);
        }
    }

    private _distanceToTargetSurface(node: Node): number {
        this.node.getWorldPosition(this._selfPos);
        return Math.sqrt(this._distanceFromSelfToTargetSurfaceSq(node));
    }

    private _distanceFromSelfToTargetSurface(node: Node): number {
        return Math.sqrt(this._distanceFromSelfToTargetSurfaceSq(node));
    }

    private _distanceFromSelfToTargetSurfaceSq(node: Node): number {
        const box = node.getComponent(BoxCollider2D);
        if (box) {
            const aabb = box.worldAABB;
            const closestX = Math.max(aabb.xMin, Math.min(this._selfPos.x, aabb.xMax));
            const closestY = Math.max(aabb.yMin, Math.min(this._selfPos.y, aabb.yMax));
            const dx = closestX - this._selfPos.x;
            const dy = closestY - this._selfPos.y;
            return dx * dx + dy * dy;
        }

        node.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        return dx * dx + dy * dy;
    }

    private _collectAttackCandidates(): Node[] {
        this._pruneDeadTargets();
        const out: Node[] = [];
        const seen = new Set<Node>();
        for (const e of this._targetList) {
            if (e.node?.isValid && this._isTargetAlive(e.node) && !seen.has(e.node)) {
                seen.add(e.node);
                out.push(e.node);
            }
        }
        const scene = this.node.scene;
        if (scene) {
            for (const soldier of scene.getComponentsInChildren(Soldier)) {
                if (
                    soldier.node?.isValid &&
                    this._isTargetAlive(soldier.node) &&
                    !seen.has(soldier.node)
                ) {
                    seen.add(soldier.node);
                    out.push(soldier.node);
                }
            }
        }
        return out;
    }

    private _isTargetAlive(node: Node | null): boolean {
        if (!node || !node.activeInHierarchy) {
            return false;
        }
        const barrier = node.getComponent(Barrier);
        if (barrier) {
            return barrier.isAlive();
        }
        const building = node.getComponent(Building);
        if (building) {
            return building.isAlive();
        }
        const tower = node.getComponent(Tower);
        if (tower) {
            return tower.isAlive();
        }
        const barracks = node.getComponent(Barracks);
        if (barracks) {
            return barracks.isAlive();
        }
        const log = node.getComponent(Log);
        if (log) {
            return log.isAttackable();
        }
        const player = node.getComponent(Player);
        if (player) {
            return !player.isDead;
        }
        const hero = node.getComponent(Hero);
        if (hero) {
            return !hero.isDead;
        }
        const soldier = node.getComponent(Soldier);
        if (soldier) {
            return !soldier.isDead;
        }
        return true;
    }

    private _isMeleeSoldier(soldier: Soldier): boolean {
        return soldier.getDeployment() === 'barracks' || /melee/i.test(soldier.node.name);
    }

    private _dealDamageToNode(node: Node): void {
        const log = node.getComponent(Log);
        if (log?.isAttackable()) {
            log.takeDamage(GameConfig.bossAttackDamage);
            return;
        }
        const barrier = node.getComponent(Barrier);
        if (barrier?.isAlive()) {
            barrier.takeDamage(GameConfig.bossBuildingDamage);
            return;
        }
        const building = node.getComponent(Building);
        if (building?.isAlive()) {
            building.takeDamage(GameConfig.bossBuildingDamage);
            return;
        }
        const soldier = node.getComponent(Soldier);
        if (soldier && !soldier.isDead) {
            soldier.takeDamage(
                Math.max(GameConfig.bossBuildingDamage, GameConfig.soldierMaxHp),
            );
            return;
        }
        const hero = node.getComponent(Hero);
        if (hero && !hero.isDead) {
            hero.takeDamage(GameConfig.bossAttackDamage);
            return;
        }
        const player = node.getComponent(Player);
        if (player) {
            player.takeDamage(GameConfig.bossAttackDamage);
        }
    }

    private _die(): void {
        this._lifeGeneration += 1;
        this._isDead = true;
        this._isAttacking = false;
        this._canMove = false;
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this._collider) {
            this._collider.enabled = false;
        }
        EnemyNavigation.get(this.node.scene)?.releaseUnit(this.node);
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
        const generation = this._lifeGeneration;
        this.scheduleOnce(() => {
            if (this._lifeGeneration !== generation) {
                return;
            }
            this.node.active = false;
        }, 0.8);
    }

    private _bindEmbeddedHpBar(): HpBarUI | null {
        const bar = this.node.getComponentInChildren(HpBarUI);
        if (!bar) {
            return null;
        }
        bar.bindTarget(this.node);
        bar.hideWhenFull = false;
        bar.showMaxInLabel = false;
        bar.applyHp(this._hp, GameConfig.bossMaxHp, true);
        return bar;
    }

    private _updateLocomotionAnim(isMoving: boolean): void {
        if (!this.visualNode || this._isDead || this._isAttacking) {
            return;
        }

        const clip = isMoving ? 'walk' : 'idle';
        if (clip === this._currentLocomotionClip) {
            return;
        }
        this._currentLocomotionClip = clip;
        playAnim(this.visualNode, clip);
    }

    private _stopMovement(): void {
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
    }

    private _bodySize(): FlowBody & { w: number; h: number } {
        const box = this.node.getComponent(BoxCollider2D);
        if (box) {
            const physical = EnemyNavigation.bodyForCollider?.(box);
            if (physical) return { ...physical, w: physical.width, h: physical.height };
            const aabb = box.worldAABB;
            const w = Math.abs(aabb.width);
            const h = Math.abs(aabb.height);
            if (w >= 1 && h >= 1) {
                this.node.getWorldPosition(this._selfPos);
                const stable = stableFlowBody({
                    width: w,
                    height: h,
                    offsetX: (aabb.xMin + aabb.xMax) * 0.5 - this._selfPos.x,
                    offsetY: (aabb.yMin + aabb.yMax) * 0.5 - this._selfPos.y,
                });
                return { ...stable, w: stable.width, h: stable.height };
            }
        }
        const fallback = AirWallAabb.bodySize(this.node, 60, 60);
        return { ...fallback, width: fallback.w, height: fallback.h, offsetX: 0, offsetY: 0 };
    }
}
