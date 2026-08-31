import { _decorator, Component, instantiate, Node, Prefab, RigidBody2D, Vec2, Vec3 } from 'cc';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

@ccclass('Hero')
export class Hero extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '相对跟随目标身后的偏移' })
    followOffset = new Vec3(0, 0, -1.5);

    @property({ tooltip: '远程攻击范围（世界单位）' })
    attackRange = 6;

    @property({ tooltip: '攻击冷却（秒）' })
    attackCooldown = 1.2;

    @property({ tooltip: '攻击伤害' })
    attackDamage = 15;

    @property({ type: Prefab, tooltip: '英雄 01 弹道占位 prefab' })
    projectilePrefab01: Prefab | null = null;

    @property({ type: Prefab, tooltip: '英雄 02 弹道占位 prefab' })
    projectilePrefab02: Prefab | null = null;

    @property({ tooltip: '英雄变体：1 或 2' })
    heroVariant: 1 | 2 = 1;

    private _rb: RigidBody2D | null = null;
    private _followTarget: Node | null = null;
    private _hp = GameConfig.heroMaxHp;
    private _isDead = false;
    private _canAct = true;
    private _attackTimer = 0;
    private _isAttacking = false;
    private _currentLocomotionClip = '';
    private readonly _velocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _desiredPos = new Vec3();

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this.setHeroVariant(this.heroVariant);
    }

    setHeroVariant(variant: 1 | 2): void {
        this.heroVariant = variant;
    }

    setFollowTarget(target: Node | null): void {
        this._followTarget = target;
    }

    tryAttack(): void {
        if (!this._canAct || this._isDead || this._attackTimer > 0) {
            return;
        }

        const enemy = this._findNearestEnemy();
        if (!enemy) {
            return;
        }

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;
        if (this.visualNode) {
            playAnim(this.visualNode, 'attack');
        }
        this._spawnProjectile(enemy.node);
        enemy.takeDamage(this.attackDamage);

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
            GameConfig.heroMaxHp,
        );
        if (this._hp <= 0) {
            this._die();
        }
    }

    fixedUpdate(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canAct || !this._rb || this._isDead) {
            return;
        }

        if (!this._followTarget || !this._followTarget.active) {
            this._velocity.set(0, 0);
            this._rb.linearVelocity = this._velocity;
            this._updateLocomotionAnim(false);
            return;
        }

        this._followTarget.getWorldPosition(this._targetPos);
        this._desiredPos.set(
            this._targetPos.x + this.followOffset.x,
            this._targetPos.y + this.followOffset.y,
            this._targetPos.z + this.followOffset.z,
        );
        this.node.getWorldPosition(this._selfPos);

        const dx = this._desiredPos.x - this._selfPos.x;
        const dy = this._desiredPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isMoving = dist > 0.15;

        if (isMoving) {
            const invDist = 1 / dist;
            this._velocity.x = dx * invDist * GameConfig.heroFollowSpeed;
            this._velocity.y = dy * invDist * GameConfig.heroFollowSpeed;
        } else {
            this._velocity.set(0, 0);
        }
        this._rb.linearVelocity = this._velocity;
        this._updateLocomotionAnim(isMoving);

        if (this._findNearestEnemy()) {
            this.tryAttack();
        }
    }

    private _findNearestEnemy(): EnemyMinion | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        this.node.getWorldPosition(this._selfPos);
        let nearest: EnemyMinion | null = null;
        let nearestDist = this.attackRange;

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
        const prefab = this.heroVariant === 1 ? this.projectilePrefab01 : this.projectilePrefab02;
        if (!prefab) {
            return;
        }

        const projectile = instantiate(prefab);
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
        if (this.visualNode) {
            playAnim(this.visualNode, 'die');
        }
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
