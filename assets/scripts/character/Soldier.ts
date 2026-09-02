import {
    _decorator,
    Collider2D,
    Component,
    instantiate,
    Node,
    Prefab,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

export type SoldierDeployment = 'tower' | 'barracks';

@ccclass('Soldier')
export class Soldier extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '攻击范围（世界单位）' })
    attackRange = 4;

    @property({ tooltip: '近战攻击范围（世界单位）' })
    meleeAttackRange = 1.5;

    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 1.0;

    @property({ tooltip: '攻击伤害' })
    attackDamage = 10;

    @property({ tooltip: '近战移动速度（世界单位/秒）' })
    moveSpeed = 3;

    @property({ type: Prefab, tooltip: '远程弹道占位 pref_projectile_arrow（P2-013 可后补）' })
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
    private readonly _velocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(Collider2D);
        // Prefab 名约定：melee → barracks 近战，其余默认 tower 远程
        if (/melee/i.test(this.node.name)) {
            this._deployment = 'barracks';
        } else if (/ranged/i.test(this.node.name)) {
            this._deployment = 'tower';
        }
    }

    setDeployment(deployment: SoldierDeployment): void {
        this._deployment = deployment;
        if (deployment === 'tower' && this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
    }

    getDeployment(): SoldierDeployment {
        return this._deployment;
    }

    setTarget(target: Node | null): void {
        this._target = target;
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
    }

    deactivate(): void {
        this._canAct = false;
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
    }

    tryAttack(): void {
        if (!this._canAct || this._isDead || this._attackTimer > 0) {
            return;
        }

        const enemy = this._resolveTargetEnemy();
        if (!enemy) {
            return;
        }

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;

        if (this._deployment === 'tower') {
            if (this.visualNode) {
                playAnim(this.visualNode, 'remoteAttack');
            }
            this._spawnProjectile(enemy.node);
            enemy.takeDamage(this.attackDamage);
        } else {
            if (this.visualNode) {
                playAnim(this.visualNode, 'meleeAttack');
            }
            enemy.takeDamage(this.attackDamage);
        }

        this.scheduleOnce(() => {
            this._isAttacking = false;
        }, 0.1);
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
        this._attackTimer = 0;
        this._isDead = false;
        this._canAct = true;
        this._isAttacking = false;
        this._currentLocomotionClip = '';
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
    }

    fixedUpdate(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canAct || this._isDead) {
            return;
        }

        if (this._deployment === 'tower') {
            if (this._rb) {
                this._rb.linearVelocity = this._velocity.set(0, 0);
            }
            this._updateLocomotionAnim(false);
            if (this._findNearestEnemy(this.attackRange)) {
                this.tryAttack();
            }
            return;
        }

        // barracks: melee, can move toward enemy
        if (!this._rb) {
            return;
        }

        const enemy = this._findNearestEnemy(Number.POSITIVE_INFINITY);
        if (!enemy) {
            this._velocity.set(0, 0);
            this._rb.linearVelocity = this._velocity;
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
            this._rb.linearVelocity = this._velocity;
            this._updateLocomotionAnim(false);
            this.tryAttack();
            return;
        }

        const invDist = 1 / dist;
        this._velocity.x = dx * invDist * this.moveSpeed;
        this._velocity.y = dy * invDist * this.moveSpeed;
        this._rb.linearVelocity = this._velocity;
        this._updateLocomotionAnim(true);
    }

    private _resolveTargetEnemy(): EnemyMinion | null {
        if (this._target && this._target.active) {
            const fromTarget = this._target.getComponent(EnemyMinion);
            if (fromTarget) {
                return fromTarget;
            }
        }
        const range = this._deployment === 'tower' ? this.attackRange : this.meleeAttackRange;
        return this._findNearestEnemy(range);
    }

    private _findNearestEnemy(maxRange: number): EnemyMinion | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        this.node.getWorldPosition(this._selfPos);
        let nearest: EnemyMinion | null = null;
        let nearestDist = maxRange;

        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.active) {
                continue;
            }
            minion.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= nearestDist) {
                nearestDist = dist;
                nearest = minion;
            }
        }
        return nearest;
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
        }, 0.5);
    }

    private _updateLocomotionAnim(_isMoving: boolean): void {
        if (!this.visualNode || this._isDead || this._isAttacking) {
            return;
        }
        // soldier 无 walk clip（ANIM_MANIFEST），移动与站立均播 idle
        if (this._currentLocomotionClip === 'idle') {
            return;
        }
        this._currentLocomotionClip = 'idle';
        playAnim(this.visualNode, 'idle');
    }
}
