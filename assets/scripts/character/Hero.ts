import {
    _decorator,
    Collider2D,
    Component,
    ERigidBody2DType,
    instantiate,
    Node,
    Prefab,
    resources,
    RigidBody2D,
    Vec2,
    Vec3,
} from 'cc';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { playAnim, playAttackWithFrameHit } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { HitFlash } from '../core/HitFlash';
import { HeroProjectile } from '../projectile/HeroProjectile';
import { UIManager } from '../ui/UIManager';
import { Player } from './Player';

const { ccclass, property } = _decorator;

const HERO_PROJECTILE_PATHS = [
    'prefabs/projectile/pref_projectile_hero_01',
    'prefabs/projectile/pref_projectile_hero_02',
] as const;

/** 可受英雄远程伤害的敌人（小怪 / Boss） */
type HeroAttackTarget = {
    node: Node;
    takeDamage: (amount: number) => void;
};

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
    private _hpBarReady = false;
    private _currentLocomotionClip = '';
    private _pendingTarget: Node | null = null;
    private _loadingProjectile = false;
    private readonly _velocity = new Vec2();
    private readonly _selfPos = new Vec3();
    private readonly _playerPos = new Vec3();
    private readonly _targetPos = new Vec3();
    private readonly _desiredPos = new Vec3();

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Dynamic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        const col = this.getComponent(Collider2D);
        if (col) {
            col.sensor = false;
        }
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        this.setHeroVariant(this.heroVariant);
        if (this.attackRange < 40) {
            this.attackRange = GameConfig.heroAttackRange;
        }
        this._ensureProjectilePrefab();
    }

    start(): void {
        this._ensureFollowTarget();
        // defense3：英雄使用与玩家相同的 pref_ui_hp_bar_player
        this._ensureHpBar();
        if (!this._hpBarReady) {
            this.scheduleOnce(() => this._ensureHpBar(), 0);
        }
    }

    /** 生成 pref_ui_hp_bar_player 并推送初始满血（可被 BuildSystem 兜底再调） */
    ensureHpBar(): void {
        this._ensureHpBar();
    }

    private _ensureHpBar(): void {
        if (this._hpBarReady || this._isDead) {
            return;
        }
        const ui = UIManager.instance;
        if (!ui) {
            return;
        }
        const bar = ui.spawnHpBar('player', this.node, this.visualNode ?? this.node);
        if (!bar) {
            return;
        }
        this._hpBarReady = true;
        bar.hideWhenFull = false;
        bar.hideWhenDead = true;
        bar.applyHp(this._hp, GameConfig.heroMaxHp, true);
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.heroMaxHp,
        );
    }

    setHeroVariant(variant: 1 | 2): void {
        this.heroVariant = variant;
    }

    setFollowTarget(target: Node | null): void {
        this._followTarget = target;
    }

    tryAttack(): void {
        if (!this._canAct || this._isDead || this._attackTimer > 0 || this._isAttacking) {
            return;
        }

        const enemy = this._findNearestEnemy();
        if (!enemy) {
            return;
        }

        this._isAttacking = true;
        this._attackTimer = this.attackCooldown;
        this._pendingTarget = enemy.node;
        this._ensureProjectilePrefab();
        this._faceTowardX(enemy.node.worldPosition.x);
        // 攻击中停住：清速度，不跟随玩家
        this._velocity.set(0, 0);
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }

        const unlock = (): void => {
            this._isAttacking = false;
            this._currentLocomotionClip = '';
        };

        if (this.visualNode) {
            const fallback = this.heroVariant === 1 ? 0.35 : 0.45;
            playAttackWithFrameHit(
                this.visualNode,
                'attack',
                () => {
                    const t = this._pendingTarget;
                    this._pendingTarget = null;
                    if (t?.isValid) {
                        this._spawnProjectile(t);
                    }
                },
                fallback,
                unlock,
            );
            this.scheduleOnce(() => {
                if (this._isAttacking) {
                    unlock();
                }
            }, 1.0);
        } else {
            this._spawnProjectile(enemy.node);
            this._pendingTarget = null;
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
        HitFlash.flash(this.visualNode ?? this.node);
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

    update(dt: number): void {
        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (!this._canAct || this._isDead || dt <= 0) {
            return;
        }

        this._ensureFollowTarget();
        if (!this._followTarget || !this._followTarget.active) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            if (!this._isAttacking) {
                this._updateLocomotionAnim(false);
            }
            return;
        }

        // 攻击中：原地等待完整 attack 动画，不跟随玩家移动
        if (this._isAttacking) {
            this._velocity.set(0, 0);
            if (this._rb) {
                this._rb.linearVelocity = this._velocity;
            }
            return;
        }

        this._followTarget.getWorldPosition(this._playerPos);
        this.node.getWorldPosition(this._selfPos);

        // 默认跟随：保持相对玩家 followOffset / heroFollowDistance，到位 idle
        this._desiredPos.set(
            this._playerPos.x + this.followOffset.x,
            this._playerPos.y + this.followOffset.y,
            this._selfPos.z,
        );
        const leash = this._leashRadius();
        this._clampToLeash(this._desiredPos, this._playerPos, leash);

        const dx = this._desiredPos.x - this._selfPos.x;
        const dy = this._desiredPos.y - this._selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stopDist = Math.max(0.12, GameConfig.heroFollowDistance * 0.25);
        const isMoving = dist > stopDist;

        if (isMoving) {
            const invDist = 1 / dist;
            this._velocity.x = dx * invDist * GameConfig.heroFollowSpeed;
            this._velocity.y = dy * invDist * GameConfig.heroFollowSpeed;
        } else {
            this._velocity.set(0, 0);
        }
        if (this._rb) {
            this._rb.linearVelocity = this._velocity;
        }
        this._updateLocomotionAnim(isMoving);

        // 射程内原地远程出手（不追敌位移）
        const combat = this._findNearestEnemy();
        if (combat) {
            this._faceTowardX(combat.node.worldPosition.x);
            this.tryAttack();
        }
    }

    private _leashRadius(): number {
        const configured = GameConfig.heroFollowLeash;
        if (configured > 0) {
            return configured;
        }
        return Math.max(GameConfig.heroFollowDistance * 3, 4);
    }

    private _clampToLeash(pos: Vec3, playerPos: Vec3, leash: number): void {
        if (leash <= 0) {
            return;
        }
        const dx = pos.x - playerPos.x;
        const dy = pos.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= leash || dist < 0.001) {
            return;
        }
        const s = leash / dist;
        pos.x = playerPos.x + dx * s;
        pos.y = playerPos.y + dy * s;
    }

    private _faceTowardX(worldX: number): void {
        const face = this.visualNode ?? this.node;
        const s = face.scale;
        const sx = Math.sign(worldX - this._selfPos.x);
        if (sx === 0) {
            return;
        }
        face.setScale(Math.abs(s.x) * sx || sx, s.y, s.z);
    }

    private _ensureFollowTarget(): void {
        if (this._followTarget?.isValid && this._followTarget.activeInHierarchy) {
            return;
        }
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const player = scene.getComponentInChildren(Player);
        this._followTarget = player?.node ?? null;
    }

    private _findNearestEnemy(): HeroAttackTarget | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const range = this.attackRange < 40 ? GameConfig.heroAttackRange : this.attackRange;
        this.node.getWorldPosition(this._selfPos);
        let nearest: HeroAttackTarget | null = null;
        let nearestDist = range;

        for (const minion of scene.getComponentsInChildren(EnemyMinion)) {
            if (!minion.node.active || minion.isDead) {
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
        for (const boss of scene.getComponentsInChildren(EnemyBoss)) {
            if (!boss.node.active || boss.isDead) {
                continue;
            }
            boss.node.getWorldPosition(this._targetPos);
            const dx = this._targetPos.x - this._selfPos.x;
            const dy = this._targetPos.y - this._selfPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= nearestDist) {
                nearestDist = dist;
                nearest = boss;
            }
        }
        return nearest;
    }

    private _ensureProjectilePrefab(): void {
        const idx = this.heroVariant === 1 ? 0 : 1;
        const current = idx === 0 ? this.projectilePrefab01 : this.projectilePrefab02;
        if (current || this._loadingProjectile) {
            return;
        }
        this._loadingProjectile = true;
        const path = HERO_PROJECTILE_PATHS[idx];
        resources.load(path, Prefab, (err, prefab) => {
            this._loadingProjectile = false;
            if (err || !prefab) {
                console.warn(`[Hero] missing projectile prefab path=${path}`, err);
                return;
            }
            if (idx === 0) {
                if (!this.projectilePrefab01) {
                    this.projectilePrefab01 = prefab;
                }
            } else if (!this.projectilePrefab02) {
                this.projectilePrefab02 = prefab;
            }
        });
    }

    private _spawnProjectile(target: Node): void {
        const prefab =
            this.heroVariant === 1 ? this.projectilePrefab01 : this.projectilePrefab02;
        if (!prefab) {
            this._ensureProjectilePrefab();
            console.warn(
                `[Hero] projectile prefab null variant=${this.heroVariant} — will retry next attack`,
            );
            return;
        }

        const projectile = instantiate(prefab);
        const parent = this.node.parent ?? this.node.scene;
        if (!parent) {
            projectile.destroy();
            return;
        }
        projectile.setParent(parent);
        projectile.setWorldPosition(this.node.worldPosition);

        let bolt = projectile.getComponent(HeroProjectile);
        if (!bolt) {
            bolt = projectile.addComponent(HeroProjectile);
        }
        bolt.init(target, this.attackDamage, GameConfig.arrowSpeed);
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
