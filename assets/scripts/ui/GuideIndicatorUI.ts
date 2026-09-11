import { _decorator, Component, director, Director, instantiate, Node, Prefab, Vec3 } from 'cc';
import { BuildPlot } from '../building/BuildPlot';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/** Renders the current guidance target in the GameRoot world layer. */
@ccclass('GuideIndicatorUI')
export class GuideIndicatorUI extends Component {
    @property({ type: Node, tooltip: 'GameRoot 下预摆的首个 guideWire' })
    directionArrow: Node | null = null;

    @property({ type: Node, tooltip: 'GameRoot 下预摆的 bigArrow' })
    targetArrow: Node | null = null;

    @property({ type: Prefab, tooltip: '额外 guideWire 使用的 DirectionArrow prefab' })
    directionArrowPrefab: Prefab | null = null;

    private _player: Node | null = null;
    private _target: Node | null = null;
    private _visible = false;
    private _floatTime = 0;
    private readonly _extraDirectionArrows: Node[] = [];
    private readonly _playerWorld = new Vec3();
    private readonly _targetWorld = new Vec3();
    private readonly _arrowWorld = new Vec3();
    private readonly _targetVisualLocal = new Vec3();

    onLoad(): void {
        this._resolveRefs();
        director.on(Director.EVENT_BEFORE_DRAW, this._beforeDraw, this);
        this._setVisualActive(false);
    }

    onDestroy(): void {
        director.off(Director.EVENT_BEFORE_DRAW, this._beforeDraw, this);
        for (const arrow of this._extraDirectionArrows) {
            if (arrow.isValid) arrow.destroy();
        }
        this._extraDirectionArrows.length = 0;
    }

    present(player: Node | null, target: Node | null, visible: boolean): void {
        this._player = player;
        this._target = target;
        this._visible = visible;
    }

    update(deltaTime: number): void {
        if (director.isPaused() || !this._visible || !this._isNodeUsable(this._player) || !this._isNodeUsable(this._target)) {
            this._setVisualActive(false);
            return;
        }

        this._resolveRefs();
        if (!this.directionArrow || !this.targetArrow || !this.directionArrowPrefab) {
            this._setVisualActive(false);
            return;
        }

        this._floatTime += deltaTime;
        this._player.getWorldPosition(this._playerWorld);
        this._resolveVisualTarget(this._target).getWorldPosition(this._targetWorld);

        const dx = this._targetWorld.x - this._playerWorld.x;
        const dy = this._targetWorld.y - this._playerWorld.y;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length)) {
            this._setVisualActive(false);
            return;
        }

        this._presentDirectionArrows(dx, dy, length);
        this._presentTargetArrow();
    }

    private _beforeDraw = (): void => {
        // Hero selection pauses world updates while the renderer still draws a frame.
        if (director.isPaused()) this._setVisualActive(false);
    };

    private _presentDirectionArrows(dx: number, dy: number, length: number): void {
        const count = this._directionArrowCount(length);
        const arrows = this._ensureDirectionArrows(count);
        if (length <= GameConfig.guideFloatTolerance) {
            for (const arrow of arrows) arrow.active = false;
            return;
        }

        const nx = dx / length;
        const ny = dy / length;
        // Source artwork points left, so rotate the normal right-facing atan2 result by 180 degrees.
        const angle = Math.atan2(dy, dx) * 180 / Math.PI - 180;
        for (let index = 0; index < arrows.length; index += 1) {
            const distance = Math.min(length, GameConfig.guideDirectionOffset + index * GameConfig.guideDirectionArrowSpacing);
            this._arrowWorld.set(this._playerWorld.x + nx * distance, this._playerWorld.y + ny * distance, this._playerWorld.z);
            const arrow = arrows[index];
            arrow.setWorldPosition(this._arrowWorld);
            arrow.setWorldRotationFromEuler(0, 0, angle);
            arrow.active = true;
        }
    }

    private _presentTargetArrow(): void {
        if (!this.targetArrow) return;
        this.targetArrow.setWorldPosition(this._targetWorld);
        const visual = this.targetArrow.getChildByName('Visual') ?? this.targetArrow;
        const bob = Math.sin(this._floatTime * Math.PI * 2 / GameConfig.guideTargetFloatPeriod) * GameConfig.guideTargetFloatAmplitude;
        this._targetVisualLocal.set(0, GameConfig.guideTargetOffset + bob, 0);
        visual.setPosition(this._targetVisualLocal);
        this.targetArrow.active = true;
    }

    private _resolveRefs(): void {
        const gameRoot = this.node.parent;
        this.directionArrow ??= gameRoot?.getChildByName('DirectionArrow') ?? null;
        this.targetArrow ??= gameRoot?.getChildByName('TargetArrow') ?? null;
    }

    private _setVisualActive(active: boolean): void {
        if (this.directionArrow) this.directionArrow.active = active;
        for (const arrow of this._extraDirectionArrows) {
            if (arrow.isValid) arrow.active = active;
        }
        if (this.targetArrow) this.targetArrow.active = active;
    }

    private _resolveVisualTarget(target: Node): Node {
        // Plot_* controls unlock state; its BuildPlot child is the real buildable world location.
        return target.getComponent(BuildPlot)?.node ?? target.getComponentInChildren(BuildPlot)?.node ?? target;
    }

    private _directionArrowCount(length: number): number {
        if (length <= GameConfig.guideFloatTolerance) return 0;
        const afterFirst = Math.max(0, length - GameConfig.guideDirectionOffset);
        return Math.min(GameConfig.guideDirectionArrowMaxCount, 1 + Math.floor(afterFirst / GameConfig.guideDirectionArrowSpacing));
    }

    private _ensureDirectionArrows(count: number): Node[] {
        if (!this.directionArrow || !this.directionArrowPrefab) return [];
        const parent = this.node.parent;
        if (!parent) return [];
        while (this._extraDirectionArrows.length + 1 < count) {
            const arrow = instantiate(this.directionArrowPrefab);
            arrow.name = `DirectionArrowGuide${this._extraDirectionArrows.length + 2}`;
            parent.addChild(arrow);
            this._extraDirectionArrows.push(arrow);
        }
        const arrows = [this.directionArrow, ...this._extraDirectionArrows];
        for (let index = count; index < arrows.length; index += 1) arrows[index].active = false;
        return arrows.slice(0, count);
    }

    private _isNodeUsable(node: Node | null): node is Node {
        return !!node && node.isValid && node.activeInHierarchy;
    }
}
