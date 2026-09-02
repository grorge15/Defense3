import {
    _decorator,
    Animation,
    BoxCollider2D,
    Component,
    Node,
    RigidBody2D,
    Size,
    UITransform,
    Vec2,
    Vec3,
    tween,
} from 'cc';
import { Player } from '../character/Player';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { TweenUtil } from '../core/TweenUtil';

const { ccclass, property } = _decorator;

export type LogPhase = 'rolling' | 'charging' | 'fixed' | 'failed';

@ccclass('Log')
export class Log extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '单段长度对应的世界单位尺寸' })
    segmentSize = 1;

    private _rb: RigidBody2D | null = null;
    private _collider: BoxCollider2D | null = null;
    private _visualTransform: UITransform | null = null;
    private _phase: LogPhase = 'rolling';
    private _currentLength = GameConfig.logMinLength;
    private _isLocked = false;
    private _isFading = false;
    private _pushPlayer: Player | null = null;
    private readonly _selfPos = new Vec3();
    private readonly _playerPos = new Vec3();
    private readonly _baseVisualScale = new Vec3(1, 1, 1);
    private readonly _visualEuler = new Vec3();
    private _chargePulsing = false;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(BoxCollider2D);
        if (this.visualNode) {
            this._visualTransform = this.visualNode.getComponent(UITransform);
            this._baseVisualScale.set(this.visualNode.scale);
        }
        this._refreshLengthVisual();
    }

    beginParkour(): void {
        this._phase = 'rolling';
        this._isLocked = false;
        this._isFading = false;
        this._currentLength = GameConfig.logMinLength;
        this._refreshLengthVisual();
        this._playRollAnim();
    }

    finishParkour(): void {
        this.unbindPlayer();
    }

    bindPlayer(player: Node | null): void {
        this._pushPlayer = player ? player.getComponent(Player) : null;
        this._pushPlayer?.bindLog(this);
    }

    unbindPlayer(): void {
        this._pushPlayer?.bindLog(null);
        this._pushPlayer = null;
    }

    isAttackable(): boolean {
        return !this._isLocked && !this._isFading && this.node.active;
    }

    getCurrentLength(): number {
        return this._currentLength;
    }

    takeDamage(amount: number): void {
        void amount;
    }

    extend(): void {
        if (this._currentLength >= GameConfig.logMaxLength) {
            return;
        }
        this._currentLength = Math.min(
            this._currentLength + GameConfig.logExtendAmount,
            GameConfig.logMaxLength,
        );
        this._refreshLengthVisual();
    }

    shrink(): void {
        if (this._currentLength <= GameConfig.logMinLength) {
            return;
        }
        this._currentLength = Math.max(
            this._currentLength - GameConfig.logShrinkAmount,
            GameConfig.logMinLength,
        );
        this._refreshLengthVisual();
    }

    enterChargeZone(): void {
        this._phase = 'charging';
        this._startChargePulse();
    }

    tryLockAtFinish(canLock: boolean): void {
        this._stopChargePulse();
        if (canLock) {
            this._phase = 'fixed';
            this._isLocked = true;
            this.unbindPlayer();
            if (this._rb) {
                this._rb.linearVelocity = new Vec2(0, 0);
            }
            this._stopRollAnim();
            EventManager.instance.emitEvent(GameEvents.LOG_FIXED);
            return;
        }
        this._phase = 'failed';
        this._isFading = true;
        this.unbindPlayer();
        this._stopRollAnim();
        this._fadeOut();
    }

    fixedUpdate(dt: number): void {
        if (!this._rb || this._isLocked || this._isFading) {
            return;
        }

        if (this._phase === 'rolling' && this._pushPlayer) {
            const velocity = this._pushPlayer.getVelocity();
            const playerNode = this._pushPlayer.node;
            this.node.getWorldPosition(this._selfPos);
            playerNode.getWorldPosition(this._playerPos);
            // 跟随玩家：X 对齐，Y 同速；用位移而非依赖 Dynamic 速度
            this._selfPos.x = this._playerPos.x;
            this._selfPos.y += velocity.y * dt;
            this.node.setWorldPosition(this._selfPos);
            if (this._rb) {
                this._rb.linearVelocity = new Vec2(velocity.x, velocity.y);
            }
            this._updateRollVisual(dt);
            return;
        }

        if (this._phase === 'charging' && this._pushPlayer) {
            const velocity = this._pushPlayer.getVelocity();
            this.node.getWorldPosition(this._selfPos);
            this._selfPos.y += velocity.y * 0.5 * dt;
            this.node.setWorldPosition(this._selfPos);
            if (this._rb) {
                this._rb.linearVelocity = new Vec2(velocity.x, velocity.y * 0.5);
            }
            this._updateRollVisual(dt);
            return;
        }
    }

    /** 按前进速度绕长度轴（X）旋转 Visual；角速度系数复用 logRollSpeed */
    private _updateRollVisual(dt: number): void {
        if (!this.visualNode || !this._rb || dt <= 0) {
            return;
        }
        const speed = this._rb.linearVelocity.length();
        if (speed < 0.001) {
            return;
        }
        const radius = Math.max(this.segmentSize * 0.5, 0.01);
        const deltaDeg =
            ((speed * GameConfig.logRollSpeed) / radius) * dt * (180 / Math.PI);
        this._visualEuler.set(this.visualNode.eulerAngles);
        this._visualEuler.x += deltaDeg;
        this.visualNode.setRotationFromEuler(this._visualEuler);
    }

    private _playRollAnim(): void {
        if (this.visualNode) {
            playAnim(this.visualNode, 'roll');
        }
    }

    private _stopRollAnim(): void {
        if (!this.visualNode) {
            return;
        }
        const anim = this.visualNode.getComponent(Animation);
        anim?.stop();
    }

    private _refreshLengthVisual(): void {
        const lengthScale = this._currentLength / GameConfig.logMinLength;
        if (this.visualNode) {
            this.visualNode.setScale(
                this._baseVisualScale.x * lengthScale,
                this._baseVisualScale.y,
                this._baseVisualScale.z,
            );
        }
        if (this._collider) {
            this._collider.size = new Size(
                this.segmentSize * this._currentLength,
                this._collider.size.height,
            );
        }
        if (this._visualTransform) {
            this._visualTransform.setContentSize(
                this.segmentSize * this._currentLength,
                this._visualTransform.contentSize.height,
            );
        }
    }

    private _startChargePulse(): void {
        if (!this.visualNode || this._chargePulsing) {
            return;
        }
        this._chargePulsing = true;
        const lengthScale = this._currentLength / GameConfig.logMinLength;
        const baseX = this._baseVisualScale.x * lengthScale;
        const baseY = this._baseVisualScale.y;
        const baseZ = this._baseVisualScale.z;
        const pulse = GameConfig.logChargePulseScale;
        const half = GameConfig.logChargePulseHalf;
        tween(this.visualNode)
            .repeatForever(
                tween()
                    .to(half, { scale: new Vec3(baseX * pulse, baseY * pulse, baseZ) })
                    .to(half, { scale: new Vec3(baseX, baseY, baseZ) }),
            )
            .start();
    }

    private _stopChargePulse(): void {
        if (!this.visualNode) {
            this._chargePulsing = false;
            return;
        }
        if (this._chargePulsing) {
            tween(this.visualNode).stop();
            this._chargePulsing = false;
        }
        this._refreshLengthVisual();
    }

    private _fadeOut(): void {
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        TweenUtil.fadeOutOpacity(this.node, GameConfig.logFadeOutDuration, () => {
            this.node.active = false;
        });
    }
}
