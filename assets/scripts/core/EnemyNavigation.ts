import { BoxCollider2D, CircleCollider2D, director, Node, PolygonCollider2D, Quat, Scene, Vec2, Vec3 } from 'cc';
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
    FlowQueryResult,
    FlowRect,
} from './FlowField';
import { GameConfig } from './GameConfig';
import { GameEvents } from './GameEvents';
import { NavigationObstacle, NavigationObstacleKind } from './NavigationObstacle';

export type EnemyNavRole = 'minion' | 'boss';
export type BlockingObstacleRoute = { target: Node; point: FlowPoint };
/** Legacy source compatibility for callers which still name the Log-specific route. */
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
    activeFieldId: string;
    activeTarget: FlowPoint | null;
    pendingFieldId: string;
    pendingTarget: FlowPoint | null;
    lastSafeDirection: FlowPoint | null;
    lastSafeTarget: FlowPoint | null;
    replacementReadiness: 'idle' | 'pending' | 'unreachable';
    target: Node | null;
};

type ObstacleSnapshot = {
    version: number;
    rects: FlowRect[];
};

type NavigationCollider = BoxCollider2D | PolygonCollider2D;

const sceneServices = new WeakMap<Scene, EnemyNavigation>();
const _tmpA = new Vec3();
const _tmpB = new Vec3();

export class EnemyNavigation {
    // Cocos Box2D expresses linear velocity in meters/sec while this navigation map uses world pixels.
    private static readonly _physicsPixelsPerMeter = 32;

    static worldSpeedForPhysicsVelocity(physicsVelocity: number): number {
        return physicsVelocity * EnemyNavigation._physicsPixelsPerMeter;
    }

    static writePhysicsVelocity(worldVelocity: Readonly<Vec2>, out: Vec2): Vec2 {
        out.set(
            worldVelocity.x / EnemyNavigation._physicsPixelsPerMeter,
            worldVelocity.y / EnemyNavigation._physicsPixelsPerMeter,
        );
        return out;
    }

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

    static bodyForCircle(circle: CircleCollider2D): FlowBody | null {
        const node = circle.node;
        if (!circle.radius || !circle.offset || !node.worldScale || !node.worldRotation) return null;
        Quat.toEulerInYXZOrder(_tmpB, node.worldRotation);
        const angle = _tmpB.z * Math.PI / 180;
        const c = Math.cos(angle), s = Math.sin(angle);
        const sx = Math.abs(node.worldScale.x), sy = Math.abs(node.worldScale.y);
        const ox = circle.offset.x * sx, oy = circle.offset.y * sy;
        return { width: 2 * circle.radius * sx, height: 2 * circle.radius * sy,
            offsetX: c * ox - s * oy, offsetY: s * ox + c * oy };
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
    private readonly _unitState = new Map<Node, UnitRouteState>();
    private readonly _registeredUnits = new Set<Node>();
    private readonly _unitPositions = new Map<Node, FlowPoint>();
    private readonly _buckets = new Map<string, Node[]>();
    private readonly _peerPositions: FlowPoint[] = [];
    private readonly _velocity = new Vec2();
    private readonly _self = new Vec3();
    private readonly _target = new Vec3();
    private readonly _obstacles: ObstacleSnapshot = { version: 1, rects: [] };
    private readonly _planningObstacles: FlowRect[] = [];
    private readonly _tracked = new Set<NavigationCollider>();
    private readonly _watched = new Set<Node>();
    private readonly _geometryWatched = new Set<Node>();
    private readonly _rectByCollider = new Map<NavigationCollider, FlowRect>();
    private readonly _kindByCollider = new Map<NavigationCollider, NavigationObstacleKind | 'legacy'>();
    private _candidateRevision = -1;
    private _candidateSnapshot: Array<{ node: Node; rects: FlowRect[]; key: string }> = [];
    private readonly _selectedBlockerCache = new Map<string, BlockingObstacleRoute | null>();
    private readonly _fixedByCollider = new Map<NavigationCollider, Log>();
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
        invalidateRequests: 0, geometryCheckRequests: 0, effectiveCommits: 0, geometryChanges: 0, blockingScans: 0, surfaceScans: 0,
        selectedCacheHits: 0, selectedCacheMisses: 0, schedulerFrames: 0, schedulerWork: 0, schedulerLastWork: 0 };
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
    private readonly _planningArea: FlowArea = {
        bounds: {
            minX: GameConfig.enemyNavDefaultMinX,
            minY: GameConfig.enemyNavDefaultMinY,
            maxX: GameConfig.enemyNavDefaultMaxX,
            maxY: GameConfig.enemyNavDefaultMaxY,
        },
        obstacles: this._planningObstacles,
        obstacleVersion: this._obstacles.version,
    };
    private _boundsMin: Node | null = null;
    private _boundsMax: Node | null = null;
    private _walkablePolygonNodes: Node[] = [];
    private _lastPreparedFrame = -1;
    private _refreshScanCount = 0;
    private _bucketBuildCount = 0;
    private _largestAvoidanceRadius = GameConfig.enemyPeerSeparationRadius;

    private constructor(scene: Scene) {
        this._scene = scene;
        scene.on?.('node-destroyed', this.destroy, this);
        EventManager.instance.onEvent(GameEvents.ENEMY_NAVIGATION_INVALIDATED, this.invalidate, this);
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
        this._field.clear();
        this._unitState.clear();
        this._registeredUnits.clear();
        this._unitPositions.clear();
        this._buckets.clear();
        for (const node of this._watched) this._unwatch(node);
        this._watched.clear(); this._tracked.clear(); this._rectByCollider.clear(); this._kindByCollider.clear(); this._fixedByCollider.clear();
        this._candidateSnapshot = [];
        this._selectedBlockerCache.clear();
        this._contactLog = null;
        for (const node of this._geometryWatched) {
            node.off?.('transform-changed', this._markGeometryForCheck, this);
            node.off?.('active-in-hierarchy-changed', this._markGeometryForCheck, this);
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
        if (options.walkablePolygon) {
            this._walkablePolygonNodes = options.walkablePolygon.filter((n) => !!n?.isValid);
        }
        this._dirty = true;
        for (const node of [this._boundsMin, this._boundsMax, ...this._walkablePolygonNodes]) this._watchGeometry(node);
    }

    invalidate(): void {
        this.debugStats.invalidateRequests++;
        this._markGeometryForCheck();
    }

    /**
     * Physics synchronizes even static bodies by assigning their transform, which emits this
     * event every frame. A snapshot comparison below decides whether that event changed navigation.
     */
    private _markGeometryForCheck(): void {
        this.debugStats.geometryCheckRequests++;
        this._dirty = true;
    }

    releaseUnit(unit: Node | null): void {
        if (!unit) {
            return;
        }
        const state = this._unitState.get(unit);
        if (state?.activeFieldId) this._field.release(state.activeFieldId);
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

    // Retained only to deserialize older scene references. Unified navigation ignores it.
    setEntranceOpen(_id: number, _open: boolean): void {}
    // Retained only to deserialize older scene references. Collider snapshots handle walls.
    syncClosedEntranceFromPlot(_plotRoot: Node | null, _spawnSide?: string): void {}

    nextVelocity(request: EnemyMoveRequest, out: Vec2 = this._velocity): Vec2 {
        out.set(0, 0);
        const unit = request.unit;
        if (!unit?.isValid || !request.target?.isValid || !request.target.activeInHierarchy || request.speed <= 0 || request.dt <= 0) {
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
        if (!this._field.pointWalkable(self, request.body, this._area)) {
            this._releaseField(unit);
            this._recoveryVelocity(self, request.body, request.dt, request.speed, out);
            return out;
        }
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
                bytes: this._field.debugBytes, flowStats: this._field.debugStats, jobs: this._field.debugJobStats,
                queries: this._diagnosticQueries,
                approachMs: this._diagnosticQueryMs, lastGeometry: this._diagnosticChange }));
            this._diagnosticQueries = 0; this._diagnosticQueryMs = 0;
        }
        const state = this._routeState(unit, request.target);
        if (!routeTarget) return this._retainedVelocity(state, self, finalTarget, request, out);

        const stop = request.stopDistance ?? 0;
        const dx = routeTarget.point.x - self.x;
        const dy = routeTarget.point.y - self.y;
        if (routeTarget.final && stop > 0 && dx * dx + dy * dy <= stop * stop) {
            this._releaseField(unit);
            return out;
        }

        const direct = this._field.lineClear(self, routeTarget.point, request.body, this._planningArea);
        if (direct) {
            this._releaseField(unit);
            const directBlocker = this._firstPhysicalBlocker(self, routeTarget.point, request.body);
            if (directBlocker && this._isDestructibleNode(directBlocker.node)) {
                return out;
            }
            const directResult = this._field.direction(self, routeTarget.point, request.body, this._planningArea);
            if (directResult.blocked || directResult.reached) return out;
            return this._applyCandidateVelocity(state, self, finalTarget, request, directResult.x, directResult.y, out);
        }

        const wantedId = this._field.fieldIdFor(routeTarget.point, request.body, this._planningArea);
        let result: ReturnType<FlowField['settledDirection']> = null;
        let resultTarget: FlowPoint = { ...routeTarget.point };
        if (state.pendingFieldId) {
            const pending = this._field.settledDirection(self, state.pendingFieldId, request.body, this._planningArea);
            if (pending) {
                const completedId = state.pendingFieldId;
                const completedTarget = state.pendingTarget ?? routeTarget.point;
                state.pendingFieldId = '';
                state.pendingTarget = null;
                state.replacementReadiness = 'idle';
                if (completedId === wantedId || this._withinRetainedDrift(completedTarget, finalTarget)) {
                    result = pending;
                    resultTarget = completedTarget;
                    if (completedId !== wantedId) {
                        const replacement = this._field.fieldStateFor(routeTarget.point, request.body, this._planningArea);
                        if (replacement.readiness !== 'settled') {
                            state.pendingFieldId = replacement.fieldId;
                            state.pendingTarget = { ...routeTarget.point };
                            state.replacementReadiness = replacement.readiness;
                        }
                    }
                }
            }
        }
        if (!result && !state.pendingFieldId) {
            const replacement = this._field.fieldStateFor(routeTarget.point, request.body, this._planningArea);
            if (replacement.readiness === 'settled') {
                result = this._field.settledDirection(self, replacement.fieldId, request.body, this._planningArea);
            } else {
                state.pendingFieldId = replacement.fieldId;
                state.pendingTarget = { ...routeTarget.point };
                state.replacementReadiness = replacement.readiness;
            }
        }
        if (result?.blocked && routeTarget.final && !state.pendingFieldId && this._field.debugPendingJobs === 0) {
            const approach = this._reachableApproach(self, finalTarget, request.body, true, this._planningArea);
            if (approach) {
                if (this._field.lineClear(self, approach.point, request.body, this._planningArea)) {
                    result = this._field.direction(self, approach.point, request.body, this._planningArea);
                    resultTarget = { ...approach.point };
                } else {
                    const fallback = this._field.fieldStateFor(approach.point, request.body, this._planningArea);
                    if (fallback.readiness === 'settled') {
                        result = this._field.settledDirection(self, fallback.fieldId, request.body, this._planningArea);
                        resultTarget = { ...approach.point };
                    } else {
                        state.pendingFieldId = fallback.fieldId;
                        state.pendingTarget = { ...approach.point };
                        state.replacementReadiness = fallback.readiness;
                    }
                }
            }
        }
        if (result && !result.blocked && !result.reached) {
            this._setActiveField(state, result.fieldId, resultTarget);
            if (!state.pendingFieldId) state.replacementReadiness = 'idle';
        } else if (state.replacementReadiness === 'pending') {
            return this._retainedVelocity(state, self, finalTarget, request, out);
        }
        if (!result || result.blocked || result.reached) return out;
        const routeBlocker = this._firstPhysicalBlocker(self, result.waypoint, request.body);
        if (routeBlocker && this._isDestructibleNode(routeBlocker.node)) {
            return out;
        }
        return this._applyCandidateVelocity(state, self, finalTarget, request, result.x, result.y, out);
    }

    blockingObstacle(request: EnemyMoveRequest, range: number): BlockingObstacleRoute | null {
        this._prepareFrame();
        if (!request.target?.isValid || !request.target.activeInHierarchy || !this._hasGroundConfigured()) return null;
        const from = nodePoint(request.unit), target = nodePoint(request.target), body = request.body;
        if (!this._field.pointWalkable(from, body, this._area)) return null;
        const selected = this._field.direction(from, target, body, this._planningArea);
        if (selected.blocked || selected.reached) return null;
        const key = `selected-blocker:${request.role}:${range}:${request.target.uuid}:${selected.fieldId || 'direct'}:` +
            `${selected.waypoint.x},${selected.waypoint.y}:v${this._obstacles.version}`;
        const selectFirst = (): FlowQueryResult<BlockingObstacleRoute | null> => {
            this.debugStats.blockingScans++;
            const first = this._firstPhysicalBlocker(from, selected.waypoint, body);
            if (!first || first.node === request.target || !this._isDestructibleNode(first.node)) {
                return { readiness: 'settled' as const, value: null };
            }
            const surface = this._surface(from, first.rect, body, this._area, range);
            return surface.readiness === 'pending' ? surface : { readiness: 'settled' as const,
                value: surface.value ? { target: first.node, point: surface.value } : null };
        };
        if (!selected.fieldId) {
            const cell = this._field.worldToCell(from, this._area.bounds);
            const directKey = `${key}:${cell.x},${cell.y}`;
            const cached = this._selectedBlockerCache.get(directKey);
            if (cached !== undefined) { this.debugStats.selectedCacheHits++; return cached; }
            this.debugStats.selectedCacheMisses++;
            const direct = selectFirst();
            if (direct.readiness !== 'settled') return null;
            const limit = GameConfig.enemyFlowCacheEntries ?? 32;
            if (this._selectedBlockerCache.size >= limit) {
                const oldest = this._selectedBlockerCache.keys().next().value;
                if (oldest !== undefined) this._selectedBlockerCache.delete(oldest);
            }
            this._selectedBlockerCache.set(directKey, direct.value);
            return direct.value;
        }
        const query = this._field.sharedQueryState(from, body, this._area, key, selectFirst);
        return query.readiness === 'settled' ? query.value ?? null : null;
    }

    blockingLog(request: EnemyMoveRequest, range: number): BlockingLogRoute | null {
        const route = this.blockingObstacle(request, range);
        const log = route?.target.getComponent(Log) ?? null;
        return route && log ? { log, point: route.point } : null;
    }

    obstacleRoute(unit: Node, target: Node, body: FlowBody, range: number): BlockingObstacleRoute | null {
        this._prepareFrame();
        const rects = this._obstacleRects(target);
        if (!rects.length || !this._isDestructibleNode(target)) return null;
        const from = nodePoint(unit);
        const query = this._field.sharedQueryState(from, body, this._area, `surface:${range}:${target.uuid}`,
            () => {
                let pending = false;
                for (const rect of rects) {
                    const surface = this._surface(from, rect, body, this._area, range);
                    if (surface.readiness === 'pending') pending = true;
                    else if (surface.value) return surface;
                }
                return pending ? { readiness: 'pending' as const } : { readiness: 'settled' as const, value: null };
            });
        return query.readiness === 'settled' && query.value ? { target, point: query.value } : null;
    }

    canAttackObstacle(unit: Node, target: Node, body: FlowBody, range: number): boolean {
        this._prepareFrame();
        const targetRects = this._obstacleRects(target);
        return this._isDestructibleNode(target) && unit.isValid && unit.activeInHierarchy &&
            targetRects.some(rect => this._surfaceHit(nodePoint(unit), rect, body, this._area, range, targetRects));
    }

    isDestructibleObstacle(target: Node | null): boolean {
        return !!target?.isValid && this._isDestructibleNode(target);
    }

    nextObstacleVelocity(request: EnemyMoveRequest, route: BlockingObstacleRoute, out: Vec2 = this._velocity): Vec2 {
        out.set(0, 0); this._prepareFrame(); this._releaseField(request.unit);
        if (!this._obstacleRects(route.target).length || request.dt <= 0 || request.speed <= 0) return out;
        const from = nodePoint(request.unit);
        if (!this._field.pointWalkable(from, request.body, this._area)) {
            this._recoveryVelocity(from, request.body, request.dt, request.speed, out);
            return out;
        }
        const result = this._field.direction(from, route.point, request.body, this._area);
        if (result.blocked || result.reached) return out;
        const speed = Math.min(request.speed, Math.hypot(route.point.x - from.x, route.point.y - from.y) / request.dt);
        out.set(result.x * speed, result.y * speed);
        this._registeredUnits.add(request.unit); this._insertUnitIntoBuckets(request.unit);
        this._applyLocalAvoidance(request.unit, from, request.body, request.speed, out);
        this._constrainVelocity(from, request.body, request.dt, out);
        return out;
    }

    logRoute(unit: Node, log: Log, body: FlowBody, range: number): BlockingLogRoute | null {
        const route = this.obstacleRoute(unit, log.node, body, range);
        return route ? { log, point: route.point } : null;
    }

    canAttackLog(unit: Node, log: Log, body: FlowBody, range: number): boolean {
        return this.canAttackObstacle(unit, log.node, body, range);
    }

    nextLogVelocity(request: EnemyMoveRequest, route: BlockingLogRoute, out: Vec2 = this._velocity): Vec2 {
        return this.nextObstacleVelocity(request, { target: route.log.node, point: route.point }, out);
    }

    private _fixedLog(log: Log | null): boolean {
        return !!log && log.isValid !== false && log.node.isValid && log.node.activeInHierarchy &&
            log.getPhase() === 'fixed' && log.isAttackable();
    }

    private _obstacleKind(node: Node): NavigationObstacleKind | null {
        const marker = node.getComponent(NavigationObstacle);
        return marker ? marker.kind : null;
    }

    private _isDestructibleNode(node: Node): boolean {
        const marked = this._obstacleKind(node);
        if (marked !== null) return marked === NavigationObstacleKind.Destructible && this._isDamageableAlive(node);
        return this._isDamageableAlive(node);
    }

    private _hasSupportedDamageAdapter(node: Node): boolean {
        return !!node.getComponent(Log) || !!node.getComponent(Barrier) || !!node.getComponent(Building);
    }

    private _isDamageableAlive(node: Node): boolean {
        const log = node.getComponent(Log);
        if (log) return this._fixedLog(log);
        const barrier = node.getComponent(Barrier);
        if (barrier) return barrier.isAlive();
        const building = node.getComponent(Building);
        return !!building?.isAlive();
    }

    private _destructibleCandidates(): Array<{ node: Node; rects: FlowRect[]; key: string }> {
        if (this._candidateRevision === this._obstacles.version) return this._candidateSnapshot;
        const byNode = new Map<Node, FlowRect[]>();
        for (const [box, rect] of this._rectByCollider) {
            const node = box.node;
            if (!node || !this._isDestructibleNode(node)) continue;
            const rects = byNode.get(node) ?? [];
            rects.push(rect); byNode.set(node, rects);
        }
        this._candidateRevision = this._obstacles.version;
        this._candidateSnapshot = Array.from(byNode, ([node, rects]) => ({ node, rects,
            key: `${node.uuid}:${rects.map(rect => JSON.stringify(rect)).join(',')}` }));
        return this._candidateSnapshot;
    }

    private _obstacleRect(node: Node): FlowRect | null {
        return this._obstacleRects(node)[0] ?? null;
    }

    private _obstacleRects(node: Node): FlowRect[] {
        const rects: FlowRect[] = [];
        for (const [box, rect] of this._rectByCollider) if (box.node === node) rects.push(rect);
        return rects;
    }

    contactLog(): Log | null {
        this._prepareFrame();
        return this._contactLog;
    }

    private _logRect(log: Log): FlowRect | null {
        return this._fixedLog(log) ? this._obstacleRect(log.node) : null;
    }

    private _surfaceHit(
        from: FlowPoint,
        rect: FlowRect,
        body: FlowBody,
        area: FlowArea,
        range: number,
        ignoredRects: readonly FlowRect[] = [],
    ): boolean {
        const attackArea = ignoredRects.length
            ? { ...area, obstacles: area.obstacles.filter(obstacle => ignoredRects.indexOf(obstacle) < 0) }
            : area;
        if (!this._field.pointWalkable(from, body, attackArea)) return false;
        const cx = from.x+(body.offsetX ?? 0), cy = from.y+(body.offsetY ?? 0);
        const sx = Math.max(rect.xMin, Math.min(cx, rect.xMax)), sy = Math.max(rect.yMin, Math.min(cy, rect.yMax));
        const bx = Math.max(cx-body.width/2, Math.min(sx,cx+body.width/2));
        const by = Math.max(cy-body.height/2, Math.min(sy,cy+body.height/2));
        return Math.hypot(sx-bx,sy-by) <= range && this._field.lineClear({x:bx,y:by},{x:sx,y:sy},
            {width:0,height:0},attackArea);
    }

    private _surface(from: FlowPoint, rect: FlowRect, body: FlowBody, area: FlowArea, range: number,
        rootRange = false): FlowQueryResult<FlowPoint | null> {
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
        let pending = false;
        for (const point of candidates) {
            if (rootRange && Math.hypot(point.x-Math.max(rect.xMin,Math.min(point.x,rect.xMax)),
                point.y-Math.max(rect.yMin,Math.min(point.y,rect.yMax))) > range) continue;
            if (!this._surfaceHit(point, rect, body, area, range)) continue;
            const reachability = this._field.reachability(from, point, body, area);
            if (reachability === 'reachable') return { readiness: 'settled', value: point };
            pending ||= reachability === 'pending';
        }
        return pending ? { readiness: 'pending' } : { readiness: 'settled', value: null };
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
        if (!this._hasGroundConfigured()) return null;
        return this._approachTarget(self, finalTarget, request.body, this._planningArea);
    }

    private _approachTarget(self: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): RouteTarget | null {
        if (this._field.pointWalkable(target, body, area)) return { point: target, final: true };
        return this._reachableApproach(self, target, body, false, area);
    }

    private _reachableApproach(
        self: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        allowBlockedTargetApproach = false,
        area: FlowArea = this._area,
    ): RouteTarget | null {
        const point = this._field.nearestReachableWalkable(
            self,
            target,
            body,
            area,
            GameConfig.enemyFlowTargetSearchCells,
            allowBlockedTargetApproach,
        );
        // A disconnected target is not the actual arrival point. Continue toward the nearest
        // reachable collision boundary without treating a hard wall as demolishable.
        return point ? { point, final: false } : null;
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
        const ground = this._walkablePolygonNodes.filter(n => n.isValid);
        if (ground.length >= 3) {
            this._area.walkablePolygons = [ground.map((n) => nodePoint(n))];
        } else {
            this._area.walkablePolygons = undefined;
        }
        this._area.castlePolygon = undefined;
        this._area.portals = undefined;
        this._area.obstacleVersion = this._obstacles.version;
        this._area.obstacles = this._obstacles.rects;
    }

    private _refreshPlanningArea(): void {
        this._planningArea.bounds.minX = this._area.bounds.minX;
        this._planningArea.bounds.minY = this._area.bounds.minY;
        this._planningArea.bounds.maxX = this._area.bounds.maxX;
        this._planningArea.bounds.maxY = this._area.bounds.maxY;
        this._planningArea.walkablePolygons = this._area.walkablePolygons;
        this._planningObstacles.length = 0;
        for (const [collider, rect] of this._rectByCollider) {
            if (!this._isDestructibleNode(collider.node)) this._planningObstacles.push(rect);
        }
        this._planningArea.obstacleVersion = this._obstacles.version;
    }

    private _refreshObstacles(): void {
        if (!this._discovered) {
            this._discovered = true; this._refreshScanCount++; this.debugStats.fullSceneScan++;
            for (const box of this._scene.getComponentsInChildren(BoxCollider2D)) this._trackCandidate(box);
            for (const polygon of this._scene.getComponentsInChildren(PolygonCollider2D)) this._trackCandidate(polygon);
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
        for (const box of this._kindByCollider.keys()) {
            if (!this._tracked.has(box)) { this._kindByCollider.delete(box); changed = true; }
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
            const kind = this._obstacleKind(box.node) ?? 'legacy';
            if (this._kindByCollider.get(box) !== kind) {
                this._kindByCollider.set(box, kind);
                changed = true;
            }
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
            this._candidateRevision = -1;
            this._selectedBlockerCache.clear();
            this._area.obstacles = this._obstacles.rects; this._area.obstacleVersion = this._obstacles.version;
            this._refreshPlanningArea();
            this._field.invalidate();
            for (const state of this._unitState.values()) {
                state.activeFieldId = ''; state.activeTarget = null; state.pendingFieldId = '';
                state.pendingTarget = null;
                state.replacementReadiness = 'idle';
            }
        }
        this._dirty = false;
    }

    private _isBlockingCollider(box: NavigationCollider): boolean {
        const node = box.node;
        if (!node?.activeInHierarchy || box.enabled === false) {
            return false;
        }
        const marked = this._obstacleKind(node);
        if (marked !== null) {
            if (marked === NavigationObstacleKind.Ignore) return false;
            if (marked === NavigationObstacleKind.Hard) return true;
            // Unsupported "Destructible" markers are never made walkable. They stay
            // hard until an actual Log/Building/Barrier damage adapter is present.
            return !this._hasSupportedDamageAdapter(node) || this._isDamageableAlive(node);
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

    private _hasGroundConfigured(): boolean {
        return !!this._area.walkablePolygons?.some((poly) => poly.length >= 3);
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

    private _recoveryVelocity(self: FlowPoint, body: FlowBody, dt: number, speed: number, out: Vec2): boolean {
        if (dt <= 0 || speed <= 0) return false;
        const escape = this._field.nearestWalkable(self, body, this._area, 2);
        if (!escape) return false;
        const dx = escape.x - self.x, dy = escape.y - self.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0.001) return false;
        const recoverySpeed = Math.min(speed, distance / dt);
        out.set(dx * recoverySpeed / distance, dy * recoverySpeed / distance);
        return true;
    }

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
        const work = this._field.advanceJobs(GameConfig.enemyNavWorkUnitsPerFrame ?? 4096);
        this.debugStats.schedulerFrames++;
        this.debugStats.schedulerWork += work;
        this.debugStats.schedulerLastWork = work;
    }

    private _topologyValues(): number[] {
        const b = this._area.bounds;
        const values = [b.minX, b.minY, b.maxX, b.maxY];
        for (const poly of this._area.walkablePolygons ?? []) {
            values.push(poly.length); for (const p of poly) values.push(p.x, p.y);
        }
        return values;
    }

    private _watchTree = (node: Node): void => {
        if (!node || this._watched.has(node)) return;
        this._watched.add(node);
        node.on?.('child-added', this._watchTree, this);
        node.on?.('child-removed', this._removeTree, this);
        node.on?.('component-added', this._componentAdded, this);
        node.on?.('component-removed', this._componentRemoved, this);
        this._trackNodeCandidates(node);
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
            node.off?.('transform-changed', this._markGeometryForCheck, this);
            node.off?.('active-in-hierarchy-changed', this._markGeometryForCheck, this);
        }
        for (const box of node.getComponents?.(BoxCollider2D) ?? []) this._componentRemoved(box);
        for (const polygon of node.getComponents?.(PolygonCollider2D) ?? []) this._componentRemoved(polygon);
        for (const child of node.children ?? []) this._removeTree(child);
    };

    private _componentAdded = (component: unknown): void => {
        const node = (component as { node?: Node })?.node;
        if (node) this._trackNodeCandidates(node);
        this._dirty = true;
    };

    private _trackNodeCandidates(node: Node): void {
        for (const box of node.getComponents?.(BoxCollider2D) ?? []) this._trackCandidate(box);
        for (const polygon of node.getComponents?.(PolygonCollider2D) ?? []) this._trackCandidate(polygon);
    }

    private _trackCandidate(box: NavigationCollider): void {
        const n = box.node;
        if (!n || !(n.getComponent(NavigationObstacle) || n.name.startsWith('airWall') || n.getComponent(Wall) || n.getComponent(Tower) ||
            n.getComponent(Barracks) || n.getComponent(Barrier) || n.getComponent(Building) || n.getComponent(Log))) return;
        this._tracked.add(box); this._watchGeometry(n);
    }

    private _watchGeometry(node: Node | null): void {
        for (let n = node; n; n = n.parent) {
            if (this._geometryWatched.has(n)) continue;
            this._geometryWatched.add(n);
            n.on?.('transform-changed', this._markGeometryForCheck, this);
            n.on?.('active-in-hierarchy-changed', this._markGeometryForCheck, this);
        }
    }

    private _componentRemoved = (component: unknown): void => {
        if (component instanceof BoxCollider2D || component instanceof PolygonCollider2D) {
            // Keep the old snapshot until the next consumer can commit the removal atomically.
            this._tracked.delete(component);
        }
        this._dirty = true;
    };

    private _releaseField(unit: Node): void {
        const state = this._unitState.get(unit);
        if (!state) return;
        if (state.activeFieldId) this._field.release(state.activeFieldId);
        state.activeFieldId = ''; state.activeTarget = null; state.pendingFieldId = '';
        state.pendingTarget = null; state.lastSafeDirection = null; state.lastSafeTarget = null;
        state.replacementReadiness = 'idle';
    }

    private _routeState(unit: Node, target: Node): UnitRouteState {
        let state = this._unitState.get(unit);
        if (!state) {
            state = { activeFieldId: '', activeTarget: null, pendingFieldId: '', pendingTarget: null,
                lastSafeDirection: null, lastSafeTarget: null, replacementReadiness: 'idle', target };
            this._unitState.set(unit, state);
        } else if (state.target !== target) {
            this._releaseField(unit);
            state.target = target;
        }
        return state;
    }

    private _setActiveField(state: UnitRouteState, fieldId: string, target: FlowPoint): void {
        if (state.activeFieldId !== fieldId) {
            if (!this._field.retain(fieldId)) return;
            if (state.activeFieldId) this._field.release(state.activeFieldId);
            state.activeFieldId = fieldId;
        }
        state.activeTarget = { ...target };
    }

    private _retainedVelocity(
        state: UnitRouteState,
        self: FlowPoint,
        finalTarget: FlowPoint,
        request: EnemyMoveRequest,
        out: Vec2,
    ): Vec2 {
        if (state.replacementReadiness !== 'pending') return out;
        if (state.activeFieldId && state.activeTarget && this._withinRetainedDrift(state.activeTarget, finalTarget)) {
            const retained = this._field.settledDirection(self, state.activeFieldId, request.body, this._planningArea);
            if (retained && !retained.blocked && !retained.reached) {
                return this._applyCandidateVelocity(state, self, finalTarget, request, retained.x, retained.y, out);
            }
        }
        if (!state.lastSafeDirection || !state.lastSafeTarget || !this._withinRetainedDrift(state.lastSafeTarget, finalTarget)) {
            return out;
        }
        return this._applyCandidateVelocity(state, self, finalTarget, request,
            state.lastSafeDirection.x, state.lastSafeDirection.y, out);
    }

    private _withinRetainedDrift(previousTarget: FlowPoint, currentTarget: FlowPoint): boolean {
        return Math.hypot(currentTarget.x - previousTarget.x, currentTarget.y - previousTarget.y) <=
            this._field.cellSize * this._field.lookaheadCells;
    }

    private _applyCandidateVelocity(
        state: UnitRouteState,
        self: FlowPoint,
        finalTarget: FlowPoint,
        request: EnemyMoveRequest,
        directionX: number,
        directionY: number,
        out: Vec2,
    ): Vec2 {
        out.set(directionX * request.speed, directionY * request.speed);
        this._applyLocalAvoidance(request.unit, self, request.body, request.speed, out);
        this._constrainVelocity(self, request.body, request.dt, out);
        if (Math.hypot(out.x, out.y) > 0.001) {
            const length = Math.hypot(directionX, directionY);
            if (length > 0.001) {
                state.lastSafeDirection = { x: directionX / length, y: directionY / length };
                state.lastSafeTarget = { ...finalTarget };
            }
        }
        return out;
    }

    private _firstPhysicalBlocker(
        from: FlowPoint,
        to: FlowPoint,
        body: FlowBody,
    ): { node: Node; rect: FlowRect; entry: number } | null {
        let first: { node: Node; rect: FlowRect; entry: number } | null = null;
        for (const [collider, rect] of this._rectByCollider) {
            const entry = segmentRectEntry(from, to, rect, body);
            if (entry === null || (first && entry >= first.entry)) continue;
            first = { node: collider.node, rect, entry };
        }
        return first;
    }

    constrainFinalVelocity(unit: Node, body: FlowBody, dt: number, speed: number, out: Vec2): void {
        this._prepareFrame();
        if (dt <= 0 || !this._hasGroundConfigured()) { out.set(0, 0); return; }
        unit.getWorldPosition(this._self);
        if (!this._field.pointWalkable(this._self, body, this._area)) {
            this._recoveryVelocity(this._self, body, dt, speed, out);
            return;
        }
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

function segmentRectEntry(from: FlowPoint, to: FlowPoint, rect: FlowRect, body: FlowBody): number | null {
    const halfW = Math.max(0, body.width) * 0.5;
    const halfH = Math.max(0, body.height) * 0.5;
    const offsetX = body.offsetX ?? 0;
    const offsetY = body.offsetY ?? 0;
    const minX = rect.xMin - halfW - offsetX;
    const maxX = rect.xMax + halfW - offsetX;
    const minY = rect.yMin - halfH - offsetY;
    const maxY = rect.yMax + halfH - offsetY;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let enter = 0;
    let exit = 1;
    for (const [origin, delta, min, max] of [[from.x, dx, minX, maxX], [from.y, dy, minY, maxY]] as const) {
        if (Math.abs(delta) < 0.000001) {
            if (origin < min || origin > max) return null;
            continue;
        }
        const a = (min - origin) / delta;
        const b = (max - origin) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (enter > exit) return null;
    }
    return enter >= 0 && enter <= 1 ? enter : null;
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
