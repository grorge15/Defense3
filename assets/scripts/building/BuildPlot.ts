import {
    _decorator,
    Collider2D,
    Color,
    Component,
    Contact2DType,
    IPhysics2DContact,
    Label,
    Node,
    Sprite,
} from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';

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

    /** 购买完成回调，供 P4/P2-006+ 生成实际建筑 */
    public onBuildComplete: ((type: BuildPlotType) => void) | null = null;

    private _buildType: BuildPlotType = 'wall';
    private _paidAmount = 0;
    private _isComplete = false;
    private _playerInside = false;
    private _coinGetter: (() => number) | null = null;
    private _fillSprite: Sprite | null = null;

    onLoad(): void {
        this._fillSprite = this.fillBar;
        if (this._fillSprite) {
            this._fillSprite.type = Sprite.Type.FILLED;
            this._fillSprite.fillType = Sprite.FillType.VERTICAL;
            this._fillSprite.fillRange = 0;
            this._fillSprite.color = new Color(80, 220, 80, 255);
        }
        this._refreshCostDisplay();
    }

    onEnable(): void {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onTriggerEnter, this);
            collider.on(Contact2DType.END_CONTACT, this.onTriggerExit, this);
        }
    }

    onDisable(): void {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onTriggerEnter, this);
            collider.off(Contact2DType.END_CONTACT, this.onTriggerExit, this);
        }
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
        EventManager.instance.emitEvent(
            GameEvents.COIN_CHANGED,
            -spend,
            this._paidAmount,
            totalCost,
        );
        this._updateFillBar();

        if (this._paidAmount >= totalCost) {
            this._completeBuild();
        }
    }

    private onTriggerEnter(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void {
        if (this._isPlayerCollider(otherCollider)) {
            this._playerInside = true;
        }
    }

    private onTriggerExit(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        _contact: IPhysics2DContact | null,
    ): void {
        if (this._isPlayerCollider(otherCollider)) {
            this._playerInside = false;
        }
    }

    private _isPlayerCollider(collider: Collider2D): boolean {
        return collider.node.getComponent(Player) !== null;
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
        this.onBuildComplete?.(this._buildType);
        this.node.destroy();
    }
}
