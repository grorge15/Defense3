import { BoxCollider2D, director, Node, Quat, Scene, Vec2, Vec3 } from 'cc';
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
export type BlockingLogRoute = { log: Log; point: FlowPoint };

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
};

const sceneServices = new WeakMap<Scene, EnemyNavigation>();
const _tmpA = new Vec3();
const _tmpB = new Vec3();

export class EnemyNavigation {
    static bodyForCollider(box: BoxCollider2D): FlowBody | null {
        const node = box.node;
        if (!box.size || !box.offset || !node.worldScale || !node.worldRotation) return null;
        // Box2D fixture AABBs can contain the swept previous/current transforms. Use the actual box geometry.
        Quat.toEulerInYXZOrder(_tmpB, node.worldRotation);
        const angle = _tmpB.z * Math.PI / 180;
        const c = Math.cos(angle), s = Math.sin(angle);
        const sx = Math.abs(node.worldScale.x), sy = Math.abs(node.worldScale.y);
        const w = box.size.width * sx, h = box.size.height * sy;
        const ox = box.offset.x * sx, oy = box.offset.y * sy;
        return { width: Math.abs(c) * w + Math.abs(s) * h,
            height: Math.abs(s) * w + Math.abs(c) * h, offsetX: c * ox - s * oy, offsetY: s * ox + c * oy };
    }

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
        { entries: GameConfig.enemyFlowCacheEntries ?? 32, bytes: GameConfig.enemyFlowCacheBytes ?? 8388608,
            cells: GameConfig.enemyFlowMaxCells ?? 262144 },
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
    private readonly _obstacles: ObstacleSnapshot = { version: 1, rects: [] };
    private readonly _tracked = new Set<BoxCollider2D>();
    private readonly _watched = new Set<Node>();
    private readonly _geometryWatched = new Set<Node>();
    private readonly _rectByCollider = new Map<BoxCollider2D, FlowRect>();
    private readonly _fixedByCollider = new Map<BoxCollider2D, Log>();
    private _contactLog: Log | null = null;
    private _discovered = false;
    private _lastGeometryFrame = -1;
    private _diagnosticAt = 0;
    private _diagnosticQueryMs = 0;
    private _diagnosticQueries = 0;
    private _diagnosticChange = '';
    private _dirty = true;
    private _topology: number[] = [];
    readonly debugStats = { fullSceneScan: 0, trackedColliderChecks: 0, signatureBuild: 0,
        invalidateRequests: 0, effectiveCommits: 0, geometryChanges: 0, blockingScans: 0, surfaceScans: 0 };
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
        scene.on?.('node-destroyed', this.destroy, this);
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
        this._scene.off?.('node-destroyed', this.destroy, this);
        EventManager.instance.offEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED, this.invalidate, this);
        EventManager.instance.offEvent(GameEvents.ENEMY_ENTRANCE_STATE_CHANGED, this._onEntranceEvent, this);
        this._field.clear();
        this._entrances.clear();
        this._unitState.clear();
        this._registeredUnits.clear();
        this._unitPositions.clear();
        this._buckets.clear();
        for (const node of this._watched) this._unwatch(node);
        this._watched.clear(); this._tracked.clear(); this._rectByCollider.clear(); this._fixedByCollider.clear();
        this._contactLog = null;
        for (const node of this._geometryWatched) {
            node.off?.('transform-changed', this.invalidate, this);
            node.off?.('active-in-hierarchy-changed', this.invalidate, this);
        }
        this._geometryWatched.clear();
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
        this._dirty = true;
        for (const node of [this._boundsMin, this._boundsMax, ...this._castlePolygonNodes, ...this._walkablePolygonNodes]) this._watchGeometry(node);
        for (const e of this._entrances.values()) { this._watchGeometry(e.outside); this._watchGeometry(e.inside); }
    }

    invalidate(): void {
        this.debugStats.invalidateRequests++;
        this._dirty = true;
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
        const pos = this._unitPositions.get(unit);
        if (pos) {
            const cell = Math.max(1, this._largestAvoidanceRadius);
            const bucket = this._buckets.get(`${Math.floor(pos.x / cell)},${Math.floor(pos.y / cell)}`);
            const index = bucket?.indexOf(unit) ?? -1;
            if (index >= 0) bucket!.splice(index, 1);
        }
        this._unitPositions.delete(unit);
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
            if (unit) this._releaseField(unit);
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
        const diagnosticStart = GameConfig.enemyNavDiagnostics ? Date.now() : 0;
        const routeTarget = this._resolveRouteTarget(request, self, finalTarget);
        if (GameConfig.enemyNavDiagnostics) {
            this._diagnosticQueries++;
            this._diagnosticQueryMs += Date.now() - diagnosticStart;
        }
        if (GameConfig.enemyNavDiagnostics && Date.now() - this._diagnosticAt >= 1000) {
            this._diagnosticAt = Date.now();
            console.log('[EnemyNavPerf]', JSON.stringify({ frame: readFrame(), unit: unit.name, body: request.body,
                from: self, target: finalTarget, graphs: this._field.debugGraphBuildCount, fields: this._field.buildCount,
                version: this._area.obstacleVersion, stats: this.debugStats, entries: this._field.debugEntries,
                bytes: this._field.debugBytes, flowStats: this._field.debugStats, queries: this._diagnosticQueries,
                approachMs: this._diagnosticQueryMs, lastGeometry: this._diagnosticChange }));
            this._diagnosticQueries = 0; this._diagnosticQueryMs = 0;
        }
        if (!routeTarget) {
            this._releaseField(unit);
            return out;
        }

        const stop = request.stopDistance ?? 0;
        const dx = routeTarget.point.x - self.x;
        const dy = routeTarget.point.y - self.y;
        if (routeTarget.final && stop > 0 && dx * dx + dy * dy <= stop * stop) {
            this._releaseField(unit);
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

    blockingLog(request: EnemyMoveRequest, range: number): BlockingLogRoute | null {
        this._prepareFrame();
        if (!request.target?.isValid || !request.target.activeInHierarchy || !this._hasGroundConfigured() ||
            !this._hasConfiguredEntrance() || (this._area.castlePolygon?.length ?? 0) < 3) return null;
        const from = nodePoint(request.unit), target = nodePoint(request.target), body = request.body;
        if (!this._field.pointWalkable(from, body, this._area)) return null;
        const targetBox = request.target.getComponent(BoxCollider2D);
        const targetRect = targetBox ? this._rectByCollider.get(targetBox) : undefined;
        if (!targetRect && this._field.lineClear(from, target, body, this._area)) return null;
        const condition = `blocking:${request.role}:${range}:${target.x},${target.y}:${targetRect ? JSON.stringify(targetRect) : ''}`;
        return this._field.sharedQuery(from, body, this._area, condition, () => {
            const reachable = (area: FlowArea): boolean => targetRect
                ? !!this._surface(from, targetRect, body, area, range, true)
                : this._field.canReach(from, target, body, area);
            if (reachable(this._area)) return null;
            this.debugStats.blockingScans++;
            for (const [box, rect] of this._rectByCollider) {
                const log = box.node.getComponent(Log);
                if (!this._fixedLog(log)) continue;
                // Diagnostic view never enters direction(), avoidance or the final movement sweep.
                const diagnostic: FlowArea = { ...this._area, obstacles: this._area.obstacles.filter(r => r !== rect),
                    diagnosticOf: this._area, ignoredObstacle: rect };
                if (!reachable(diagnostic)) continue;
                const point = this._surface(from, rect, body, this._area, range);
                if (point) return { log: log!, point };
            }
            return null;
        });
    }

    logRoute(unit: Node, log: Log, body: FlowBody, range: number): BlockingLogRoute | null {
        this._prepareFrame();
        const rect = this._logRect(log);
        if (!rect) return null;
        const from = nodePoint(unit);
        const point = this._field.sharedQuery(from, body, this._area, `surface:${range}:${JSON.stringify(rect)}`,
            () => this._surface(from, rect, body, this._area, range));
        return point ? { log, point } : null;
    }

    canAttackLog(unit: Node, log: Log, body: FlowBody, range: number): boolean {
        this._prepareFrame();
        const rect = this._logRect(log);
        if (!rect || !unit.isValid || !unit.activeInHierarchy) return false;
        return this._surfaceHit(nodePoint(unit), rect, body, this._area, range);
    }

    nextLogVelocity(request: EnemyMoveRequest, route: BlockingLogRoute, out: Vec2 = this._velocity): Vec2 {
        out.set(0, 0); this._prepareFrame(); this._releaseField(request.unit);
        if (!this._logRect(route.log) || request.dt <= 0 || request.speed <= 0) return out;
        const from = nodePoint(request.unit);
        const result = this._field.direction(from, route.point, request.body, this._area);
        if (result.blocked || result.reached) return out;
        const speed = Math.min(request.speed, Math.hypot(route.point.x-from.x, route.point.y-from.y)/request.dt);
        out.set(result.x*speed, result.y*speed);
        this._registeredUnits.add(request.unit); this._insertUnitIntoBuckets(request.unit);
        this._applyLocalAvoidance(request.unit, from, request.body, request.speed, out);
        this._constrainVelocity(from, request.body, request.dt, out);
        return out;
    }

    private _fixedLog(log: Log | null): boolean {
        return !!log && log.isValid !== false && log.node.isValid && log.node.activeInHierarchy &&
            log.getPhase() === 'fixed' && log.isAttackable();
    }

    contactLog(): Log | null {
        this._prepareFrame();
        return this._contactLog;
    }

    private _logRect(log: Log): FlowRect | null {
        if (!this._hasGroundConfigured() || !this._hasConfiguredEntrance() ||
            (this._area.castlePolygon?.length ?? 0) < 3 || !this._fixedLog(log)) return null;
        const box = log.getBoxCollider();
        return box?.enabled ? this._rectByCollider.get(box) ?? null : null;
    }

    private _surfaceHit(from: FlowPoint, rect: FlowRect, body: FlowBody, area: FlowArea, range: number): boolean {
        if (!this._field.pointWalkable(from, body, area)) return false;
        const cx = from.x+(body.offsetX ?? 0), cy = from.y+(body.offsetY ?? 0);
        const sx = Math.max(rect.xMin, Math.min(cx, rect.xMax)), sy = Math.max(rect.yMin, Math.min(cy, rect.yMax));
        const bx = Math.max(cx-body.width/2, Math.min(sx,cx+body.width/2));
        const by = Math.max(cy-body.height/2, Math.min(sy,cy+body.height/2));
        return Math.hypot(sx-bx,sy-by) <= range && this._field.lineClear({x:bx,y:by},{x:sx,y:sy},
            {width:0,height:0},area);
    }

    private _surface(from: FlowPoint, rect: FlowRect, body: FlowBody, area: FlowArea, range: number, rootRange = false): FlowPoint | null {
        this.debugStats.surfaceScans++;
        const ox = body.offsetX ?? 0, oy = body.offsetY ?? 0;
        const candidates: FlowPoint[] = [];
        const step = Math.max(1,this._field.cellSize/2);
        const span = (min: number,max: number,add: (v:number)=>void): void => {
            add(min); add(max);
            for (let v=Math.ceil(min/step)*step;v<max;v+=step) add(v);
        };
        for (const gap of [0.05, Math.max(0.05,range/2), Math.max(0.05,range-0.05)]) {
            const left = rect.xMin-body.width/2-ox-gap, right = rect.xMax+body.width/2-ox+gap;
            const bottom = rect.yMin-body.height/2-oy-gap, top = rect.yMax+body.height/2-oy+gap;
            span(Math.max(rect.xMin-ox,area.bounds.minX),Math.min(rect.xMax-ox,area.bounds.maxX), x => {
                candidates.push({x,y:bottom},{x,y:top});
            });
            span(Math.max(rect.yMin-oy,area.bounds.minY),Math.min(rect.yMax-oy,area.bounds.maxY), y => {
                candidates.push({x:left,y},{x:right,y});
            });
        }
        // Stable ordering lets the selected surface be shared by an entire connected region.
        for (const point of candidates) {
            if (rootRange && Math.hypot(point.x-Math.max(rect.xMin,Math.min(point.x,rect.xMax)),
                point.y-Math.max(rect.yMin,Math.min(point.y,rect.yMax))) > range) continue;
            if (this._surfaceHit(point,rect,body,area,range) && this._field.canReach(from,point,body,area)) return point;
        }
        return null;
    }

    chooseEntrance(
        from: FlowPoint,
        body: FlowBody,
        role: EnemyNavRole,
        preferTarget?: FlowPoint | null,
    ): EnemyEntranceConfig | null {
        this._prepareFrame();
        if (!this._hasGroundConfigured()) return null;
        const candidates: EnemyEntranceConfig[] = [];
        for (const entrance of this._entrances.values()) {
            if (!this._entranceUsable(entrance, body)) {
                continue;
            }
            entrance.outside!.getWorldPosition(_tmpA);
            const outside = { x: _tmpA.x, y: _tmpA.y };
            const dir = this._field.direction(from, outside, body, this._area);
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
        if (!from?.isValid || !to?.isValid) {
            return false;
        }
        this._prepareFrame();
        if (!this._hasGroundConfigured()) return false;
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
        const castle = this._castlePolygonNodes.filter(n => n.isValid);
        const ground = this._walkablePolygonNodes.filter(n => n.isValid);
        this._area.castlePolygon = castle.length >= 3 ? castle.map(n => nodePoint(n)) : undefined;
        if (ground.length >= 3) {
            this._area.walkablePolygons = [ground.map((n) => nodePoint(n))];
        } else {
            this._area.walkablePolygons = undefined;
        }
        this._area.portals = this._buildPortals();
        this._area.obstacleVersion = this._obstacles.version;
        this._area.obstacles = this._obstacles.rects;
    }

    private _refreshObstacles(): void {
        if (!this._discovered) {
            this._discovered = true; this._refreshScanCount++; this.debugStats.fullSceneScan++;
            for (const box of this._scene.getComponentsInChildren(BoxCollider2D)) this._trackCandidate(box);
            this._watchTree(this._scene);
        }
        let changed = false;
        this._contactLog = null;
        for (const box of this._fixedByCollider.keys()) {
            if (!this._tracked.has(box)) { this._fixedByCollider.delete(box); changed = true; }
        }
        for (const box of this._rectByCollider.keys()) {
            if (!this._tracked.has(box)) { this._rectByCollider.delete(box); changed = true; this.debugStats.geometryChanges++; }
        }
        for (const box of this._tracked) {
            this.debugStats.trackedColliderChecks++;
            const log = box.node?.getComponent(Log) ?? null;
            if (!this._contactLog && log && log.isValid !== false && log.node.isValid && log.node.activeInHierarchy &&
                log.node.active && log.getPhase() !== 'failed') this._contactLog = log;
            const fixed = box.enabled !== false && this._fixedLog(log);
            if ((this._fixedByCollider.get(box) ?? null) !== (fixed ? log : null)) {
                if (fixed) this._fixedByCollider.set(box, log!); else this._fixedByCollider.delete(box);
                changed = true;
            }
            const old = this._rectByCollider.get(box);
            if (box.isValid === false || box.node?.isValid === false || !this._isBlockingCollider(box)) {
                if (old) { this._rectByCollider.delete(box); changed = true; this.debugStats.geometryChanges++; }
                if (box.isValid === false || box.node?.isValid === false) this._tracked.delete(box);
                continue;
            }
            const r = box.worldAABB;
            if (!old || old.xMin !== r.xMin || old.xMax !== r.xMax || old.yMin !== r.yMin || old.yMax !== r.yMax) {
                if (GameConfig.enemyNavDiagnostics) this._diagnosticChange = JSON.stringify({ name: box.node.name, before: old,
                    after: { xMin: r.xMin, xMax: r.xMax, yMin: r.yMin, yMax: r.yMax } });
                this._rectByCollider.set(box, { xMin: r.xMin, xMax: r.xMax, yMin: r.yMin, yMax: r.yMax });
                changed = true; this.debugStats.geometryChanges++;
            }
        }
        const topology = this._topologyValues();
        const topologyChanged = topology.length !== this._topology.length || topology.some((v, i) => v !== this._topology[i]);
        if (changed || topologyChanged) {
            this._topology = topology;
            this._obstacles.rects = Array.from(this._rectByCollider.values());
            this._obstacles.version++; this.debugStats.effectiveCommits++;
            this._area.obstacles = this._obstacles.rects; this._area.obstacleVersion = this._obstacles.version;
            this._field.invalidate();
            for (const state of this._unitState.values()) state.fieldId = '';
        }
        this._dirty = false;
    }

    private _isBlockingCollider(box: BoxCollider2D): boolean {
        const node = box.node;
        if (!node?.activeInHierarchy || box.enabled === false) {
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
        if (this._dirty || frame !== this._lastGeometryFrame) {
            this._refreshArea();
            this._refreshObstacles();
            this._lastGeometryFrame = frame;
        }
        if (frame === this._lastPreparedFrame) {
            return;
        }
        this._lastPreparedFrame = frame;
        this._rebuildBuckets();
        this._field.prune();
    }

    private _topologyValues(): number[] {
        const b = this._area.bounds;
        const values = [b.minX, b.minY, b.maxX, b.maxY];
        for (const poly of [this._area.castlePolygon ?? [], ...(this._area.walkablePolygons ?? [])]) {
            values.push(poly.length); for (const p of poly) values.push(p.x, p.y);
        }
        for (const p of this._area.portals ?? []) values.push(p.id, p.a.x, p.a.y, p.b.x, p.b.y, p.width, +p.open);
        return values;
    }

    private _watchTree = (node: Node): void => {
        if (!node || this._watched.has(node)) return;
        this._watched.add(node);
        node.on?.('child-added', this._watchTree, this);
        node.on?.('child-removed', this._removeTree, this);
        node.on?.('component-added', this._componentAdded, this);
        node.on?.('component-removed', this._componentRemoved, this);
        for (const box of node.getComponents?.(BoxCollider2D) ?? []) this._trackCandidate(box);
        for (const child of node.children ?? []) this._watchTree(child);
        this._dirty = true;
    };

    private _unwatch(node: Node): void {
        node.off?.('child-added', this._watchTree, this);
        node.off?.('child-removed', this._removeTree, this);
        node.off?.('component-added', this._componentAdded, this);
        node.off?.('component-removed', this._componentRemoved, this);
    }

    private _removeTree = (node: Node): void => {
        this._unwatch(node); this._watched.delete(node);
        if (this._geometryWatched.delete(node)) {
            node.off?.('transform-changed', this.invalidate, this);
            node.off?.('active-in-hierarchy-changed', this.invalidate, this);
        }
        for (const box of node.getComponents?.(BoxCollider2D) ?? []) this._componentRemoved(box);
        for (const child of node.children ?? []) this._removeTree(child);
    };

    private _componentAdded = (component: unknown): void => {
        const node = (component as { node?: Node })?.node;
        if (node) for (const box of node.getComponents?.(BoxCollider2D) ?? []) this._trackCandidate(box);
        this._dirty = true;
    };

    private _trackCandidate(box: BoxCollider2D): void {
        const n = box.node;
        if (!n || !(n.name.startsWith('airWall') || n.getComponent(Wall) || n.getComponent(Tower) ||
            n.getComponent(Barracks) || n.getComponent(Barrier) || n.getComponent(Building) || n.getComponent(Log))) return;
        this._tracked.add(box); this._watchGeometry(n);
    }

    private _watchGeometry(node: Node | null): void {
        for (let n = node; n; n = n.parent) {
            if (this._geometryWatched.has(n)) continue;
            this._geometryWatched.add(n);
            n.on?.('transform-changed', this.invalidate, this);
            n.on?.('active-in-hierarchy-changed', this.invalidate, this);
        }
    }

    private _componentRemoved = (component: unknown): void => {
        if (component instanceof BoxCollider2D) {
            // Keep the old snapshot until the next consumer can commit the removal atomically.
            this._tracked.delete(component);
        }
        this._dirty = true;
    };

    private _releaseField(unit: Node): void {
        const state = this._unitState.get(unit);
        if (state?.fieldId) { this._field.release(state.fieldId); state.fieldId = ''; }
    }

    constrainFinalVelocity(unit: Node, body: FlowBody, dt: number, speed: number, out: Vec2): void {
        this._prepareFrame();
        if (dt <= 0 || !this._hasGroundConfigured()) { out.set(0, 0); return; }
        unit.getWorldPosition(this._self);
        const magnitude = Math.hypot(out.x, out.y);
        if (magnitude > speed) { out.x *= speed / magnitude; out.y *= speed / magnitude; }
        this._constrainVelocity(this._self, body, dt, out);
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
