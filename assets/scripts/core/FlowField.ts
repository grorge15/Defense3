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
    castlePolygon?: FlowPoint[];
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
    private _graphBuildCount = 0;
    readonly debugStats = { visitedCells: 0, candidates: 0, hits: 0, misses: 0, peakBytes: 0, peakEntries: 0,
        lineChecks: 0, pointChecks: 0, approachHits: 0 };
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
        return bytes;
    }
    get debugEntries(): number { return this._cache.size + this._graphs.size + this._approaches.size + this._queries.size; }

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
        this._cache.clear();
        this._graphs.clear();
        this._approaches.clear();
        this._queries.clear();
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
        if (!this._canReach(from, target, body, area)) return this._emptyResult('', from, true);
        const field = this._fieldFor(target, body, area);
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
        if (!this._segmentRegionAllowed(from, to, area, body)) {
            return false;
        }
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
    ): FlowPoint | null {
        if (!this.pointWalkable(from, body, area)) return null;
        if (this.lineClear(from, target, body, area)) return target;
        const starts = this._attachments(from, body, area);
        if (!starts.length) return null;
        const graph = this._graphFor(body, area);
        if (!graph) return null;
        const labels = new Set(starts.map(c => graph.labels[this._index(c.x, c.y, graph.width)]).filter(label => label >= 0));
        const key = `${graph.id}:${Array.from(labels).sort((a,b) => a-b).join(',')}:${target.x},${target.y}:${maxRadiusCells}`;
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
                        !this._approachLineBlockedOnlyNearTarget(point, target, body, area)
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

    segmentUsesOpenPortal(
        from: FlowPoint,
        to: FlowPoint,
        area: FlowArea,
        body: FlowBody,
    ): boolean {
        for (const portal of area.portals ?? []) {
            if (!portal.open || portal.width < Math.max(body.width, body.height)) {
                continue;
            }
            if (segmentsIntersect(from, to, portal.a, portal.b)) {
                return true;
            }
        }
        return false;
    }

    private _fieldFor(target: FlowPoint, body: FlowBody, area: FlowArea): Field {
        const id = this.fieldIdFor(target, body, area);
        const cached = this._cache.get(id);
        if (cached) {
            this.debugStats.hits++;
            return cached;
        }
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        const distances = new Int32Array(width * height);
        distances.fill(-1);
        const targetPoint = this.nearestWalkable(target, body, area) ?? target;
        const targetCell = this._attachments(targetPoint, body, area).sort((a, b) => {
            const p = this.cellToWorld(a, area.bounds), q = this.cellToWorld(b, area.bounds);
            return Math.hypot(p.x - targetPoint.x, p.y - targetPoint.y) - Math.hypot(q.x - targetPoint.x, q.y - targetPoint.y);
        })[0] ?? this.worldToCell(targetPoint, area.bounds);
        const field: Field = {
            id,
            targetCell,
            distances,
            width,
            height,
            stamp: this._stamp,
            refs: 0,
        };
        this._bfs(field, body, area);
        this._makeRoom(distances.byteLength + id.length * 2 + 128);
        this._cache.set(id, field);
        this._buildCount += 1;
        this._recordPeak();
        return field;
    }

    private _bfs(field: Field, body: FlowBody, area: FlowArea): void {
        const graph = this._graphFor(body, area);
        if (!graph) return;
        const queue = new Int32Array(field.width * field.height);
        if (!this._insideCell(field.targetCell, field.width, field.height)) {
            return;
        }
        const targetPoint = this.cellToWorld(field.targetCell, area.bounds);
        if (!this.pointWalkable(targetPoint, body, area)) {
            return;
        }
        let read = 0;
        let end = 1;
        field.distances[this._index(field.targetCell.x, field.targetCell.y, field.width)] = 0;
        queue[0] = this._index(field.targetCell.x, field.targetCell.y, field.width);
        while (read < end) {
            const x = queue[read] % field.width;
            const y = Math.floor(queue[read] / field.width);
            read += 1;
            const baseDist = field.distances[this._index(x, y, field.width)];
            for (let edge = 0; edge < ORTHO.length; edge++) {
                if (!(graph.edges[this._index(x, y, field.width)] & (1 << edge))) continue;
                const [ox, oy] = ORTHO[edge];
                const nx = x + ox;
                const ny = y + oy;
                if (!this._insideCell({ x: nx, y: ny }, field.width, field.height)) {
                    continue;
                }
                const idx = this._index(nx, ny, field.width);
                if (field.distances[idx] >= 0) {
                    continue;
                }
                const p = this.cellToWorld({ x: nx, y: ny }, area.bounds);
                if (!this.pointWalkable(p, body, area)) {
                    continue;
                }
                const cur = this.cellToWorld({ x, y }, area.bounds);
                if (!this._segmentRegionAllowed(cur, p, area, body)) {
                    continue;
                }
                field.distances[idx] = baseDist + 1;
                queue[end++] = idx;
            }
        }
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

    private _segmentRegionAllowed(
        from: FlowPoint,
        to: FlowPoint,
        area: FlowArea,
        body: FlowBody,
    ): boolean {
        const poly = area.castlePolygon;
        if (!poly || poly.length < 3) {
            return true;
        }
        const fromInside = this.pointInPolygon(from, poly);
        const toInside = this.pointInPolygon(to, poly);
        const crossings = segmentPolygonCrossings(from, to, poly);
        if (fromInside === toInside && crossings.length === 0) {
            return true;
        }
        if (crossings.length === 0) {
            return true;
        }
        for (const crossing of crossings) {
            if (!this._pointCoveredByOpenPortal(crossing, area, body)) {
                return false;
            }
        }
        return true;
    }

    private _pointCoveredByOpenPortal(point: FlowPoint, area: FlowArea, body: FlowBody): boolean {
        for (const portal of area.portals ?? []) {
            if (!portal.open || portal.width < Math.max(body.width, body.height)) {
                continue;
            }
            const tolerance = Math.max(this.cellSize * 0.25, portal.width * 0.5);
            if (distancePointToSegment(point, portal.a, portal.b) <= tolerance) {
                return true;
            }
        }
        return false;
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

    canReach(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        return this._canReach(from, target, body, area);
    }

    // Small fixed-shape query results share graph/field admission and LRU, including null results.
    sharedQuery<T>(from: FlowPoint, body: FlowBody, area: FlowArea, condition: string, compute: () => T): T {
        const starts = this._attachments(from, body, area);
        if (!starts.length) return compute();
        const graph = this._graphFor(body, area);
        if (!graph) return compute();
        const labels = Array.from(new Set(starts.map(c => graph.labels[this._index(c.x, c.y, graph.width)])))
            .filter(l => l >= 0).sort((a,b) => a-b);
        if (!labels.length) return compute();
        const id = `${graph.id}:query:${labels.join(',')}:${condition}`;
        const old = this._queries.get(id);
        if (old) { old.stamp = ++this._stamp; return old.value as T; }
        const value = compute();
        const bytes = id.length * 2 + 256;
        if (bytes <= this._budget.bytes && this._budget.entries > 0) {
            this._makeRoom(bytes); this._queries.set(id, { id, value, stamp: ++this._stamp }); this._recordPeak();
        }
        return value;
    }

    private _canReach(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        if (this.lineClear(from, target, body, area)) return true;
        const starts = this._attachments(from, body, area);
        const ends = this._attachments(target, body, area);
        if (!starts.length || !ends.length) return false;
        const graph = this._graphFor(body, area);
        if (!graph) return false;
        return starts.some(s => ends.some(t => {
            const label = graph.labels[this._index(s.x, s.y, graph.width)];
            return label >= 0 && label === graph.labels[this._index(t.x, t.y, graph.width)];
        }));
    }

    private _areaIds = new WeakMap<FlowArea, number>();
    private _areaKeys = new WeakMap<FlowArea, { version: number; key: string }>();
    private _nextAreaId = 0;
    private _areaKey(area: FlowArea): string {
        if (area.diagnosticOf) return `${this._areaKey(area.diagnosticOf)}:ignore:${area.diagnosticOf.obstacles.indexOf(area.ignoredObstacle!)}`;
        const cached = this._areaKeys.get(area);
        if (cached?.version === area.obstacleVersion) return cached.key;
        if (!this._areaIds.has(area)) this._areaIds.set(area, ++this._nextAreaId);
        const key = `${this._areaIds.get(area)}:${area.obstacleVersion}:${JSON.stringify([area.bounds, area.walkablePolygons, area.castlePolygon, area.portals])}`;
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

    private _graphFor(body: FlowBody, area: FlowArea): Connectivity | null {
        const id = `${this._bodyKey(body)}:${this._areaKey(area)}`;
        const old = this._graphs.get(id);
        if (old) { old.stamp = ++this._stamp; this.debugStats.hits++; return old; }
        const width = this._gridWidth(area.bounds), height = this._gridHeight(area.bounds);
        const count = width * height;
        // Admission bounds both persistent arrays and the temporary flood queue.
        if (count > this._budget.cells || count * 13 + id.length * 2 + 128 > this._budget.bytes || this._budget.entries < 2) return null;
        this.debugStats.misses++;
        const labels = new Int32Array(count); labels.fill(-1);
        const edges = new Uint8Array(count);
        const queue = new Int32Array(count);
        for (let i = 0; i < count; i++) {
            const c = { x: i % width, y: Math.floor(i / width) };
            if (!this.pointWalkable(this.cellToWorld(c, area.bounds), body, area)) labels[i] = -2;
        }
        for (let i = 0; i < count; i++) {
            if (labels[i] === -2) continue;
            const c = { x: i % width, y: Math.floor(i / width) };
            for (const e of [0, 2]) {
                const [dx, dy] = ORTHO[e]; const n = { x: c.x + dx, y: c.y + dy };
                const j = this._index(n.x, n.y, width);
                if (!this._insideCell(n, width, height) || labels[j] === -2) continue;
                if (!this.lineClear(this.cellToWorld(c, area.bounds), this.cellToWorld(n, area.bounds), body, area)) continue;
                edges[i] |= 1 << e; edges[j] |= 1 << (e + 1);
            }
        }
        let component = 0;
        for (let i = 0; i < count; i++) {
            if (labels[i] !== -1) continue;
            let read = 0, end = 1; queue[0] = i; labels[i] = component;
            while (read < end) {
                const j = queue[read++]; this.debugStats.visitedCells++;
                for (let e = 0; e < 4; e++) {
                    if (!(edges[j] & (1 << e))) continue;
                    const k = j + ORTHO[e][0] + ORTHO[e][1] * width;
                    if (labels[k] !== -1) continue;
                    labels[k] = component; queue[end++] = k;
                }
            }
            component++;
        }
        const graph = { id, width, height, labels, edges, stamp: ++this._stamp };
        this._makeRoom(count * 5 + id.length * 2 + 128);
        this._graphs.set(id, graph); this._graphBuildCount++; this._recordPeak();
        return graph;
    }

    private _makeRoom(bytes: number): void {
        while (this.debugEntries && (this.debugEntries >= this._budget.entries || this.debugBytes + bytes > this._budget.bytes)) {
            let key = '', stamp = Infinity, kind = 0;
            for (const [id, f] of this._cache) if (f.stamp < stamp) { key = id; stamp = f.stamp; kind = 0; }
            for (const [id, g] of this._graphs) if (g.stamp < stamp) { key = id; stamp = g.stamp; kind = 1; }
            for (const [id, a] of this._approaches) if (a.stamp < stamp) { key = id; stamp = a.stamp; kind = 2; }
            for (const [id, q] of this._queries) if (q.stamp < stamp) { key = id; stamp = q.stamp; kind = 3; }
            // Unit references are identifiers, not array ownership. Eviction forces a fresh query.
            if (kind === 1) this._graphs.delete(key); else if (kind === 2) this._approaches.delete(key);
            else if (kind === 3) this._queries.delete(key); else this._cache.delete(key);
        }
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
        if (!this._segmentRegionAllowed(from, target, area, body)) {
            return false;
        }
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

function segmentsIntersect(a: FlowPoint, b: FlowPoint, c: FlowPoint, d: FlowPoint): boolean {
    const ab1 = orient(a, b, c);
    const ab2 = orient(a, b, d);
    const cd1 = orient(c, d, a);
    const cd2 = orient(c, d, b);
    if (ab1 === 0 && onSegment(a, c, b)) {
        return true;
    }
    if (ab2 === 0 && onSegment(a, d, b)) {
        return true;
    }
    if (cd1 === 0 && onSegment(c, a, d)) {
        return true;
    }
    if (cd2 === 0 && onSegment(c, b, d)) {
        return true;
    }
    return (ab1 > 0) !== (ab2 > 0) && (cd1 > 0) !== (cd2 > 0);
}

function orient(a: FlowPoint, b: FlowPoint, c: FlowPoint): number {
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(v) < 0.000001) {
        return 0;
    }
    return v > 0 ? 1 : -1;
}

function onSegment(a: FlowPoint, p: FlowPoint, b: FlowPoint): boolean {
    return (
        p.x >= Math.min(a.x, b.x) - 0.000001 &&
        p.x <= Math.max(a.x, b.x) + 0.000001 &&
        p.y >= Math.min(a.y, b.y) - 0.000001 &&
        p.y <= Math.max(a.y, b.y) + 0.000001
    );
}

function segmentIntersectsPolygon(a: FlowPoint, b: FlowPoint, polygon: FlowPoint[]): boolean {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (segmentsIntersect(a, b, polygon[j], polygon[i])) {
            return true;
        }
    }
    return false;
}

function segmentPolygonCrossings(a: FlowPoint, b: FlowPoint, polygon: FlowPoint[]): FlowPoint[] {
    const out: FlowPoint[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const hit = segmentIntersectionPoint(a, b, polygon[j], polygon[i]);
        if (!hit) {
            continue;
        }
        if (!out.some((p) => Math.abs(p.x - hit.x) < 0.0001 && Math.abs(p.y - hit.y) < 0.0001)) {
            out.push(hit);
        }
    }
    return out;
}

function segmentIntersectionPoint(
    a: FlowPoint,
    b: FlowPoint,
    c: FlowPoint,
    d: FlowPoint,
): FlowPoint | null {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 0.000001) {
        return segmentsIntersect(a, b, c, d) ? c : null;
    }
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
    if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) {
        return null;
    }
    return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function distancePointToSegment(p: FlowPoint, a: FlowPoint, b: FlowPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.000001) {
        const px = p.x - a.x;
        const py = p.y - a.y;
        return Math.sqrt(px * px + py * py);
    }
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const px = p.x - x;
    const py = p.y - y;
    return Math.sqrt(px * px + py * py);
}
