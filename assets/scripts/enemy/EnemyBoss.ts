import {
    _decorator,
    Collider2D,
    Component,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { Barrier } from '../building/Barrier';
import { Building } from '../building/Building';
import { Player } from '../character/Player';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { Log } from '../item/Log';
import { UIManager } from '../ui/UIManager';

const { ccclass, property } = _decorator;

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
    private _buildings: Node[] = [];
    private _heroes: Node[] = [];
    private _playerNode: Node | null = null;
    private readonly _velocity = new Vec2();
    private readonly _facingDir = new Vec2(0, 1);
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _toTarget = new Vec2();
    private readonly _nextWorld = new Vec3();
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
        // 旧预制若仍是「约 1 单位」世界，抬到百级像素尺度
        if (this.attackTriggerRange < 20) {
            this.attackTriggerRange = 120;
        }
        if (this.attackLength < 20) {
            this.attackLength = 160;
        }
        if (this.attackWidth < 10) {
            this.attackWidth = 80;
        }
    }

    start(): void {
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

    registerTargets(options: BossTargetOptions): void {
        this._buildings = options.buildings ?? [];
        this._heroes = options.heroes ?? [];
        this._playerNode = options.player ?? null;
        this._injectBarriersIntoBuildings();
    }

    /** 将场景内存活 Barrier 并入建筑索敌列表（BossSpawner 未注入时仍生效） */
    private _injectBarriersIntoBuildings(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const set = new Set(this._buildings.filter((n) => !!n));
        for (const barrier of scene.getComponentsInChildren(Barrier)) {
            if (barrier.isAlive()) {
                set.add(barrier.node);
            }
        }
        this._buildings = [...set];
    }

    pickTarget(): Node | null {
        if (!this._playerNode && this.node.scene) {
            this._playerNode =
                this.node.scene.getComponentInChildren(Player)?.node ?? null;
        }
        // 追击优先玩家
        if (this._isTargetAlive(this._playerNode)) {
            return this._playerNode;
        }
        this._injectBarriersIntoBuildings();
        const building = this._pickNearestAlive(this._buildings);
        if (building) {
            return building;
        }
        return this._pickNearestAlive(this._heroes);
    }

    tryAttack(): void {
        if (this._isDead || this._attackTimer > 0) {
            return;
        }

        const target = this.pickTarget();
        if (!target) {
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        target.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.attackTriggerRange) {
            return;
        }

        if (dist > 0.001) {
            this._facingDir.set(dx / dist, dy / dist);
        }

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;
        if (this.visualNode) {
            playAnim(this.visualNode, 'attack');
        }
        this._applyLineAttack();
        this.scheduleOnce(() => {
            this._isAttacking = false;
        }, 0.15);
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

    reset(): void {
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.bossMaxHp;
        this._buildings = [];
        this._heroes = [];
        this._playerNode = null;
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
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.bossMaxHp,
        );
    }

    fixedUpdate(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canMove || this._isDead || dt <= 0) {
            return;
        }

        // 始终追玩家（无玩家再退回建筑/英雄）
        const target = this.pickTarget();
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

        if (dist <= this.attackTriggerRange) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const invDist = 1 / dist;
        this._velocity.x = dx * invDist * GameConfig.bossMoveSpeed;
        this._velocity.y = dy * invDist * GameConfig.bossMoveSpeed;
        this._nextWorld.set(
            this._selfPos.x + this._velocity.x * dt,
            this._selfPos.y + this._velocity.y * dt,
            this._selfPos.z,
        );
        this.node.setWorldPosition(this._nextWorld);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
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
        const set = new Set<Node>();
        for (const node of this._buildings) {
            if (node) {
                set.add(node);
            }
        }
        for (const node of this._heroes) {
            if (node) {
                set.add(node);
            }
        }
        if (this._playerNode) {
            set.add(this._playerNode);
        }
        return [...set];
    }

    private _pickNearestAlive(nodes: Node[]): Node | null {
        let nearest: Node | null = null;
        let nearestDistSq = Number.POSITIVE_INFINITY;
        this.node.getWorldPosition(this._selfPos);

        for (const node of nodes) {
            if (!this._isTargetAlive(node)) {
                continue;
            }
            node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = node;
            }
        }
        return nearest;
    }

    private _isTargetAlive(node: Node | null): boolean {
        if (!node || !node.active) {
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
        const log = node.getComponent(Log);
        if (log) {
            return log.isAttackable();
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
            barrier.takeDamage(GameConfig.bossAttackDamage);
            return;
        }
        const building = node.getComponent(Building);
        if (building?.isAlive()) {
            building.takeDamage(GameConfig.bossAttackDamage);
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
