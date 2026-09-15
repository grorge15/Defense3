import {
    _decorator,
    Animation,
    BoxCollider2D,
    Component,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Size,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { AirWallAabb } from '../core/AirWallAabb';
import { playAnim } from '../core/AnimUtil';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyNavigation } from '../core/EnemyNavigation';
import { TweenUtil } from '../core/TweenUtil';
import { HpBarUI } from '../ui/HpBarUI';

const { ccclass, property } = _decorator;

export type LogPhase = 'rolling' | 'charging' | 'fixed' | 'failed';
export type LogCutSide = 'left' | 'right';

const LOG_SHADOW_NODE_NAME = '木杆投影';

@ccclass('Log')
export class Log extends Component {
    @property({ tooltip: 'Visual 子节点，挂有 Animation 组件' })
    visualNode: Node | null = null;

    @property({ tooltip: '单段长度对应的世界单位尺寸' })
    segmentSize = 1;

    @property({ type: Node, tooltip: '黄线节点；空则运行时按名查找 YellowLine' })
    yellowLine: Node | null = null;

    @property({ type: Node, tooltip: '蓝线节点；空则运行时按名查找 BlueLine' })
    blueLine: Node | null = null;

    private _rb: RigidBody2D | null = null;
    private _collider: BoxCollider2D | null = null;
    private _baseColliderWidth = 100;
    private _baseColliderHeight = 76;
    private readonly _baseColliderOffset = new Vec2();
    private readonly _baseVisualPosition = new Vec3();
    private _phase: LogPhase = 'rolling';
    private _currentLength = GameConfig.logInitialLength;
    private _isLocked = false;
    private _isFading = false;
    private _pushPlayer: Player | null = null;
    private readonly _selfPos = new Vec3();
    private readonly _playerPos = new Vec3();
    private readonly _desiredPos = new Vec3();
    private readonly _followOffset = new Vec3();
    private readonly _tmpLinePos = new Vec3();
    private readonly _followVel = new Vec2();
    private _airWalls: BoxCollider2D[] = [];
    private _hasFollowOffset = false;
    private _yellowTriggered = false;
    private _blueTriggered = false;
    private readonly _baseVisualScale = new Vec3(1, 1, 1);
    private _baseVisualContentWidth = 200;
    private _shadowNode: Node | null = null;
    private _shadowTransform: UITransform | null = null;
    private readonly _baseShadowPosition = new Vec3();
    private _rollingLeftEdge = -0.5;
    private _rollingRightEdge = 0.5;
    private _lastCutSide: LogCutSide | null = null;
    private _hp = GameConfig.logMaxHp;
    private _hpBarSpawned = false;
    private _rollAnimPlaying = false;

    onLoad(): void {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(BoxCollider2D);
        if (this._collider) {
            this._baseColliderOffset.set(this._collider.offset);
            // 必须在 _refreshLengthVisual 之前缓存；禁止用 segmentSize*length(=1) 覆盖成细条
            const w = Math.abs(this._collider.size.width);
            const h = Math.abs(this._collider.size.height);
            if (w > 0.01) {
                this._baseColliderWidth = w;
            }
            if (h > 0.01) {
                this._baseColliderHeight = h;
            }
            // 传感器：不与 Dynamic 玩家产生固体顶撞（挡路/电锯接触靠逻辑与 Trigger）
            this._collider.sensor = true;
        }
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual');
        }
        if (this.visualNode) {
            this._baseVisualScale.set(this.visualNode.scale);
            this._baseVisualPosition.set(this.visualNode.position);
            const visualUi = this.visualNode.getComponent(UITransform);
            if (visualUi && visualUi.contentSize.width > 0.01) {
                this._baseVisualContentWidth = visualUi.contentSize.width;
            }
        }
        this._resolveShadowNode();
        this._resetRollingGeometry();
        this._refreshLengthVisual();
    }

    start(): void {
        this._resolveParkourLines();
    }

    beginParkour(): void {
        this._phase = 'rolling';
        this._isLocked = false;
        this._isFading = false;
        this._yellowTriggered = false;
        this._blueTriggered = false;
        this._currentLength = GameConfig.logInitialLength;
        this._lastCutSide = null;
        this._resetRollingGeometry();
        this._refreshLengthVisual();
        this._stopRollAnim();
        if (this._pushPlayer) {
            this._captureFollowOffset();
        }
    }

    finishParkour(): void {
        this.unbindPlayer();
    }

    bindPlayer(player: Node | null): void {
        this._pushPlayer = player ? player.getComponent(Player) : null;
        this._pushPlayer?.bindLog(this);
        if (this._pushPlayer) {
            this._captureFollowOffset();
        } else {
            this._hasFollowOffset = false;
        }
    }

    unbindPlayer(): void {
        this._pushPlayer?.bindLog(null);
        this._pushPlayer = null;
        this._hasFollowOffset = false;
    }

    /**
     * 固定后作为可攻击障碍。
     * 跑酷中电锯砍短请用 canBeCutBySaw()。
     */
    isAttackable(): boolean {
        return this._isLocked && !this._isFading && this._hp > 0 && this.node.active;
    }

    /** 跑酷段可被电锯缩短 */
    canBeCutBySaw(): boolean {
        return (
            !this._isLocked &&
            !this._isFading &&
            this.node.active &&
            (this._phase === 'rolling' || this._phase === 'charging')
        );
    }

    /** Approximate logical length for debug/UI; geometry uses rolling edges. */
    getCurrentLength(): number {
        return this._currentLength;
    }

    getRollingWidth(): number {
        return this._rollingWidth();
    }

    meetsFixedWidthRequirement(): boolean {
        return this._rollingWidth() >= this._fixedMinRollingWidth();
    }

    getPhase(): LogPhase {
        return this._phase;
    }

    /** 供小怪 AABB 挡路 */
    getBoxCollider(): BoxCollider2D | null {
        return this._collider;
    }

    takeDamage(amount: number): void {
        if (!this.isAttackable() || amount <= 0) {
            return;
        }
        this._hp = Math.max(0, this._hp - amount);
        EventManager.instance.emitEvent(
            GameEvents.HP_CHANGED,
            this.node,
            this._hp,
            GameConfig.logMaxHp,
        );
        if (this._hp <= 0) {
            this._onDestroyedAsBarrier();
        }
    }

    extend(): void {
        const maxWidth = this._maxRollingWidth();
        const previousWidth = this._rollingWidth();
        if (previousWidth >= maxWidth - 0.01) {
            return;
        }
        const addedWidth = Math.min(this._extendWorldStep(), maxWidth - previousWidth);
        if (addedWidth <= 0.01) {
            return;
        }
        if (this._lastCutSide === 'left') {
            this._rollingLeftEdge -= addedWidth;
        } else if (this._lastCutSide === 'right') {
            this._rollingRightEdge += addedWidth;
        } else {
            this._rollingLeftEdge -= addedWidth * 0.5;
            this._rollingRightEdge += addedWidth * 0.5;
        }
        this._syncLengthFromWidth();
        this._refreshLengthVisual();
    }

    shrink(): void {
        const width = this._rollingWidth();
        const step = this._extendWorldStep();
        const cutX = this._rollingRightEdge - Math.min(step, Math.max(0, width - this._minRollingWidth()));
        this.cutAtLocalX(cutX, 'left');
    }

    /**
     * Cut at log-local X. `keep` is the side of the cut that remains.
     */
    cutAtLocalX(cutX: number, keep: LogCutSide): boolean {
        if (!this.canBeCutBySaw()) {
            return false;
        }
        const left = this._rollingLeftEdge;
        const right = this._rollingRightEdge;
        const width = right - left;
        const minW = this._minRollingWidth();
        if (width <= minW + 0.01) {
            return false;
        }
        const clamped = Math.min(right, Math.max(left, cutX));
        if (keep === 'left') {
            const nextRight = Math.max(left + minW, Math.min(right, clamped));
            if (nextRight >= right - 0.01) {
                return false;
            }
            this._rollingRightEdge = nextRight;
            this._lastCutSide = 'right';
        } else {
            const nextLeft = Math.min(right - minW, Math.max(left, clamped));
            if (nextLeft <= left + 0.01) {
                return false;
            }
            this._rollingLeftEdge = nextLeft;
            this._lastCutSide = 'left';
        }
        this._syncLengthFromWidth();
        this._refreshLengthVisual();
        return true;
    }

    /** @deprecated Prefer cutAtLocalX; shrinks one world step from the named side. */
    cutFromSide(side: LogCutSide): boolean {
        const width = this._rollingWidth();
        const step = this._extendWorldStep();
        const remove = Math.min(step, Math.max(0, width - this._minRollingWidth()));
        if (remove <= 0.01) {
            return false;
        }
        if (side === 'left') {
            return this.cutAtLocalX(this._rollingLeftEdge + remove, 'right');
        }
        return this.cutAtLocalX(this._rollingRightEdge - remove, 'left');
    }

    enterChargeZone(): void {
        if (this._phase === 'charging' || this._phase === 'fixed' || this._phase === 'failed') {
            return;
        }
        this._phase = 'charging';
        this._pushPlayer?.setParkourCharging(true);
    }

    tryLockAtFinish(canLock: boolean): void {
        if (this._phase === 'fixed' || this._phase === 'failed') {
            return;
        }
        this._pushPlayer?.setParkourCharging(false);
        const width = this._rollingWidth();
        const need = this._fixedMinRollingWidth();
        if (canLock) {
            this._phase = 'fixed';
            this._isLocked = true;
            this._resolveFixedPoint();
            this._stopRollAnim();
            this._enableAsSolidBarrier();
            this.unbindPlayer();
            this._spawnHpBar();
            console.info(
                `[Log] blue line LOCK OK width=${width.toFixed(1)} need>=${need.toFixed(1)}`,
            );
            EventManager.instance.emitEvent(GameEvents.BOSS_TARGET_REGISTER, {
                node: this.node,
                kind: 'log',
            });
            return;
        }
        this._phase = 'failed';
        this._isFading = true;
        this.unbindPlayer();
        this._stopRollAnim();
        this._freezeVisualRotation();
        console.warn(
            `[Log] blue line LOCK FAIL width=${width.toFixed(1)} need>=${need.toFixed(1)} -> fade out`,
        );
        EventManager.instance.emitEvent(GameEvents.LOG_FAILED, {
            length: this._currentLength,
            width,
            need,
        });
        this._fadeOut();
    }

    private _enableAsSolidBarrier(): void {
        this._freezeVisualRotation();
        if (this._rb) {
            this._rb.type = ERigidBody2DType.Static;
            this._rb.linearVelocity = new Vec2(0, 0);
            this._rb.angularVelocity = 0;
            this._rb.fixedRotation = true;
            this._rb.enabledContactListener = true;
        }
        this._applyFixedGeometry();
        if (this._collider) {
            this._collider.apply();
        }
        this._hp = GameConfig.logMaxHp;
    }

    private _spawnHpBar(): void {
        if (this._hpBarSpawned) {
            return;
        }
        this._hpBarSpawned = true;
        this.scheduleOnce(() => {
            const bar = this.node.getComponentInChildren(HpBarUI);
            if (bar) {
                bar.hideWhenFull = false;
                bar.bindTarget(this.node);
                bar.applyHp(this._hp, GameConfig.logMaxHp, true);
                EventManager.instance.emitEvent(
                    GameEvents.HP_CHANGED,
                    this.node,
                    this._hp,
                    GameConfig.logMaxHp,
                );
            }
        }, 0);
    }

    private _onDestroyedAsBarrier(): void {
        EnemyNavigation.get(this.node.scene)?.invalidate();
        this._isFading = true;
        if (this._collider) {
            this._collider.enabled = false;
        }
        this._fadeOut();
    }

    private _freezeVisualRotation(): void {
        if (this._rb) {
            this._rb.linearVelocity = new Vec2(0, 0);
            this._rb.angularVelocity = 0;
            this._rb.fixedRotation = true;
        }
        if (this.visualNode) {
            this.visualNode.setRotationFromEuler(25, 0, 0);
        }
    }

    update(dt: number): void {
        if (this._isLocked || this._isFading || dt <= 0 || !this._pushPlayer) {
            return;
        }
        if (this._phase !== 'rolling' && this._phase !== 'charging') {
            return;
        }
        this._keepVisualRotationFlat();
        this._pollParkourLines();
    }

    lateUpdate(): void {
        if (this._isLocked || this._isFading || !this._pushPlayer) {
            return;
        }
        if (this._phase !== 'rolling' && this._phase !== 'charging') {
            return;
        }

        this._syncRollAnimToPlayerMovement();
        this._pushPlayer.node.getWorldPosition(this._playerPos);
        if (!this._hasFollowOffset) {
            this._captureFollowOffset();
        }
        this._desiredPos.set(
            this._playerPos.x + this._followOffset.x,
            this._playerPos.y + this._followOffset.y,
            this._playerPos.z + this._followOffset.z,
        );

        const pv = this._pushPlayer.getVelocity();
        this._followVel.set(pv.x, pv.y);
        const size = AirWallAabb.bodySize(this.node, this._baseColliderWidth, this._baseColliderHeight);
        const walls = AirWallAabb.collectAirWalls(this.node.scene, this._airWalls);
        AirWallAabb.resolveWorldPos(
            this._desiredPos,
            size.w,
            size.h,
            walls,
            this._followVel,
        );
        this.node.setWorldPosition(this._desiredPos);

        if (this._rb) {
            this._rb.type = ERigidBody2DType.Kinematic;
            this._rb.gravityScale = 0;
            this._rb.fixedRotation = true;
            this._rb.allowSleep = false;
            this._rb.angularVelocity = 0;
            this._rb.linearVelocity = this._followVel;
        }
        if (this._collider) {
            this._collider.sensor = true;
        }
    }

    private _captureFollowOffset(): void {
        if (!this._pushPlayer) {
            this._hasFollowOffset = false;
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        this._pushPlayer.node.getWorldPosition(this._playerPos);
        Vec3.subtract(this._followOffset, this._selfPos, this._playerPos);
        this._hasFollowOffset = true;
    }

    private _resolveParkourLines(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        if (!this.yellowLine) {
            this.yellowLine = this._findNodeByName(scene, 'YellowLine');
        }
        if (!this.blueLine) {
            this.blueLine = this._findNodeByName(scene, 'BlueLine');
        }
    }

    private _resolveShadowNode(): void {
        this._shadowNode = this.node.getChildByName(LOG_SHADOW_NODE_NAME);
        this._shadowTransform = this._shadowNode?.getComponent(UITransform) ?? null;
        if (this._shadowNode) {
            this._baseShadowPosition.set(this._shadowNode.position);
        }
    }

    private _resolveFixedPoint(): void {
        const scene = this.node.scene;
        const gameRoot = scene ? this._findNodeByName(scene, 'GameRoot') : null;
        const world = gameRoot?.getChildByName('World') ?? null;
        const buildPlots = world?.getChildByName('BuildPlots') ?? null;
        const fixedPoint = buildPlots?.getChildByName('LogFixPoint') ?? null;
        if (!fixedPoint) {
            console.warn('[Log] fixed point not found: GameRoot/World/BuildPlots/LogFixPoint');
            return;
        }
        fixedPoint.getWorldPosition(this._desiredPos);
        this.node.setWorldPosition(this._desiredPos);
    }

    private _findNodeByName(root: Node, name: string): Node | null {
        if (root.name === name) {
            return root;
        }
        for (const child of root.children) {
            const found = this._findNodeByName(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private _pollParkourLines(): void {
        this._resolveParkourLines();
        this.node.getWorldPosition(this._selfPos);

        if (!this._yellowTriggered && this.yellowLine) {
            this.yellowLine.getWorldPosition(this._tmpLinePos);
            if (this._selfPos.y >= this._tmpLinePos.y) {
                this._yellowTriggered = true;
                this.enterChargeZone();
            }
        }
        if (!this._blueTriggered && this.blueLine) {
            this.blueLine.getWorldPosition(this._tmpLinePos);
            if (this._selfPos.y >= this._tmpLinePos.y) {
                this._blueTriggered = true;
                EventManager.instance.emitEvent(GameEvents.PARKOUR_FINISHED);
                this.tryLockAtFinish(this.meetsFixedWidthRequirement());
            }
        }
    }

    private _keepVisualRotationFlat(): void {
        if (this.visualNode) {
            this.visualNode.setRotationFromEuler(25, 0, 0);
        }
    }

    private _playRollAnim(): void {
        if (this.visualNode) {
            playAnim(this.visualNode, 'roll');
        }
    }

    private _syncRollAnimToPlayerMovement(): void {
        const isPlayerMoving = this._pushPlayer!.getVelocity().lengthSqr() > 0.001;
        if (isPlayerMoving === this._rollAnimPlaying) {
            return;
        }
        this._rollAnimPlaying = isPlayerMoving;
        if (isPlayerMoving) {
            this._playRollAnim();
        } else {
            this._stopRollAnim();
        }
    }

    private _stopRollAnim(): void {
        this._rollAnimPlaying = false;
        if (!this.visualNode) {
            return;
        }
        const anim = this.visualNode.getComponent(Animation);
        anim?.stop();
    }

    private _refreshLengthVisual(): void {
        if (this._phase === 'fixed') {
            this._applyFixedGeometry();
            this._collider?.apply();
            return;
        }

        const width = this._rollingWidth();
        const visualLengthScale = width / this._baseColliderWidth;
        const centerOffsetX = (this._rollingLeftEdge + this._rollingRightEdge) * 0.5;
        if (this.visualNode) {
            this.visualNode.setScale(
                this._baseVisualScale.x * visualLengthScale,
                this._baseVisualScale.y,
                this._baseVisualScale.z,
            );
            this.visualNode.setPosition(
                this._baseVisualPosition.x + centerOffsetX,
                this._baseVisualPosition.y,
                this._baseVisualPosition.z,
            );
        }
        if (this._collider) {
            this._collider.size = new Size(
                Math.max(0.01, width),
                this._baseColliderHeight,
            );
            this._collider.offset = new Vec2(
                this._baseColliderOffset.x + centerOffsetX,
                this._baseColliderOffset.y,
            );
            this._collider.apply();
        }
        this._syncShadowContentWidth(this._visualContentWidth(visualLengthScale), centerOffsetX);
    }

    private _applyFixedGeometry(): void {
        const fixedVisualScale = 2.0;
        if (this.visualNode) {
            this.visualNode.setScale(
                this._baseVisualScale.x * fixedVisualScale,
                this._baseVisualScale.y,
                this._baseVisualScale.z,
            );
            this.visualNode.setPosition(this._baseVisualPosition);
        }
        if (this._collider) {
            this._collider.size = new Size(
                GameConfig.logFixedColliderWidth,
                GameConfig.logFixedColliderHeight,
            );
            this._collider.offset = new Vec2(
                GameConfig.logFixedColliderOffsetX,
                GameConfig.logFixedColliderOffsetY,
            );
            this._collider.sensor = false;
        }
        this._syncShadowContentWidth(this._visualContentWidth(fixedVisualScale), 0);
    }

    /** Current log Visual content width (prefab contentSize × length scale). */
    private _visualContentWidth(visualLengthScale: number): number {
        return Math.max(0.01, this._baseVisualContentWidth * visualLengthScale);
    }

    /** 木杆投影 contentSize.width = log Visual content width − slack; do not touch shadow scale. */
    private _syncShadowContentWidth(logContentWidth: number, centerOffsetX: number): void {
        if (!this._shadowNode || !this._shadowTransform) {
            this._resolveShadowNode();
        }
        if (!this._shadowNode || !this._shadowTransform) {
            return;
        }
        const shadowWidth = Math.max(0.01, logContentWidth - GameConfig.logShadowWidthSlack);
        const size = this._shadowTransform.contentSize;
        this._shadowTransform.setContentSize(shadowWidth, size.height);
        this._shadowNode.setPosition(
            this._baseShadowPosition.x + centerOffsetX,
            this._baseShadowPosition.y,
            this._baseShadowPosition.z,
        );
    }

    private _resetRollingGeometry(): void {
        const width = this._rollingWidthForLength(this._currentLength);
        this._rollingLeftEdge = -width * 0.5;
        this._rollingRightEdge = width * 0.5;
    }

    private _rollingWidthForLength(length: number): number {
        const visualLengthScale = GameConfig.logVisualBaseScale
            + length * GameConfig.logVisualScalePerLength;
        return Math.max(0.01, this._baseColliderWidth * visualLengthScale);
    }

    private _rollingWidth(): number {
        return Math.max(0.01, this._rollingRightEdge - this._rollingLeftEdge);
    }

    private _minRollingWidth(): number {
        return this._rollingWidthForLength(GameConfig.logMinLength);
    }

    private _maxRollingWidth(): number {
        return this._rollingWidthForLength(GameConfig.logMaxLength);
    }

    private _fixedMinRollingWidth(): number {
        return Math.max(0.01, this._baseColliderWidth * GameConfig.logFixedMinWidthFactor);
    }

    private _extendWorldStep(): number {
        return Math.max(0.01, this._baseColliderWidth * GameConfig.logVisualScalePerLength);
    }

    private _syncLengthFromWidth(): void {
        const scale = this._rollingWidth() / this._baseColliderWidth;
        const approx = (scale - GameConfig.logVisualBaseScale) / GameConfig.logVisualScalePerLength;
        this._currentLength = Math.max(
            GameConfig.logMinLength,
            Math.min(GameConfig.logMaxLength, approx),
        );
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
