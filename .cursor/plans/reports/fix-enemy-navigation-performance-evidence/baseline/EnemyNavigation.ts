import { BoxCollider2D, director, Node, Scene, Vec2, Vec3 } from 'cc';
import { Barracks } from '../building/Barracks';
import { Barrier } from '../building/Barrier';
import { Building } from '../building/Building';
import { Tower } from '../building/Tower';
import { Wall } from '../building/Wall';
import { Log } from '../item/Log';
import { EventManager } from './EventManager';
import {
    FlowArea,
    FlowBody,
    FlowField,
    FlowPoint,
    FlowPortal,
    FlowRect,
} from './FlowField';
import { GameConfig } from './GameConfig';
import { GameEvents } from './GameEvents';

export type EnemyNavRole = 'minion' | 'boss';
export type EnemyRegion = 'outside' | 'transition' | 'inside';

export type EnemyEntranceConfig = {
    id: number;
    outside: Node | null;
    inside: Node | null;
    closePlot: Node | null;
    width: number;
    open: boolean;
};

export type EnemyMoveRequest = {
    unit: Node;
    target: Node | null;
    role: EnemyNavRole;
    speed: number;
    dt: number;
    body: FlowBody;
    stopDistance?: number;
    preferEntranceNearestTo?: Node | null;
};

type RouteTarget = {
    point: FlowPoint;
    final: boolean;
};

type UnitRouteState = {
    entranceId: number;
    phase: EnemyRegion;
    fieldId: string;
    enteringInside: boolean;
};

type ObstacleSnapshot = {
    version: number;
    rects: FlowRect[];
    signature: string;
};

const sceneServices = new WeakMap<Scene, EnemyNavigation>();
const _tmpA = new Vec3();
const _tmpB = new Vec3();

export class EnemyNavigation {
    static get(scene: Scene | null): EnemyNavigation | null {
        if (!scene) {
            return null;
        }
        let service = sceneServices.get(scene);
        if (!service) {
            service = new EnemyNavigation(scene);
            sceneServices.set(scene, service);
        }
        return service;
    }

    private readonly _scene: Scene;
    private readonly _field = new FlowField(
        GameConfig.enemyFlowCellSize,
        GameConfig.enemyFlowLookaheadCells,
    );
    private readonly _entrances = new Map<number, EnemyEntranceConfig>();
    private readonly _unitState = new Map<Node, UnitRouteState>();
    private readonly _registeredUnits = new Set<Node>();
    private readonly _unitPositions = new Map<Node, FlowPoint>();
    private readonly _buckets = new Map<string, Node[]>();
    private readonly _completedWallPlots = new WeakSet<Node>();
    private readonly _completedWallSides = new Set<string>();
    private readonly _peerPositions: FlowPoint[] = [];
    private readonly _velocity = new Vec2();
    private readonly _self = new Vec3();
    private readonly _target = new Vec3();
    private readonly _obstacles: ObstacleSnapshot = { version: 1, rects: [], signature: '' };
    private readonly _area: FlowArea = {
        bounds: {
            minX: GameConfig.enemyNavDefaultMinX,
            minY: GameConfig.enemyNavDefaultMinY,
            maxX: GameConfig.enemyNavDefaultMaxX,
            maxY: GameConfig.enemyNavDefaultMaxY,
        },
        obstacles: this._obstacles.rects,
        obstacleVersion: this._obstacles.version,
    };
    private _boundsMin: Node | null = null;
    private _boundsMax: Node | null = null;
    private _walkablePolygonNodes: Node[] = [];
    private _castlePolygonNodes: Node[] = [];
    private _lastPreparedFrame = -1;
    private _refreshScanCount = 0;
    private _bucketBuildCount = 0;
    private _largestAvoidanceRadius = GameConfig.enemyPeerSeparationRadius;

    private constructor(scene: Scene) {
        this._scene = scene;
        EventManager.instance.onEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED, this.invalidate, this);
        EventManager.instance.onEvent(GameEvents.ENEMY_ENTRANCE_STATE_CHANGED, this._onEntranceEvent, this);
    }

    get debugObstacleRefreshCount(): number {
        return this._refreshScanCount;
    }

    get debugBucketBuildCount(): number {
        return this._bucketBuildCount;
    }

    get debugFieldBuildCount(): number {
        return this._field.buildCount;
    }

    destroy(): void {
        EventManager.instance.offEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED, this.invalidate, this);
        EventManager.instance.offEvent(GameEvents.ENEMY_ENTRANCE_STATE_CHANGED, this._onEntranceEvent, this);
        this._field.clear();
        this._entrances.clear();
        this._unitState.clear();
        this._registeredUnits.clear();
        this._unitPositions.clear();
        this._buckets.clear();
        sceneServices.delete(this._scene);
    }

    configure(options: {
        boundsMin?: Node | null;
        boundsMax?: Node | null;
        castlePolygon?: Node[];
        walkablePolygon?: Node[];
        entrances?: EnemyEntranceConfig[];
    }): void {
        if (options.boundsMin !== undefined) {
            this._boundsMin = options.boundsMin;
        }
        if (options.boundsMax !== undefined) {
            this._boundsMax = options.boundsMax;
        }
        if (options.castlePolygon) {
            this._castlePolygonNodes = options.castlePolygon.filter((n) => !!n?.isValid);
        }
        if (options.walkablePolygon) {
            this._walkablePolygonNodes = options.walkablePolygon.filter((n) => !!n?.isValid);
        }
        if (options.entrances) {
            for (const entrance of options.entrances) {
                if (!entrance || !entrance.id) {
                    continue;
                }
                const old = this._entrances.get(entrance.id);
                const builtClosed =
                    entrance.id !== 2 &&
                    (this._plotHasCompletedWall(entrance.closePlot) ||
                        (entrance.id === 1 && this._completedWallSides.has('left')) ||
                        (entrance.id === 3 && this._completedWallSides.has('right')));
                this._entrances.set(entrance.id, {
                    id: entrance.id,
                    outside: entrance.outside,
                    inside: entrance.inside,
                    closePlot: entrance.closePlot,
                    width: Math.max(1, entrance.width || GameConfig.enemyEntranceWidth),
                    open: entrance.id === 2 ? true : (builtClosed ? false : (old?.open ?? entrance.open)),
                });
            }
        }
        this._refreshArea();
    }

    invalidate(): void {
        this._obstacles.version += 1;
        this._obstacles.signature = '';
        this._field.invalidate();
    }

    releaseUnit(unit: Node | null): void {
        if (!unit) {
            return;
        }
        const state = this._unitState.get(unit);
        if (state?.fieldId) {
            this._field.release(state.fieldId);
        }
        this._unitState.delete(unit);
        this._registeredUnits.delete(unit);
    }

    resetUnit(unit: Node | null): void {
        this.releaseUnit(unit);
    }

    setEntranceOpen(id: number, open: boolean): void {
        if (id === 2) {
            open = true;
        }
        let entrance = this._entrances.get(id);
        if (!entrance) {
            entrance = { id, outside: null, inside: null, closePlot: null, width: GameConfig.enemyEntranceWidth, open };
            this._entrances.set(id, entrance);
        }
        if (entrance.open === open) {
            return;
        }
        entrance.open = open;
        for (const [unit, state] of this._unitState) {
            if (state.entranceId === id && state.phase !== 'inside') {
                this.releaseUnit(unit);
            }
        }
        this.invalidate();
    }

    syncClosedEntranceFromPlot(plotRoot: Node | null, spawnSide?: string): void {
        if (!plotRoot && !spawnSide) {
            return;
        }
        if (plotRoot?.isValid) {
            this._completedWallPlots.add(plotRoot);
        }
        if (spawnSide === 'left' || spawnSide === 'right') {
            this._completedWallSides.add(spawnSide);
        }
        let matched = false;
        for (const entrance of this._entrances.values()) {
            if (plotRoot && entrance.closePlot === plotRoot) {
                this.setEntranceOpen(entrance.id, false);
                matched = true;
            }
        }
        if (!matched && (spawnSide === 'left' || spawnSide === 'right')) {
            this.setEntranceOpen(spawnSide === 'left' ? 1 : 3, false);
        }
    }

    nextVelocity(request: EnemyMoveRequest, out: Vec2 = this._velocity): Vec2 {
        out.set(0, 0);
        const unit = request.unit;
        if (!unit?.isValid || !request.target?.isValid || request.speed <= 0 || request.dt <= 0) {
            return out;
        }

        const wasRegistered = this._registeredUnits.has(unit);
        this._registeredUnits.add(unit);
        const oldLargest = this._largestAvoidanceRadius;
        this._largestAvoidanceRadius = Math.max(
            this._largestAvoidanceRadius,
            request.body.width,
            request.body.height,
            GameConfig.enemyPeerSeparationRadius,
        );
        if (this._largestAvoidanceRadius !== oldLargest) {
            this._lastPreparedFrame = -1;
        }
        this._prepareFrame();
        if (!wasRegistered) {
            this._insertUnitIntoBuckets(unit);
        }

        unit.getWorldPosition(this._self);
        request.target.getWorldPosition(this._target);
        const self = { x: this._self.x, y: this._self.y };
        const finalTarget = { x: this._target.x, y: this._target.y };
        const routeTarget = this._resolveRouteTarget(request, self, finalTarget);
        if (!routeTarget) {
            return out;
        }

        const stop = request.stopDistance ?? 0;
        const dx = routeTarget.point.x - self.x;
        const dy = routeTarget.point.y - self.y;
        if (routeTarget.final && stop > 0 && dx * dx + dy * dy <= stop * stop) {
            return out;
        }

        const result = this._field.direction(self, routeTarget.point, request.body, this._area, true);
        const state = this._unitState.get(unit);
        if (state) {
            if (state.fieldId && state.fieldId !== result.fieldId) {
                this._field.release(state.fieldId);
            }
            if (state.fieldId === result.fieldId) {
                this._field.release(result.fieldId);
            } else {
                state.fieldId = result.fieldId;
            }
        } else {
            this._field.release(result.fieldId);
        }
        if (result.blocked || result.reached) {
            return out;
        }

        out.set(result.x * request.speed, result.y * request.speed);
        this._applyLocalAvoidance(unit, self, request.body, request.speed, out);
        this._constrainVelocity(self, request.body, request.dt, out);
        return out;
    }

    chooseEntrance(
        from: FlowPoint,
        body: FlowBody,
        role: EnemyNavRole,
        preferTarget?: FlowPoint | null,
    ): EnemyEntranceConfig | null {
        this._prepareFrame();
        const candidates: EnemyEntranceConfig[] = [];
        for (const entrance of this._entrances.values()) {
            if (!this._entranceUsable(entrance, body)) {
                continue;
            }
            entrance.outside!.getWorldPosition(_tmpA);
            const outside = { x: _tmpA.x, y: _tmpA.y };
            const dir = this._field.direction(from, outside, body, this._area);
            this._field.release(dir.fieldId);
            if (!dir.blocked || this._field.lineClear(from, outside, body, this._area)) {
                candidates.push(entrance);
            }
        }
        if (candidates.length === 0) {
            return null;
        }
        if (role === 'boss' && preferTarget) {
            candidates.sort((a, b) => {
                a.inside!.getWorldPosition(_tmpA);
                b.inside!.getWorldPosition(_tmpB);
                return distSq(_tmpA, preferTarget) - distSq(_tmpB, preferTarget);
            });
            return candidates[0];
        }
        const idx = Math.floor(Math.random() * candidates.length);
        return candidates[idx] ?? candidates[0];
    }

    isInside(point: FlowPoint): boolean {
        return this._field.pointInPolygon(point, this._area.castlePolygon);
    }

    hasLineOfSight(from: Node | null, to: Node | null, body: FlowBody): boolean {
        if (!from?.isValid || !to?.isValid || !this._hasGroundConfigured()) {
            return false;
        }
        this._prepareFrame();
        from.getWorldPosition(_tmpA);
        to.getWorldPosition(_tmpB);
        return this._field.lineClear(
            { x: _tmpA.x, y: _tmpA.y },
            { x: _tmpB.x, y: _tmpB.y },
            body,
            this._area,
        );
    }

    private _resolveRouteTarget(
        request: EnemyMoveRequest,
        self: FlowPoint,
        finalTarget: FlowPoint,
    ): RouteTarget | null {
        const hasEntrances = this._hasConfiguredEntrance();
        if (
            !this._hasGroundConfigured() ||
            !hasEntrances ||
            !this._area.castlePolygon ||
            this._area.castlePolygon.length < 3
        ) {
            return null;
        }

        const targetInside = this.isInside(finalTarget);
        const selfInside = this.isInside(self);
        let state = this._unitState.get(request.unit);
        if (!state) {
            state = {
                entranceId: 0,
                phase: selfInside ? 'inside' : 'outside',
                fieldId: '',
                enteringInside: targetInside,
            };
            this._unitState.set(request.unit, state);
        }

        if (state.phase === 'inside' && selfInside === targetInside) {
            return this._approachTarget(self, finalTarget, request.body);
        }
        if (selfInside === targetInside && state.phase !== 'transition') {
            state.phase = selfInside ? 'inside' : 'outside';
            return this._approachTarget(self, finalTarget, request.body);
        }

        let entrance = this._entrances.get(state.entranceId) ?? null;
        if (!entrance || !this._entranceUsable(entrance, request.body)) {
            state.entranceId = 0;
            state.phase = selfInside ? 'inside' : 'outside';
            entrance = this.chooseEntrance(
                self,
                request.body,
                request.role,
                request.preferEntranceNearestTo ? nodePoint(request.preferEntranceNearestTo) : finalTarget,
            );
        }
        if (!entrance || !this._entranceUsable(entrance, request.body)) {
            return null;
        }
        state.entranceId = entrance.id;
        entrance.outside!.getWorldPosition(_tmpA);
        entrance.inside!.getWorldPosition(_tmpB);
        const outside = { x: _tmpA.x, y: _tmpA.y };
        const inside = { x: _tmpB.x, y: _tmpB.y };
        const enterFromOutside =
            state.phase === 'transition' ? state.enteringInside : !selfInside && targetInside;
        state.enteringInside = enterFromOutside;
        const first = enterFromOutside ? outside : inside;
        const second = enterFromOutside ? inside : outside;
        const reach = Math.max(GameConfig.pathWaypointReachDistance, request.body.width);
        const reachSq = reach * reach;

        if (state.phase !== 'transition' && distSqPoint(self, first) > reachSq) {
            state.phase = enterFromOutside ? 'outside' : 'inside';
            return { point: first, final: false };
        }
        state.phase = 'transition';
        if (distSqPoint(self, second) > reachSq) {
            return { point: second, final: false };
        }
        state.phase = targetInside ? 'inside' : 'outside';
        return this._approachTarget(self, finalTarget, request.body);
    }

    private _approachTarget(self: FlowPoint, target: FlowPoint, body: FlowBody): RouteTarget | null {
        const point = this._field.nearestReachableWalkable(
            self,
            target,
            body,
            this._area,
            GameConfig.enemyFlowTargetSearchCells,
        );
        return point ? { point, final: true } : null;
    }

    private _refreshArea(): void {
        if (this._boundsMin?.isValid && this._boundsMax?.isValid) {
            this._boundsMin.getWorldPosition(_tmpA);
            this._boundsMax.getWorldPosition(_tmpB);
            this._area.bounds.minX = Math.min(_tmpA.x, _tmpB.x);
            this._area.bounds.maxX = Math.max(_tmpA.x, _tmpB.x);
            this._area.bounds.minY = Math.min(_tmpA.y, _tmpB.y);
            this._area.bounds.maxY = Math.max(_tmpA.y, _tmpB.y);
        }
        if (this._castlePolygonNodes.length >= 3) {
            this._area.castlePolygon = this._castlePolygonNodes.map((n) => nodePoint(n));
        }
        if (this._walkablePolygonNodes.length >= 3) {
            this._area.walkablePolygons = [this._walkablePolygonNodes.map((n) => nodePoint(n))];
        } else {
            this._area.walkablePolygons = undefined;
        }
        this._area.portals = this._buildPortals();
        this._area.obstacleVersion = this._obstacles.version;
        this._area.obstacles = this._obstacles.rects;
    }

    private _refreshObstacles(): void {
        this._refreshScanCount += 1;
        const rects: FlowRect[] = [];
        for (const box of this._scene.getComponentsInChildren(BoxCollider2D)) {
            if (!this._isBlockingCollider(box)) {
                continue;
            }
            const aabb = box.worldAABB;
            rects.push({
                xMin: aabb.xMin,
                yMin: aabb.yMin,
                xMax: aabb.xMax,
                yMax: aabb.yMax,
            });
        }
        rects.sort((a, b) => a.xMin - b.xMin || a.yMin - b.yMin || a.xMax - b.xMax || a.yMax - b.yMax);
        const signature = rects
            .map((r) => `${round(r.xMin)},${round(r.yMin)},${round(r.xMax)},${round(r.yMax)}`)
            .join('|');
        if (signature === this._obstacles.signature) {
            return;
        }
        this._obstacles.signature = signature;
        this._obstacles.rects = rects;
        this._obstacles.version += 1;
        this._field.invalidate();
        this._area.obstacles = this._obstacles.rects;
        this._area.obstacleVersion = this._obstacles.version;
    }

    private _isBlockingCollider(box: BoxCollider2D): boolean {
        const node = box.node;
        if (!node?.activeInHierarchy) {
            return false;
        }
        if (node.name.startsWith('airWall')) {
            return true;
        }
        if (node.getComponent(Wall) || node.getComponent(Tower) || node.getComponent(Barracks)) {
            return true;
        }
        const barrier = node.getComponent(Barrier);
        if (barrier) {
            return barrier.isAlive();
        }
        const building = node.getComponent(Building);
        if (building) {
            return building.isAlive();
        }
        const log = node.getComponent(Log);
        return !!log?.isAttackable();
    }

    private _buildPortals(): FlowPortal[] {
        const portals: FlowPortal[] = [];
        for (const entrance of this._entrances.values()) {
            if (!entrance.outside?.isValid || !entrance.inside?.isValid) {
                continue;
            }
            entrance.outside.getWorldPosition(_tmpA);
            entrance.inside.getWorldPosition(_tmpB);
            portals.push({
                id: entrance.id,
                a: { x: _tmpA.x, y: _tmpA.y },
                b: { x: _tmpB.x, y: _tmpB.y },
                width: entrance.width,
                open: entrance.open,
            });
        }
        return portals;
    }

    private _entranceUsable(entrance: EnemyEntranceConfig, body: FlowBody): boolean {
        if (!entrance.open || entrance.width < Math.max(body.width, body.height)) {
            return false;
        }
        if (!entrance.outside?.isValid || !entrance.inside?.isValid) {
            return false;
        }
        entrance.outside.getWorldPosition(_tmpA);
        entrance.inside.getWorldPosition(_tmpB);
        return (
            this._field.pointWalkable({ x: _tmpA.x, y: _tmpA.y }, body, this._area) &&
            this._field.pointWalkable({ x: _tmpB.x, y: _tmpB.y }, body, this._area) &&
            this._field.lineClear({ x: _tmpA.x, y: _tmpA.y }, { x: _tmpB.x, y: _tmpB.y }, body, this._area)
        );
    }

    private _hasConfiguredEntrance(): boolean {
        for (const entrance of this._entrances.values()) {
            if (entrance.outside?.isValid && entrance.inside?.isValid) {
                return true;
            }
        }
        return false;
    }

    private _hasGroundConfigured(): boolean {
        return !!this._area.walkablePolygons?.some((poly) => poly.length >= 3);
    }

    private _plotHasCompletedWall(plotRoot: Node | null): boolean {
        return !!plotRoot?.isValid && this._completedWallPlots.has(plotRoot);
    }

    private _applyLocalAvoidance(
        unit: Node,
        self: FlowPoint,
        body: FlowBody,
        speed: number,
        out: Vec2,
    ): void {
        this._peerPositions.length = 0;
        const radius = Math.max(GameConfig.enemyPeerSeparationRadius, body.width, body.height);
        const bucketSize = Math.max(radius, this._largestAvoidanceRadius);
        const cx = Math.floor(self.x / bucketSize);
        const cy = Math.floor(self.y / bucketSize);
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const bucket = this._buckets.get(`${cx + ox},${cy + oy}`);
                if (!bucket) {
                    continue;
                }
                for (const peer of bucket) {
                    if (peer === unit) {
                        continue;
                    }
                    const pos = this._unitPositions.get(peer);
                    if (pos && distSqPoint(self, pos) <= radius * radius) {
                        this._peerPositions.push(pos);
                    }
                }
            }
        }
        const push = this._field.separate(self, this._peerPositions, radius, speed * GameConfig.enemyAvoidanceWeight);
        out.x += push.x;
        out.y += push.y;
        const mag = Math.sqrt(out.x * out.x + out.y * out.y);
        if (mag > speed && mag > 0.001) {
            out.x = (out.x / mag) * speed;
            out.y = (out.y / mag) * speed;
        }
    }

    private _constrainVelocity(self: FlowPoint, body: FlowBody, dt: number, out: Vec2): void {
        const desired = { x: self.x + out.x * dt, y: self.y + out.y * dt };
        const safe = this._field.sweep(self, desired, body, this._area);
        out.x = (safe.x - self.x) / dt;
        out.y = (safe.y - self.y) / dt;
    }

    private _onEntranceEvent = (...args: unknown[]): void => {
        const payload = (args[0] ?? null) as { id?: number; open?: boolean } | null;
        if (typeof payload?.id !== 'number' || typeof payload.open !== 'boolean') {
            return;
        }
        this.setEntranceOpen(payload.id, payload.open);
    };

    private _prepareFrame(): void {
        const frame = readFrame();
        if (frame === this._lastPreparedFrame) {
            return;
        }
        this._lastPreparedFrame = frame;
        this._refreshArea();
        this._refreshObstacles();
        this._rebuildBuckets();
        this._field.prune();
    }

    private _rebuildBuckets(): void {
        this._bucketBuildCount += 1;
        this._unitPositions.clear();
        this._buckets.clear();
        const cell = Math.max(1, this._largestAvoidanceRadius);
        const stale: Node[] = [];
        for (const unit of this._registeredUnits) {
            if (!unit?.isValid || !unit.activeInHierarchy) {
                stale.push(unit);
                continue;
            }
            unit.getWorldPosition(_tmpA);
            this._insertUnitIntoBuckets(unit);
        }
        for (const unit of stale) {
            this.releaseUnit(unit);
        }
    }

    private _insertUnitIntoBuckets(unit: Node): void {
        if (!unit?.isValid || !unit.activeInHierarchy) {
            return;
        }
        const old = this._unitPositions.get(unit);
        if (old) {
            const oldCell = Math.max(1, this._largestAvoidanceRadius);
            const oldKey = `${Math.floor(old.x / oldCell)},${Math.floor(old.y / oldCell)}`;
            const oldBucket = this._buckets.get(oldKey);
            if (oldBucket) {
                const idx = oldBucket.indexOf(unit);
                if (idx >= 0) {
                    oldBucket.splice(idx, 1);
                }
            }
        }
        const cell = Math.max(1, this._largestAvoidanceRadius);
        unit.getWorldPosition(_tmpA);
        const pos = { x: _tmpA.x, y: _tmpA.y };
        this._unitPositions.set(unit, pos);
        const key = `${Math.floor(pos.x / cell)},${Math.floor(pos.y / cell)}`;
        let bucket = this._buckets.get(key);
        if (!bucket) {
            bucket = [];
            this._buckets.set(key, bucket);
        }
        bucket.push(unit);
    }
}

function nodePoint(node: Node): FlowPoint {
    node.getWorldPosition(_tmpA);
    return { x: _tmpA.x, y: _tmpA.y };
}

function distSq(nodePos: Vec3, point: FlowPoint): number {
    const dx = nodePos.x - point.x;
    const dy = nodePos.y - point.y;
    return dx * dx + dy * dy;
}

function distSqPoint(a: FlowPoint, b: FlowPoint): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function round(value: number): number {
    return Math.round(value * 10) / 10;
}

function readFrame(): number {
    const d = director as unknown as { getTotalFrames?: () => number };
    if (typeof d.getTotalFrames === 'function') {
        return d.getTotalFrames();
    }
    return Math.floor(Date.now() / 16);
}
