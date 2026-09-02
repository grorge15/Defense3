import {
    _decorator,
    BoxCollider2D,
    Component,
    Node,
    RigidBody2D,
    Size,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

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
    }

    tryLockAtFinish(canLock: boolean): void {
        if (canLock) {
            this._phase = 'fixed';
            this._isLocked = true;
            this.unbindPlayer();
            if (this._rb) {
                this._rb.linearVelocity = new Vec2(0, 0);
            }
            EventManager.instance.emitEvent(GameEvents.LOG_FIXED);
            return;
        }
        this._phase = 'failed';
        this._isFading = true;
        this.unbindPlayer();
        this._fadeOut();
    }

    fixedUpdate(): void {
        if (!this._rb || this._isLocked || this._isFading) {
            return;
        }

        if (this._phase === 'rolling' && this._pushPlayer) {
            const velocity = this._pushPlayer.getVelocity();
            this._rb.linearVelocity = new Vec2(velocity.x, velocity.y);

            const playerNode = this._pushPlayer.node;
            this.node.getWorldPosition(this._selfPos);
            playerNode.getWorldPosition(this._playerPos);
            this._selfPos.x = this._playerPos.x;
            this.node.setWorldPosition(this._selfPos);
            return;
        }

        if (this._phase === 'charging' && this._pushPlayer) {
            const velocity = this._pushPlayer.getVelocity();
            this._rb.linearVelocity = new Vec2(velocity.x, velocity.y * 0.5);
            return;
        }
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

    private _fadeOut(): void {
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
        }
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.scheduleOnce(() => {
            opacity.opacity = 0;
            this.node.active = false;
        }, 0.5);
    }
}
