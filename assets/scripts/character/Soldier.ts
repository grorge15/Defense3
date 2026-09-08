import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    ERigidBody2DType,
    instantiate,
    Node,
    Prefab,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { AirWallAabb } from '../core/AirWallAabb';
import { playAnim, playAttackWithFrameHit } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { PathAgent } from '../core/PathAgent';
import { VisualFacing } from '../core/VisualFacing';
import { HpBarUI } from '../ui/HpBarUI';

const { ccclass, property } = _decorator;

export type SoldierDeployment = 'tower' | 'barracks';
type BossLike = Component & {
    readonly isDead: boolean;
    takeDamage(amount: number): void;
};
type SoldierAttackTarget = EnemyMinion | BossLike;

@ccclass('Soldier')
export class Soldier extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '远程攻击范围（世界单位）' })
    attackRange = 280;

    @property({ tooltip: '近战攻击范围（世界单位）' })
    meleeAttackRange = 48;

    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 1.0;

    @property({ tooltip: '攻击伤害' })
    attackDamage = 10;

    @property({ tooltip: '近战移动速度（世界单位/秒；运行时用 GameConfig.soldierMoveSpeed）' })
    moveSpeed = 2;

    @property({ type: Prefab, tooltip: '远程弹道占位 pref_projectile_arrow' })
    projectilePrefab: Prefab | null = null;

    private _rb: RigidBody2D | null = null;
    private _collider: Collider2D | null = null;
    private _hp = GameConfig.soldierMaxHp;
    private _deployment: SoldierDeployment = 'tower';
    private _target: Node | null = null;
    private _attackTimer = 0;
    private _isDead = false;
    private _canAct = true;
    private _isAttacking = false;
    private _currentLocomotionClip = '';
    private _lockedAttackTarget: SoldierAttackTarget | null = null;
    private _retargetTimer = 0;
    private readonly _velocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _pathAgent = new PathAgent();
    private readonly _visualFacing = new VisualFacing();
    private _airWalls: BoxCollider2D[] = [];

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(Collider2D);
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        this._visualFacing.bind(this.visualNode);
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
        if (/melee/i.test(this.node.name)) {
            this._deployment = 'barracks';
        } else if (/ranged/i.test(this.node.name)) {
            this._deployment = 'tower';
        }
        // 近战移速与小怪同量级：读 GameConfig，禁止把 prefab 的 2~3 误抬到 90
        this.moveSpeed = GameConfig.soldierMoveSpeed;
        this.meleeAttackRange = GameConfig.soldierMeleeAttackRange;
        if (this.attackRange < 40) {
            this.attackRange = 280;
        }
        this._bindEmbeddedHpBar();
    }

    setDeployment(deployment: SoldierDeployment): void {
        this._deployment = deployment;
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        this._lockedAttackTarget = null;
        this._retargetTimer = 0;
        this._pathAgent.reset();
    }

    getDeployment(): SoldierDeployment {
        return this._deployment;
    }

    setTarget(target: Node | null): void {
        this._target = target;
        this._lockedAttackTarget = null;
        this._retargetTimer = 0;
        this._pathAgent.reset();
    }

    activate(): void {
        if (this._isDead) {
            return;
        }
        this._canAct = true;
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'idle');
        }
        this._bindEmbeddedHpBar();
    }

    deactivate(): void {
        this._canAct = false;
        this._velocity.set(0, 0);
        this._pathAgent.reset();
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
    }

    tryAttack(): void {
        if (!this._canAct || this._isDead || this._attackTimer > 0) {
            return;
        }

        const enemy = this._resolveAttackTarget();
        if (!enemy) {
            return;
        }
        this._visualFacing.faceByTarget(this.visualNode, this.node, enemy.node);

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;

        const unlock = (): void => {
            this._isAttacking = false;
            this._currentLocomotionClip = '';
        };

        if (this._deployment === 'tower') {
            if (this.visualNode) {
                playAttackWithFrameHit(
                    this.visualNode,
                    'remoteAttack',
                    () => {
                        if (enemy.node.isValid && !enemy.isDead) {
                            this._spawnProjectile(enemy.node);
                            enemy.takeDamage(this.attackDamage);
                        }
                    },
                    0.9,
                    unlock,
                );
                this.scheduleOnce(() => {
                    if (this._isAttacking) {
                        unlock();
                    }
                }, 1.2);
            } else {
                this._spawnProjectile(enemy.node);
                enemy.takeDamage(this.attackDamage);
                unlock();
            }
        } else if (this.visualNode) {
            playAttackWithFrameHit(
                this.visualNode,
                'meleeAttack',
                () => {
                    if (enemy.node.isValid && !enemy.isDead) {
                        enemy.takeDamage(this.attackDamage);
                    }
                },
                0.5,
                unlock,
            );
            this.scheduleOnce(() => {
                if (this._isAttacking) {
                    unlock();
                }
            }, 0.9);
        } else {
            enemy.takeDamage(this.attackDamage);
            unlock();
        }
    }

    get isDead(): boolean {
        return this._isDead;
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
            GameConfig.soldierMaxHp,
        );
        if (this._hp <= 0) {
            this._die();
        }
    }

    reset(): void {
        this.unscheduleAllCallbacks();
        this._hp = GameConfig.soldierMaxHp;
        this._target = null;
        this._lockedAttackTarget = null;
        this._retargetTimer = 0;
        this._attackTimer = 0;
        this._isDead = false;
        this._canAct = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
        this._pathAgent.reset();
        this.node.active = true;
        if (this._collider) {
            this._collider.enabled = true;
            this._collider.sensor = false;
        }
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = this._velocity;
        }
        if (this.visualNode) {
            this._visualFacing.reset(this.visualNode);
            playAnim(this.visualNode, 'idle');
        }
    }

    update(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canAct || this._isDead || dt <= 0) {
            return;
        }

        if (this._deployment === 'tower') {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._updateLocomotionAnim(false);
            if (this._findPreferredTarget(this.attackRange)) {
                this.tryAttack();
            }
            return;
        }

        const enemy = this._resolveMeleeChaseTarget(dt);
        if (!enemy) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._updateLocomotionAnim(false);
            return;
        }

        this.node.getWorldPosition(this._selfPos);
        enemy.node.getWorldPosition(this._targetPos);
        const dx = this._targetPos.x - this._selfPos.x;
        const dy = this._targetPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.meleeAttackRange) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            this._visualFacing.faceByTarget(this.visualNode, this.node, enemy.node);
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const speed = GameConfig.soldierMoveSpeed;
        const size = AirWallAabb.bodySize(this.node);
        const walls = AirWallAabb.collectAirWalls(this.node.scene, this._airWalls);
        this._pathAgent.nextDirection(
            dt,
            this._selfPos,
            this._targetPos,
            size.w,
            size.h,
            walls,
            this._velocity,
        );
        this._velocity.x *= speed;
        this._velocity.y *= speed;
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._visualFacing.faceByVelocity(this.visualNode, this._velocity.x);
        this._updateLocomotionAnim(true);
    }

    private _resolveAttackTarget(): SoldierAttackTarget | null {
        if (this._target && this._target.activeInHierarchy) {
            const fromTarget = this._target.getComponent(EnemyMinion);
            if (fromTarget) {
                return fromTarget;
            }
            const bossFromTarget = this._target.getComponent('EnemyBoss') as BossLike | null;
            if (bossFromTarget && !bossFromTarget.isDead) {
                return bossFromTarget;
            }
        }
        const range = this._deployment === 'tower' ? this.attackRange : this.meleeAttackRange;
        return this._findPreferredTarget(range);
    }

    private _resolveMeleeChaseTarget(dt: number): SoldierAttackTarget | null {
        this._retargetTimer -= dt;
        if (
            this._lockedAttackTarget &&
            this._retargetTimer > 0 &&
            this._isAttackTargetAlive(this._lockedAttackTarget)
        ) {
            return this._lockedAttackTarget;
        }

        const next = this._findPreferredTarget(Number.POSITIVE_INFINITY);
        if (next !== this._lockedAttackTarget) {
            this._pathAgent.reset();
        }
        this._lockedAttackTarget = next;
        this._retargetTimer = GameConfig.soldierRetargetInterval;
        return next;
    }

    private _findPreferredTarget(maxRange: number): SoldierAttackTarget | null {
        if (this._deployment === 'barracks') {
            const boss = this._findNearestBoss(maxRange);
            if (boss) {
                return boss;
            }
        }
        return this._findNearestEnemy(maxRange);
    }

    private _findNearestBoss(maxRange: number): BossLike | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        this.node.getWorldPosition(this._selfPos);
        let nearest: BossLike | null = null;
        let nearestDistSq = maxRange * maxRange;

        for (const boss of scene.getComponentsInChildren('EnemyBoss') as BossLike[]) {
            if (!boss.node.activeInHierarchy || boss.isDead) {
                continue;
            }
            boss.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= nearestDistSq) {
                nearestDistSq = distSq;
                nearest = boss;
            }
        }
        return nearest;
    }

    private _findNearestEnemy(maxRange: number): EnemyMinion | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        this.node.getWorldPosition(this._selfPos);
        let nearest: EnemyMinion | null = null;
        let nearestDistSq = maxRange * maxRange;

        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.activeInHierarchy || minion.isDead) {
                continue;
            }
            minion.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= nearestDistSq) {
                nearestDistSq = distSq;
                nearest = minion;
            }
        }
        return nearest;
    }

    private _isAttackTargetAlive(target: SoldierAttackTarget | null): boolean {
        return !!target?.node?.isValid && target.node.activeInHierarchy && !target.isDead;
    }

    private _spawnProjectile(target: Node): void {
        if (!this.projectilePrefab) {
            return;
        }

        const projectile = instantiate(this.projectilePrefab);
        const parent = this.node.parent ?? this.node.scene;
        projectile.setParent(parent);
        projectile.setWorldPosition(this.node.worldPosition);

        const start = this.node.worldPosition.clone();
        const end = target.worldPosition.clone();
        let elapsed = 0;
        const duration = 0.2;

        const moveTick = (dt: number): void => {
            elapsed += dt;
            const t = Math.min(elapsed / duration, 1);
            projectile.setWorldPosition(
                start.x + (end.x - start.x) * t,
                start.y + (end.y - start.y) * t,
                start.z + (end.z - start.z) * t,
            );
            if (t >= 1) {
                this.unschedule(moveTick);
                if (projectile.isValid) {
                    projectile.destroy();
                }
            }
        };
        this.schedule(moveTick, 0);
    }

    private _die(): void {
        this._isDead = true;
        this._canAct = false;
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        if (this._collider) {
            this._collider.enabled = false;
        }
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
        this.scheduleOnce(() => {
            this.node.active = false;
        }, 0.5);
    }

    private _updateLocomotionAnim(_isMoving: boolean): void {
        if (!this.visualNode || this._isDead || this._isAttacking) {
            return;
        }
        const clip = _isMoving ? 'walk' : 'idle';
        if (this._currentLocomotionClip === clip) {
            return;
        }
        this._currentLocomotionClip = clip;
        playAnim(this.visualNode, clip);
    }

    private _bindEmbeddedHpBar(): void {
        const bar = this.node.getComponentInChildren(HpBarUI);
        if (!bar) {
            return;
        }
        bar.hideWhenFull = true;
        bar.hideWhenDead = true;
        bar.bindTarget(this.node);
        bar.applyHp(this._hp, GameConfig.soldierMaxHp, true);
    }
}
