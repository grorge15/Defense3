import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Color,
    Component,
    Contact2DType,
    ERigidBody2DType,
    IPhysics2DContact,
    Label,
    Node,
    RigidBody2D,
    Size,
    Sprite,
    UITransform,
    Vec3,
} from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { CoinSystem } from '../game/CoinSystem';
import { CoinUI } from '../ui/CoinUI';

const { ccclass, property } = _decorator;

export type BuildPlotType =
    | 'wall'
    | 'towerBasic'
    | 'towerAdvanced'
    | 'barracks'
    | 'heroShrine'
    | 'expandArea';

@ccclass('BuildPlot')
export class BuildPlot extends Component {
    @property({ type: Node, tooltip: '背景 Sprite 节点' })
    backgroundSprite: Node | null = null;

    @property({ type: Node, tooltip: '金币图标节点' })
    coinIcon: Node | null = null;

    @property({ type: Label, tooltip: '费用 Label' })
    costLabel: Label | null = null;

    @property({ type: Node, tooltip: '建筑预览图标节点' })
    previewIcon: Node | null = null;

    @property({ type: Sprite, tooltip: '绿色 vertical 填充条' })
    fillBar: Sprite | null = null;

    @property({ tooltip: '玩家在区域内时每秒填充对应的金币量' })
    fillSpeedPerSecond = 20;

    @property({ tooltip: '墙地块对应刷怪侧别（left/right）；非墙留空' })
    spawnSide: '' | 'left' | 'right' = '';

    @property({ tooltip: '无可靠碰撞时的站立判定半宽（世界单位）' })
    standHalfWidth = 60;

    @property({ tooltip: '无可靠碰撞时的站立判定半高（世界单位）' })
    standHalfHeight = 60;

    /** 购买完成回调，供 P4/P2-006+ 生成实际建筑 */
    public onBuildComplete: ((type: BuildPlotType) => void) | null = null;

    private _buildType: BuildPlotType = 'wall';
    private _paidAmount = 0;
    private _isComplete = false;
    private _playerInside = false;
    private _coinGetter: (() => number) | null = null;
    private _fillSprite: Sprite | null = null;
    private _collider: Collider2D | null = null;
    private _rb: RigidBody2D | null = null;
    private readonly _selfPos = new Vec3();
    private readonly _playerPos = new Vec3();

    onLoad(): void {
        this._fillSprite = this.fillBar;
        if (this._fillSprite) {
            this._fillSprite.type = Sprite.Type.FILLED;
            this._fillSprite.fillType = Sprite.FillType.VERTICAL;
            this._fillSprite.fillRange = 0;
            this._fillSprite.color = new Color(80, 220, 80, 255);
        }

        this._rb = this.getComponent(RigidBody2D);
        if (!this._rb) {
            this._rb = this.addComponent(RigidBody2D);
        }
        this._rb.type = ERigidBody2DType.Kinematic;
        this._rb.gravityScale = 0;
        this._rb.allowSleep = false;
        this._rb.enabledContactListener = true;

        this._collider = this.getComponent(Collider2D);
        if (this._collider) {
            this._collider.sensor = true;
            if (this._collider instanceof BoxCollider2D) {
                const w = Math.abs(this._collider.size.width);
                const h = Math.abs(this._collider.size.height);
                // 旧 prefab 碰撞盒 2×2，相对百级像素世界几乎摸不到
                if (w < 8 || h < 8) {
                    const ui =
                        this.backgroundSprite?.getComponent(UITransform) ??
                        this.node.getComponent(UITransform);
                    const bw = ui ? Math.max(ui.contentSize.width, 80) : 100;
                    const bh = ui ? Math.max(ui.contentSize.height, 80) : 100;
                    this._collider.size = new Size(bw, bh);
                }
            }
        }
        this._refreshCostDisplay();
    }

    onEnable(): void {
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this.onTriggerEnter, this);
            this._collider.on(Contact2DType.END_CONTACT, this.onTriggerExit, this);
        }
    }

    onDisable(): void {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onTriggerEnter, this);
            this._collider.off(Contact2DType.END_CONTACT, this.onTriggerExit, this);
        }
        this._playerInside = false;
    }

    setBuildType(type: BuildPlotType): void {
        this._buildType = type;
        this._refreshCostDisplay();
    }

    getBuildCost(): number {
        switch (this._buildType) {
            case 'wall':
                return GameConfig.wallBuildCost;
            case 'towerBasic':
                return GameConfig.towerBasicBuildCost;
            case 'towerAdvanced':
                return GameConfig.towerAdvancedBuildCost;
            case 'barracks':
                return GameConfig.barracksBuildCost;
            case 'heroShrine':
                return GameConfig.heroShrineBuildCost;
            case 'expandArea':
                return GameConfig.expandAreaBuildCost;
            default:
                return GameConfig.wallBuildCost;
        }
    }

    setAvailableCoins(getter: () => number): void {
        this._coinGetter = getter;
    }

    update(dt: number): void {
        this._pollPlayerInside();

        if (this._isComplete || !this._playerInside) {
            return;
        }

        const totalCost = this.getBuildCost();
        if (this._paidAmount >= totalCost) {
            this._completeBuild();
            return;
        }

        const available = this._coinGetter?.() ?? Number.POSITIVE_INFINITY;
        if (available <= 0) {
            return;
        }

        const remaining = totalCost - this._paidAmount;
        const spend = Math.min(this.fillSpeedPerSecond * dt, remaining, available);
        if (spend <= 0) {
            return;
        }

        this._paidAmount += spend;
        // 直接扣余额 → CoinSystem emit (delta, balance) → CoinUI 渐变；再飞币视觉
        const cs = CoinSystem.instance;
        if (cs) {
            cs.addCoins(-spend);
        } else {
            // 无 CoinSystem 时仍走旧事件，供 BuildSystem 兜底（CoinUI 已忽略三参）
            EventManager.instance.emitEvent(
                GameEvents.COIN_CHANGED,
                -spend,
                this._paidAmount,
                totalCost,
            );
        }
        this.node.getWorldPosition(this._selfPos);
        const player = this.node.scene?.getComponentInChildren(Player) ?? null;
        const from = new Vec3();
        if (player) {
            player.node.getWorldPosition(from);
        } else {
            from.set(this._selfPos);
        }
        CoinUI.instance?.playDeliverFly(this._selfPos, from);
        this._updateFillBar();

        if (this._paidAmount >= totalCost) {
            this._completeBuild();
        }
    }

    /** 玩家 setPosition + 传感器时接触常丢：用 AABB/距离轮询站立 */
    private _pollPlayerInside(): void {
        if (this._isComplete || !this.node.activeInHierarchy) {
            this._playerInside = false;
            return;
        }
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const player = scene.getComponentInChildren(Player);
        if (!player || player.isDead) {
            this._playerInside = false;
            return;
        }
        this.node.getWorldPosition(this._selfPos);
        player.node.getWorldPosition(this._playerPos);

        if (this._collider instanceof BoxCollider2D) {
            const a = this._collider.worldAABB;
            const pw = 24;
            const ph = 24;
            const px = this._playerPos.x;
            const py = this._playerPos.y;
            this._playerInside = !(
                px + pw < a.xMin ||
                px - pw > a.xMax ||
                py + ph < a.yMin ||
                py - ph > a.yMax
            );
            return;
        }

        const dx = Math.abs(this._playerPos.x - this._selfPos.x);
        const dy = Math.abs(this._playerPos.y - this._selfPos.y);
        this._playerInside = dx <= this.standHalfWidth && dy <= this.standHalfHeight;
    }

    private onTriggerEnter(
        _selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void {
        void _selfCollider;
        void _contact;
        if (this._isPlayerCollider(otherCollider)) {
            this._playerInside = true;
        }
    }

    private onTriggerExit(
        _selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void {
        void _selfCollider;
        void _contact;
        if (this._isPlayerCollider(otherCollider)) {
            this._playerInside = false;
        }
    }

    private _isPlayerCollider(collider: Collider2D): boolean {
        return (
            collider.node.getComponent(Player) !== null ||
            collider.node.parent?.getComponent(Player) !== null
        );
    }

    private _refreshCostDisplay(): void {
        if (this.costLabel) {
            this.costLabel.string = String(this.getBuildCost());
        }
        this._updateFillBar();
    }

    private _updateFillBar(): void {
        if (!this._fillSprite) {
            return;
        }
        const totalCost = this.getBuildCost();
        this._fillSprite.fillRange = totalCost > 0 ? this._paidAmount / totalCost : 0;
    }

    private _completeBuild(): void {
        if (this._isComplete) {
            return;
        }
        this._isComplete = true;
        this._playerInside = false;
        // Plot_Wall_R / Plot_Tower_* 等父挂点；建成物应挂在此节点下
        const plotRoot = this.node.parent ?? this.node;
        const worldPosition = new Vec3();
        plotRoot.getWorldPosition(worldPosition);
        EventManager.instance.emitEvent(GameEvents.BUILD_COMPLETE, {
            buildType: this._buildType,
            spawnSide: this.spawnSide,
            worldPosition,
            plotRoot,
        });
        this.onBuildComplete?.(this._buildType);
        this.scheduleOnce(() => {
            if (this.node?.isValid) {
                this.node.destroy();
            }
        }, 0);
    }
}
