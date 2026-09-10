export type FlowPoint = {
    x: number;
    y: number;
};

export type FlowRect = {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
};

export type FlowBody = {
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
};

export type FlowBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

export type FlowPortal = {
    id: number;
    a: FlowPoint;
    b: FlowPoint;
    width: number;
    open: boolean;
};

export type FlowArea = {
    bounds: FlowBounds;
    obstacles: FlowRect[];
    obstacleVersion: number;
    walkablePolygons?: FlowPoint[][];
    /** Deprecated compatibility data. Physical navigation ignores this boundary. */
    castlePolygon?: FlowPoint[];
    /** Deprecated compatibility data. Physical navigation ignores these portals. */
    portals?: FlowPortal[];
    diagnosticOf?: FlowArea;
    ignoredObstacle?: FlowRect;
};

export type FlowDirectionResult = {
    x: number;
    y: number;
    waypoint: FlowPoint;
    fieldId: string;
    reached: boolean;
    blocked: boolean;
};

export type FlowReachability = 'pending' | 'reachable' | 'unreachable';
export type FlowQueryResult<T> = { readiness: 'pending' } | { readiness: 'settled'; value: T };

type FlowCell = {
    x: number;
    y: number;
};

type Field = {
    id: string;
    targetCell: FlowCell;
    distances: Int32Array;
    width: number;
    height: number;
    stamp: number;
    refs: number;
};

type Connectivity = {
    id: string;
    width: number;
    height: number;
    labels: Int32Array;
    edges: Uint8Array;
    stamp: number;
};
type Approach = { id: string; point: FlowPoint | null; stamp: number };
type SharedQuery = { id: string; value: unknown; stamp: number };

type GraphJob = {
    kind: 'graph';
    id: string;
    body: FlowBody;
    area: FlowArea;
    width: number;
    height: number;
    labels: Int32Array;
    edges: Uint8Array;
    queue: Int32Array;
    phase: 'occupancy' | 'edges' | 'components';
    cursor: number;
    component: number;
    read: number;
    end: number;
    stamp: number;
    fastWalkableRegion: boolean;
};

type FieldJob = {
    kind: 'field';
    id: string;
    body: FlowBody;
    area: FlowArea;
    target: FlowPoint;
    targetCell: FlowCell;
    width: number;
    height: number;
    distances: Int32Array;
    walkable: Uint8Array;
    edges: Uint8Array;
    queue: Int32Array;
    phase: 'occupancy' | 'edges' | 'bfs';
    cursor: number;
    read: number;
    end: number;
    stamp: number;
    fastWalkableRegion: boolean;
};

type FlowJob = GraphJob | FieldJob;
export type FlowJobStats = {
    queued: number;
    completed: number;
    cancelled: number;
    coalesced: number;
    refused: number;
    slices: number;
    lastSliceWork: number;
    totalWork: number;
};

export type FlowBudget = { entries: number; bytes: number; cells: number };

// Outward rounding defines the geometry as well as the key; never reuse a smaller envelope.
export function stableFlowBody(body: FlowBody): FlowBody {
    const left = Math.floor(((body.offsetX ?? 0) - body.width / 2 - 0.000001) * 100) / 100;
    const right = Math.ceil(((body.offsetX ?? 0) + body.width / 2 + 0.000001) * 100) / 100;
    const bottom = Math.floor(((body.offsetY ?? 0) - body.height / 2 - 0.000001) * 100) / 100;
    const top = Math.ceil(((body.offsetY ?? 0) + body.height / 2 + 0.000001) * 100) / 100;
    return { width: right - left, height: top - bottom, offsetX: (left + right) / 2, offsetY: (bottom + top) / 2 };
}

const ORTHO = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

const DIAGONAL = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

export class FlowField {
    readonly cellSize: number;
    readonly lookaheadCells: number;
    private readonly _cache = new Map<string, Field>();
    private _stamp = 0;
    private _buildCount = 0;
    private readonly _graphs = new Map<string, Connectivity>();
    private readonly _approaches = new Map<string, Approach>();
    private readonly _queries = new Map<string, SharedQuery>();
    private readonly _jobs = new Map<string, FlowJob>();
    private readonly _jobOrder: string[] = [];
    private _jobCursor = 0;
    private _graphBuildCount = 0;
    readonly debugStats = { visitedCells: 0, candidates: 0, hits: 0, misses: 0, peakBytes: 0, peakEntries: 0,
        lineChecks: 0, pointChecks: 0, approachHits: 0 };
    readonly debugJobStats: FlowJobStats = { queued: 0, completed: 0, cancelled: 0, coalesced: 0, refused: 0,
        slices: 0, lastSliceWork: 0, totalWork: 0 };
    private readonly _budget: FlowBudget;

    constructor(cellSize: number, lookaheadCells: number, budget: FlowBudget = { entries: 32, bytes: 8 * 1024 * 1024, cells: 262144 }) {
        this.cellSize = Math.max(1, cellSize);
        this.lookaheadCells = Math.max(1, Math.floor(lookaheadCells));
        this._budget = budget;
    }

    get debugGraphBuildCount(): number { return this._graphBuildCount; }
    get debugBytes(): number {
        let bytes = 0;
        for (const f of this._cache.values()) bytes += f.distances.byteLength + f.id.length * 2 + 128;
        for (const g of this._graphs.values()) bytes += g.labels.byteLength + g.edges.byteLength + g.id.length * 2 + 128;
        for (const a of this._approaches.values()) bytes += a.id.length * 2 + 128;
        for (const q of this._queries.values()) bytes += q.id.length * 2 + 256;
        for (const job of this._jobs.values()) {
            bytes += job.id.length * 2 + 128 + job.queue.byteLength;
            bytes += job.kind === 'graph' ? job.labels.byteLength + job.edges.byteLength
                : job.distances.byteLength + job.walkable.byteLength + job.edges.byteLength;
        }
        return bytes;
    }
    get debugEntries(): number { return this._cache.size + this._graphs.size + this._approaches.size + this._queries.size + this._jobs.size; }
    get debugPendingJobs(): number { return this._jobs.size; }

    get buildCount(): number {
        return this._buildCount;
    }

    get debugCacheSize(): number {
        return this._cache.size;
    }

    debugRefCount(fieldId: string): number {
        return this._cache.get(fieldId)?.refs ?? 0;
    }

    clear(): void {
        this.debugJobStats.cancelled += this._jobs.size;
        this._cache.clear();
        this._graphs.clear();
        this._approaches.clear();
        this._queries.clear();
        this._jobs.clear();
        this._jobOrder.length = 0;
        this._jobCursor = 0;
    }

    invalidate(): void {
        this.clear();
    }

    release(fieldId: string): void {
        const field = this._cache.get(fieldId);
        if (!field) {
            return;
        }
        if (field.refs <= 0) {
            return;
        }
        field.refs = Math.max(0, field.refs - 1);
    }

    prune(maxAge = 600): void {
        const minStamp = this._stamp - Math.max(1, maxAge);
        for (const [key, field] of this._cache) {
            if (field.refs <= 0 && field.stamp < minStamp) {
                this._cache.delete(key);
            }
        }
    }

    direction(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        retain = false,
    ): FlowDirectionResult {
        this._stamp += 1;
        if (!this.pointWalkable(from, body, area)) return this._emptyResult('', from, true);
        if (!this.pointWalkable(target, body, area)) target = this.nearestWalkable(target, body, area) ?? target;
        if (this.lineClear(from, target, body, area)) {
            const fc = this.worldToCell(from, area.bounds);
            const tc = this.worldToCell(target, area.bounds);
            const distance = Math.hypot(target.x - from.x, target.y - from.y);
            return fc.x === tc.x && fc.y === tc.y && distance <= Math.max(1, this.cellSize * 0.25)
                ? this._emptyResult('', target, false, true) : this._dirTo('', from, target, false);
        }
        const field = this._fieldFor(target, body, area);
        if (!field) {
            return this._emptyResult('', from, true);
        }
        if (retain) {
            field.refs += 1;
        }
        field.stamp = this._stamp;

        const attachments = this._attachments(from, body, area);
        attachments.sort((a, b) => field.distances[this._index(a.x, a.y, field.width)] - field.distances[this._index(b.x, b.y, field.width)]);
        const fromCell = attachments.find(c => field.distances[this._index(c.x, c.y, field.width)] >= 0)
            ?? this.worldToCell(from, area.bounds);
        const fromIdx = this._index(fromCell.x, fromCell.y, field.width);
        if (
            !this._insideCell(fromCell, field.width, field.height) ||
            field.distances[fromIdx] < 0
        ) {
            return this._emptyResult(field.id, from, true);
        }

        const targetCell = this.worldToCell(target, area.bounds);
        const targetDistSq = (target.x - from.x) * (target.x - from.x) +
            (target.y - from.y) * (target.y - from.y);
        const reached =
            fromCell.x === targetCell.x &&
            fromCell.y === targetCell.y &&
            targetDistSq <= Math.max(1, this.cellSize * 0.25) * Math.max(1, this.cellSize * 0.25) &&
            this.lineClear(from, target, body, area);
        if (reached) {
            return this._emptyResult(field.id, target, false, true);
        }

        if (this.lineClear(from, target, body, area)) {
            return this._dirTo(field.id, from, target, false);
        }

        let best = this._bestDescendingCell(fromCell, field, area, body);
        if (!best) {
            return this._emptyResult(field.id, from, true);
        }

        for (let i = 1; i < this.lookaheadCells; i++) {
            const next = this._bestDescendingCell(best, field, area, body);
            if (!next) {
                break;
            }
            const point = this.cellToWorld(next, area.bounds);
            if (!this.lineClear(from, point, body, area)) {
                break;
            }
            best = next;
        }

        const waypoint = this.cellToWorld(best, area.bounds);
        if (!this.lineClear(from, waypoint, body, area)) {
            const access = this.cellToWorld(fromCell, area.bounds);
            return this.lineClear(from, access, body, area) ? this._dirTo(field.id, from, access, false)
                : this._emptyResult(field.id, from, true);
        }
        return this._dirTo(field.id, from, waypoint, false);
    }

    fieldIdFor(target: FlowPoint, body: FlowBody, area: FlowArea): string {
        const targetCell = this.worldToCell(target, area.bounds);
        const bodyKey = this._bodyKey(body);
        return `${bodyKey}:${this._areaKey(area)}:${targetCell.x},${targetCell.y}`;
    }

    worldToCell(point: FlowPoint, bounds: FlowBounds): FlowCell {
        return {
            x: Math.floor((point.x - bounds.minX) / this.cellSize),
            y: Math.floor((point.y - bounds.minY) / this.cellSize),
        };
    }

    cellToWorld(cell: FlowCell, bounds: FlowBounds): FlowPoint {
        return {
            x: bounds.minX + cell.x * this.cellSize + this.cellSize * 0.5,
            y: bounds.minY + cell.y * this.cellSize + this.cellSize * 0.5,
        };
    }

    lineClear(from: FlowPoint, to: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        this.debugStats.lineChecks++;
        const hw = Math.max(0, body.width) / 2, hh = Math.max(0, body.height) / 2;
        const ox = body.offsetX ?? 0, oy = body.offsetY ?? 0;
        for (const r of area.obstacles) {
            if (segmentEntersRect(from, to, { xMin: r.xMin - hw - ox, xMax: r.xMax + hw - ox,
                yMin: r.yMin - hh - oy, yMax: r.yMax + hh - oy })) return false;
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.5)));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = { x: from.x + dx * t, y: from.y + dy * t };
            if (!this.pointWalkable(p, body, area)) {
                return false;
            }
        }
        return true;
    }

    sweep(
        from: FlowPoint,
        desired: FlowPoint,
        body: FlowBody,
        area: FlowArea,
    ): FlowPoint {
        const dx = desired.x - from.x;
        const dy = desired.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            return { x: from.x, y: from.y };
        }
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.25)));
        let x = from.x;
        let y = from.y;
        for (let i = 1; i <= steps; i++) {
            const nx = from.x + (dx * i) / steps;
            const ny = from.y + (dy * i) / steps;
            if (
                this.lineClear({ x, y }, { x: nx, y: ny }, body, area)
            ) {
                x = nx;
                y = ny;
                continue;
            }
            const xOnly = { x: nx, y };
            const yOnly = { x, y: ny };
            if (this.lineClear({ x, y }, xOnly, body, area)) {
                x = nx;
            }
            if (this.lineClear({ x, y }, yOnly, body, area)) {
                y = ny;
            }
            break;
        }
        return { x, y };
    }

    pointWalkable(point: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        this.debugStats.pointChecks++;
        const halfW = Math.max(0, body.width) * 0.5;
        const halfH = Math.max(0, body.height) * 0.5;
        const centerX = point.x + (body.offsetX ?? 0);
        const centerY = point.y + (body.offsetY ?? 0);
        if (
            centerX - halfW < area.bounds.minX ||
            centerX + halfW > area.bounds.maxX ||
            centerY - halfH < area.bounds.minY ||
            centerY + halfH > area.bounds.maxY
        ) {
            return false;
        }
        if (area.walkablePolygons?.length) {
            const corners = [
                { x: centerX - halfW, y: centerY - halfH },
                { x: centerX + halfW, y: centerY - halfH },
                { x: centerX + halfW, y: centerY + halfH },
                { x: centerX - halfW, y: centerY + halfH },
            ];
            for (const corner of corners) {
                if (!area.walkablePolygons.some((poly) => this.pointInPolygon(corner, poly))) {
                    return false;
                }
            }
        }
        for (const obstacle of area.obstacles) {
            if (
                centerX + halfW > obstacle.xMin &&
                centerX - halfW < obstacle.xMax &&
                centerY + halfH > obstacle.yMin &&
                centerY - halfH < obstacle.yMax
            ) {
                return false;
            }
        }
        return true;
    }

    nearestWalkable(
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        maxRadiusCells = 8,
    ): FlowPoint | null {
        const center = this.worldToCell(target, area.bounds);
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        const probe = (cell: FlowCell, preferTarget = false): FlowPoint | null => {
            if (!this._insideCell(cell, width, height)) {
                return null;
            }
            const point = preferTarget ? target : this.cellToWorld(cell, area.bounds);
            return this.pointWalkable(point, body, area) ? point : null;
        };
        const own = probe(center, true);
        if (own) {
            return own;
        }
        for (let r = 1; r <= maxRadiusCells; r++) {
            for (let ox = -r; ox <= r; ox++) {
                for (let oy = -r; oy <= r; oy++) {
                    if (Math.abs(ox) !== r && Math.abs(oy) !== r) {
                        continue;
                    }
                    const found = probe({ x: center.x + ox, y: center.y + oy });
                    if (found) {
                        return found;
                    }
                }
            }
        }
        return null;
    }

    nearestReachableWalkable(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        maxRadiusCells = 8,
        allowBlockedTargetApproach = false,
    ): FlowPoint | null {
        if (!this.pointWalkable(from, body, area)) return null;
        if (this.lineClear(from, target, body, area)) return target;
        const starts = this._attachments(from, body, area);
        if (!starts.length) return null;
        const graph = this._graphFor(body, area);
        if (!graph) return null;
        const labels = new Set(starts.map(c => graph.labels[this._index(c.x, c.y, graph.width)]).filter(label => label >= 0));
        const key = `${graph.id}:${Array.from(labels).sort((a,b) => a-b).join(',')}:${target.x},${target.y}:` +
            `${maxRadiusCells}:${allowBlockedTargetApproach ? 'boundary' : 'surface'}`;
        const cached = this._approaches.get(key);
        if (cached) { cached.stamp = ++this._stamp; this.debugStats.approachHits++; return cached.point ? { ...cached.point } : null; }
        const remember = (point: FlowPoint | null): FlowPoint | null => {
            const bytes = key.length * 2 + 128;
            if (bytes <= this._budget.bytes) {
                this._makeRoom(bytes); this._approaches.set(key, { id: key, point, stamp: ++this._stamp }); this._recordPeak();
            }
            return point ? { ...point } : null;
        };
        const own = this.nearestWalkable(target, body, area, 0);
        if (own && this._attachments(own, body, area).some(c => labels.has(graph.labels[this._index(c.x, c.y, graph.width)]))) {
            return remember(own);
        }
        const center = this.worldToCell(target, area.bounds);
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        let best: FlowPoint | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let r = 1; r <= maxRadiusCells; r++) {
            for (let ox = -r; ox <= r; ox++) {
                for (let oy = -r; oy <= r; oy++) {
                    if (Math.abs(ox) !== r && Math.abs(oy) !== r) {
                        continue;
                    }
                    const cell = { x: center.x + ox, y: center.y + oy };
                    if (!this._insideCell(cell, width, height)) {
                        continue;
                    }
                    const point = this.cellToWorld(cell, area.bounds);
                    this.debugStats.candidates++;
                    if (
                        !labels.has(graph.labels[this._index(cell.x, cell.y, graph.width)]) ||
                        (!allowBlockedTargetApproach && !this._approachLineBlockedOnlyNearTarget(point, target, body, area))
                    ) {
                        continue;
                    }
                    const d = (point.x - target.x) * (point.x - target.x) +
                        (point.y - target.y) * (point.y - target.y);
                    if (d < bestDist) {
                        bestDist = d;
                        best = point;
                    }
                }
            }
            if (best) {
                return remember(best);
            }
        }
        return remember(null);
    }

    separate(
        self: FlowPoint,
        peers: FlowPoint[],
        radius: number,
        maxPush: number,
        seed = 0,
    ): FlowPoint {
        let x = 0;
        let y = 0;
        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];
            const dx = self.x - peer.x;
            const dy = self.y - peer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= radius * radius) {
                continue;
            }
            if (distSq < 0.0001) {
                const angle = ((i + 1 + seed) * 2.399963229728653) % (Math.PI * 2);
                x += Math.cos(angle) * maxPush;
                y += Math.sin(angle) * maxPush;
                continue;
            }
            const dist = Math.sqrt(distSq);
            const push = ((radius - dist) / radius) * maxPush;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
        }
        const mag = Math.sqrt(x * x + y * y);
        if (mag > maxPush && mag > 0.001) {
            x = (x / mag) * maxPush;
            y = (y / mag) * maxPush;
        }
        return { x, y };
    }

    pointInPolygon(point: FlowPoint, polygon: FlowPoint[] | undefined): boolean {
        if (!polygon || polygon.length < 3) {
            return false;
        }
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            const intersects =
                pi.y > point.y !== pj.y > point.y &&
                point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private _fieldFor(target: FlowPoint, body: FlowBody, area: FlowArea): Field | null {
        const id = this.fieldIdFor(target, body, area);
        const cached = this._cache.get(id);
        if (cached) {
            this.debugStats.hits++;
            return cached;
        }
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        const targetPoint = this.nearestWalkable(target, body, area) ?? target;
        const targetCell = this._attachments(targetPoint, body, area).sort((a, b) => {
            const p = this.cellToWorld(a, area.bounds), q = this.cellToWorld(b, area.bounds);
            return Math.hypot(p.x - targetPoint.x, p.y - targetPoint.y) - Math.hypot(q.x - targetPoint.x, q.y - targetPoint.y);
        })[0] ?? this.worldToCell(targetPoint, area.bounds);
        if (!this._insideCell(targetCell, width, height) ||
            !this.pointWalkable(this.cellToWorld(targetCell, area.bounds), body, area)) {
            return null;
        }
        this._enqueueField(id, targetPoint, targetCell, body, area, width, height);
        return null;
    }


    private _bestDescendingCell(
        from: FlowCell,
        field: Field,
        area: FlowArea,
        body: FlowBody,
    ): FlowCell | null {
        const curIdx = this._index(from.x, from.y, field.width);
        const curDist = field.distances[curIdx];
        if (curDist <= 0) {
            return null;
        }
        let best: FlowCell | null = null;
        let bestDist = curDist;
        const tryCell = (x: number, y: number): void => {
            if (!this._insideCell({ x, y }, field.width, field.height)) {
                return;
            }
            const d = field.distances[this._index(x, y, field.width)];
            if (d >= 0 && d < bestDist) {
                bestDist = d;
                best = { x, y };
            }
        };
        for (const [ox, oy] of ORTHO) {
            tryCell(from.x + ox, from.y + oy);
        }
        for (const [ox, oy] of DIAGONAL) {
            const nx = from.x + ox;
            const ny = from.y + oy;
            const sideA = { x: from.x + ox, y: from.y };
            const sideB = { x: from.x, y: from.y + oy };
            if (
                !this._cellWalkable(sideA, field, area, body) ||
                !this._cellWalkable(sideB, field, area, body)
            ) {
                continue;
            }
            tryCell(nx, ny);
        }
        return best;
    }

    private _cellWalkable(cell: FlowCell, field: Field, area: FlowArea, body: FlowBody): boolean {
        if (!this._insideCell(cell, field.width, field.height)) {
            return false;
        }
        return this.pointWalkable(this.cellToWorld(cell, area.bounds), body, area);
    }

    // Adjacent grid centers are already occupancy-checked. For one convex walkable region,
    // translating a body between two valid centers cannot leave that region, so only expanded
    // rectangle checks remain. Non-convex/multi-region geometry keeps
    // the existing half-cell midpoint validation used by lineClear for a 30-unit edge.
    private _gridEdgeClear(fromX: number, fromY: number, toX: number, toY: number, body: FlowBody, area: FlowArea,
        fastWalkableRegion: boolean): boolean {
        const hw = Math.max(0, body.width) / 2, hh = Math.max(0, body.height) / 2;
        const ox = body.offsetX ?? 0, oy = body.offsetY ?? 0;
        // The common convex grid path is axis-aligned. Avoid allocating two points
        // and an expanded rectangle for every edge in a 4096-unit slice.
        if (fastWalkableRegion) {
            for (const r of area.obstacles) {
                const xMin = r.xMin - hw - ox, xMax = r.xMax + hw - ox;
                const yMin = r.yMin - hh - oy, yMax = r.yMax + hh - oy;
                if (fromY === toY) {
                    if (fromY > yMin && fromY < yMax && Math.max(fromX, toX) > xMin && Math.min(fromX, toX) < xMax) return false;
                } else if (fromX > xMin && fromX < xMax && Math.max(fromY, toY) > yMin && Math.min(fromY, toY) < yMax) {
                    return false;
                }
            }
            return true;
        }
        const from = { x: fromX, y: fromY }, to = { x: toX, y: toY };
        for (const r of area.obstacles) {
            if (segmentEntersRect(from, to, { xMin: r.xMin - hw - ox, xMax: r.xMax + hw - ox,
                yMin: r.yMin - hh - oy, yMax: r.yMax + hh - oy })) return false;
        }
        return fastWalkableRegion || this.pointWalkable({ x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 }, body, area);
    }

    private _hasConvexWalkableRegion(area: FlowArea): boolean {
        const polygons = area.walkablePolygons;
        if (!polygons?.length) return true;
        if (polygons.length !== 1 || polygons[0].length < 3) return false;
        let sign = 0;
        const polygon = polygons[0];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length], c = polygon[(i + 2) % polygon.length];
            const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            if (Math.abs(cross) < 0.000001) continue;
            const next = cross > 0 ? 1 : -1;
            if (sign && next !== sign) return false;
            sign = next;
        }
        return sign !== 0;
    }

    private _gridWidth(bounds: FlowBounds): number {
        return Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / this.cellSize));
    }

    private _gridHeight(bounds: FlowBounds): number {
        return Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / this.cellSize));
    }

    private _insideCell(cell: FlowCell, width: number, height: number): boolean {
        return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
    }

    private _index(x: number, y: number, width: number): number {
        return y * width + x;
    }

    private _bodyKey(body: FlowBody): string {
        return `${body.width}x${body.height}@${body.offsetX ?? 0},${body.offsetY ?? 0}`;
    }

    private _dirTo(
        fieldId: string,
        from: FlowPoint,
        to: FlowPoint,
        blocked: boolean,
    ): FlowDirectionResult {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            return this._emptyResult(fieldId, to, blocked, true);
        }
        return {
            x: dx / dist,
            y: dy / dist,
            waypoint: { x: to.x, y: to.y },
            fieldId,
            reached: false,
            blocked,
        };
    }

    private _emptyResult(
        fieldId: string,
        waypoint: FlowPoint,
        blocked: boolean,
        reached = false,
    ): FlowDirectionResult {
        return { x: 0, y: 0, waypoint: { x: waypoint.x, y: waypoint.y }, fieldId, blocked, reached };
    }

    reachability(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): FlowReachability {
        if (this.lineClear(from, target, body, area)) return 'reachable';
        const starts = this._attachments(from, body, area);
        const ends = this._attachments(target, body, area);
        if (!starts.length || !ends.length) return 'unreachable';
        const graph = this._graphFor(body, area);
        if (!graph) return 'pending';
        return starts.some(s => ends.some(t => {
            const label = graph.labels[this._index(s.x, s.y, graph.width)];
            return label >= 0 && label === graph.labels[this._index(t.x, t.y, graph.width)];
        })) ? 'reachable' : 'unreachable';
    }

    canReach(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        return this.reachability(from, target, body, area) === 'reachable';
    }

    // A pending result is never cached: callers must retry the same current-revision key after the graph settles.
    sharedQueryState<T>(from: FlowPoint, body: FlowBody, area: FlowArea, condition: string,
        compute: () => FlowQueryResult<T>): FlowQueryResult<T | undefined> {
        const starts = this._attachments(from, body, area);
        if (!starts.length) return { readiness: 'settled', value: undefined };
        const graph = this._graphFor(body, area);
        if (!graph) return { readiness: 'pending' };
        const labels = Array.from(new Set(starts.map(c => graph.labels[this._index(c.x, c.y, graph.width)])))
            .filter(l => l >= 0).sort((a,b) => a-b);
        if (!labels.length) return { readiness: 'settled', value: undefined };
        const id = `${graph.id}:query:${labels.join(',')}:${condition}`;
        const old = this._queries.get(id);
        if (old) { old.stamp = ++this._stamp; return { readiness: 'settled', value: old.value as T }; }
        const result = compute();
        if (result.readiness === 'pending') return result;
        const value = result.value;
        const bytes = id.length * 2 + 256;
        if (bytes <= this._budget.bytes && this._budget.entries > 0) {
            if (this._makeRoom(bytes)) {
                this._queries.set(id, { id, value, stamp: ++this._stamp }); this._recordPeak();
            }
        }
        return result;
    }

    // Compatibility helper for non-diagnostic callers. It intentionally maps only pending to undefined.
    sharedQuery<T>(from: FlowPoint, body: FlowBody, area: FlowArea, condition: string, compute: () => T): T | undefined {
        const result = this.sharedQueryState(from, body, area, condition,
            () => ({ readiness: 'settled', value: compute() }));
        return result.readiness === 'settled' ? result.value : undefined;
    }

    private _canReach(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        return this.reachability(from, target, body, area) === 'reachable';
    }

    private _areaIds = new WeakMap<FlowArea, number>();
    private _areaKeys = new WeakMap<FlowArea, { version: number; key: string }>();
    private _nextAreaId = 0;
    private _areaKey(area: FlowArea): string {
        if (area.diagnosticOf) return `${this._areaKey(area.diagnosticOf)}:ignore:${area.diagnosticOf.obstacles.indexOf(area.ignoredObstacle!)}`;
        const cached = this._areaKeys.get(area);
        if (cached?.version === area.obstacleVersion) return cached.key;
        if (!this._areaIds.has(area)) this._areaIds.set(area, ++this._nextAreaId);
        const key = `${this._areaIds.get(area)}:${area.obstacleVersion}:${JSON.stringify([area.bounds, area.walkablePolygons])}`;
        this._areaKeys.set(area, { version: area.obstacleVersion, key });
        return key;
    }

    private _attachments(point: FlowPoint, body: FlowBody, area: FlowArea): FlowCell[] {
        if (!this.pointWalkable(point, body, area)) return [];
        const center = this.worldToCell(point, area.bounds);
        const cells: FlowCell[] = [];
        const width = this._gridWidth(area.bounds), height = this._gridHeight(area.bounds);
        for (let x = center.x - 1; x <= center.x + 1; x++) {
            for (let y = center.y - 1; y <= center.y + 1; y++) {
                const c = { x, y };
                if (this._insideCell(c, width, height) && this.lineClear(point, this.cellToWorld(c, area.bounds), body, area)) cells.push(c);
            }
        }
        return cells;
    }

    // Requests only enqueue work. EnemyNavigation advances this queue once per frame.
    advanceJobs(maxWork: number): number {
        const allowance = Math.max(0, Math.floor(maxWork));
        let used = 0;
        if (allowance > 0 && this._jobOrder.length) this.debugJobStats.slices++;
        while (used < allowance && this._jobOrder.length) {
            if (this._jobCursor >= this._jobOrder.length) this._jobCursor = 0;
            const key = this._jobOrder[this._jobCursor];
            const job = this._jobs.get(key);
            if (!job) {
                this._jobOrder.splice(this._jobCursor, 1);
                continue;
            }
            const finished = job.kind === 'graph' ? this._advanceGraph(job) : this._advanceField(job);
            used++;
            if (finished) {
                this._jobs.delete(key);
                this._jobOrder.splice(this._jobCursor, 1);
                this.debugJobStats.completed++;
            } else {
                this._jobCursor = (this._jobCursor + 1) % this._jobOrder.length;
            }
        }
        this.debugJobStats.lastSliceWork = used;
        this.debugJobStats.totalWork += used;
        this._recordPeak();
        return used;
    }

    private _graphFor(body: FlowBody, area: FlowArea): Connectivity | null {
        const id = `${this._bodyKey(body)}:${this._areaKey(area)}`;
        const old = this._graphs.get(id);
        if (old) { old.stamp = ++this._stamp; this.debugStats.hits++; return old; }
        this._enqueueGraph(id, body, area);
        return null;
    }

    private _enqueueGraph(id: string, body: FlowBody, area: FlowArea): void {
        const key = `graph:${id}`;
        if (this._jobs.has(key)) {
            this.debugJobStats.coalesced++;
            return;
        }
        const width = this._gridWidth(area.bounds), height = this._gridHeight(area.bounds);
        const count = width * height;
        // Admission includes private occupancy, edge and component queue arrays.
        const bytes = count * 9 + id.length * 2 + 128;
        if (count > this._budget.cells || bytes > this._budget.bytes || this._budget.entries < 1 ||
            !this._makeRoom(bytes, key)) {
            this.debugJobStats.refused++;
            return;
        }
        this.debugStats.misses++;
        const snapshot = this._snapshotArea(area);
        this._jobs.set(key, { kind: 'graph', id, body: { ...body }, area: snapshot, width, height,
            labels: new Int32Array(count), edges: new Uint8Array(count), queue: new Int32Array(count),
            phase: 'occupancy', cursor: 0, component: 0, read: 0, end: 0, stamp: ++this._stamp,
            fastWalkableRegion: this._hasConvexWalkableRegion(snapshot) });
        this._jobOrder.push(key);
        this.debugJobStats.queued++;
    }

    private _enqueueField(id: string, target: FlowPoint, targetCell: FlowCell, body: FlowBody, area: FlowArea,
        width: number, height: number): void {
        const key = `field:${id}`;
        if (this._jobs.has(key)) {
            this.debugJobStats.coalesced++;
            return;
        }
        const count = width * height;
        // Occupancy, edges and BFS are private to this field until the complete distance array publishes.
        const bytes = count * 10 + id.length * 2 + 128;
        if (count > this._budget.cells || bytes > this._budget.bytes || !this._makeRoom(bytes, key)) {
            this.debugJobStats.refused++;
            return;
        }
        const snapshot = this._snapshotArea(area);
        this._jobs.set(key, { kind: 'field', id, body: { ...body }, area: snapshot,
            target: { ...target }, targetCell: { ...targetCell }, width, height,
            distances: new Int32Array(count), walkable: new Uint8Array(count), edges: new Uint8Array(count),
            queue: new Int32Array(count), phase: 'occupancy', cursor: 0,
            read: 0, end: 0, stamp: ++this._stamp, fastWalkableRegion: this._hasConvexWalkableRegion(snapshot) });
        this._jobOrder.push(key);
        this.debugJobStats.queued++;
    }

    private _advanceGraph(job: GraphJob): boolean {
        const count = job.width * job.height;
        if (job.phase === 'occupancy') {
            const i = job.cursor++;
            const cell = { x: i % job.width, y: Math.floor(i / job.width) };
            job.labels[i] = this.pointWalkable(this.cellToWorld(cell, job.area.bounds), job.body, job.area) ? -1 : -2;
            if (job.cursor < count) return false;
            job.phase = 'edges'; job.cursor = 0;
            return false;
        }
        if (job.phase === 'edges') {
            const i = job.cursor++;
            if (job.labels[i] !== -2) {
                const cell = { x: i % job.width, y: Math.floor(i / job.width) };
                for (const edge of [0, 2]) {
                    const [dx, dy] = ORTHO[edge]; const next = { x: cell.x + dx, y: cell.y + dy };
                    if (!this._insideCell(next, job.width, job.height)) continue;
                    const ni = this._index(next.x, next.y, job.width);
                    const x = job.area.bounds.minX + (cell.x + 0.5) * this.cellSize;
                    const y = job.area.bounds.minY + (cell.y + 0.5) * this.cellSize;
                    const nx = job.area.bounds.minX + (next.x + 0.5) * this.cellSize;
                    const ny = job.area.bounds.minY + (next.y + 0.5) * this.cellSize;
                    if (job.labels[ni] === -2 || !this._gridEdgeClear(x, y, nx, ny, job.body, job.area,
                        job.fastWalkableRegion)) continue;
                    job.edges[i] |= 1 << edge; job.edges[ni] |= 1 << (edge + 1);
                }
            }
            if (job.cursor < count) return false;
            job.phase = 'components'; job.cursor = 0;
            return false;
        }
        if (job.read < job.end) {
            const i = job.queue[job.read++]; this.debugStats.visitedCells++;
            for (let edge = 0; edge < ORTHO.length; edge++) {
                if (!(job.edges[i] & (1 << edge))) continue;
                const next = i + ORTHO[edge][0] + ORTHO[edge][1] * job.width;
                if (job.labels[next] !== -1) continue;
                job.labels[next] = job.component; job.queue[job.end++] = next;
            }
            return false;
        }
        if (job.end > 0) {
            // The completed queue owns one component label. Advance only before
            // seeding the next disconnected component.
            job.component++;
            job.read = 0;
            job.end = 0;
        }
        if (job.cursor < count) {
            if (job.labels[job.cursor] !== -1) {
                job.cursor++;
                return false;
            }
            // Keep one label for the whole queue. Incrementing here made the seed differ
            // from its neighbours and let the next seed alias the previous component.
            job.queue[0] = job.cursor; job.labels[job.cursor] = job.component; job.cursor++; job.read = 0; job.end = 1;
            return false;
        }
        this._graphs.set(job.id, { id: job.id, width: job.width, height: job.height, labels: job.labels,
            edges: job.edges, stamp: ++this._stamp });
        this._graphBuildCount++;
        return true;
    }

    private _advanceField(job: FieldJob): boolean {
        const count = job.width * job.height;
        if (job.phase === 'occupancy') {
            const i = job.cursor++;
            const cell = { x: i % job.width, y: Math.floor(i / job.width) };
            job.walkable[i] = this.pointWalkable(this.cellToWorld(cell, job.area.bounds), job.body, job.area) ? 1 : 0;
            job.distances[i] = -1;
            if (job.cursor < count) return false;
            job.phase = 'edges'; job.cursor = 0;
            return false;
        }
        if (job.phase === 'edges') {
            const i = job.cursor++;
            if (job.walkable[i]) {
                const cell = { x: i % job.width, y: Math.floor(i / job.width) };
                for (const edge of [0, 2]) {
                    const [dx, dy] = ORTHO[edge];
                    const next = { x: cell.x + dx, y: cell.y + dy };
                    if (!this._insideCell(next, job.width, job.height)) continue;
                    const ni = this._index(next.x, next.y, job.width);
                    const x = job.area.bounds.minX + (cell.x + 0.5) * this.cellSize;
                    const y = job.area.bounds.minY + (cell.y + 0.5) * this.cellSize;
                    const nx = job.area.bounds.minX + (next.x + 0.5) * this.cellSize;
                    const ny = job.area.bounds.minY + (next.y + 0.5) * this.cellSize;
                    if (!job.walkable[ni] || !this._gridEdgeClear(x, y, nx, ny, job.body, job.area,
                        job.fastWalkableRegion)) continue;
                    job.edges[i] |= 1 << edge; job.edges[ni] |= 1 << (edge + 1);
                }
            }
            if (job.cursor < count) return false;
            if (!this._insideCell(job.targetCell, job.width, job.height)) return true;
            const start = this._index(job.targetCell.x, job.targetCell.y, job.width);
            if (!job.walkable[start]) return true;
            job.distances[start] = 0; job.queue[0] = start; job.read = 0; job.end = 1; job.phase = 'bfs';
            return false;
        }
        if (job.read < job.end) {
            const i = job.queue[job.read++];
            const base = job.distances[i];
            for (let edge = 0; edge < ORTHO.length; edge++) {
                if (!(job.edges[i] & (1 << edge))) continue;
                const next = i + ORTHO[edge][0] + ORTHO[edge][1] * job.width;
                if (job.distances[next] >= 0) continue;
                job.distances[next] = base + 1; job.queue[job.end++] = next;
            }
            return false;
        }
        this._cache.set(job.id, { id: job.id, targetCell: job.targetCell, distances: job.distances,
            width: job.width, height: job.height, stamp: ++this._stamp, refs: 0 });
        this._buildCount++;
        return true;
    }

    private _snapshotArea(area: FlowArea): FlowArea {
        return { bounds: { ...area.bounds }, obstacles: area.obstacles.map(r => ({ ...r })), obstacleVersion: area.obstacleVersion,
            walkablePolygons: area.walkablePolygons?.map(poly => poly.map(p => ({ ...p }))),
            diagnosticOf: area.diagnosticOf ? this._snapshotArea(area.diagnosticOf) : undefined,
            ignoredObstacle: area.ignoredObstacle ? { ...area.ignoredObstacle } : undefined };
    }

    private _makeRoom(bytes: number, preserve = ''): boolean {
        if (bytes > this._budget.bytes || this._budget.entries < 1) return false;
        while (this.debugEntries && (this.debugEntries >= this._budget.entries || this.debugBytes + bytes > this._budget.bytes)) {
            let key = '', stamp = Infinity, kind = 0;
            for (const [id, f] of this._cache) if (f.stamp < stamp) { key = id; stamp = f.stamp; kind = 0; }
            for (const [id, g] of this._graphs) if (g.stamp < stamp) { key = id; stamp = g.stamp; kind = 1; }
            for (const [id, a] of this._approaches) if (a.stamp < stamp) { key = id; stamp = a.stamp; kind = 2; }
            for (const [id, q] of this._queries) if (q.stamp < stamp) { key = id; stamp = q.stamp; kind = 3; }
            for (const [id, job] of this._jobs) if (id !== preserve && job.stamp < stamp) { key = id; stamp = job.stamp; kind = 4; }
            if (!key) return false;
            // Unit references are identifiers, not array ownership. Eviction forces a fresh query.
            if (kind === 1) this._graphs.delete(key); else if (kind === 2) this._approaches.delete(key);
            else if (kind === 3) this._queries.delete(key); else if (kind === 4) {
                this._jobs.delete(key);
                const index = this._jobOrder.indexOf(key);
                if (index >= 0) this._jobOrder.splice(index, 1);
                this.debugJobStats.cancelled++;
            } else this._cache.delete(key);
        }
        return true;
    }

    private _recordPeak(): void {
        this.debugStats.peakBytes = Math.max(this.debugStats.peakBytes, this.debugBytes);
        this.debugStats.peakEntries = Math.max(this.debugStats.peakEntries, this.debugEntries);
    }

    private _approachLineBlockedOnlyNearTarget(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
    ): boolean {
        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const allowedBlockDistance = this.cellSize * 1.5 + Math.max(body.width, body.height) * 0.5;
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.5)));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const p = { x: from.x + dx * t, y: from.y + dy * t };
            if (this.pointWalkable(p, body, area)) {
                continue;
            }
            const px = target.x - p.x;
            const py = target.y - p.y;
            return Math.sqrt(px * px + py * py) <= allowedBlockDistance;
        }
        return true;
    }
}

function segmentEntersRect(a: FlowPoint, b: FlowPoint, r: FlowRect): boolean {
    let low = 0, high = 1;
    for (const [start, end, min, max] of [[a.x, b.x, r.xMin, r.xMax], [a.y, b.y, r.yMin, r.yMax]]) {
        const d = end - start;
        if (d === 0) { if (start <= min || start >= max) return false; continue; }
        const t1 = (min - start) / d, t2 = (max - start) / d;
        low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
        if (low >= high) return false;
    }
    return low < high;
}
