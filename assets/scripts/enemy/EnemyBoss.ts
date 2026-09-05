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
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { Log } from '../item/Log';
import { UIManager } from '../ui/UIManager';

const { ccclass, property } = _decorator;

export type BossTargetKind = 'player' | 'hero' | 'building' | 'barrier' | 'log';

export interface BossTargetRegisterPayload {
    node: Node;
    kind: BossTargetKind;
    /** Structure 建造顺序（越小越先建成、越优先）；非 Structure 可省略 */
    buildOrder?: number;
}

/**
 * 索敌优先级：Structure(building/barrier/log) > hero > player。
 * Structure 内再按 buildOrder 升序（建造顺序）。
 */
const BOSS_TARGET_PRIORITY: Record<BossTargetKind, number> = {
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

    @property({ tooltip: '长条攻击长度（世界单位）' })
    attackLength = 4;

    @property({ tooltip: '长条攻击宽度（世界单位）' })
    attackWidth = 2;

    @property({ tooltip: '进入攻击的距离（世界单位）' })
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
    private _nextBuildOrder = 1;
    private readonly _velocity = new Vec2();
    private readonly _facingDir = new Vec2(0, 1);
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _toTarget = new Vec2();
    private _airWalls: BoxCollider2D[] = [];
    private _attackTimer = 0;
    private _isDead = false;
    private _canMove = true;
    private _isAttacking = false;
    private _currentLocomotionClip = '';

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(Collider2D);
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
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
            const bar = UIManager.instance?.spawnHpBar(
                'boss',
                this.node,
                this.visualNode ?? this.node,
            );
            if (bar) {
                bar.hideWhenFull = false;
                bar.showMaxInLabel = false;
            }
            EventManager.instance.emitEvent(
                GameEvents.HP_CHANGED,
                this.node,
                this._hp,
                GameConfig.bossMaxHp,
            );
        }, 0);
    }

    onDestroy(): void {
        EventManager.instance.offEvent(
            GameEvents.BOSS_TARGET_REGISTER,
            this._onTargetRegister,
            this,
        );
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
        for (const e of this._targetList) {
            if (e.priority !== bestPriority || !this._isTargetAlive(e.node)) {
                continue;
            }
            if (
                !best ||
                e.buildOrder < best.buildOrder ||
                (e.buildOrder === best.buildOrder && this._distSq(e.node) < this._distSq(best.node))
            ) {
                best = e;
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

        this.node.getWorldPosition(this._selfPos);
        target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const melee = Math.max(this.attackTriggerRange, 48);
        if (dist > melee) {
            return;
        }

        if (dist > 0.001) {
            this._facingDir.set(dx / dist, dy / dist);
        }

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;
        if (this.visualNode) {
            // boss frame_007 → 0.7s
            playAttackWithFrameHit(
                this.visualNode,
                'attack',
                () => {
                    if (!this._isDead) {
                        this._applyLineAttack();
                    }
                },
                0.75,
            );
        } else {
            this._applyLineAttack();
        }
        this.scheduleOnce(() => {
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
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.bossMaxHp;
        this._targetList.length = 0;
        this._playerNode = null;
        this._lockedTarget = null;
        this._retargetTimer = 0;
        this._nextBuildOrder = 1;
        this._attackTimer = 0;
        this._isDead = false;
        this._canMove = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
        this._facingDir.set(0, 1);
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
        }
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'idle');
        }
        this._bootstrapExistingTargets();
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.bossMaxHp,
        );
    }

    update(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canMove || this._isDead || dt <= 0) {
            return;
        }

        // 每 5s 重索敌；Structure > hero > player（Structure 按建造序）
        const target = this._resolveChaseTarget(dt);
        if (!target) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._updateLocomotionAnim(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.001) {
            this._facingDir.set(dx / dist, dy / dist);
        }

        const melee = Math.max(this.attackTriggerRange, 48);
        if (dist <= melee) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const size = AirWallAabb.bodySize(this.node, 60, 60);
        const walls = AirWallAabb.collectAirWalls(this.node.scene, this._airWalls);
        AirWallAabb.steerDirection(
            this._selfPos,
            this._targetPos,
            size.w,
            size.h,
            walls,
            this._toTarget,
        );
        this._velocity.x = this._toTarget.x * GameConfig.bossMoveSpeed;
        this._velocity.y = this._toTarget.y * GameConfig.bossMoveSpeed;
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._updateLocomotionAnim(true);
    }

    private _applyLineAttack(): void {
        const candidates = this._collectAttackCandidates();
        const halfWidth = this.attackWidth * 0.5;
        const forwardX = this._facingDir.x;
        const forwardY = this._facingDir.y;
        const perpX = -forwardY;
        const perpY = forwardX;

        this.node.getWorldPosition(this._selfPos);

        for (const node of candidates) {
            if (!this._isTargetAlive(node)) {
                continue;
            }
            node.getWorldPosition(this._targetPos);
            const offsetX = this._targetPos.x - this._selfPos.x;
            const offsetY = this._targetPos.y - this._selfPos.y;
            const forwardDist = offsetX * forwardX + offsetY * forwardY;
            if (forwardDist < 0 || forwardDist > this.attackLength) {
                continue;
            }
            const sideDist = Math.abs(offsetX * perpX + offsetY * perpY);
            if (sideDist > halfWidth) {
                continue;
            }
            this._dealDamageToNode(node);
        }
    }

    private _collectAttackCandidates(): Node[] {
        this._pruneDeadTargets();
        const out: Node[] = [];
        for (const e of this._targetList) {
            if (e.node?.isValid && this._isTargetAlive(e.node)) {
                out.push(e.node);
            }
        }
        const scene = this.node.scene;
        if (scene) {
            for (const soldier of scene.getComponentsInChildren(Soldier)) {
                if (soldier.node?.isValid && this._isTargetAlive(soldier.node)) {
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
        this._isDead = true;
        this._canMove = false;
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        if (this._collider) {
            this._collider.enabled = false;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
        this.scheduleOnce(() => {
            this.node.active = false;
        }, 0.8);
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
}
